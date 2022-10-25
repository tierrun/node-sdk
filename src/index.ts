// TODO: use the built-in tier binary for the appropriate platform
// can do the platform-specific optional dep trick.

// TODO: more type checking on inputs and return values
// TODO: handle tier errors in a nice consistent way

import { ChildProcess, spawn } from 'child_process'
import fetch from 'node-fetch'

let sidecarPID: number | undefined
let initting: undefined | Promise<void>
const port = 10000 + (process.pid % 10000)
const debug =
  process.env.TIER_DEBUG === '1' ||
  /\btier\b/i.test(process.env.NODE_DEBUG || '')
const debugLog = debug ? console.error : () => {}

const init = async () => {
  if (sidecarPID || process.env.TIER_SIDECAR) {
    return
  }
  if (initting) {
    return await initting
  }
  initting = new Promise<ChildProcess>((res, rej) => {
    const args = process.env.TIER_LIVE === '1' ? ['--live'] : []
    const env = Object.fromEntries(Object.entries(process.env))
    if (debug) {
      args.push('-v')
      env.STRIPE_DEBUG = '1'
    }
    args.push('serve', '--addr', `127.0.0.1:${port}`)
    debugLog('tier:', args)
    let proc = spawn('tier', args, {
      env,
      stdio: ['ignore', 'pipe', 'inherit'],
    })
    proc.on('error', rej)
    /* c8 ignore start */
    if (!proc || !proc.stdout) {
      return rej(new Error('failed to start tier sidecar'))
    }
    /* c8 ignore stop */
    proc.stdout.on('data', () => res(proc))
  })
    .then(proc => {
      proc.on('close', () => {
        sidecarPID = undefined
        delete process.env.TIER_SIDECAR
        process.removeListener('exit', Tier.exitHandler)
      })
      process.on('exit', Tier.exitHandler)
      proc.unref()
      process.env.TIER_SIDECAR = `http://127.0.0.1:${port}`
      sidecarPID = proc.pid
      initting = undefined
    })
    .catch(er => {
      initting = undefined
      sidecarPID = undefined
      throw er
    })
  return initting
}

/* c8 ignore start */
const exitHandler = (_: number, signal: string | null) => {
  if (sidecarPID) {
    process.kill(sidecarPID, signal || 'SIGTERM')
  }
}
/* c8 ignore stop */

export type OrgName = `org:${string}`
const isOrgName = (o: any): o is OrgName =>
  typeof o === 'string' && o.startsWith('org:')

export type FeatureName = `feature:${string}`
const isFeatureName = (f: any): f is FeatureName =>
  typeof f === 'string' && f.startsWith('feature:')

export interface Usage {
  feature: FeatureName
  used: number
  limit: number
}

// same as Usage, but with strings for dates
export interface Limits {
  org: OrgName
  usage: Usage[]
}

// XXX too clever for older ts versions?
export type PlanName = `plan:${string}@${string}`
export type VersionedFeatureName = `${FeatureName}@${PlanName}`
export type Features = PlanName | VersionedFeatureName

const isPlanName = (p: any): p is PlanName =>
  typeof p === 'string' && /^plan:[^@]+@[^@]+$/.test(p)

const isVersionedFeatureName = (f: any): f is VersionedFeatureName =>
  typeof f === 'string' && /^feature:[^@]+@plan:[^@]+@[^@]+$/.test(f)

const isFeatures = (f: any): f is Features =>
  isPlanName(f) || isVersionedFeatureName(f)

export interface CurrentPhase {
  effective: Date
  features: VersionedFeatureName[]
  plans: PlanName[]
}
interface CurrentPhaseResponse {
  effective: string
  features: VersionedFeatureName[]
  plans: PlanName[]
}

export interface Phase {
  effective?: Date
  features: Features[]
}

const isDate = (d: any): d is Date =>
  d && typeof d === 'object' && d instanceof Date

const isPhase = (p: any): p is Phase =>
  p &&
  typeof p === 'object' &&
  (p.effective === undefined || isDate(p.effective)) &&
  Array.isArray(p.features) &&
  !p.features.some((f: any) => !isFeatures(f))

export interface SubscribeRequest {
  org: OrgName
  phases: Phase[]
}

export interface PhasesResponse {
  org: OrgName
  phases: Phase[]
}

export interface ReportRequest {
  org: OrgName
  feature: FeatureName
  n?: number
  at?: Date
  clobber?: boolean
}

export interface WhoIsResponse {
  org: OrgName
  stripe_id: string
}

const apiGet = async <T>(
  path: string,
  query?: { [k: string]: string | string[] }
): Promise<T> => {
  await Tier.init()
  const base = process.env.TIER_SIDECAR || `http://127.0.0.1:${port}`
  const u = new URL(path, base)
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      /* c8 ignore start */
      if (Array.isArray(v)) {
        for (const value of v) {
          u.searchParams.append(k, value)
        }
        /* c8 ignore stop */
      } else {
        u.searchParams.set(k, v)
      }
    }
  }
  debugLog('tier: GET', u.pathname)
  const res = await fetch(u.toString())
  return (await res.json()) as T
}

const apiPost = async <TReq, TRes>(path: string, body: TReq): Promise<TRes> => {
  await Tier.init()
  const base = process.env.TIER_SIDECAR || `http://127.0.0.1:${port}`
  const u = new URL(path, base)
  const res = await fetch(u.toString(), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  debugLog('tier: POST', u.pathname)
  return (await res.json()) as TRes
}

// actual API methods
async function limits(org: OrgName): Promise<Limits> {
  return await apiGet<Limits>('/v1/limits', { org })
}

async function report(
  org: OrgName,
  feature: FeatureName,
  n: number = 1,
  at?: Date,
  clobber?: boolean
): Promise<void> {
  const req: ReportRequest = {
    org,
    feature,
    n,
  }
  if (at) {
    req.at = at
  }
  req.clobber = !!clobber

  return await apiPost<ReportRequest, void>('/v1/report', req)
}

async function subscribe(org: OrgName, phases: Phase[]): Promise<void>
async function subscribe(
  org: OrgName,
  features: Features | Features[],
  effective?: Date
): Promise<void>
async function subscribe(
  org: OrgName,
  featuresOrPhases: Features | Features[] | Phase[],
  effective?: Date
): Promise<void> {
  const phasesArg =
    Array.isArray(featuresOrPhases) && !featuresOrPhases.some(p => !isPhase(p))
  if (phasesArg && effective) {
    throw new TypeError('effective date should be set in phase objects')
  }
  const phases: Phase[] = phasesArg
    ? (featuresOrPhases as Phase[])
    : !Array.isArray(featuresOrPhases)
    ? [{ features: [featuresOrPhases], effective }]
    : [{ features: featuresOrPhases as unknown as Features[], effective }]

  const sr: SubscribeRequest = { org, phases }
  return await apiPost<SubscribeRequest, void>('/v1/subscribe', sr)
}

async function whois(org: OrgName): Promise<WhoIsResponse> {
  return await apiGet<WhoIsResponse>('/v1/whois', { org })
}

async function phase(org: OrgName): Promise<CurrentPhase> {
  const resp = await apiGet<CurrentPhaseResponse>('/v1/phase', { org })
  return {
    ...resp,
    effective: new Date(resp.effective),
  }
}

const Tier = {
  init,
  exitHandler,
  isOrgName,
  isFeatureName,
  isPlanName,
  isVersionedFeatureName,
  isFeatures,
  isPhase,
  limits,
  report,
  subscribe,
  whois,
  phase,
}

export default Tier
