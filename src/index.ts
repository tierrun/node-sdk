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
const debugLog = debug
  ? (...m: any[]) => console.error('tier:', ...m)
  : () => {}

export const init = async () => {
  if (sidecarPID || process.env.TIER_SIDECAR) {
    return
  }
  if (initting) {
    return initting
  }
  initting = new Promise<ChildProcess>((res, rej) => {
    const args = process.env.TIER_LIVE === '1' ? ['--live'] : []
    const env = Object.fromEntries(Object.entries(process.env))
    if (debug) {
      args.push('-v')
      env.STRIPE_DEBUG = '1'
    }
    args.push('serve', '--addr', `127.0.0.1:${port}`)
    debugLog(args)
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
      debugLog('started sidecar', proc.pid)
      proc.on('close', () => {
        debugLog('sidecar closed', sidecarPID)
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
      debugLog('sidecar error', er)
      initting = undefined
      sidecarPID = undefined
      throw er
    })
  return initting
}

/* c8 ignore start */
export const exitHandler = (_: number, signal: string | null) => {
  if (sidecarPID) {
    process.kill(sidecarPID, signal || 'SIGTERM')
  }
}
/* c8 ignore stop */

export type OrgName = `org:${string}`
export const isOrgName = (o: any): o is OrgName =>
  typeof o === 'string' && o.startsWith('org:')

export type FeatureName = `feature:${string}`
export const isFeatureName = (f: any): f is FeatureName =>
  typeof f === 'string' && f.startsWith('feature:')

export interface Model {
  plans: {
    [p: PlanName]: Plan
  }
}
export interface Plan {
  title?: string
  features?: {
    [f: FeatureName]: FeatureDefinition
  }
  currency?: string
  interval?: Interval
}
export type Interval = '@daily' | '@weekly' | '@monthly' | '@yearly'
export interface FeatureDefinition {
  title?: string
  base?: number
  tiers?: FeatureTier[]
  mode?: Mode
}
export type Mode = 'graduated' | 'volume'
export interface FeatureTier {
  upto?: number
  price?: number
  base?: number
}

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

export const isPlanName = (p: any): p is PlanName =>
  typeof p === 'string' && /^plan:[^@]+@[^@]+$/.test(p)

export const isVersionedFeatureName = (f: any): f is VersionedFeatureName =>
  typeof f === 'string' && /^feature:[^@]+@plan:[^@]+@[^@]+$/.test(f)

export const isFeatures = (f: any): f is Features =>
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

export const isPhase = (p: any): p is Phase =>
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
  debugLog('GET', u.pathname)
  const res = await fetch(u.toString())
  return (await res.json()) as T
}

const apiPost = async <TReq>(path: string, body: TReq): Promise<string> => {
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
  debugLog('POST', u.pathname)
  return await res.text()
}

// actual API methods
export async function pull(): Promise<Model> {
  return await apiGet<Model>('/v1/pull')
}

// Same as Tier.pull, but only shows the latest version
// of each plan, sorted lexically.  Experimental!
export async function pullLatest(): Promise<Model> {
  const model = await Tier.pull()
  const plans: {[k:PlanName]:Plan} = Object.create(null)
  const latest: {[k:string]:string} = Object.create(null)
  for (const id of Object.keys(model.plans)) {
    const [name, version] = id.split('@')
    if (!latest[name] || version.localeCompare(latest[name], 'en') > 0) {
      latest[name] = version
    }
  }
  for (const [name, version] of Object.entries(latest)) {
    const id = `${name}@${version}` as PlanName
    plans[id] = model.plans[id]
  }
  return { plans }
}

export async function limits(org: OrgName): Promise<Limits> {
  return await apiGet<Limits>('/v1/limits', { org })
}

export async function limit(org: OrgName, feature: FeatureName): Promise<Usage> {
  const limits = await apiGet<Limits>('/v1/limits', { org })
  for (const usage of limits.usage) {
    if (usage.feature === feature) {
      return usage
    }
  }
  return { feature, used: 0, limit: 0 }
}

export async function report(
  org: OrgName,
  feature: FeatureName,
  n: number = 1,
  at?: Date,
  clobber?: boolean
): Promise<string> {
  const req: ReportRequest = {
    org,
    feature,
    n,
  }
  if (at) {
    req.at = at
  }
  req.clobber = !!clobber

  return await apiPost<ReportRequest>('/v1/report', req)
}

export async function subscribe(org: OrgName, phases: Phase[]): Promise<string>
export async function subscribe(
  org: OrgName,
  features: Features | Features[],
  effective?: Date
): Promise<string>
export async function subscribe(
  org: OrgName,
  featuresOrPhases: Features | Features[] | Phase[],
  effective?: Date
): Promise<string> {
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
  return await apiPost<SubscribeRequest>('/v1/subscribe', sr)
}

export async function whois(org: OrgName): Promise<WhoIsResponse> {
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
  limit,
  report,
  subscribe,
  whois,
  phase,
  pull,
  pullLatest,
}

export default Tier
