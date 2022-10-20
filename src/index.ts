// TODO: use the built-in tier binary for the appropriate platform
// can do the platform-specific optional dep trick.

// TODO: more type checking on inputs and return values
// TODO: handle tier errors in a nice consistent way

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
    const proc = spawn('tier', ['serve'], {
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

export interface Phase {
  effective: Date
	features: (PlanName | VersionedFeatureName)[]
}

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

const apiGet = async<T> (
  path: string,
  query?: { [k: string]: string | string[] }
):Promise<T> => {
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
  return await res.json() as T
}

const apiPost = async<TReq, TRes> (
  path: string,
  body: TReq
):Promise<TRes>  => {
  await init()
  const u = new URL(path, 'http://localhost:8080')
  const res = await fetch(u.toString(), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  return await res.json() as TRes
}

// actual API methods
export const limits = async (org: OrgName): Promise<Limits> => {
  return await apiGet<Limits>('/v1/limits', { org })
}

export const report = async (req: ReportRequest): Promise<void> => {
  if (req.n === undefined) {
    req.n = 1
  }
  return await apiPost<ReportRequest, void>('/v1/report', req)
}

export const subscribe = async (req: SubscribeRequest): Promise<void> => {
  return await apiPost<SubscribeRequest, void>('/v1/subscribe', req)
}

export const whois = async (org: OrgName): Promise<WhoIsResponse> => {
  return await apiGet<WhoIsResponse>('/v1/whois', { org })
}
