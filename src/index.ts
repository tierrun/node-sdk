// TODO: use the built-in tier binary for the appropriate platform
// can do the platform-specific optional dep trick.

import { ChildProcess, spawn } from 'child_process'

import type {
  Answer,
  CheckoutParams,
  CheckoutResponse,
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

/**
 * Initialize the Tier sidecar.
 *
 * Exported for testing, not necessary to call directly.
 *
 * @internal
 */
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

/**
 * Method to shut down the auto-started sidecar process on
 * exit.  Exported for testing, not to be called directly.
 *
 * @internal
 */
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

/**
 * Pull the full {@link Model} pushed to Tier
 *
 * Convenience wrapper for {@link client.Tier.pull | Tier.pull}
 */
export async function pull(): Promise<Model> {
  const tier = await getClient()
  return tier.pull()
}

/**
 * Similar to {@link client.Tier.pull}, but filters plans to only include
 * the highest version of each plan.  Plan versions are sorted numerically
 * if they are decimal integers, or lexically in the `en` locale otherwise.
 *
 * So, for example, the plan version `20test` will be considered "lower"
 * than `9test`, because the non-numeric string causes it to be lexically
 * sorted.  But the plan version `20` sill be considered "higher" than the
 * plan version `9`, because both are strictly numeric.
 *
 * Convenience wrapper for {@link client.Tier.pullLatest | Tier.pullLatest}
 */
export async function pullLatest(): Promise<Model> {
  const tier = await getClient()
  return tier.pullLatest()
}

/**
 * Look up the limits for all features for a given {@link OrgName}
 *
 * Convenience wrapper for {@link client.Tier.lookupLimits | Tier.lookupLimits}
 */
export async function lookupLimits(org: OrgName): Promise<Limits> {
  const tier = await getClient()
  return tier.lookupLimits(org)
}

/**
 * Look up limits for a given {@link FeatureName} and {@link OrgName}
 *
 * Convenience wrapper for {@link client.Tier.lookupLimit | Tier.lookupLimit}
 */
export async function lookupLimit(
  org: OrgName,
  feature: FeatureName
): Promise<Usage> {
  const tier = await getClient()
  return tier.lookupLimit(org, feature)
}

/**
 * Report metered feature usage
 *
 * Convenience wrapper for {@link client.Tier.report | Tier.report}
 */
export async function report(
  org: OrgName,
  feature: FeatureName,
  n: number = 1,
  options?: ReportParams
): Promise<{}> {
  const tier = await getClient()
  return await tier.report(org, feature, n, options)
}

/**
 * Return an {@link Answer} indicating whether an org can
 * access a feature, or if they are at their plan limit.
 *
 * Convenience wrapper for {@link client.Tier.can | Tier.can}
 */
export async function can(org: OrgName, feature: FeatureName): Promise<Answer> {
  const tier = await getClient()
  return tier.can(org, feature)
}

/**
 * Generate a checkout URL to set an org's payment info, and optionally
 * to create a subscription on completion.
 *
 * `successUrl` param should be a URL within your application where the
 * user will be redirected upon completion.
 *
 * Convenience wrapper for {@link client.Tier.checkout | Tier.checkout}
 */
export async function checkout(
  org: OrgName,
  successUrl: string,
  { cancelUrl, features, trialDays }: CheckoutParams = {}
): Promise<CheckoutResponse> {
  const tier = await getClient()
  return await tier.checkout(org, successUrl, {
    cancelUrl,
    features,
    trialDays,
  })
}

/**
 * Simple interface for creating a new phase in the org's subscription
 * schedule.
 *
 * Setting `trialDays` will cause it to prepend a "trial" phase on the
 * effective date, and delay the creation of the actual non-trial
 * subscription phase by the specified number of days.
 *
 * Convenience wrapper for {@link client.Tier.subscribe | Tier.subscribe}
 */
export async function subscribe(
  org: OrgName,
  features: Features | Features[],
  { effective, info, trialDays }: SubscribeParams = {}
): Promise<ScheduleResponse> {
  const tier = await getClient()
  return await tier.subscribe(org, features, {
    effective,
    info,
    trialDays,
  })
}

/**
 * Cancel an org's subscriptions
 *
 * Convenience wrapper for {@link client.Tier.cancel | Tier.cancel}
 */
export async function cancel(org: OrgName): Promise<ScheduleResponse> {
  const tier = await getClient()
  return await tier.cancel(org)
}

/**
 * Advanced interface for creating arbitrary schedule phases in any
 * order.
 *
 * Convenience wrapper for {@link client.Tier.schedule | Tier.schedule}
 */
export async function schedule(
  org: OrgName,
  phases?: Phase[],
  { info }: ScheduleParams = {}
): Promise<ScheduleResponse> {
  const tier = await getClient()
  return await tier.schedule(org, phases, { info })
}

/**
 * Update an org's metadata. Note that any fields not set (other than
 * `metadata`) will be reset to empty `''` values on any update.
 *
 * Convenience wrapper for {@link client.Tier.updateOrg | Tier.updateOrg}
 */
export async function updateOrg(
  org: OrgName,
  info: OrgInfo
): Promise<ScheduleResponse> {
  const tier = await getClient()
  return await tier.updateOrg(org, info)
}

/**
 * Get an org's billing provider identifier
 *
 * Convenience wrapper for {@link client.Tier.whois | Tier.whois}
 */
export async function whois(org: OrgName): Promise<WhoIsResponse> {
  const tier = await getClient()
  return tier.whois(org)
}

/**
 * Look up all {@link OrgInfo} metadata about an org
 *
 * Convenience wrapper for {@link client.Tier.lookupOrg | Tier.lookupOrg}
 */
export async function lookupOrg(org: OrgName): Promise<LookupOrgResponse> {
  const tier = await getClient()
  return tier.lookupOrg(org)
}

/**
 * Get information about the current sidecare API in use
 *
 * Convenience wrapper for {@link client.Tier.whoami | Tier.whoami}
 */
export async function whoami(): Promise<WhoAmIResponse> {
  const tier = await getClient()
  return tier.whoami()
}

/**
 * Fetch the current phase for an org
 *
 * Convenience wrapper for {@link client.Tier.lookupPhase | Tier.lookupPhase}
 */
export async function lookupPhase(org: OrgName): Promise<CurrentPhase> {
  const tier = await getClient()
  return tier.lookupPhase(org)
}

/**
 * Push a new {@link Model} to Tier
 *
 * Any previously pushed {@link PlanName} will be ignored, new
 * plans will be added.
 *
 * Convenience wrapper for {@link client.Tier.push | Tier.push}
 */
export async function push(model: Model): Promise<PushResponse> {
  const tier = await getClient()
  return tier.push(model)
}

/**
 * @module client
 */
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
  checkout,
  updateOrg,
  whois,
  lookupOrg,
  whoami,

  limit,
  limits,
  phase,
}

export default TIER
