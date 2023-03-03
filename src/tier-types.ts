/**
 * @module types
 */
import {
  hasOnly,
  isDate,
  isKV,
  isNonNegInt,
  isNonNegNum,
  isObj,
  isPosInt,
  isVArray,
  optionalIs,
  optionalIsVArray,
  optionalKV,
  optionalString,
  optionalType,
  unexpectedFields,
} from './is.js'

export interface ClockRequest {
  id?: string
  name?: string
  present: Date | string
}

export interface ClockResponse {
  id: string
  link: string
  present: string
  status: string
}

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

const isCurrency = (c: any): c is Plan['currency'] =>
  typeof c === 'string' && c.length === 3 && c === c.toLowerCase()

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
 * {@link FeatureDefinition} transforms.
 */
export interface Divide {
  by?: number
  rounding?: 'up'
}

/**
 * Test whether a `divide` field is a valid transform config
 */
export const isDivide = (a: any): a is Divide =>
  !!a &&
  typeof a === 'object' &&
  hasOnly(a, 'by', 'rounding') &&
  optionalIs(a.by, isNonNegInt) &&
  optionalIs(a.rounding, (r: any) => r === 'up')

export const validateDivide: (a: any) => void = (
  a: any
): asserts a is Divide => {
  if (!a || typeof a !== 'object') {
    throw 'not an object'
  }
  if (!optionalIs(a.by, isNonNegInt)) {
    throw 'by must be a non-negative integer'
  }
  if (!optionalIs(a.rounding, r => r === 'up')) {
    throw 'rounding must be "up" if set ("down" is default)'
  }
}

/**
 * The definition of a feature within a {@link Plan}.
 */
export interface FeatureDefinition {
  title?: string
  base?: number
  tiers?: FeatureTier[]
  mode?: Mode
  aggregate?: Aggregate
  divide?: Divide
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
  hasOnly(f, 'base', 'tiers', 'mode', 'aggregate', 'title', 'divide') &&
  optionalString(f.title) &&
  optionalIs(f.base, isNonNegNum) &&
  optionalIs(f.mode, isMode) &&
  optionalIsVArray(f.tiers, isFeatureTier) &&
  !(f.base !== undefined && f.tiers) &&
  optionalIs(f.aggregate, isAggregate) &&
  optionalIs(f.divide, isDivide)
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
    throw 'invalid base, must be non-negative number'
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
  if (f.divide !== undefined) {
    try {
      validateDivide(f.divide)
    } catch (er) {
      throw `divide: ${er}`
    }
  }
  const unexpected = unexpectedFields(
    f,
    'base',
    'tiers',
    'mode',
    'aggregate',
    'title',
    'divide'
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
  end?: Date
  features?: FeatureNameVersioned[]
  plans?: PlanName[]
  fragments?: FeatureNameVersioned[]
  trial: boolean
}

export interface CurrentPhaseResponse {
  effective: string
  end?: string
  features?: FeatureNameVersioned[]
  plans?: PlanName[]
  fragments?: FeatureNameVersioned[]
  trial?: boolean
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

/**
 * Test whether a value is a valid {@link Phase}
 */
export const isPhase = (p: any): p is Phase =>
  isObj(p) &&
  optionalIs(p.effective, isDate) &&
  optionalType(p.trial, 'boolean') &&
  isVArray(p.features, isFeatures)

/**
 * Options for the {@link client.Tier.checkout} method
 */
export interface CheckoutParams {
  cancelUrl?: string
  features?: Features | Features[]
  trialDays?: number
  requireBillingAddress?: boolean
}

export interface CheckoutRequest {
  org: OrgName
  success_url: string
  features?: Features[]
  trial_days?: number
  cancel_url?: string
  require_billing_address?: boolean
}

/**
 * Response from the {@link client.Tier.checkout} method, indicating the url
 * that the user must visit to complete the checkout process.
 */
export interface CheckoutResponse {
  url: string
}

export interface ScheduleRequest {
  org: OrgName
  phases?: Phase[] | [CancelPhase]
  info?: OrgInfoJSON
  payment_method_id?: string
}

/**
 * Response from the methods that use the `/v1/subscribe` endpoint.
 */
export interface ScheduleResponse {}

/**
 * Options for the {@link client.Tier.subscribe} method
 */
export interface SubscribeParams {
  effective?: Date
  info?: OrgInfo
  trialDays?: number
  paymentMethodID?: string
}

/**
 * Options for the {@link client.Tier.schedule} method
 */
export interface ScheduleParams {
  info?: OrgInfo
  paymentMethodID?: string
}

export interface PaymentMethodsResponseJSON {
  org: string
  methods: null | string[]
}

/**
 * Response from the {@link client.Tier.lookupPaymentMethods} method
 */
export interface PaymentMethodsResponse {
  org: string
  methods: string[]
}

/**
 * Options for the {@link client.Tier.report} and {@link answer.Answer.report} methods
 */
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

export interface ReportResponse {}

/**
 * Response from the {@link client.Tier.whois} method
 */
export interface WhoIsResponse {
  org: OrgName
  stripe_id: string
}

/**
 * The object shape we send/receive from the API itself.
 * Converted between this and OrgInfo when talking to the API,
 * to avoid the excess of snake case.
 */
export interface OrgInfoJSON {
  email: string
  name: string
  description: string
  phone: string
  invoice_settings: {
    default_payment_method: string
  }
  metadata: { [key: string]: string }
}

/**
 * Object representing an org's billing metadata. Note that any fields
 * not set (other than `metadata`) will be reset to empty `''` values
 * on any update.
 *
 * Used by {@link client.Tier.lookupOrg}, {@link client.Tier.schedule}, and
 * {@link client.Tier.subscribe} methods.
 */
export interface OrgInfo {
  email: string
  name: string
  description: string
  phone: string
  invoiceSettings?: {
    defaultPaymentMethod?: string
  }
  metadata: { [key: string]: string }
}

/**
 * Response from the {@link client.Tier.lookupOrg} method
 */
export type LookupOrgResponse = WhoIsResponse & OrgInfo

/**
 * Raw JSON response from the lookupOrg API route
 */
export type LookupOrgResponseJSON = WhoIsResponse & OrgInfoJSON

/**
 * Object indicating the success status of a given feature and plan
 * when using {@link client.Tier.push}
 */
export interface PushResult {
  feature: FeatureNameVersioned
  status: string
  reason: string
}

/**
 * Response from the {@link client.Tier.push} method
 */
export interface PushResponse {
  results?: PushResult[]
}

/**
 * Response from the {@link client.Tier.whoami} method
 */
export interface WhoAmIResponse {
  id: string
  email: string
  key_source: string
  isolated: boolean
  url: string
}
