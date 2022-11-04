// TODO: use the built-in tier binary for the appropriate platform
// can do the platform-specific optional dep trick.

// TODO: more type checking on inputs and return values
// TODO: handle tier errors in a nice consistent way

import { ChildProcess, spawn } from 'child_process'

import type {
  CurrentPhase,
  FeatureName,
  Features,
  Limits,
  Model,
  OrgName,
  Phase,
  PushResponse,
  Usage,
  WhoIsResponse,
} from './client'

// just use node-fetch as a polyfill for old node environments
let fetchPromise: Promise<void> | null = null
let FETCH = global.fetch
if (typeof FETCH !== 'function') {
  fetchPromise = import('node-fetch').then(f => {
    //@ts-ignore
    FETCH = f.default
    fetchPromise = null
  })
}

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
  /* c8 ignore start */
  if (!FETCH) {
    await fetchPromise
    if (!FETCH) {
      throw new Error('could not find a fetch implementation')
    }
  }
  /* c8 ignore stop */

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
        process.removeListener('exit', exitHandler)
      })
      process.on('exit', exitHandler)
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

const getClient = async (): Promise<Tier> => {
  await TIER.init()
  /* c8 ignore start */
  if (typeof process.env.TIER_SIDECAR !== 'string') {
    throw new Error('failed sidecar initialization')
  }
  /* c8 ignore stop */
  return new Tier({
    sidecar: process.env.TIER_SIDECAR as string,
    debug,
    fetchImpl: FETCH,
  })
}

// actual API methods
export async function pull(): Promise<Model> {
  const tier = await getClient()
  return tier.pull()
}

export async function pullLatest(): Promise<Model> {
  const tier = await getClient()
  return tier.pullLatest()
}

export async function limits(org: OrgName): Promise<Limits> {
  const tier = await getClient()
  return tier.limits(org)
}

export async function limit(
  org: OrgName,
  feature: FeatureName
): Promise<Usage> {
  const tier = await getClient()
  return tier.limit(org, feature)
}

export async function report(
  org: OrgName,
  feature: FeatureName,
  n: number = 1,
  at?: Date,
  clobber?: boolean
): Promise<{}> {
  const tier = await getClient()
  return tier.report(org, feature, n, at, clobber)
}

export async function subscribe(
  org: OrgName,
  features: Features | Features[],
  effective?: Date
): Promise<{}> {
  const tier = await getClient()
  return await tier.subscribe(org, features, effective)
}

export async function schedule(
  org: OrgName,
  phases: Phase[]
): Promise<{}> {
  const tier = await getClient()
  return await tier.schedule(org, phases)
}

export async function whois(org: OrgName): Promise<WhoIsResponse> {
  const tier = await getClient()
  return tier.whois(org)
}

export async function phase(org: OrgName): Promise<CurrentPhase> {
  const tier = await getClient()
  return tier.phase(org)
}

export async function push(model: Model): Promise<PushResponse> {
  const tier = await getClient()
  return tier.push(model)
}

import {
  isErrorResponse,
  isFeatureName,
  isFeatures,
  isOrgName,
  isPhase,
  isPlanName,
  isTierError,
  isVersionedFeatureName,
  Tier,
} from './client'

export * from './client'

const TIER = {
  isErrorResponse,
  isFeatureName,
  isFeatures,
  isOrgName,
  isPhase,
  isPlanName,
  isTierError,
  isVersionedFeatureName,
  Tier,
  init,
  exitHandler,

  limit,
  limits,
  phase,
  pull,
  pullLatest,
  push,
  report,
  subscribe,
  schedule,
  whois,
}

export default TIER
