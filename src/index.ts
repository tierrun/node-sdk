import { getClient } from './get-client.js'

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
  PaymentMethodsResponse,
  Phase,
  PushResponse,
  ReportParams,
  ScheduleParams,
  ScheduleResponse,
  SubscribeParams,
  TierGetClientOptions,
  TierWithClock,
  Usage,
  WhoAmIResponse,
  WhoIsResponse,
} from './client.js'
import {
  isErrorResponse,
  isFeatureName,
  isFeatureNameVersioned,
  isFeatures,
  isOrgName,
  isPhase,
  isPlanName,
  isTierError,
  Tier,
  validateFeatureDefinition,
  validateFeatureTier,
  validateModel,
  validatePlan,
} from './client.js'

// actual API methods

/**
 * Pull the full {@link types.Model} pushed to Tier
 *
 * Convenience wrapper for {@link client.Tier.pull | Tier.pull}
 */
export async function pull(
  clientOptions?: TierGetClientOptions
): Promise<Model> {
  const tier = await getClient(clientOptions)
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
 *
 * **Note** Plan versions are inherently arbitrary, and as such, they really
 * should not be sorted or given any special priority by being "latest".
 *
 * This method will be removed in version 6 of this SDK.
 *
 * @deprecated
 */
export async function pullLatest(
  clientOptions?: TierGetClientOptions
): Promise<Model> {
  const tier = await getClient(clientOptions)
  return tier.pullLatest()
}

/**
 * Look up the limits for all features for a given {@link types.OrgName}
 *
 * Convenience wrapper for {@link client.Tier.lookupLimits | Tier.lookupLimits}
 */
export async function lookupLimits(
  org: OrgName,
  clientOptions?: TierGetClientOptions
): Promise<Limits> {
  const tier = await getClient(clientOptions)
  return tier.lookupLimits(org)
}

/**
 * Look up limits for a given {@link types.FeatureName} and {@link types.OrgName}
 *
 * Convenience wrapper for {@link client.Tier.lookupLimit | Tier.lookupLimit}
 */
export async function lookupLimit(
  org: OrgName,
  feature: FeatureName,
  clientOptions?: TierGetClientOptions
): Promise<Usage> {
  const tier = await getClient(clientOptions)
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
  options?: ReportParams,
  clientOptions?: TierGetClientOptions
): Promise<{}> {
  const tier = await getClient(clientOptions)
  return await tier.report(org, feature, n, options)
}

/**
 * Return an {@link answer.Answer} indicating whether an org can
 * access a feature, or if they are at their plan limit.
 *
 * Convenience wrapper for {@link client.Tier.can | Tier.can}
 */
export async function can(
  org: OrgName,
  feature: FeatureName,
  clientOptions?: TierGetClientOptions
): Promise<Answer> {
  const tier = await getClient(clientOptions)
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
  { cancelUrl, features, trialDays, tax }: CheckoutParams = {},
  clientOptions?: TierGetClientOptions
): Promise<CheckoutResponse> {
  const tier = await getClient(clientOptions)
  return await tier.checkout(org, successUrl, {
    cancelUrl,
    features,
    trialDays,
    tax,
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
  { effective, info, trialDays }: SubscribeParams = {},
  clientOptions?: TierGetClientOptions
): Promise<ScheduleResponse> {
  const tier = await getClient(clientOptions)
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
export async function cancel(
  org: OrgName,
  clientOptions?: TierGetClientOptions
): Promise<ScheduleResponse> {
  const tier = await getClient(clientOptions)
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
  { info }: ScheduleParams = {},
  clientOptions?: TierGetClientOptions
): Promise<ScheduleResponse> {
  const tier = await getClient(clientOptions)
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
 * Look up all {@link types.OrgInfo} metadata about an org
 *
 * Convenience wrapper for {@link client.Tier.lookupOrg | Tier.lookupOrg}
 */
export async function lookupOrg(org: OrgName): Promise<LookupOrgResponse> {
  const tier = await getClient()
  return tier.lookupOrg(org)
}

/**
 * Look up all the Payment Methods available for a given {@link types.OrgName}
 *
 * Convenience wrapper for {@link client.Tier.lookupPaymentMethods | Tier.lookupPaymentMethods}
 */
export async function lookupPaymentMethods(
  org: OrgName
): Promise<PaymentMethodsResponse> {
  const tier = await getClient()
  return tier.lookupPaymentMethods(org)
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
 * Push a new {@link types.Model} to Tier
 *
 * Any previously pushed {@link types.PlanName} will be ignored, new
 * plans will be added.
 *
 * Convenience wrapper for {@link client.Tier.push | Tier.push}
 */
export async function push(model: Model): Promise<PushResponse> {
  const tier = await getClient()
  return tier.push(model)
}

/**
 * Return a new Tier client that has a test clock
 */
export async function withClock(
  name: string,
  start: Date = new Date(),
  options: TierGetClientOptions = {}
): Promise<TierWithClock> {
  const tier = await getClient(options)
  return tier.withClock(name, start)
}

/**
 * Get a client with the settings from the environment
 */
export async function fromEnv(
  options: TierGetClientOptions = {}
): Promise<Tier> {
  return getClient(options)
}

export * from './client.js'
export type { TierGetClientOptions, TierWithClock } from './client.js'
export type {
  Aggregate,
  CancelPhase,
  CheckoutParams,
  CheckoutResponse,
  CurrentPhase,
  CurrentPhaseResponse,
  Divide,
  FeatureDefinition,
  FeatureName,
  FeatureNameVersioned,
  Features,
  FeatureTier,
  Interval,
  Limits,
  LookupOrgResponse,
  Mode,
  Model,
  OrgInfo,
  OrgName,
  PaymentMethodsResponse,
  Phase,
  Plan,
  PlanName,
  PushResponse,
  ReportParams,
  ReportResponse,
  ScheduleParams,
  ScheduleResponse,
  SubscribeParams,
  Usage,
  WhoAmIResponse,
  WhoIsResponse,
} from './tier-types.js'

/* c8 ignore start */
/**
 * @deprecated alias for lookupLimits
 */
export async function limits(org: OrgName): Promise<Limits> {
  const tier = await getClient()
  return tier.limits(org)
}
/**
 * @deprecated alias for lookupLimit
 */
export async function limit(
  org: OrgName,
  feature: FeatureName
): Promise<Usage> {
  const tier = await getClient()
  return tier.limit(org, feature)
}
/**
 * @deprecated alias for lookupPhase
 */
export async function phase(org: OrgName): Promise<CurrentPhase> {
  const tier = await getClient()
  return tier.phase(org)
}
/* c8 ignore stop */

const TIER = {
  isErrorResponse,
  isFeatureName,
  isFeatureNameVersioned,
  isFeatures,
  isOrgName,
  isPhase,
  isPlanName,
  isTierError,
  validateFeatureDefinition,
  validateFeatureTier,
  validateModel,
  validatePlan,

  Tier,

  can,
  cancel,
  checkout,
  lookupLimit,
  lookupLimits,
  lookupOrg,
  lookupPaymentMethods,
  lookupPhase,
  pull,
  push,
  report,
  schedule,
  subscribe,
  updateOrg,
  whoami,
  whois,

  withClock,
  fromEnv,

  pullLatest,
  limit,
  limits,
  phase,
}

export default TIER
