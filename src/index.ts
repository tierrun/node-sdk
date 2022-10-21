// TODO: use the built-in tier binary for the appropriate platform
// can do the platform-specific optional dep trick.

// TODO: more type checking on inputs and return values
// TODO: handle tier errors in a nice consistent way

// set to a specific tier binary, otherwise just resolve from PATH
const { TIER = 'tier' } = process.env

import { spawn } from 'child_process'
import fetch from 'node-fetch'

let sidecarPID: number | undefined
let initting: undefined | Promise<string>

export const init = async () => {
  if (sidecarPID) {
    return
  }
  if (initting) {
    return await initting
  }
  initting = new Promise((res, rej) => {
    initting = undefined
    const proc = spawn(TIER, ['serve'], {
      stdio: ['ignore', 'pipe', 'inherit'],
    })
    proc.on('error', rej)
    if (!proc || !proc.stdout) {
      return rej(new Error('failed to start tier sidecar'))
    }
    proc.stdout.on('data', c => res(c.toString()))
    proc.on('close', () => (sidecarPID = undefined))
    sidecarPID = proc.pid
    proc.unref()
  })
  return initting
}

export const exitHandler = (_: number, signal: string | null) => {
  if (sidecarPID) {
    process.kill(sidecarPID, signal || 'SIGTERM')
  }
}

process.on('exit', exitHandler)

export type OrgName = `org:${string}`
export const isOrgName = (o: any): o is OrgName =>
  typeof o === 'string' && o.startsWith('org:')

export type FeatureName = `feature:${string}`
export const isFeatureName = (f: any): f is FeatureName =>
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

export const isPlanName = (p: any): p is PlanName =>
  typeof p === 'string' && /^plan:[^@]+@[^@]+$/.test(p)

export const isVersionedFeatureName = (f: any): f is VersionedFeatureName =>
  typeof f === 'string' && /^feature:[^@]+@plan:[^@]+@[^@]+$/.test(f)

export const isFeatures = (f: any): f is Features =>
  isPlanName(f) || isVersionedFeatureName(f)

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
  await init()
  const u = new URL(path, 'http://localhost:8080')
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (Array.isArray(v)) {
        for (const value of v) {
          u.searchParams.append(k, value)
        }
      } else {
        u.searchParams.set(k, v)
      }
    }
  }
  const res = await fetch(u.toString())
  return (await res.json()) as T
}

const apiPost = async <TReq, TRes>(path: string, body: TReq): Promise<TRes> => {
  await init()
  const u = new URL(path, 'http://localhost:8080')
  const res = await fetch(u.toString(), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  return (await res.json()) as TRes
}

// actual API methods
export async function limits(org: OrgName): Promise<Limits> {
  return await apiGet<Limits>('/v1/limits', { org })
}

export async function report(
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

export async function subscribe(org: OrgName, phases: Phase[]): Promise<void>
export async function subscribe(
  org: OrgName,
  features: Features | Features[],
  effective: Date
): Promise<void>
export async function subscribe(
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
    : featuresOrPhases.map(f => ({
        features: f as unknown as Features[],
        effective,
      }))

  const sr: SubscribeRequest = { org, phases }
  return await apiPost<SubscribeRequest, void>('/v1/subscribe', sr)
}

export async function whois(org: OrgName): Promise<WhoIsResponse> {
  return await apiGet<WhoIsResponse>('/v1/whois', { org })
}
