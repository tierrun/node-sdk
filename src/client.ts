// just the client bits, assuming that the sidecar is already
// initialized and running somewhere.

/**
 * The name of an organization, used to uniquely reference a
 * customer account within Tier. Any unique string identifier,
 * prefixed with 'org:'
 */
export type OrgName = `org:${string}`

/**
 * Test whether a value is a valid {@link OrgName}
 */
export const isOrgName = (o: any): o is OrgName =>
  typeof o === 'string' && o.startsWith('org:') && o !== 'org:'

/**
 * The name of a feature within Tier.  Can be any string
 * containing ASCII alphanumeric characters and ':'
 */
export type FeatureName = `feature:${string}`

/**
 * Test whether a value is a valid {@link FeatureName}
 */
export const isFeatureName = (f: any): f is FeatureName =>
  typeof f === 'string' && /^feature:[a-zA-Z0-9:]+$/.test(f)

/**
 * A Tier pricing model, as would be stored within a `pricing.json`
 * file, or created on <https://model.tier.run/>
 */
export interface Model {
  plans: {
    [p: PlanName]: Plan
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

// just keeping the double-negative in one place, since I so often
// type this wrong and get annoyed.
const isVArray = (arr: any, valTest: (v: any) => boolean) =>
  Array.isArray(arr) && !arr.some(v => !valTest(v))

const isObj = (c: any): c is { [k: string]: any } =>
  !!c && typeof c === 'object'

const optionalType = (c: any, t: string): boolean =>
  c === undefined || typeof c === t

const optionalString = (c: any): c is string | undefined =>
  optionalType(c, 'string')

const optionalKV = (
  c: any,
  keyTest: (k: string) => boolean,
  valTest: (v: any) => boolean
): boolean => c === undefined || isKV(c, keyTest, valTest)

const optionalIs = (c: any, test: (c: any) => boolean) =>
  c === undefined || test(c)

const optionalIsVArray = (c: any, valTest: (v: any) => boolean) =>
  c === undefined || isVArray(c, valTest)

const isKV = (
  obj: any,
  keyTest: (k: string) => boolean,
  valTest: (v: any) => boolean
): boolean =>
  isObj(obj) &&
  isVArray(Object.keys(obj), keyTest) &&
  isVArray(Object.values(obj), valTest)

const unexpectedFields = (
  obj: { [k: string]: any },
  ...keys: string[]
): string[] => {
  const expect = new Set<string>(keys)
  return Object.keys(obj).filter(k => !expect.has(k))
}

const hasOnly = (obj: any, ...keys: string[]): boolean => {
  if (!isObj(obj)) {
    return false
  }
  const expect = new Set<string>(keys)
  for (const k of Object.keys(obj)) {
    if (!expect.has(k)) {
      return false
    }
  }
  return true
}

/**
 * Test whether a value is a valid {@link Model}
 */
export const isModel = (m: any): m is Model =>
  hasOnly(m, 'plans') && isKV(m.plans, isPlanName, isPlan)

/**
 * Asserts that a value is a valid {@link Model}
 *
 * If it is not, then a string is thrown indicating the problem.
 */
export const validateModel = (m: any): asserts m is Model => {
  if (!isObj(m)) {
    throw 'not an object'
  }
  if (!isObj(m.plans)) {
    throw 'missing or invalid plans, must be object'
  }
  for (const [pn, plan] of Object.entries(m.plans)) {
    if (!isPlanName(pn)) {
      throw `invalid plan name: ${pn}`
    }
    try {
      validatePlan(plan as any)
    } catch (er) {
      throw `plans['${pn}']: ${er}`
    }
  }
  const unexpected = unexpectedFields(m, 'plans')
  if (unexpected.length !== 0) {
    throw `unexpected field(s): ${unexpected.join(', ')}`
  }
}

/**
 * The definition of a plan within a {@link Model}.
 */
export interface Plan {
  title?: string
  features?: {
    [f: FeatureName]: FeatureDefinition
  }
  currency?: string
  interval?: Interval
}

const isCurrency = (c: any): c is Plan['currency'] =>
  typeof c === 'string' && c.length === 3 && c === c.toLowerCase()

/**
 * Test whether a value is a valid {@link Plan}
 */
export const isPlan = (p: any): p is Plan =>
  isObj(p) &&
  hasOnly(p, 'title', 'currency', 'interval', 'features') &&
  optionalString(p.title) &&
  optionalKV(p.features, isFeatureName, isFeatureDefinition) &&
  optionalIs(p.currency, isCurrency) &&
  optionalIs(p.interval, isInterval)

/**
 * Asserts that a value is a valid {@link Plan}
 *
 * If not, throws a string indicating the source of the problem.
 */
export const validatePlan: (p: any) => void = (p: any): asserts p is Plan => {
  if (!isObj(p)) {
    throw 'not an object'
  }
  if (p.title !== undefined && typeof p.title !== 'string') {
    throw 'invalid title, must be string'
  }
  if (p.features !== undefined) {
    if (!isObj(p.features)) {
      throw 'invalid features field, must be object'
    }
    for (const [fn, fdef] of Object.entries(p.features)) {
      if (!isFeatureName(fn)) {
        throw `invalid feature name: ${fn}`
      }
      try {
        validateFeatureDefinition(fdef)
      } catch (er) {
        throw `features['${fn}']: ${er}`
      }
    }
  }
  if (!optionalIs(p.currency, isCurrency)) {
    throw `invalid currency: ${p.currency}`
  }
  if (!optionalIs(p.interval, isInterval)) {
    throw `invalid interval: ${p.interval}`
  }
  const unexpected = unexpectedFields(
    p,
    'title',
    'currency',
    'interval',
    'features'
  )
  if (unexpected.length !== 0) {
    throw `unexpected field(s): ${unexpected.join(', ')}`
  }
}

/**
 * Valid values for the `interval` field in a {@link FeatureDefinition}
 */
export type Interval = '@daily' | '@weekly' | '@monthly' | '@yearly'
/**
 * Test whether a value is a valid {@link Interval}
 */
export const isInterval = (i: any): i is Interval =>
  i === '@daily' || i === '@weekly' || i === '@monthly' || i === '@yearly'

/**
 * The definition of a feature within a {@link Plan}.
 */
export interface FeatureDefinition {
  title?: string
  base?: number
  tiers?: FeatureTier[]
  mode?: Mode
  aggregate?: Aggregate
}
/**
 * Valid values for the `aggregate` field in a {@link FeatureDefinition}
 */
export type Aggregate = 'sum' | 'max' | 'last' | 'perpetual'
/**
 * Test whether a value is a valid {@link Aggregate}
 */
export const isAggregate = (a: any): a is Aggregate =>
  a === 'sum' || a === 'max' || a === 'last' || a === 'perpetual'

/**
 * Test whether a value is a valid {@link FeatureDefinition}
 */
export const isFeatureDefinition = (f: any): f is FeatureDefinition =>
  hasOnly(f, 'base', 'tiers', 'mode', 'aggregate', 'title') &&
  optionalString(f.title) &&
  optionalIs(f.base, isNonNegInt) &&
  optionalIs(f.mode, isMode) &&
  optionalIsVArray(f.tiers, isFeatureTier) &&
  !(f.base !== undefined && f.tiers) &&
  optionalIs(f.aggregate, isAggregate)
/**
 * Asserts that a value is a valid {@link FeatureDefinition}
 *
 * If not, a string is thrown indicating the source of the problem.
 */
export const validateFeatureDefinition: (f: any) => void = (
  f: any
): asserts f is FeatureDefinition => {
  if (!isObj(f)) {
    throw 'not an object'
  }
  if (!optionalString(f.title)) {
    throw 'title not a string'
  }
  if (!optionalIs(f.base, isNonNegInt)) {
    throw 'invalid base, must be non-negative integer'
  }
  if (!optionalIs(f.mode, isMode)) {
    throw 'invalid mode'
  }
  if (f.tiers && f.base !== undefined) {
    throw 'tiers and base cannot be set together'
  }
  // unroll this so we can show the tier that failed
  if (f.tiers !== undefined) {
    if (!Array.isArray(f.tiers)) {
      throw 'non-array tiers field'
    }
    f.tiers.forEach((t: FeatureTier, i: number) => {
      try {
        validateFeatureTier(t)
      } catch (er) {
        throw `tiers[${i}]: ${er}`
      }
    })
  }
  if (!optionalIs(f.aggregate, isAggregate)) {
    throw 'invalid aggregate'
  }
  const unexpected = unexpectedFields(
    f,
    'base',
    'tiers',
    'mode',
    'aggregate',
    'title'
  )
  if (unexpected.length) {
    throw `unexpected field(s): ${unexpected.join(', ')}`
  }
}

/**
 * Valid values for the `mode` field in a {@link FeatureDefinition}
 */
export type Mode = 'graduated' | 'volume'
/**
 * Test whether a value is a valiid {@link Mode}
 */
export const isMode = (m: any): m is Mode => m === 'graduated' || m === 'volume'

/**
 * Entry in the {@link FeatureDefinition} `tier` array
 */
export interface FeatureTier {
  upto?: number
  price?: number
  base?: number
}

const isPosInt = (n: any): boolean => Number.isInteger(n) && n > 0
const isNonNegInt = (n: any): boolean => Number.isInteger(n) && n >= 0
const isNonNegNum = (n: any): boolean =>
  typeof n === 'number' && isFinite(n) && n >= 0

/**
 * Test whether a value is a valid {@link FeatureTier}
 */
export const isFeatureTier = (t: any): t is FeatureTier =>
  hasOnly(t, 'upto', 'price', 'base') &&
  optionalIs(t.upto, isPosInt) &&
  optionalIs(t.price, isNonNegNum) &&
  optionalIs(t.base, isNonNegInt)

/**
 * Validate that a value is a valid {@link FeatureTier}
 *
 * If not, a string is thrown indicating the source of the problem.
 */
export const validateFeatureTier: (t: any) => void = (
  t: any
): asserts t is FeatureTier => {
  if (!isObj(t)) {
    throw 'not an object'
  }
  if (!optionalIs(t.upto, isPosInt)) {
    throw 'invalid upto, must be integer greater than 0'
  }
  if (!optionalIs(t.price, isNonNegNum)) {
    throw 'invalid price, must be non-negative number'
  }
  if (!optionalIs(t.base, isNonNegInt)) {
    throw 'invalid base, must be non-negative integer'
  }
  const unexpected = unexpectedFields(t, 'base', 'price', 'upto')
  if (unexpected.length !== 0) {
    throw `unexpected field(s): ${unexpected.join(', ')}`
  }
}

/**
 * Object representing some amount of feature consumption.
 */
export interface Usage {
  feature: FeatureName
  used: number
  limit: number
}

/**
 * The set of {@link Usage} values for each feature that an
 * org has access to.
 */
export interface Limits {
  org: OrgName
  usage: Usage[]
}

/**
 * A {@link Plan} identifier.  Format is `plan:<name>@<version>`.
 * Name can contain any ASCII alphanumeric characters and `:`.
 * Version can contain any ASCII alphanumeric characters.
 */
export type PlanName = `plan:${string}@${string}`
/**
 * An identifier for a feature as defined within a given plan.
 * Format is `<feature>@<plan>` where `feature` is a {@link FeatureName}
 * and `plan` is a {@link PlanName}.
 *
 * FeatureNameVersioned and {@link PlanName} strings may be used
 * equivalently to specify prices and entitlements to Tier methods.
 */
export type FeatureNameVersioned = `${FeatureName}@${PlanName}`
/**
 * alias for {@link FeatureNameVersioned}
 * @deprecated
 */
export type VersionedFeatureName = FeatureNameVersioned
/**
 * Either a {@link PlanName} or {@link FeatureNameVersioned}
 *
 * The type of values that may be used to specify prices and entitlements.
 */
export type Features = PlanName | FeatureNameVersioned

/**
 * Test whether a value is a valid {@link PlanName}
 */
export const isPlanName = (p: any): p is PlanName =>
  typeof p === 'string' && /^plan:[a-zA-Z0-9:]+@[a-zA-Z0-9]+$/.test(p)

/**
 * Test whether a value is a valid {@link FeatureNameVersioned}
 */
export const isFeatureNameVersioned = (f: any): f is FeatureNameVersioned =>
  typeof f === 'string' &&
  /^feature:[a-zA-Z0-9:]+@plan:[a-zA-Z0-9:]+@[a-zA-Z0-9]+$/.test(f)
/**
 * @deprecated alias for {@link isFeatureNameVersioned}
 */
export const isVersionedFeatureName = isFeatureNameVersioned

/**
 * Test whether a value is a valid {@link Features}
 */
export const isFeatures = (f: any): f is Features =>
  isPlanName(f) || isFeatureNameVersioned(f)

/**
 * Object representing the current phase in an org's subscription schedule
 */
export interface CurrentPhase {
  effective: Date
  features: FeatureNameVersioned[]
  plans: PlanName[]
}

interface CurrentPhaseResponse {
  effective: string
  features: FeatureNameVersioned[]
  plans: PlanName[]
}

/**
 * Object representing a phase in an org's subscription schedule, for
 * creating new schedules via `tier.schedule()`.
 */
export interface Phase {
  effective?: Date
  features: Features[]
  plans?: PlanName[]
  trial?: boolean
}

/**
 * Special empty {@link Phase} object that has no features, indicating
 * that the org's plan should be terminated.
 */
export interface CancelPhase {}

const isDate = (d: any): d is Date => isObj(d) && d instanceof Date

/**
 * Test whether a value is a valid {@link Phase}
 */
export const isPhase = (p: any): p is Phase =>
  isObj(p) &&
  optionalIs(p.effective, isDate) &&
  optionalType(p.trial, 'boolean') &&
  isVArray(p.features, isFeatures)

/**
 * Options for the {@link Tier.checkout} method
 */
export interface CheckoutParams {
  cancelUrl?: string
  features?: Features | Features[]
  trialDays?: number
}

interface CheckoutRequest {
  org: OrgName
  success_url: string
  features?: Features[]
  trial_days?: number
  cancel_url?: string
}

/**
 * Response from the {@link Tier.checkout} method, indicating the url
 * that the user must visit to complete the checkout process.
 */
export interface CheckoutResponse {
  url: string
}

interface ScheduleRequest {
  org: OrgName
  phases?: Phase[] | [CancelPhase]
  info?: OrgInfo
}

/**
 * Response from the methods that use the `/v1/subscribe` endpoint.
 */
export interface ScheduleResponse {}

/**
 * Options for the {@link Tier.subscribe} method
 */
export interface SubscribeParams {
  effective?: Date
  info?: OrgInfo
  trialDays?: number
}

/**
 * Options for the {@link Tier.schedule} method
 */
export interface ScheduleParams {
  info?: OrgInfo
}

/**
 * Options for the {@link Tier.report} and {@link Answer.report} methods
 */
export interface ReportParams {
  at?: Date
  clobber?: boolean
}

interface ReportRequest {
  org: OrgName
  feature: FeatureName
  n?: number
  at?: Date
  clobber?: boolean
}

/**
 * Response from the {@link Tier.whois} method
 */
export interface WhoIsResponse {
  org: OrgName
  stripe_id: string
}

/**
 * Object representing an org's billing metadata. Note that any fields
 * not set (other than `metadata`) will be reset to empty `''` values
 * on any update.
 *
 * Used by {@link Tier.lookupOrg}, {@link Tier.schedule}, and
 * {@link Tier.subscribe} methods.
 */
export interface OrgInfo {
  email: string
  name: string
  description: string
  phone: string
  metadata: { [key: string]: string }
}

/**
 * Response from the {@link Tier.lookupOrg} method
 */
export type LookupOrgResponse = WhoIsResponse & OrgInfo

/**
 * Object indicating the success status of a given feature and plan
 * when using {@link Tier.push}
 */
export interface PushResult {
  feature: FeatureNameVersioned
  status: string
  reason: string
}

/**
 * Response from the {@link Tier.push} method
 */
export interface PushResponse {
  results?: PushResult[]
}

/**
 * Response from the {@link Tier.whoami} method
 */
export interface WhoAmIResponse {
  id: string
  email: string
  key_source: string
  isolated: boolean
  url: string
}

// errors
/**
 * Response returned by the Tier API on failure
 * @internal
 */
export interface ErrorResponse {
  status: number
  code: string
  message: string
}
/**
 * Test whether a value is a valid {@link ErrorResponse}
 * @internal
 */
export const isErrorResponse = (e: any): e is ErrorResponse =>
  isObj(e) &&
  typeof e.status === 'number' &&
  typeof e.message === 'string' &&
  typeof e.code === 'string'

/**
 * Test whether a value is a valid {@link TierError}
 */
export const isTierError = (e: any): e is TierError =>
  isObj(e) && e instanceof TierError

/**
 * The object returned by the {@link Tier.can} method.
 * Should not be instantiated directly.
 */
export class Answer {
  /**
   * Indicates that the org is not over their limit for the feature
   * Note that when an error occurs, `ok` will be set to `true`,
   * so that we fail open by default. In order to prevent access
   * on API failures, you must check *both* `answer.ok` *and*
   * `answer.err`.
   */
  ok: boolean
  /**
   * The feature checked by {@link Tier.can}
   */
  feature: FeatureName
  /**
   * The org checked by {@link Tier.can}
   */
  org: OrgName
  /**
   * Reference to the {@link Tier} client in use.
   * @internal
   */
  client: Tier
  /**
   * Any error encountered during the feature limit check.
   * Note that when an error occurs, `ok` will be set to `true`,
   * so that we fail open by default. In order to prevent access
   * on API failures, you must check *both* `answer.ok` *and*
   * `answer.err`.
   */
  err?: TierError

  constructor(
    client: Tier,
    org: OrgName,
    feature: FeatureName,
    usage?: Usage,
    err?: TierError
  ) {
    this.client = client
    this.org = org
    this.feature = feature
    if (usage && !err) {
      this.ok = usage.used < usage.limit
    } else {
      this.ok = true
      this.err = err
    }
  }

  /**
   * Report usage for the org and feature checked by {@link Tier.can}
   */
  public async report(n: number = 1, options?: ReportParams) {
    return this.client.report(this.org, this.feature, n, options)
  }
}

/**
 * Error subclass raised for any error returned by the API.
 * Should not be instantiated directly.
 */
export class TierError extends Error {
  /**
   * The API endpoint that was requested
   */
  public path: string
  /**
   * The data that was sent to the API endpoint.  Will be a parsed
   * JavaScript object unless the request JSON was invalid, in which
   * case it will be a string.
   */
  public requestData: any
  /**
   * The HTTP response status code returned
   */
  public status: number
  /**
   * The `code` field in the {@link ErrorResponse}
   */
  public code?: string
  /**
   * The HTTP response body.  Will be a parsed JavaScript object
   * unless the response JSON was invalid, in which case it will
   * be a string.
   */
  public responseData: any

  /**
   * An underlying system error or other cause.
   */
  public cause?: Error

  constructor(
    path: string,
    reqBody: any,
    status: number,
    resBody: any,
    er?: any
  ) {
    if (isErrorResponse(resBody)) {
      super(resBody.message)
      this.code = resBody.code
    } else {
      super('Tier request failed')
    }
    if (er && typeof er === 'object' && er instanceof Error) {
      this.cause = er
    }
    this.path = path
    this.requestData = reqBody
    this.status = status
    this.responseData = resBody
  }
}

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
   * Create a new Tier client.  Set `{ debug: true }` in the
   * options object to enable debugging output.
   */
  constructor({
    baseURL,
    apiKey = '',
    fetchImpl = globalThis.fetch,
    debug = false,
    onError,
  }: {
    baseURL: string
    apiKey?: string
    fetchImpl?: typeof fetch
    debug?: boolean
    onError?: (er: TierError) => any
  }) {
    this.fetch = fetchImpl
    this.debug = !!debug
    this.baseURL = baseURL
    this.apiKey = apiKey
    this.onError = onError
  }

  /* c8 ignore start */
  private debugLog(..._: any[]): void {}
  /* c8 ignore stop */
  private set debug(d: boolean) {
    if (d) {
      this.debugLog = (...m: any[]) => console.error('tier:', ...m)
    } else {
      this.debugLog = (..._: any[]) => {}
    }
  }

  private async apiGet<T>(
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
      res = await fetch.call(ctx, u.toString(), basicAuth(this.apiKey))
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
  private async tryGet<T>(
    path: string,
    query?: { [k: string]: string | string[] }
  ): Promise<T> {
    const p = this.apiGet<T>(path, query)
    const onError = this.onError
    return !onError ? p : p.catch(er => onError(er))
  }

  private async apiPost<TReq, TRes = {}>(
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
        basicAuth(this.apiKey, {
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

  private async tryPost<TReq, TRes = {}>(
    path: string,
    body: TReq
  ): Promise<TRes> {
    const p = this.apiPost<TReq, TRes>(path, body)
    const onError = this.onError
    return !onError ? p : p.catch(er => onError(er))
  }

  /**
   * Look up the limits for all features for a given {@link OrgName}
   */
  async lookupLimits(org: OrgName): Promise<Limits> {
    return await this.tryGet<Limits>('/v1/limits', { org })
  }

  /**
   * Look up limits for a given {@link FeatureName} and {@link OrgName}
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
    return await this.tryPost<ReportRequest>('/v1/report', req)
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
    { effective, info, trialDays }: SubscribeParams = {}
  ): Promise<ScheduleResponse> {
    return await this.schedule(
      org,
      featuresToPhases(features, { effective, trialDays }),
      { info }
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
    { info }: ScheduleParams = {}
  ) {
    const sr: ScheduleRequest = { org, phases, info }
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
    const sr: ScheduleRequest = { org, info }
    return await this.tryPost<ScheduleRequest, ScheduleResponse>(
      '/v1/subscribe',
      sr
    )
  }

  /**
   * Get an org's billing provider identifier
   */
  public async whois(org: OrgName): Promise<WhoIsResponse> {
    // don't send back an `info:null`
    const res = await this.tryGet<WhoIsResponse>('/v1/whois', { org })
    return {
      org: res.org,
      stripe_id: res.stripe_id,
    }
  }

  // note: same endpoint as whois, but when include=info is set, this hits
  // stripe every time and cannot be cached.
  /**
   * Look up all {@link OrgInfo} metadata about an org
   */
  public async lookupOrg(org: OrgName): Promise<LookupOrgResponse> {
    return await this.tryGet<LookupOrgResponse>('/v1/whois', {
      org,
      include: 'info',
    })
  }

  /**
   * Fetch the current phase for an org
   */
  public async lookupPhase(org: OrgName): Promise<CurrentPhase> {
    const resp = await this.tryGet<CurrentPhaseResponse>('/v1/phase', { org })
    return {
      ...resp,
      effective: new Date(resp.effective),
    }
  }

  /**
   * Pull the full {@link Model} pushed to Tier
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
   */
  public async pullLatest(): Promise<Model> {
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
   * Push a new {@link Model} to Tier
   *
   * Any previously pushed {@link PlanName} will be ignored, new
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
   * Return an {@link Answer} indicating whether an org can
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
    return this.lookupLimits(org)
  }
  /**
   * @deprecated alias for {@link Tier.lookupLimit}
   */
  public async limit(org: OrgName, feature: FeatureName): Promise<Usage> {
    return this.lookupLimit(org, feature)
  }
  /**
   * @deprecated alias for {@link Tier.lookupPhase}
   */
  public async phase(org: OrgName): Promise<CurrentPhase> {
    return this.lookupPhase(org)
  }
  /* c8 ignore stop */
}

const basicAuth = (key: string, settings: RequestInit = {}): RequestInit => {
  return !key
    ? {
        ...settings,
        credentials: 'include',
      }
    : {
        ...settings,
        headers: {
          ...(settings.headers || {}),
          authorization: `Basic ${base64(key + ':')}`,
        },
        credentials: 'include',
      }
}

/* c8 ignore start */
const base64 = (s: string): string =>
  typeof window !== 'undefined'
    ? window.btoa(s)
    : Buffer.from(s).toString('base64')
/* c8 ignore stop */
