// just the client bits, assuming that the sidecar is already
// initialized and running somewhere.

export type OrgName = `org:${string}`
export const isOrgName = (o: any): o is OrgName =>
  typeof o === 'string' && o.startsWith('org:') && o !== 'org:'

export type FeatureName = `feature:${string}`
export const isFeatureName = (f: any): f is FeatureName =>
  typeof f === 'string' &&
  f.startsWith('feature:') &&
  !f.includes('@') &&
  f !== 'feature:'

export interface Model {
  plans: {
    [p: PlanName]: Plan
  }
}

// just keeping the double-negative in one place, since I so often
// type this wrong and get annoyed.
const isVArray = (arr: any[], valTest: (v: any) => boolean) =>
  !arr.some(v => !valTest(v))

const isKV = (
  obj: any,
  keyTest: (k: string) => boolean,
  valTest: (v: any) => boolean
): boolean =>
  !!obj &&
  typeof obj === 'object' &&
  isVArray(Object.keys(obj), keyTest) &&
  isVArray(Object.values(obj), valTest)

export const isModel = (m: any): m is Model =>
  !!m && typeof m === 'object' && isKV(m.plans, isPlanName, isPlan)

export interface Plan {
  title?: string
  features?: {
    [f: FeatureName]: FeatureDefinition
  }
  currency?: string
  interval?: Interval
}

export const isPlan = (p: any): p is Plan =>
  !!p &&
  typeof p === 'object' &&
  (p.title === undefined || typeof p.title === 'string') &&
  (p.features === undefined ||
    isKV(p.features, isFeatureName, isFeatureDefinition)) &&
  (p.currency === undefined || typeof p.currency === 'string') &&
  (p.interval === undefined || isInterval(p.interval))

export type Interval = '@daily' | '@weekly' | '@monthly' | '@yearly'
export const isInterval = (i: any): i is Interval =>
  i === '@daily' || i === '@weekly' || i === '@monthly' || i === '@yearly'

export interface FeatureDefinition {
  title?: string
  base?: number
  tiers?: FeatureTier[]
  mode?: Mode
}
export const isFeatureDefinition = (f: any): f is FeatureDefinition =>
  !!f &&
  typeof f === 'object' &&
  (f.title === undefined || typeof f.title === 'string') &&
  (f.base === undefined ||
    (typeof f.base === 'number' && f.base === Math.floor(f.base))) &&
  (f.mode === undefined || isMode(f.mode)) &&
  (f.tiers === undefined ||
    (Array.isArray(f.tiers) && isVArray(f.tiers, isFeatureTier))) &&
  !(f.base !== undefined && f.tiers)

export type Mode = 'graduated' | 'volume'
export const isMode = (m: any): m is Mode => m === 'graduated' || m === 'volume'

export interface FeatureTier {
  upto?: number
  price?: number
  base?: number
}

export const isFeatureTier = (t: any): t is FeatureTier =>
  !!t &&
  typeof t === 'object' &&
  (t.upto === undefined ||
    (typeof t.upto === 'number' && t.upto === Math.floor(t.upto))) &&
  (t.price === undefined ||
    (typeof t.price === 'number' && t.price === Math.floor(t.price))) &&
  (t.base === undefined ||
    (typeof t.base === 'number' && t.base === Math.floor(t.base)))

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
  typeof p === 'string' && /^plan:[^@]+@[^@]+$/.test(p)

export const isFeatureNameVersioned = (f: any): f is FeatureNameVersioned =>
  typeof f === 'string' && /^feature:[^@]+@plan:[^@]+@[^@]+$/.test(f)
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
}

const isDate = (d: any): d is Date =>
  d && typeof d === 'object' && d instanceof Date

export const isPhase = (p: any): p is Phase =>
  p &&
  typeof p === 'object' &&
  (p.effective === undefined || isDate(p.effective)) &&
  Array.isArray(p.features) &&
  !p.features.some((f: any) => !isFeatures(f))

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
  e &&
  typeof e === 'object' &&
  typeof e.status === 'number' &&
  typeof e.message === 'string' &&
  typeof e.code === 'string'

export const isTierError = (e: any): e is TierError =>
  !!e && typeof e === 'object' && e instanceof TierError

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
    this.debugLog('GET', u.pathname)
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
    this.debugLog('POST', u.pathname)
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

  async limits(org: OrgName): Promise<Limits> {
    return await this.apiGet<Limits>('/v1/limits', { org })
  }

  async limit(org: OrgName, feature: FeatureName): Promise<Usage> {
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
    at?: Date,
    clobber?: boolean
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

  public async subscribe(
    org: OrgName,
    features: Features | Features[],
    effective?: Date
  ): Promise<{}> {
    // deprecated overloading of subscribe() as schedule()
    if (
      Array.isArray(features) &&
      !features.some(f => !isPhase(f)) &&
      effective === undefined
    ) {
      const msg = `Using phase objects with subscribe() is deprecated, please use tier.schedule() for this use case.`
      process.emitWarning(msg, 'DeprecationWarning')
      return await this.schedule(org, features as unknown as Phase[])
    }

    const phases: Phase[] = !Array.isArray(features)
      ? [{ features: [features], effective }]
      : [{ features, effective }]
    return await this.schedule(org, phases)
  }

  public async schedule(org: OrgName, phases: Phase[]) {
    const sr: SubscribeRequest = { org, phases }
    return await this.apiPost<SubscribeRequest>('/v1/subscribe', sr)
  }

  public async whois(org: OrgName): Promise<WhoIsResponse> {
    return await this.apiGet<WhoIsResponse>('/v1/whois', { org })
  }

  public async phase(org: OrgName): Promise<CurrentPhase> {
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
}
