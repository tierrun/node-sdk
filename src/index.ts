// TODO: use the built-in tier binary for the appropriate platform
// can do the platform-specific optional dep trick.

import { spawn } from 'child_process'
import fetch from 'node-fetch'

let sidecarPID: number | undefined
let initting: undefined | Promise<string>
const init = async () => {
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

process.on('exit', (_: number, signal: string | null) => {
  if (sidecarPID) {
    process.kill(sidecarPID, signal || 'SIGTERM')
  }
})

export type OrgName = `org:${string}`
export type FeatureName = `feature:${string}`
export interface Usage {
  feature: FeatureName
  start: Date
  end: Date
  used: number
  limit: number
}

export interface Limits {
  org: OrgName
  usage: Usage[]
}

const isFeatureName = (f: any): f is FeatureName =>
  typeof f === 'string' && f.startsWith('feature:')

const toUsage = (u: any): Usage => {
  if (
    !u ||
    typeof u !== 'object' ||
    !isFeatureName(u.feature) ||
    typeof u.used !== 'number' ||
    typeof u.limit !== 'number' ||
    typeof u.start !== 'string' ||
    typeof u.end !== 'string'
  ) {
    throw new TypeError('invalid usage item')
  }
  return {
    ...u,
    start: new Date(u.start),
    end: new Date(u.end),
  }
}

const isOrgName = (o: any): o is OrgName =>
  typeof o === 'string' && o.startsWith('org:')

const toLimits = (u: any): Limits => {
  if (!u || typeof u !== 'object' || !isOrgName(u.org)) {
    throw new TypeError('invalid limits response')
  }
  return {
    ...u,
    usage: u.usage.map((u: any) => toUsage(u)),
  }
}

const apiGet = async (
  path: string,
  query?: { [k: string]: string | string[] }
) => {
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
    const res = await fetch(u.toString())
    return await res.json()
  }
}

export const limits = async (org: OrgName): Promise<Limits> => {
  const limits = await apiGet('/v1/limits', { org })
  try {
    return toLimits(limits)
  } catch (e) {
    throw Object.assign(e as Error, { response: limits })
  }
}
