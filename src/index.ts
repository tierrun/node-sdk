// TODO: use the built-in tier binary for the appropriate platform
// can do the platform-specific optional dep trick.

// TODO: more type checking on inputs and return values
// TODO: handle tier errors in a nice consistent way

import { ChildProcess, spawn } from 'child_process'

import type {
  Answer,
  CurrentPhase,
  FeatureName,
  Features,
  Limits,
  LookupOrgResponse,
  Model,
  OrgInfo,
  OrgName,
  Phase,
  PushResponse,
  ReportParams,
  ScheduleParams,
  ScheduleResponse,
  SubscribeParams,
  Usage,
  WhoAmIResponse,
  WhoIsResponse,
} from './client.js'

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

export async function lookupLimits(org: OrgName): Promise<Limits> {
  const tier = await getClient()
  return tier.lookupLimits(org)
}

export async function lookupLimit(
  org: OrgName,
  feature: FeatureName
): Promise<Usage> {
  const tier = await getClient()
  return tier.lookupLimit(org, feature)
}

export async function report(
  org: OrgName,
  feature: FeatureName,
  n: number = 1,
  options?: ReportParams
): Promise<{}> {
  const tier = await getClient()
  return await tier.report(org, feature, n, options)
}

export async function can(org: OrgName, feature: FeatureName): Promise<Answer> {
  const tier = await getClient()
  return tier.can(org, feature)
}

export async function subscribe(
  org: OrgName,
  features: Features | Features[],
  { effective, info, trialDays, checkout }: SubscribeParams = {}
): Promise<ScheduleResponse> {
  const tier = await getClient()
  return await tier.subscribe(org, features, {
    effective,
    info,
    trialDays,
    checkout,
  })
}

export async function cancel(org: OrgName): Promise<ScheduleResponse> {
  const tier = await getClient()
  return await tier.cancel(org)
}

export async function schedule(
  org: OrgName,
  phases?: Phase[],
  { info, checkout }: ScheduleParams = {}
): Promise<ScheduleResponse> {
  const tier = await getClient()
  return await tier.schedule(org, phases, { info, checkout })
}

export async function updateOrg(
  org: OrgName,
  info: OrgInfo
): Promise<ScheduleResponse> {
  const tier = await getClient()
  return await tier.updateOrg(org, info)
}

export async function whois(org: OrgName): Promise<WhoIsResponse> {
  const tier = await getClient()
  return tier.whois(org)
}

export async function lookupOrg(org: OrgName): Promise<LookupOrgResponse> {
  const tier = await getClient()
  return tier.lookupOrg(org)
}

export async function whoami(): Promise<WhoAmIResponse> {
  const tier = await getClient()
  return tier.whoami()
}

export async function lookupPhase(org: OrgName): Promise<CurrentPhase> {
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
  isFeatureNameVersioned,
  isFeatures,
  isOrgName,
  isPhase,
  isPlanName,
  isTierError,
  isVersionedFeatureName,
  Tier,
  validateFeatureDefinition,
  validateFeatureTier,
  validateModel,
  validatePlan,
} from './client.js'

export * from './client.js'

/* c8 ignore start */
/**
 * @deprecated alias for lookupLimits
 */
export async function limits(org: OrgName): Promise<Limits> {
  return lookupLimits(org)
}
/**
 * @deprecated alias for lookupLimit
 */
export async function limit(
  org: OrgName,
  feature: FeatureName
): Promise<Usage> {
  return lookupLimit(org, feature)
}
/**
 * @deprecated alias for lookupPhase
 */
export async function phase(org: OrgName): Promise<CurrentPhase> {
  return lookupPhase(org)
}
/* c8 ignore stop */

const TIER = {
  isErrorResponse,
  isFeatureName,
  isFeatures,
  isOrgName,
  isPhase,
  isPlanName,
  isTierError,
  isVersionedFeatureName,
  isFeatureNameVersioned,
  validatePlan,
  validateModel,
  validateFeatureTier,
  validateFeatureDefinition,

  Tier,
  init,
  exitHandler,

  lookupLimit,
  lookupLimits,
  lookupPhase,
  pull,
  pullLatest,
  push,
  report,
  can,
  subscribe,
  schedule,
  cancel,
  updateOrg,
  whois,
  lookupOrg,
  whoami,

  limit,
  limits,
  phase,
}

export default TIER
