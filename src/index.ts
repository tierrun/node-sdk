import { randomBytes, randomUUID } from 'crypto'
// TODO: abstract all login stuff into a TierClientCLI class, so that we're
// not importing it where tierweb uses it.
// store tokens in ~/.config/tier/tokens/${hash}
import { readFileSync } from 'fs'
import fetch, { Headers, HeadersInit, RequestInit } from 'node-fetch'
import nfPackage from 'node-fetch/package.json'
import { resolve } from 'path'
import { encode } from 'querystring'
import { AuthStore, defaultAuthStore } from './auth-store'
import { Reservation, ReservationFromTierd } from './reservation'

const REFUND = Symbol('tier refund')

// old node versions don't have a randomUUID method
/* c8 ignore start */
const uuid =
  typeof randomUUID === 'function'
    ? randomUUID
    : () =>
        randomBytes(16)
          .toString('hex')
          .replace(/^(.{8})(.{4})(.{4})(.{4})/, '$1-$2-$3-$4-')
/* c8 ignore stop */

// TODO: handle refresh_token flow, right now we just delete
// automatically when the key expires

export interface TierErrorRequest {
  method: string
  url: string
  headers: { [k: string]: any }
  body?: any
}

export interface TierErrorResponse {
  status: number
  headers: { [k: string]: any }
  body: string
}

export class TierError extends Error {
  request: TierErrorRequest
  response?: TierErrorResponse

  constructor(
    message: string,
    request: TierErrorRequest,
    response?: TierErrorResponse
  ) {
    super(message)
    this.request = request
    this.response = response
    Error.captureStackTrace(this, TierClient.prototype.fetchOK)
  }

  get name() {
    return 'TierError'
  }
}

export const isTierError = (er: any): er is TierError =>
  !!er && typeof er === 'object' && er instanceof TierError

export interface Tier {
  upto?: number
  price?: number
  base?: number
}

export enum Mode {
  Graduated = 'graduated',
  Volume = 'volume',
}

export interface Feature {
  type?: Mode
  reset?: string
  aggregate?: string
  tiers?: Array<Tier>
}

export type FeaturePrefix = 'feature:'
export type FeatureName = `${FeaturePrefix}${string}`
export interface Plan {
  id?: string
  title?: string
  features?: {
    [name: FeatureName]: Feature
  }
}

export type PlanPrefix = 'plan:'
export type PlanName = `${PlanPrefix}${string}`
export interface Model {
  plans: {
    [name: PlanName]: Plan
  }
}

export interface PricingPage {
  id?: string
  name: string
  signupURL?: string
  plans: Plan[]
}

export interface StripeOptions {
  publishableKey: string
  accountID: string
  clientSecret: string
}

export interface SetupIntent {
  id: string
  status: string
  payment_method?: string
  last_setup_error: {
    code?: string
    decline_code?: string
    doc_url?: string
    message?: string
    param?: string
    type?: string
  }
  next_action: {
    redirect_to_url: {
      return_url?: string
      url?: string
    }
    type?: string
  }
}

export const isSetupIntent = (si: any): si is SetupIntent =>
  !!si &&
  typeof si === 'object' &&
  !!si.id &&
  typeof si.id === 'string' &&
  typeof si.status === 'string' &&
  !!si.status &&
  (si.payment_method === undefined ||
    (!!si.payment_method && typeof si.payment_method === 'string')) &&
  typeof si.last_setup_error === 'object' &&
  !!si.last_setup_error &&
  typeof si.next_action?.redirect_to_url === 'object' &&
  !!si.next_action.redirect_to_url

export interface DeviceAuthorizationSuccessResponse {
  device_code: string
  user_code: string
  verification_uri: string
  verification_uri_complete?: string
  expires_in: number
  interval?: number
}

export interface DeviceAccessTokenSuccessResponse {
  access_token: string
  token_type: string
  expires_in?: number
  refresh_token?: string
  scope?: string
}

export interface ErrorResponse {
  error: string
}

export type DeviceAuthorizationResponse =
  | DeviceAuthorizationSuccessResponse
  | ErrorResponse

export type DeviceAccessTokenResponse =
  | DeviceAccessTokenSuccessResponse
  | ErrorResponse

export type { AuthStore } from './auth-store'
export { Reservation } from './reservation'

const grant_type = 'urn:ietf:params:oauth:grant-type:device_code'

const USER_AGENT = (() => {
  const pj = readFileSync(resolve(__dirname, '../package.json'))
  const pkg = JSON.parse(pj.toString('utf8'))
  return `tier ${pkg.name}@${pkg.version} node-fetch/${nfPackage.version} node/${process.version}`
})()

export type OrgPrefix = 'org:'
export type OrgName = `${OrgPrefix}${string}`

interface PhaseFromTierd {
  plan: PlanName
  // date strings
  effective: string
  scheduled?: string
  // more details of phase/schedules TBD
  [key: string]: any
}

export interface Phase {
  plan: PlanName
  effective: Date
  scheduled?: Date
  [key: string]: any
}

interface ScheduleFromTierd {
  current: number
  phases: PhaseFromTierd[]
  // more details of phase/schedules TBD
  [key: string]: any
}

export interface Schedule {
  current: number
  phases: Phase[]
  [key: string]: any
}

export interface PaymentMethod {
  id: string
  billing_details: {
    address: {
      city?: string
      country?: string
      line1?: string
      line2?: string
      postal_code?: string
      state?: string
    }
    email?: string
    name?: string
    phone?: string
  }
  card: {
    brand?: string
    exp_month?: number
    exp_year?: number
    last4?: string
  }
}

export interface OrgDetails {
  id: string
  name: string
  default_payment_method?: PaymentMethod
  delinquent?: boolean
  discount?: number
  phone?: string
  email?: string
  live_mode: boolean
  url?: string
}

const wait = async (n: number) => await new Promise(r => setTimeout(r, n))

const toBasic = (key: string) =>
  `Basic ${Buffer.from(key + ':').toString('base64')}`
const toBearer = (key: string) => `Bearer ${key}`

export enum AuthType {
  BASIC = 'basic',
  BEARER = 'bearer',
}

const isAuthType = (at: any): at is AuthType =>
  typeof at === 'string' && (at === AuthType.BASIC || at === AuthType.BEARER)

const DEFAULT_TIER_API_URL = 'https://api.tier.run'
const DEFAULT_TIER_WEB_URL = 'https://app.tier.run'
const DEFAULT_TIER_AUTH_TYPE = AuthType.BASIC

type MaybeSettings = {
  apiUrl?: string | undefined
  webUrl?: string | undefined
  authType?: string | undefined
  tierKey?: string | undefined
  authStore?: AuthStore
  debug?: boolean
  [k: string]: any
}

type Settings = {
  apiUrl: string
  webUrl: string | undefined
  authType: AuthType
  tierKey: string
  authStore: AuthStore
  debug: boolean
  [k: string]: any
}

const getEnvSettings = (): MaybeSettings => {
  const {
    TIER_DEBUG,
    NODE_DEBUG,
    TIER_KEY,
    TIER_API_URL,
    TIER_WEB_URL,
    TIER_AUTH_TYPE,
  } = process.env
  return {
    apiUrl: TIER_API_URL,
    webUrl: TIER_WEB_URL,
    authType: TIER_AUTH_TYPE,
    tierKey: TIER_KEY,
    authStore: defaultAuthStore,
    debug: TIER_DEBUG === '1' || /\btier\b/i.test(NODE_DEBUG || ''),
  }
}

const settingsOrEnv = ({
  tierKey,
  apiUrl,
  webUrl,
  authType,
  authStore,
  debug,
  ...settings
}: MaybeSettings): Settings => {
  const fromEnv = getEnvSettings()
  return validSettings({
    apiUrl: apiUrl || fromEnv.apiUrl,
    webUrl: webUrl || fromEnv.webUrl,
    authType: authType || fromEnv.authType,
    tierKey: tierKey || fromEnv.tierKey,
    authStore: authStore || defaultAuthStore,
    debug: debug === undefined ? fromEnv.debug : debug,
    ...settings,
  })
}

const validAuthType = (tokenType: string | undefined): AuthType => {
  switch (tokenType) {
    case undefined:
      return DEFAULT_TIER_AUTH_TYPE
    case AuthType.BEARER:
    case AuthType.BASIC:
      return tokenType
    default:
      throw new Error(
        `Unsupported auth type: '${tokenType}'. Must be 'basic' or 'bearer'`
      )
  }
}

const fixUrl = (url: string): string => new URL(url).origin

const validSettings = ({
  authStore = defaultAuthStore,
  tierKey,
  apiUrl,
  webUrl,
  authType,
  debug = false,
  ...settings
}: MaybeSettings): Settings => {
  if (!tierKey) {
    throw new Error('must provide tierKey in options or env.TIER_KEY')
  }

  const fixedApiUrl = apiUrl && fixUrl(apiUrl)
  const fixedWebUrl = webUrl && fixUrl(webUrl)
  if (fixedApiUrl !== apiUrl || fixedWebUrl !== webUrl) {
    return validSettings({
      apiUrl: fixedApiUrl,
      webUrl: fixedWebUrl,
      authStore,
      tierKey,
      debug,
      ...settings,
    })
  }

  // api not set, or set to the public default, use defaults
  if (!apiUrl || apiUrl === DEFAULT_TIER_API_URL) {
    return {
      apiUrl: DEFAULT_TIER_API_URL,
      webUrl: DEFAULT_TIER_WEB_URL,
      authType: validAuthType(authType),
      tierKey,
      authStore,
      debug,
      ...settings,
    }
  }

  // don't use default auth url if apiUrl changed
  if (webUrl === DEFAULT_TIER_WEB_URL) {
    return {
      apiUrl,
      webUrl: undefined,
      authType: validAuthType(authType),
      tierKey,
      authStore,
      debug,
      ...settings,
    }
  }

  // both set, use them
  return {
    apiUrl,
    webUrl,
    authType: validAuthType(authType),
    tierKey,
    authStore,
    debug,
    ...settings,
  }
}

// If the response body was JSON, try to parse and return that
// If not, throw the original error.
const tryParseErrorResponse = (er: any) => {
  if (
    isTierError(er) &&
    er.response &&
    er.response.body &&
    typeof er.response.body === 'string' &&
    er.response.headers &&
    typeof er.response.headers === 'object' &&
    typeof er.response.headers['content-type'] === 'string' &&
    er.response.headers['content-type'].startsWith('application/json')
  ) {
    try {
      return JSON.parse(er.response.body)
    } catch (_) {}
  }
  throw er
}

type Operation = 'incr' | 'decr' // TODO: 'clobber' | 'gincr' | 'gdecr'

export class TierClient {
  apiUrl: string
  webUrl: string | undefined
  tierKey: string
  authType: AuthType
  clientID: string
  authStore: AuthStore

  static fromCwd(
    cwd: string = process.cwd(),
    options: MaybeSettings = {}
  ): TierClient {
    const {
      authStore = defaultAuthStore,
      apiUrl,
      webUrl,
      ...settings
    } = settingsOrEnv({ ...options, tierKey: TierClient.NO_AUTH })

    const token = authStore.get(cwd, apiUrl)
    if (!token || !token.access_token) {
      throw new Error('please run: tier login')
    }

    return new TierClient({
      ...settings,
      apiUrl,
      webUrl,
      tierKey: token.access_token,
      authType: validAuthType(token.token_type),
    })
  }

  static fromEnv(options: MaybeSettings = {}): TierClient {
    return new TierClient(settingsOrEnv(options))
  }

  constructor(options: MaybeSettings = {}) {
    const { apiUrl, webUrl, tierKey, authType, authStore, debug } =
      settingsOrEnv(options)

    this.apiUrl = apiUrl
    this.webUrl = webUrl
    this.tierKey = tierKey
    this.authType = authType
    this.authStore = authStore
    if (debug) {
      this.debug = console.error
    }
    this.clientID = ''
  }

  tierJSUrl(): string {
    return String(new URL('/tier.js', this.webUrl || 'https://app.tier.run'))
  }

  // validate that a path is allowed, and pick the host to send it to
  tierUrl(path: string): string {
    const base = path.startsWith('/api/v1/')
      ? this.apiUrl
      : path.startsWith('/auth/') || path.startsWith('/web/')
      ? this.webUrl
      : null
    if (!base) {
      throw new Error(`invalid path: ${path}`)
    }
    return String(new URL(path, base))
  }

  debug(..._: any[]): void {}

  logout(cwd: string): void {
    this.authStore.delete(cwd, this.apiUrl)
  }

  async initLogin(): Promise<DeviceAuthorizationResponse> {
    // start the initialization
    this.clientID = uuid()
    return await this.postFormOK<DeviceAuthorizationResponse>('/auth/cli', {
      client_id: this.clientID,
    })
  }

  async awaitLogin(
    cwd: string,
    authResponse: DeviceAuthorizationSuccessResponse
  ): Promise<DeviceAccessTokenResponse> {
    // post on the endpoint with the grant_type and device_id until done
    // presumably whatever called this method is showing the user some
    // instructions
    const { device_code, interval = 10 } = authResponse
    await wait(interval * 1000)
    const res = await this.postFormOK<DeviceAccessTokenResponse>('/auth/cli', {
      client_id: this.clientID,
      device_code,
      grant_type,
    })
      .catch(er => tryParseErrorResponse(er))
      .catch(e => {
        this.clientID = ''
        throw e
      })

    const { error } = res as { error?: string }
    const success = res as DeviceAccessTokenSuccessResponse
    if (!error && success.access_token) {
      const { token_type } = success
      if (!isAuthType(token_type)) {
        this.clientID = ''
        throw new Error('Received unsupported token type: ' + token_type)
      }
      // auth success
      this.clientID = ''
      this.authStore.set(cwd, this.apiUrl, success)
      return res
    }

    switch (error) {
      case 'slow_down': {
        authResponse.interval = interval + 5
        return this.awaitLogin(cwd, authResponse)
      }
      case 'authorization_pending':
        return this.awaitLogin(cwd, authResponse)
      default:
        this.clientID = ''
        throw new Error('failed: ' + error)
    }
  }

  // all or nothing
  authorize(h: HeadersInit | undefined): Headers {
    if (this.tierKey !== TierClient.NO_AUTH) {
      const withAuth = new Headers(h)
      withAuth.set(
        'authorization',
        this.authType === 'basic'
          ? toBasic(this.tierKey)
          : toBearer(this.tierKey)
      )
      return withAuth
    } else {
      const withoutAuth = new Headers(h)
      withoutAuth.delete('authorization')
      return withoutAuth
    }
  }

  async fetchOK<T>(path: string, options: RequestInit): Promise<T> {
    const url = this.tierUrl(path)
    options.headers = this.authorize(options.headers)
    options.headers.set('user-agent', USER_AGENT)
    options.headers.set('accept', 'application/json')

    let errorReqBody = options.body
    if (Buffer.isBuffer(options.body)) {
      errorReqBody = options.body.toString()
    }
    if (
      typeof errorReqBody === 'string' &&
      options.headers.get('content-type') === 'application/json'
    ) {
      try {
        errorReqBody = JSON.parse(errorReqBody)
        /* c8 ignore start */
      } catch (_) {}
      /* c8 ignore stop */
    }

    const reqForError = () => ({
      method: options.method || 'GET',
      url,
      headers: Object.fromEntries(
        [...new Headers(options.headers).entries()].map(([k, v]) => [
          k,
          k === 'authorization' ? '(redacted)' : v,
        ])
      ),
      body: errorReqBody,
    })
    this.debug(reqForError())

    let res
    try {
      res = await fetch(url, options)
    } catch (err) {
      // fetch() can only ever throw actual Error objects with
      // a string message but TS wants what it wants.
      const er = err as Error
      /* c8 ignore next */
      const msg = er.message || 'tier fetch failed'
      const ter = new TierError(msg, reqForError())
      this.debug('fetch error, no response', er, ter)
      throw ter
    }

    if (!res.ok) {
      const ter = new TierError('tier fetch failed', reqForError(), {
        status: res.status,
        headers: Object.fromEntries(res.headers.entries()),
        body: await res.text(),
      })
      this.debug('not-ok response', ter)
      throw ter
    }

    let body
    try {
      body = await res.text()
      return JSON.parse(body) as T
      /* c8 ignore start */
    } catch (er) {
      /* c8 ignore stop */
      const ter = new TierError('tier invalid JSON', reqForError(), {
        status: res.status,
        headers: Object.fromEntries(res.headers.entries()),
        body: String(body),
      })
      this.debug('bad json', er, ter)
      throw ter
    }
  }

  async getOK<T>(path: string): Promise<T> {
    this.debug(`GET ${path}`)
    return await this.fetchOK<T>(path, { method: 'GET' })
  }

  async postFormOK<T>(path: string, body: { [key: string]: any }): Promise<T> {
    this.debug(`POST FORM ${path}`, body)
    return await this.fetchOK<T>(path, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: encode(body),
    })
  }

  async postOK<T>(
    path: string,
    body: Buffer | string | { [key: string]: any }
  ): Promise<T> {
    this.debug(`POST ${path}`, body)
    const b: Buffer | string = Buffer.isBuffer(body)
      ? body
      : typeof body === 'string'
      ? Buffer.from(body)
      : Buffer.from(JSON.stringify(body))
    return await this.fetchOK<T>(path, {
      method: 'POST',
      headers: {
        'content-length': String(b.length),
        'content-type': 'application/json',
      },
      body: b,
    })
  }

  async ping(): Promise<any> {
    return await this.getOK<any>('/api/v1/whoami')
  }

  async pushModel(model: Model | string | Buffer): Promise<null> {
    return await this.postOK<null>('/api/v1/push', model)
  }

  async pullModel(): Promise<Model | null> {
    const model = await this.getOK<Model>('/api/v1/pull')
    // if the model invalid or empty, return null
    if (
      !model ||
      typeof model !== 'object' ||
      !model.plans ||
      typeof model.plans !== 'object' ||
      Object.keys(model.plans).length === 0
    ) {
      return null
    }
    return model
  }

  async appendPhase(
    org: OrgName,
    plan: PlanName,
    effective: Date | string | number = new Date()
  ): Promise<any> {
    return await this.postOK<any>('/api/v1/append', {
      org,
      plan,
      effective: new Date(effective).toISOString(),
    })
  }

  async stripeOptions(org: OrgName): Promise<StripeOptions> {
    return await this.postOK<StripeOptions>('/api/v1/stripe/options', {
      org,
    })
  }

  // Call this in the vendor app stripe setup page when we get loaded
  // with ?setup_intent=...&client_secret=...&status=... in the query
  async stripeSetup(org: OrgName, setup_intent: string): Promise<SetupIntent> {
    // note: we may get a non-200 response if stripe had an issue, which
    // we need to address.  if so, throw the parsed body instead of the
    // generic TierError.
    return await this.postOK<SetupIntent>('/api/v1/stripe/setup', {
      org,
      setup_intent,
    }).catch(er => {
      const si = tryParseErrorResponse(er)
      throw isSetupIntent(si) ? si : er
    })
  }

  async lookupOrg(org: OrgName): Promise<OrgDetails> {
    return this.getOK<OrgDetails>('/api/v1/org?org=' + org)
  }

  async lookupSchedule(org: OrgName): Promise<Schedule> {
    const raw: ScheduleFromTierd = await this.getOK<ScheduleFromTierd>(
      '/api/v1/schedule?org=' + org
    )
    // Date-ify the scheduled and effective date strings
    return {
      ...raw,
      phases: raw.phases.map(
        p =>
          ({
            ...p,
            ...{ effective: new Date(p.effective) },
            ...(p.scheduled ? { scheduled: new Date(p.scheduled) } : {}),
          } as Phase)
      ),
    }
  }

  async lookupCurrentPlan(org: OrgName): Promise<PlanName> {
    const schedule = await this.lookupSchedule(org)
    return schedule.phases[schedule.current].plan
  }

  async pullPricingPage(name: string = ''): Promise<PricingPage> {
    const path = `/web/pricing-page/-/${name}`
    return await this.getOK<PricingPage>(path)
  }

  /* c8 ignore start */
  async pushPricingPage(name: string, pp: PricingPage): Promise<null | {}> {
    // TODO
    console.log(name, pp)
    return null
  }
  /* c8 ignore stop */

  /**
   * Record `count` units of usage for the given org and feature.
   */
  async record(
    org: OrgName,
    feature: FeatureName,
    count: number = 1,
    now: Date | string | number = new Date()
  ): Promise<void> {
    await this.reserve(org, feature, count, now)
  }

  /**
   * Reserve N units of feature usage for the specified org, and return
   * a refundable Reservation object.
   */
  async reserve(
    org: OrgName,
    feature: FeatureName,
    count: number = 1,
    now: Date | string | number = new Date(),
    refund?: typeof REFUND
  ): Promise<Reservation> {
    if (count < 0) {
      throw new TypeError('count must be >= 0')
    }

    const isRefund = refund === REFUND
    const op: Operation = isRefund ? 'decr' : 'incr'
    const numberField = isRefund ? 'n' : 'p'

    now = new Date(now)
    const resTier = await this.postOK<ReservationFromTierd>('/api/v1/reserve', {
      org,
      feature,
      [numberField]: count,
      op,
      now: new Date(now).toISOString(),
    })
    return new Reservation(this, org, feature, count, now, resTier, isRefund)
  }

  async commit(res: Reservation) {
    return res.commit()
  }

  async refund(res: Reservation) {
    if (res.isRefund) {
      throw new Error('cannot refund a refund')
    }
    if (res.committed) {
      return res
    }
    return this.reserve(res.org, res.feature, res.count, res.now, REFUND)
  }

  // convenience wrappers for reserve()

  /**
   * Get the current usage as a Reservation object
   * containing "used" and "limit".
   * No side effects, does not record usage.
   */
  async currentUsage(
    org: OrgName,
    feature: FeatureName,
    now: Date | string | number = new Date()
  ): Promise<Reservation> {
    return this.reserve(org, feature, 0, now)
  }

  /**
   * returns true if the user is entitled to reserve the full unit count.
   * No side-effects, does not register usage.
   *
   * Note that the request is point-in-time.  It does not "hold" the value,
   * so a subsequent reservation may still go into overages.
   */
  async can(
    org: OrgName,
    feature: FeatureName,
    n: number = 1,
    now: Date | number | string = new Date()
  ): Promise<boolean> {
    // XXX: refactor this when /api/v1/reserve changes
    const res = await this.currentUsage(org, feature, now)
    const rem = res.limit - res.used
    return rem >= n
  }

  /**
   * Inverse of `can()`
   * Returns true if the user is not allowed to make the reservation
   * fully.
   */
  async cannot(
    org: OrgName,
    feature: FeatureName,
    n: number = 1,
    now: Date | string | number = new Date()
  ): Promise<boolean> {
    return !(await this.can(org, feature, n, now))
  }

  static get NO_AUTH() {
    return '<nil>'
  }
}
