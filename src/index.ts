import fetch, { HeadersInit, Headers, RequestInit } from 'node-fetch'
import { randomUUID } from 'node:crypto'

export interface TierError extends Error {
  request: {
    method?: string
    path: string
    baseUrl: string
    headers: { [k: string]: any }
  }
  response: {
    status: number
    headers: { [k: string]: any }
    body: string
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
  get: (cwd: string) => string | undefined
  set: (cwd: string, token: string) => any
  delete: (cwd: string) => any
  [key: string]: any
}

import querystring from 'node:querystring'
const grant_type = 'urn:ietf:params:oauth:grant-type:device_code'

// TODO: abstract all login stuff into a TierClientCLI class, so that we're
// not importing it where tierweb uses it.
// store tokens in ~/.config/tier/tokens/${hash(cwd)}
import { readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
const hash = (str: string) => createHash('sha512').update(str).digest('hex')
const defaultAuthStore: AuthStore = {
  get: cwd => {
    if (!process.env.HOME) {
      throw new Error('no $HOME directory set')
    }
    const h = hash(cwd)
    const file = resolve(process.env.HOME, '.config/tier/tokens', h)
    try {
      return readFileSync(file, 'utf8')
    } catch (_) {}
  },
  set: (cwd, token) => {
    if (!process.env.HOME) {
      throw new Error('no $HOME directory set')
    }
    const h = hash(cwd)
    const root = resolve(process.env.HOME, '.config/tier/tokens')
    const file = resolve(root, h)
    mkdirSync(root, { recursive: true, mode: 0o700 })
    writeFileSync(file, token)
  },
  delete: cwd => {
    if (!process.env.HOME) {
      throw new Error('no $HOME directory set')
    }
    const h = hash(cwd)
    const root = resolve(process.env.HOME, '.config/tier/tokens')
    const file = resolve(root, h)
    try {
      unlinkSync(file)
    } catch (_) {}
  },
}

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

export class TierClient {
  baseUrl: string
  tierKey: string
  clientID: string
  authStore: AuthStore

  static fromCwd(cwd: string, options: { [k: string]: any } = {}): TierClient {
    if (process.env.TIER_URL === undefined) {
      throw new Error('must set TIER_URL in environment')
    }
    const { authStore = defaultAuthStore } = options
    const tierKey = authStore.get(cwd)
    if (!tierKey) {
      throw new Error('please run: tier login')
    }
    return new TierClient({
      ...options,
      baseUrl: process.env.TIER_URL,
      tierKey,
    })
  }

  static fromEnv(options: { [k: string]: any } = {}): TierClient {
    if (process.env.TIER_URL === undefined) {
      throw new Error('must set TIER_URL in environment')
    }
    if (process.env.TIER_KEY === undefined) {
      throw new Error('must set TIER_KEY in environment')
    }
    return new TierClient({
      ...options,
      baseUrl: process.env.TIER_URL,
      tierKey: process.env.TIER_KEY,
    })
  }

  constructor({
    baseUrl,
    tierKey,
    authStore = defaultAuthStore,
  }: {
    baseUrl: string
    tierKey: string
    authStore?: AuthStore
  }) {
    this.baseUrl = baseUrl
    this.tierKey = tierKey
    this.authStore = authStore
    this.clientID = ''
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
    const { device_code, interval = 5 } = authResponse
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
    if (!error && (res as DeviceAccessTokenSuccessResponse).access_token) {
      // auth success
      this.clientID = ''
      this.authStore.set(cwd, res.access_token)
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
  authorize(h: HeadersInit | undefined): HeadersInit {
    if (this.tierKey) {
      const basic = Buffer.from(this.tierKey + ':').toString('base64')
      const authorization = `Basic ${basic}`
      const withAuth = new Headers(h)
      withAuth.set('authorization', authorization)
      return withAuth
    } else {
      const withoutAuth = new Headers(h)
      withoutAuth.delete('authorization')
      return withoutAuth
    }
  }

  async fetchOK<T>(path: string, options: RequestInit): Promise<T> {
    const u = new URL(path, this.baseUrl)
    options.headers = this.authorize(options.headers)

    const res = await fetch(String(u), options)
    if (!res.ok) {
      throw Object.assign(new Error('tier fetch failed'), {
        request: {
          method: options.method,
          path,
          baseUrl: this.baseUrl,
          headers: Object.fromEntries(new Headers(options.headers).entries()),
        },
        response: {
          status: res.status,
          headers: Object.fromEntries(res.headers.entries()),
          body: await res.text(),
        },
      })
    }
    return (await res.json()) as T
  }

  async getOK<T>(path: string): Promise<T> {
    console.error(`GET ${path}`)
    return await this.fetchOK<T>(path, { method: 'GET' })
  }

  async postFormOK<T>(path: string, body: { [key: string]: any }): Promise<T> {
    console.error(`POST FORM ${path}`, body)
    return await this.fetchOK<T>(path, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: querystring.encode(body),
    })
  }

  async postOK<T>(path: string, body: { [key: string]: any }): Promise<T> {
    console.error(`POST ${path}`, body)
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
    return await this.postOK<StripeOptions>('/api/v1/stripe/options', { org })
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
}
