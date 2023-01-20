// just the client bits, assuming that the sidecar is already
// initialized and running somewhere.

export type OrgName = `org:${string}`
export const isOrgName = (o: any): o is OrgName =>
  typeof o === 'string' && o.startsWith('org:') && o !== 'org:'

export type FeatureName = `feature:${string}`
export const isFeatureName = (f: any): f is FeatureName =>
  typeof f === 'string' && /^feature:[a-zA-Z0-9:]+$/.test(f)

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
    const effective = real.effective
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

export const isModel = (m: any): m is Model =>
  hasOnly(m, 'plans') && isKV(m.plans, isPlanName, isPlan)

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

export const isPlan = (p: any): p is Plan =>
  isObj(p) &&
  hasOnly(p, 'title', 'currency', 'interval', 'features') &&
  optionalString(p.title) &&
  optionalKV(p.features, isFeatureName, isFeatureDefinition) &&
  optionalIs(p.currency, isCurrency) &&
  optionalIs(p.interval, isInterval)

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

export type Interval = '@daily' | '@weekly' | '@monthly' | '@yearly'
export const isInterval = (i: any): i is Interval =>
  i === '@daily' || i === '@weekly' || i === '@monthly' || i === '@yearly'

export interface FeatureDefinition {
  title?: string
  base?: number
  tiers?: FeatureTier[]
  mode?: Mode
  aggregate?: Aggregate
}
export type Aggregate = 'sum' | 'max' | 'last' | 'perpetual'
export const isAggregate = (a: any): a is Aggregate =>
  a === 'sum' || a === 'max' || a === 'last' || a === 'perpetual'

export const isFeatureDefinition = (f: any): f is FeatureDefinition =>
  hasOnly(f, 'base', 'tiers', 'mode', 'aggregate', 'title') &&
  optionalString(f.title) &&
  optionalIs(f.base, isNonNegInt) &&
  optionalIs(f.mode, isMode) &&
  optionalIsVArray(f.tiers, isFeatureTier) &&
  !(f.base !== undefined && f.tiers) &&
  optionalIs(f.aggregate, isAggregate)

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

export type Mode = 'graduated' | 'volume'
export const isMode = (m: any): m is Mode => m === 'graduated' || m === 'volume'

export interface FeatureTier {
  upto?: number
  price?: number
  base?: number
}

const isPosInt = (n: any): boolean => Number.isInteger(n) && n > 0
const isNonNegInt = (n: any): boolean => Number.isInteger(n) && n >= 0
const isNonNegNum = (n: any): boolean =>
  typeof n === 'number' && isFinite(n) && n >= 0

export const isFeatureTier = (t: any): t is FeatureTier =>
  hasOnly(t, 'upto', 'price', 'base') &&
  optionalIs(t.upto, isPosInt) &&
  optionalIs(t.price, isNonNegNum) &&
  optionalIs(t.base, isNonNegInt)

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

export type PlanName = `plan:${string}@${string}`
export type FeatureNameVersioned = `${FeatureName}@${PlanName}`
export type VersionedFeatureName = FeatureNameVersioned
export type Features = PlanName | FeatureNameVersioned

export const isPlanName = (p: any): p is PlanName =>
  typeof p === 'string' && /^plan:[a-zA-Z0-9:]+@[a-zA-Z0-9]+$/.test(p)

export const isFeatureNameVersioned = (f: any): f is FeatureNameVersioned =>
  typeof f === 'string' &&
  /^feature:[a-zA-Z0-9:]+@plan:[a-zA-Z0-9:]+@[a-zA-Z0-9]+$/.test(f)
export const isVersionedFeatureName = isFeatureNameVersioned

export const isFeatures = (f: any): f is Features =>
  isPlanName(f) || isFeatureNameVersioned(f)

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

export interface Phase {
  effective?: Date
  features: Features[]
  trial?: boolean
}

export interface CancelPhase {}

const isDate = (d: any): d is Date => isObj(d) && d instanceof Date

export const isPhase = (p: any): p is Phase =>
  isObj(p) &&
  optionalIs(p.effective, isDate) &&
  optionalType(p.trial, 'boolean') &&
  isVArray(p.features, isFeatures)

export interface CheckoutParams {
  cancelUrl?: string
  features?: Features | Features[]
  trialDays?: number
}

// change when /v1/checkout api lands
export interface CheckoutRequest {
  org: OrgName
  phases?: Phase[]
  checkout: {
    success_url: string
    cancel_url?: string
  }
}

export interface CheckoutResponse {
  checkout_url: string
}

export interface ScheduleRequest {
  org: OrgName
  phases?: Phase[] | [CancelPhase]
  info?: OrgInfo
}

/**
 * @deprecated alias for ScheduleRequest
 */
export type SubscribeRequest = ScheduleRequest

export interface ScheduleResponse {}

export interface SubscribeParams {
  effective?: Date
  info?: OrgInfo
  trialDays?: number
}

export interface ScheduleParams {
  info?: OrgInfo
}

export interface PhasesResponse {
  org: OrgName
  phases: Phase[]
}

export interface ReportParams {
  at?: Date
  clobber?: boolean
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

export interface OrgInfo {
  email: string
  name: string
  description: string
  phone: string
  metadata: { [key: string]: string }
}

export type LookupOrgResponse = WhoIsResponse & OrgInfo

export interface PushResult {
  feature: FeatureNameVersioned
  status: string
  reason: string
}

export interface PushResponse {
  results?: PushResult[]
}

export interface WhoAmIResponse {
  id: string
  email: string
  key_source: string
  isolated: boolean
  url: string
}

// errors
export interface ErrorResponse {
  status: number
  code: string
  message: string
}
export const isErrorResponse = (e: any): e is ErrorResponse =>
  isObj(e) &&
  typeof e.status === 'number' &&
  typeof e.message === 'string' &&
  typeof e.code === 'string'

export const isTierError = (e: any): e is TierError =>
  isObj(e) && e instanceof TierError

export class Answer {
  ok: boolean
  feature: FeatureName
  org: OrgName
  client: Tier
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

  async report(n: number = 1, options?: ReportParams) {
    return this.client.report(this.org, this.feature, n, options)
  }
}

export class TierError extends Error {
  public path: string
  public requestData: any
  public status: number
  public code?: string
  public responseData: any

  constructor(path: string, reqBody: any, status: number, resBody: any) {
    if (isErrorResponse(resBody)) {
      super(resBody.message)
      this.code = resBody.code
    } else {
      super('Tier request failed')
    }
    this.path = path
    this.requestData = reqBody
    this.status = status
    this.responseData = resBody
  }
}

// actual client class
export class Tier {
  readonly fetch: typeof fetch
  readonly sidecar: string

  constructor({
    sidecar,
    fetchImpl = globalThis.fetch,
    debug = false,
  }: {
    sidecar: string
    fetchImpl?: typeof fetch
    debug?: boolean
  }) {
    this.fetch = fetchImpl
    this.debug = !!debug
    this.sidecar = sidecar
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
    const u = new URL(path, this.sidecar)
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
    const res = await this.fetch(u.toString())
    const text = await res.text()
    let responseData: any
    try {
      responseData = JSON.parse(text)
    } catch (er) {
      responseData = text
      throw new TierError(path, query, res.status, text)
    }
    if (res.status !== 200) {
      throw new TierError(path, query, res.status, responseData)
    }
    return responseData as T
  }

  private async apiPost<TReq, TRes = {}>(
    path: string,
    body: TReq
  ): Promise<TRes> {
    const u = new URL(path, this.sidecar)
    const res = await this.fetch(u.toString(), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    this.debugLog('POST', u.pathname, body)
    if (res.status < 200 || res.status > 299) {
      let responseData: any
      const text = await res.text()
      try {
        responseData = JSON.parse(text)
      } catch (e) {
        responseData = text
      }
      throw new TierError(path, body, res.status, responseData)
    }
    return (await res.json()) as TRes
  }

  async lookupLimits(org: OrgName): Promise<Limits> {
    return await this.apiGet<Limits>('/v1/limits', { org })
  }

  async lookupLimit(org: OrgName, feature: FeatureName): Promise<Usage> {
    const limits = await this.apiGet<Limits>('/v1/limits', { org })
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
    return await this.apiPost<ReportRequest>('/v1/report', req)
  }

  // XXX: this method will change when /v1/checkout arrives
  // For now, it's basically copypasta from tier.subscribe()
  public async checkout(
    org: OrgName,
    successUrl: string,
    params: CheckoutParams = {}
  ): Promise<CheckoutResponse> {
    const cr: CheckoutRequest = {
      org,
      checkout: {
        success_url: successUrl,
        cancel_url: params.cancelUrl,
      },
    }
    const { features, trialDays } = params
    if (features) {
      cr.phases = featuresToPhases(features, { trialDays })
    }
    return await this.apiPost<CheckoutRequest, CheckoutResponse>(
      '/v1/subscribe',
      cr
    )
  }

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

  public async cancel(org: OrgName) {
    const cp: CancelPhase = {}
    const sr: ScheduleRequest = { org, phases: [cp] }
    return await this.apiPost<ScheduleRequest, ScheduleResponse>(
      '/v1/subscribe',
      sr
    )
  }

  public async schedule(
    org: OrgName,
    phases?: Phase[],
    { info }: ScheduleParams = {}
  ) {
    const sr: ScheduleRequest = { org, phases, info }
    return await this.apiPost<ScheduleRequest, ScheduleResponse>(
      '/v1/subscribe',
      sr
    )
  }

  public async updateOrg(org: OrgName, info: OrgInfo) {
    const sr: ScheduleRequest = { org, info }
    return await this.apiPost<ScheduleRequest, ScheduleResponse>(
      '/v1/subscribe',
      sr
    )
  }

  public async whois(org: OrgName): Promise<WhoIsResponse> {
    // don't send back an `info:null`
    const res = await this.apiGet<WhoIsResponse>('/v1/whois', { org })
    return {
      org: res.org,
      stripe_id: res.stripe_id,
    }
  }

  // note: same endpoint as whois, but when include=info is set, this hits
  // stripe every time and cannot be cached.
  public async lookupOrg(org: OrgName): Promise<LookupOrgResponse> {
    return await this.apiGet<LookupOrgResponse>('/v1/whois', {
      org,
      include: 'info',
    })
  }

  public async lookupPhase(org: OrgName): Promise<CurrentPhase> {
    const resp = await this.apiGet<CurrentPhaseResponse>('/v1/phase', { org })
    return {
      ...resp,
      effective: new Date(resp.effective),
    }
  }

  public async pull(): Promise<Model> {
    return this.apiGet<Model>('/v1/pull')
  }

  async pullLatest(): Promise<Model> {
    const model = await this.pull()
    const plans: { [k: PlanName]: Plan } = Object.create(null)
    const latest: { [k: string]: string } = Object.create(null)
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

  async push(model: Model): Promise<PushResponse> {
    return await this.apiPost<Model, PushResponse>('/v1/push', model)
  }

  async whoami(): Promise<WhoAmIResponse> {
    return await this.apiGet<WhoAmIResponse>('/v1/whoami')
  }

  async can(org: OrgName, feature: FeatureName): Promise<Answer> {
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
   * @deprecated alias for lookupLimits
   */
  async limits(org: OrgName): Promise<Limits> {
    return this.lookupLimits(org)
  }
  /**
   * @deprecated alias for lookupLimit
   */
  async limit(org: OrgName, feature: FeatureName): Promise<Usage> {
    return this.lookupLimit(org, feature)
  }
  /**
   * @deprecated alias for lookupPhase
   */
  public async phase(org: OrgName): Promise<CurrentPhase> {
    return this.lookupPhase(org)
  }
  /* c8 ignore stop */
}
