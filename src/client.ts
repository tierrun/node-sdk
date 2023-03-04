/**
 * @module client
 */

// just the client bits, assuming that the sidecar is already
// initialized and running somewhere.

import { Answer } from './answer.js'
import { Backoff } from './backoff.js'
import { isTierError, TierError } from './tier-error.js'

import {
  CancelPhase,
  CheckoutParams,
  CheckoutRequest,
  CheckoutResponse,
  ClockRequest,
  ClockResponse,
  CurrentPhase,
  CurrentPhaseResponse,
  FeatureName,
  Features,
  Limits,
  LookupOrgResponse,
  LookupOrgResponseJSON,
  Model,
  OrgInfo,
  OrgInfoJSON,
  OrgName,
  PaymentMethodsResponse,
  PaymentMethodsResponseJSON,
  Phase,
  Plan,
  PlanName,
  PushResponse,
  ReportParams,
  ReportRequest,
  ReportResponse,
  ScheduleParams,
  ScheduleRequest,
  ScheduleResponse,
  SubscribeParams,
  Usage,
  WhoAmIResponse,
  WhoIsResponse,
} from './tier-types.js'

/* c8 ignore start */
export { Answer } from './answer.js'
export { isErrorResponse, isTierError, TierError } from './tier-error.js'
export {
  isAggregate,
  isDivide,
  isFeatureDefinition,
  isFeatureName,
  isFeatureNameVersioned,
  isFeatures,
  isFeatureTier,
  isInterval,
  isMode,
  isModel,
  isOrgName,
  isPhase,
  isPlan,
  isPlanName,
  validateDivide,
  validateFeatureDefinition,
  validateFeatureTier,
  validateModel,
  validatePlan,
} from './tier-types.js'
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
/* c8 ignore stop */

let warnedPullLatest = false
const warnPullLatest = () => {
  if (warnedPullLatest) return
  warnedPullLatest = true
  emitWarning(
    'pullLatest is deprecated, and will be removed in the next version',
    'DeprecationWarning',
    '',
    Tier.prototype.pullLatest
  )
}
const warnedDeprecated = new Set<string>()
const warnDeprecated = (n: string, instead: string) => {
  if (warnedDeprecated.has(n)) return
  warnedDeprecated.add(n)
  emitWarning(
    `Tier.${n} is deprecated. Please use Tier.${instead} instead.`,
    'DeprecationWarning',
    '',
    Tier.prototype[n as keyof Tier] as () => {}
  )
}
const emitWarning = (
  msg: string,
  warningType: string,
  code: string,
  fn: (...a: any[]) => any
) => {
  typeof process === 'object' &&
  process &&
  typeof process.emitWarning === 'function'
    ? process.emitWarning(msg, warningType, code, fn)
    : /* c8 ignore start */
      console.error(msg)
  /* c8 ignore stop */
}

// turn an orginfo object into a suitable json request
const orgInfoToJSON = (o: OrgInfo): OrgInfoJSON => {
  const { invoiceSettings, ...clean } = o
  return {
    ...clean,
    invoice_settings: {
      default_payment_method: invoiceSettings?.defaultPaymentMethod || '',
    },
  }
}

// turn the json from a lookup org response into humane form
const lookupOrgResponseFromJSON = (
  d: LookupOrgResponseJSON
): LookupOrgResponse => {
  const { invoice_settings, ...cleaned } = d
  return {
    ...cleaned,
    invoiceSettings: {
      defaultPaymentMethod: invoice_settings?.default_payment_method || '',
    },
  }
}

const paymentMethodsFromJSON = (
  r: PaymentMethodsResponseJSON
): PaymentMethodsResponse => {
  return {
    org: r.org,
    methods: r.methods || [],
  }
}

// turn (features, {trialDays, effective}) into a set of phases
const featuresToPhases = (
  features: Features | Features[],
  {
    trialDays,
    effective,
  }: {
    trialDays?: number
    effective?: Date
  }
): Phase[] => {
  const phases: Phase[] = !Array.isArray(features)
    ? [{ features: [features], effective }]
    : features.length
    ? [{ features, effective }]
    : []

  if (trialDays !== undefined) {
    if (typeof trialDays !== 'number' || trialDays <= 0) {
      throw new TypeError('trialDays must be number >0 if specified')
    }
    if (!phases.length) {
      throw new TypeError('trialDays may not be set without a subscription')
    }
    const real = phases[0]
    const { effective } = real
    const start = (effective || new Date()).getTime()
    const offset = 1000 * 60 * 60 * 24 * trialDays
    real.effective = new Date(start + offset)
    phases.unshift({ ...real, trial: true, effective })
  }

  return phases
}

// XXX remove in v6
const versionIsNewer = (oldV: string | undefined, newV: string): boolean => {
  if (!oldV) {
    return true
  }
  const oldN = /^0$|^[1-9][0-9]*$/.test(oldV) ? parseInt(oldV, 10) : NaN
  const newN = /^0$|^[1-9][0-9]*$/.test(newV) ? parseInt(newV, 10) : NaN
  // this will return false if either are NaN
  return oldN < newN
    ? true
    : newN < oldN
    ? false
    : newV.localeCompare(oldV, 'en') > 0
}

/**
 * Tier constructor options for cases where the baseURL is
 * set by the environment.
 */
export interface TierGetClientOptions {
  baseURL?: string
  apiKey?: string
  fetchImpl?: typeof fetch
  debug?: boolean
  onError?: (er: TierError) => any
  signal?: AbortSignal
}

/**
 * Options for the Tier constructor.  Same as {@link TierGetClientOptions},
 * but baseURL is required.
 */
export interface TierOptions extends TierGetClientOptions {
  baseURL: string
}

export interface TierWithClockOptions extends TierOptions {
  clockID: string
}

/**
 * The Tier client, main interface provided by the SDK.
 *
 * All methods are re-exported as top level functions by the main
 * package export, in such a way that they create a client and
 * spin up a Tier sidecar process on demand.
 */
export class Tier {
  /**
   * The `fetch()` implementation in use.  Will default to the Node
   * built-in `fetch` if available, otherwise `node-fetch` will be used.
   */
  readonly fetch: typeof fetch

  /**
   * The URL to the sidecar providing API endpoints
   */
  readonly baseURL: string

  /**
   * A method which is called on all errors, useful for logging,
   * or handling 401 responses from a public tier API.
   */
  onError?: (er: TierError) => any

  /**
   * API key for use with the hosted service on tier.run
   */
  readonly apiKey: string

  /**
   * AbortSignal used to cancel all requests from this client.
   */
  signal?: AbortSignal

  /**
   * Create a new Tier client.  Set `{ debug: true }` in the
   * options object to enable debugging output.
   */
  constructor({
    baseURL,
    apiKey = '',
    fetchImpl = globalThis.fetch,
    debug = false,
    onError,
    signal,
  }: TierOptions) {
    this.fetch = fetchImpl
    this.debug = !!debug
    this.baseURL = baseURL
    this.apiKey = apiKey
    this.onError = onError
    this.signal = signal
  }

  async withClock(
    name: string,
    start: Date = new Date()
  ): Promise<TierWithClock> {
    const c = await this.tryPost<ClockRequest, ClockResponse>('/v1/clock', {
      name,
      present: start,
    })
    return new TierWithClock({
      baseURL: this.baseURL,
      apiKey: this.apiKey,
      fetchImpl: this.fetch,
      debug: this.debug,
      onError: this.onError,
      signal: this.signal,
      clockID: c.id,
    })
  }

  /* c8 ignore start */
  protected debugLog(..._: any[]): void {}
  /* c8 ignore stop */
  protected set debug(d: boolean) {
    if (d) {
      this.debugLog = (...m: any[]) => console.info('tier:', ...m)
    } else {
      this.debugLog = (..._: any[]) => {}
    }
  }

  protected async apiGet<T>(
    path: string,
    query?: { [k: string]: string | string[] }
  ): Promise<T> {
    const u = new URL(path, this.baseURL)
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
    this.debugLog('GET', u.toString())
    const { fetch } = this
    /* c8 ignore start */
    const ctx = typeof window === 'undefined' ? globalThis : window
    /* c8 ignore stop */
    let res: Awaited<ReturnType<typeof fetch>>
    let text: string
    try {
      const fo = fetchOptions(this)
      res = await fetch.call(ctx, u.toString(), fo)
      text = await res.text()
    } catch (er) {
      throw new TierError(path, query, 0, (er as Error).message, er)
    }
    let responseData: any
    try {
      responseData = JSON.parse(text)
    } catch (er) {
      responseData = text || (er as Error).message
      throw new TierError(path, query, res.status, text, er)
    }
    if (res.status !== 200) {
      throw new TierError(path, query, res.status, responseData)
    }
    return responseData as T
  }
  protected async tryGet<T>(
    path: string,
    query?: { [k: string]: string | string[] }
  ): Promise<T> {
    const p = this.apiGet<T>(path, query)
    const onError = this.onError
    return !onError ? p : p.catch(er => onError(er))
  }

  protected async apiPost<TReq, TRes = {}>(
    path: string,
    body: TReq
  ): Promise<TRes> {
    const u = new URL(path, this.baseURL)
    const { fetch } = this
    /* c8 ignore start */
    const ctx = typeof window === 'undefined' ? globalThis : window
    /* c8 ignore stop */

    let res: Awaited<ReturnType<typeof fetch>>
    let text: string
    this.debugLog('POST', u.pathname, body)
    try {
      res = await fetch.call(
        ctx,
        u.toString(),
        fetchOptions(this, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify(body),
        })
      )
      text = await res.text()
    } catch (er) {
      throw new TierError(path, body, 0, (er as Error).message, er)
    }
    let responseData: any
    try {
      responseData = JSON.parse(text)
    } catch (er) {
      responseData = text || (er as Error).message
      throw new TierError(path, body, res.status, responseData, er)
    }
    if (res.status < 200 || res.status > 299) {
      throw new TierError(path, body, res.status, responseData)
    }
    return responseData as TRes
  }

  protected async tryPost<TReq, TRes = {}>(
    path: string,
    body: TReq
  ): Promise<TRes> {
    const p = this.apiPost<TReq, TRes>(path, body)
    const onError = this.onError
    return !onError ? p : p.catch(er => onError(er))
  }

  /**
   * Look up the limits for all features for a given {@link types.OrgName}
   */
  async lookupLimits(org: OrgName): Promise<Limits> {
    return await this.tryGet<Limits>('/v1/limits', { org })
  }

  /**
   * Look up the payment methods on file for a given {@link types.OrgName}
   */
  async lookupPaymentMethods(org: OrgName): Promise<PaymentMethodsResponse> {
    return paymentMethodsFromJSON(
      await this.tryGet<PaymentMethodsResponseJSON>('/v1/payment_methods', {
        org,
      })
    )
  }

  /**
   * Look up limits for a given {@link types.FeatureName} and {@link types.OrgName}
   */
  async lookupLimit(org: OrgName, feature: FeatureName): Promise<Usage> {
    const limits = await this.tryGet<Limits>('/v1/limits', { org })
    for (const usage of limits.usage) {
      if (
        usage.feature === feature ||
        usage.feature.startsWith(`${feature}@plan:`)
      ) {
        return usage
      }
    }
    return { feature, used: 0, limit: 0 }
  }

  /**
   * Report metered feature usage
   */
  public async report(
    org: OrgName,
    feature: FeatureName,
    n: number = 1,
    { at, clobber }: ReportParams = {}
  ): Promise<{}> {
    const req: ReportRequest = {
      org,
      feature,
      n,
    }
    if (at) {
      req.at = at
    }
    req.clobber = !!clobber
    return await this.tryPost<ReportRequest, ReportResponse>('/v1/report', req)
  }

  /**
   * Generate a checkout URL to set an org's payment info, and optionally
   * to create a subscription on completion.
   *
   * `successUrl` param should be a URL within your application where the
   * user will be redirected upon completion.
   */
  public async checkout(
    org: OrgName,
    successUrl: string,
    params: CheckoutParams = {}
  ): Promise<CheckoutResponse> {
    const cr: CheckoutRequest = {
      org,
      success_url: successUrl,
      cancel_url: params.cancelUrl,
      require_billing_address: params.requireBillingAddress,
    }
    const { features, trialDays } = params
    if (features) {
      cr.features = Array.isArray(features) ? features : [features]
      cr.trial_days = trialDays
    }
    return await this.tryPost<CheckoutRequest, CheckoutResponse>(
      '/v1/checkout',
      cr
    )
  }

  /**
   * Simple interface for creating a new phase in the org's subscription
   * schedule.
   *
   * Setting `trialDays` will cause it to prepend a "trial" phase on the
   * effective date, and delay the creation of the actual non-trial
   * subscription phase by the specified number of days.
   */
  public async subscribe(
    org: OrgName,
    features: Features | Features[],
    { effective, info, trialDays, paymentMethodID }: SubscribeParams = {}
  ): Promise<ScheduleResponse> {
    return await this.schedule(
      org,
      featuresToPhases(features, { effective, trialDays }),
      { info, paymentMethodID }
    )
  }

  /**
   * Cancel an org's subscriptions
   */
  public async cancel(org: OrgName) {
    const cp: CancelPhase = {}
    const sr: ScheduleRequest = { org, phases: [cp] }
    return await this.tryPost<ScheduleRequest, ScheduleResponse>(
      '/v1/subscribe',
      sr
    )
  }

  /**
   * Advanced interface for creating arbitrary schedule phases in any
   * order.
   */
  public async schedule(
    org: OrgName,
    phases?: Phase[],
    { info, paymentMethodID }: ScheduleParams = {}
  ) {
    const sr: ScheduleRequest = {
      org,
      phases,
      info: info ? orgInfoToJSON(info) : undefined,
      payment_method_id: paymentMethodID,
    }
    return await this.tryPost<ScheduleRequest, ScheduleResponse>(
      '/v1/subscribe',
      sr
    )
  }

  /**
   * Update an org's metadata. Note that any fields not set (other than
   * `metadata`) will be reset to empty `''` values on any update.
   */
  public async updateOrg(org: OrgName, info: OrgInfo) {
    const sr: ScheduleRequest = {
      org,
      info: orgInfoToJSON(info),
    }
    return await this.tryPost<ScheduleRequest, ScheduleResponse>(
      '/v1/subscribe',
      sr
    )
  }

  /**
   * Get an org's billing provider identifier
   */
  public async whois(org: OrgName): Promise<WhoIsResponse> {
    return await this.tryGet<WhoIsResponse>('/v1/whois', { org })
  }

  // note: same endpoint as whois, but when include=info is set, this hits
  // stripe every time and cannot be cached.
  /**
   * Look up all {@link types.OrgInfo} metadata about an org
   */
  public async lookupOrg(org: OrgName): Promise<LookupOrgResponse> {
    return lookupOrgResponseFromJSON(
      await this.tryGet<LookupOrgResponseJSON>('/v1/whois', {
        org,
        include: 'info',
      })
    )
  }

  /**
   * Fetch the current phase for an org
   */
  public async lookupPhase(org: OrgName): Promise<CurrentPhase> {
    const resp = await this.tryGet<CurrentPhaseResponse>('/v1/phase', { org })
    const end = resp.end !== undefined ? new Date(resp.end) : resp.end
    return {
      ...resp,
      effective: new Date(resp.effective),
      end,
      trial: !!resp.trial,
    }
  }

  /**
   * Pull the full {@link types.Model} pushed to Tier
   */
  public async pull(): Promise<Model> {
    return this.tryGet<Model>('/v1/pull')
  }

  /**
   * Similar to {@link Tier.pull}, but filters plans to only include
   * the highest version of each plan.  Plan versions are sorted numerically
   * if they are decimal integers, or lexically in the `en` locale otherwise.
   *
   * So, for example, the plan version `20test` will be considered "lower"
   * than `9test`, because the non-numeric string causes it to be lexically
   * sorted.  But the plan version `20` sill be considered "higher" than the
   * plan version `9`, because both are strictly numeric.
   *
   * **Note** Plan versions are inherently arbitrary, and as such, they really
   * should not be sorted or given any special priority by being "latest".
   *
   * This method will be removed in version 6 of this SDK.
   *
   * @deprecated
   */
  public async pullLatest(): Promise<Model> {
    warnPullLatest()
    const model = await this.pull()
    const plans: { [k: PlanName]: Plan } = Object.create(null)
    const latest: { [k: string]: string } = Object.create(null)
    for (const id of Object.keys(model.plans)) {
      const [name, version] = id.split('@')
      if (versionIsNewer(latest[name], version)) {
        latest[name] = version
      }
    }
    for (const [name, version] of Object.entries(latest)) {
      const id = `${name}@${version}` as PlanName
      plans[id] = model.plans[id]
    }
    return { plans }
  }

  /**
   * Push a new {@link types.Model} to Tier
   *
   * Any previously pushed {@link types.PlanName} will be ignored, new
   * plans will be added.
   */
  public async push(model: Model): Promise<PushResponse> {
    return await this.tryPost<Model, PushResponse>('/v1/push', model)
  }

  /**
   * Get information about the current sidecare API in use
   */
  public async whoami(): Promise<WhoAmIResponse> {
    return await this.tryGet<WhoAmIResponse>('/v1/whoami')
  }

  /**
   * Return an {@link answer.Answer} indicating whether an org can
   * access a feature, or if they are at their plan limit.
   */
  public async can(org: OrgName, feature: FeatureName): Promise<Answer> {
    try {
      const usage = await this.lookupLimit(org, feature)
      return new Answer(this, org, feature, usage)
    } catch (err) {
      /* c8 ignore start */
      // something extra broken, just fail. should be impossible.
      if (!isTierError(err)) {
        throw err
      }
      /* c8 ignore stop */
      return new Answer(this, org, feature, undefined, err)
    }
  }

  /* c8 ignore start */
  /**
   * @deprecated alias for {@link Tier.lookupLimits}
   */
  public async limits(org: OrgName): Promise<Limits> {
    warnDeprecated('limits', 'lookupLimits')
    return this.lookupLimits(org)
  }
  /**
   * @deprecated alias for {@link Tier.lookupLimit}
   */
  public async limit(org: OrgName, feature: FeatureName): Promise<Usage> {
    warnDeprecated('limit', 'lookupLimit')
    return this.lookupLimit(org, feature)
  }
  /**
   * @deprecated alias for {@link Tier.lookupPhase}
   */
  public async phase(org: OrgName): Promise<CurrentPhase> {
    warnDeprecated('phase', 'lookupPhase')
    return this.lookupPhase(org)
  }
  /* c8 ignore stop */
}

export class TierWithClock extends Tier {
  /**
   * The ID of a stripe test clock.  Set via {@link withClock}
   */
  clockID: string

  constructor(options: TierWithClockOptions) {
    super(options)
    this.clockID = options.clockID
    /* c8 ignore start */
    if (!this.clockID) {
      throw new TypeError('no clockID found in TierWithClock constructor')
    }
    /* c8 ignore stop */
  }

  async advance(t: Date): Promise<void> {
    await this.tryPost<ClockRequest, ClockResponse>('/v1/clock', {
      id: this.clockID,
      present: t,
    })
    await this.#awaitClockReady()
  }

  async #awaitClockReady(): Promise<void> {
    const bo = new Backoff(5000, 30000, { signal: this.signal })
    while (!this.signal?.aborted) {
      const cr = await this.#syncClock()
      if (cr.status === 'ready') {
        return
      }
      await bo.backoff()
    }
  }

  async #syncClock(): Promise<ClockResponse> {
    const id = this.clockID
    return await this.tryGet<ClockResponse>('/v1/clock', { id })
  }
}

const fetchOptions = (
  tier: Tier | TierWithClock,
  settings: RequestInit = {}
): RequestInit => {
  const { apiKey, signal } = tier
  const clockID = tier instanceof TierWithClock ? tier.clockID : undefined

  const authHeader = apiKey
    ? { authorization: `Basic ${base64(apiKey + ':')}` }
    : {}

  const clockHeader = clockID ? { 'tier-clock': clockID } : {}
  return {
    ...settings,
    credentials: 'include',
    mode: 'cors',
    signal,
    headers: {
      ...(settings.headers || {}),
      ...authHeader,
      ...clockHeader,
    } as HeadersInit,
  }
}

/* c8 ignore start */
const base64 = (s: string): string =>
  typeof window !== 'undefined'
    ? window.btoa(s)
    : Buffer.from(s).toString('base64')
/* c8 ignore stop */
