import fetch, { HeadersInit, Headers, RequestInit } from 'node-fetch'
import { randomUUID } from 'crypto'

// TODO: handle refresh_token flow, right now we just delete
// automatically when the key expires

interface TierErrorRequest {
  method: string
  url: string
  headers: { [k: string]: any }
  body?: any
}
const isTierErrorRequest = (raw: unknown): raw is TierErrorRequest => {
  const req = raw as TierErrorRequest
  return (
    !!req &&
    typeof req === 'object' &&
    typeof req.method === 'string' &&
    typeof req.url === 'string' &&
    !!req.headers &&
    typeof req.headers === 'object'
  )
}

interface TierErrorResponse {
  status: number
  headers: { [k: string]: any }
  body: string
}
const isTierErrorResponse = (raw: unknown): raw is TierErrorResponse => {
  const res = raw as TierErrorResponse
  return (
    !!res &&
    typeof res === 'object' &&
    typeof res.status === 'number' &&
    !!res.headers &&
    typeof res.headers === 'object' &&
    typeof res.body === 'string'
  )
}

export class TierError extends Error {
  request: TierErrorRequest
  response?: TierErrorResponse

  constructor(
    message: string,
    request: TierErrorRequest,
    response?: TierErrorResponse
  ) {
    super(message || 'tier fetch failed')
    this.request = request
    this.response = response
  }

  static is(raw: unknown): raw is TierError {
    const er = raw as TierError
    return (
      !!er &&
      typeof er === 'object' &&
      er instanceof TierError &&
      isTierErrorRequest(er.request) &&
      (er.response === undefined || isTierErrorResponse(er.response))
    )
  }
}

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

type FeaturePrefix = 'feature:'
export type FeatureName = `${FeaturePrefix}${string}`
export interface Plan {
  id?: string
  title?: string
  features: {
    [name: FeatureName]: Feature
  }
}

type PlanPrefix = 'plan:'
export type PlanName = `${PlanPrefix}${string}`
export interface Model {
  plans: {
    [name: PlanName]: Plan
  }
}

export interface StripeOptions {
  publishableKey: string
  accountID: string
  clientSecret: string
}

export interface AuthStore {
  get: (
    cwd: string,
    apiUrl: string
  ) => DeviceAccessTokenSuccessResponse | undefined
  set: (
    cwd: string,
    apiUrl: string,
    token: DeviceAccessTokenSuccessResponse
  ) => any
  delete: (cwd: string, apiUrl: string) => any
  [key: string]: any
}

import { encode } from 'querystring'
const grant_type = 'urn:ietf:params:oauth:grant-type:device_code'

// TODO: abstract all login stuff into a TierClientCLI class, so that we're
// not importing it where tierweb uses it.
// store tokens in ~/.config/tier/tokens/${hash(cwd)}
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  unlinkSync,
  lstatSync,
} from 'fs'

import { createHash } from 'crypto'
import { resolve } from 'path'

const hash = (str: string) => createHash('sha512').update(str).digest('hex')

const defaultAuthStore: AuthStore = {
  debug:
    /\btier\b/.test(process.env.NODE_DEBUG || '') ||
    process.env.TIER_DEBUG === '1',

  get: (cwd, apiUrl) => {
    if (defaultAuthStore.debug) {
      console.error('get token', { cwd, apiUrl })
    }
    if (!process.env.HOME) {
      throw new Error('no $HOME directory set')
    }

    const h = hash(hash(cwd) + hash(apiUrl))
    const file = resolve(process.env.HOME, '.config/tier/tokens', h)
    if (defaultAuthStore.debug) {
      console.error('file', file)
    }

    try {
      const st = lstatSync(file)
      // immediately stop trusting it if it smells funny.
      if (!st.isFile() || (st.mode & 0o777) !== 0o600 || st.nlink !== 1) {
        throw new Error('invalid token store file type')
      }
      const record = JSON.parse(readFileSync(file, 'utf8'))
      if (!Array.isArray(record) || record.length !== 4) {
        throw new Error('token file invalid')
      }
      const [token, born, url, sig] = record
      if (url !== apiUrl) {
        throw new Error('token file invalid host')
      }
      // not security really, just fs corruption defense
      if (sig !== hash(JSON.stringify([token, born, url]))) {
        throw new Error('token file corrupted')
      }
      if (token.expires_in) {
        // TODO: refresh_token flow?  would need to expose this case somehow,
        // rather than just deleting the record.
        const now = Date.now()
        if (now > born + token.expires_in * 1000) {
          throw new Error('token expired')
        }
      }
      if (!token.access_token) {
        throw new Error('no access_token found in record')
      }
      return token
    } catch (er) {
      if (defaultAuthStore.debug) {
        const m =
          (er &&
            typeof er === 'object' &&
            er instanceof Error &&
            er?.message) ||
          er

        console.error(cwd, m)
      }
      defaultAuthStore.delete(cwd, apiUrl)
    }
  },

  set: (cwd, apiUrl, token) => {
    if (!process.env.HOME) {
      throw new Error('no $HOME directory set')
    }
    const h = hash(hash(cwd) + hash(apiUrl))
    const root = resolve(process.env.HOME, '.config/tier/tokens')
    const file = resolve(root, h)
    mkdirSync(root, { recursive: true, mode: 0o700 })
    const born = Date.now()
    const sig = hash(JSON.stringify([token, born, apiUrl]))
    if (defaultAuthStore.debug) {
      const { access_token, refresh_token, ...redacted } = token
      Object.assign(redacted as DeviceAccessTokenSuccessResponse, {
        access_token: '(redacted)',
        refresh_token: '(redacted)',
      })
      console.error('WRITE TOKEN FILE', file, [redacted, born, apiUrl, sig])
    }
    const j = JSON.stringify([token, born, apiUrl, sig])
    writeFileSync(file, j, { mode: 0o600 })
  },

  delete: (cwd, apiUrl) => {
    if (!process.env.HOME) {
      throw new Error('no $HOME directory set')
    }
    const h = hash(hash(cwd) + hash(apiUrl))
    const root = resolve(process.env.HOME, '.config/tier/tokens')
    const file = resolve(root, h)
    try {
      unlinkSync(file)
    } catch (er) {
      if (
        !er ||
        typeof er !== 'object' ||
        (er as { code?: string })?.code !== 'ENOENT'
      ) {
        throw er
      }
    }
  },
}

import nfPackage from 'node-fetch/package.json'
const USER_AGENT = (() => {
  const pj = readFileSync(resolve(__dirname, '../package.json'))
  const pkg = JSON.parse(pj.toString('utf8'))
  return `tier ${pkg.name}@${pkg.version} node-fetch/${nfPackage.version} node/${process.version}`
})()

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

type OrgPrefix = 'org:'
export type OrgName = `${OrgPrefix}${string}`

export type Reservation = any // TODO
export type Schedule = any // TODO

const wait = async (n: number) => await new Promise(r => setTimeout(r, n))

const toBasic = (key: string) =>
  `Basic ${Buffer.from(key + ':').toString('base64')}`
const toBearer = (key: string) => `Bearer ${key}`

enum AuthType {
  BASIC = 'basic',
  BEARER = 'bearer',
}

const isAuthType = (at: any): at is AuthType =>
  typeof at === 'string' && (at === AuthType.BASIC || at === AuthType.BEARER)

const DEFAULT_TIER_API_URL = 'https://api.tier.run'
const DEFAULT_TIER_WEB_URL = 'https://tier.run'
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

const fixUrl = (url: string): string | undefined => {
  try {
    return new URL(url).origin
  } catch (_) {
    return undefined
  }
}

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
      ...settings
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

export class TierClient {
  apiUrl: string
  webUrl: string | undefined
  tierKey: string
  authType: AuthType
  clientID: string
  authStore: AuthStore

  static fromCwd(cwd: string, options: MaybeSettings = {}): TierClient {
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

  constructor(options: MaybeSettings) {
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

  // validate that a path is allowed, and pick the host to send it to
  tierUrl (path: string): string {
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

  debug(...args: any[]): void {}

  logout(cwd: string): void {
    this.authStore.delete(cwd, this.apiUrl)
  }

  async initLogin(cwd: string): Promise<DeviceAuthorizationResponse> {
    // start the initialization
    this.clientID = randomUUID()
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
    }).catch(er => {
      if (
        er &&
        er.response &&
        er.response.body &&
        typeof er.response.body === 'string' &&
        er.response.headers &&
        typeof er.response.headers === 'object' &&
        er.response.headers['content-type'].startsWith('application/json')
      ) {
        return JSON.parse(er.response.body)
      }
      throw er
    })

    const { error } = res as { error?: string }
    const success = res as DeviceAccessTokenSuccessResponse
    if (!error && success.access_token) {
      const { token_type } = success
      if (!isAuthType(token_type)) {
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

    const reqForError = () => ({
      method: options.method || 'GET',
      url,
      headers: Object.fromEntries(
        [...new Headers(options.headers).entries()].map(([k, v]) => [
          k,
          k === 'authorization' ? '(redacted)' : v,
        ])
      ),
      body: options.body,
    })
    this.debug(reqForError())

    const res = await fetch(url, options).catch(er => {
      if (er && typeof er === 'object' && er instanceof Error) {
        const msg = er.message || 'tier fetch failed'
        const ter = new TierError(msg, reqForError())
        this.debug('fetch error, no response', er, ter)
        throw ter
      } else {
        throw er
      }
    })
    if (!res.ok) {
      const ter = new TierError('tier fetch failed', reqForError(), {
        status: res.status,
        headers: Object.fromEntries(res.headers.entries()),
        body: await res.text(),
      })
      this.debug('not-ok response', ter)
      throw ter
    }
    return (await res.json()) as T
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

  async postOK<T>(path: string, body: { [key: string]: any }): Promise<T> {
    this.debug(`POST ${path}`, body)
    return await this.fetchOK<T>(path, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  }

  async reserveN(
    now: Date | null,
    org: OrgName,
    feature: FeatureName,
    n: number
  ): Promise<Reservation> {
    // TODO(bmizerany): hook this up
    return await this.postOK<Reservation>('/api/v1/reserve', {
      org,
      feature,
      n,
      now: now?.toISOString(),
    })
  }

  async lookupSchedule(org: OrgName): Promise<Schedule> {
    return await this.getOK<Schedule>('/api/v1/schedule?org=' + org)
  }

  async ping(): Promise<any> {
    return await this.getOK<any>('/api/v1/whoami')
  }

  async stripeOptions(org: OrgName): Promise<StripeOptions> {
    return await this.postOK<StripeOptions>('/api/v1/stripe/options', {
      org,
    })
  }

  async appendPhase(
    org: OrgName,
    plan: PlanName,
    effective?: Date
  ): Promise<any> {
    return await this.postOK<any>('/api/v1/append', {
      org,
      plan,
      effective: effective?.toISOString(),
    })
  }

  async pushModel(model: Model): Promise<null> {
    return await this.postOK<null>('/api/v1/push', model)
  }

  async pullModel(): Promise<Model> {
    return this.getOK<Model>('/api/v1/pull')
  }

  async cannot(org: OrgName, feature: FeatureName): Promise<boolean> {
    try {
      await this.reserveN(new Date(), org, feature, 1)
      return false
    } catch (_) {
      return true
    }
  }

  static get NO_AUTH() {
    return '<nil>'
  }
}
