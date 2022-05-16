import t from 'tap'

import {
  Reservation,
  DeviceAuthorizationSuccessResponse,
  StripeOptions,
  TierClient,
  TierError,
} from '../lib/index'
import nock from 'nock'

type Nock = ReturnType<typeof nock>

const dateRE =
  /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}.[0-9]{3}Z$/
const uuidRE = /^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/

// start each test with a clean set of nocks
t.beforeEach(t => {
  nock.cleanAll()
  t.context.api = nock(apiUrl)
  t.context.web = nock(webUrl)
})

// assert that all mocks are matched by each test
t.afterEach(t => {
  t.context.api.done()
  t.context.web.done()
})

import { resolve } from 'path'
import { readFileSync } from 'fs'
import { createHash } from 'crypto'

const hash = (str: string) => createHash('sha512').update(str).digest('hex')

process.env.TIER_API_URL = 'http://127.0.0.1:8888'
process.env.TIER_WEB_URL = 'http://localhost:3000'
const apiUrl = process.env.TIER_API_URL
const webUrl = process.env.TIER_WEB_URL

const dir = t.testdir()
process.env.HOME = dir

const grant_type = 'urn:ietf:params:oauth:grant-type:device_code'
t.test('basic login', async t => {
  let client_id: string | null = null
  const verifyURI = `${webUrl}/auth/cli/verify/12345`
  const verifyURIComplete = `${verifyURI}?code=ABCD-EFGH`

  const tnock = t.context.web as Nock
  tnock
    .post('/auth/cli', body => {
      t.match(body, { client_id: uuidRE })
      client_id = body.client_id
      return true
    })
    .reply(200, {
      device_code: '12345',
      user_code: 'ABCD-EFGH',
      verification_uri: verifyURI,
      verification_uri_complete: verifyURIComplete,
      // tell it to fetch the token right away,
      // so the test doesn't hang 10s waiting for it.
      interval: 0,
    })
    .post('/auth/cli', body => {
      t.match(body, {
        client_id,
        device_code: '12345',
        grant_type,
      })
      return true
    })
    .reply(200, {
      access_token: 'tier key',
      token_type: 'basic',
    })

  const tc = TierClient.fromEnv({ tierKey: TierClient.NO_AUTH })
  const res = await tc.initLogin()
  t.strictSame(res, {
    device_code: '12345',
    user_code: 'ABCD-EFGH',
    verification_uri: verifyURI,
    verification_uri_complete: verifyURIComplete,
    interval: 0,
  })
  const tokenRes = await tc.awaitLogin(
    '/test/path',
    res as DeviceAuthorizationSuccessResponse
  )

  t.strictSame(tokenRes, {
    access_token: 'tier key',
    token_type: 'basic',
  })

  const f = hash(hash('/test/path') + hash(apiUrl))
  const file = resolve(dir, '.config/tier/tokens', f)
  const record = JSON.parse(readFileSync(file, 'utf8'))
  const sig = hash(JSON.stringify(record.slice(0, 3)))
  t.match(record, [tokenRes, Number, apiUrl, sig])
})

t.test('login with weird errors', async t => {
  let client_id: string | null = null
  const verifyURI = `${webUrl}/auth/cli/verify/12345`
  const verifyURIComplete = `${verifyURI}?code=ABCD-EFGH`

  const tnock = t.context.web as Nock
  tnock
    .post('/auth/cli', body => {
      t.match(body, { client_id: uuidRE })
      client_id = body.client_id
      return true
    })
    .reply(200, {
      device_code: '12345',
      user_code: 'ABCD-EFGH',
      verification_uri: verifyURI,
      verification_uri_complete: verifyURIComplete,
      // tell it to fetch the token right away,
      // so the test doesn't hang 10s waiting for it.
      interval: 0,
    })
    .post('/auth/cli', body => {
      t.match(body, {
        client_id,
        device_code: '12345',
        grant_type,
      })
      return true
    })
    .reply(400, { error: 'authorization_pending' })
    .post('/auth/cli', body => {
      t.match(body, {
        client_id,
        device_code: '12345',
        grant_type,
      })
      return true
    })
    .reply(400, { error: 'slow_down' })
    .post('/auth/cli', body => {
      t.match(body, {
        client_id,
        device_code: '12345',
        grant_type,
      })
      return true
    })
    .reply(400, {
      error: 'authorization_denied',
    })

  const tc = TierClient.fromEnv({ tierKey: TierClient.NO_AUTH })
  const res = await tc.initLogin()
  t.strictSame(res, {
    device_code: '12345',
    user_code: 'ABCD-EFGH',
    verification_uri: verifyURI,
    verification_uri_complete: verifyURIComplete,
    interval: 0,
  })
  await t.rejects(
    tc.awaitLogin('/test/path', res as DeviceAuthorizationSuccessResponse),
    { message: 'failed: authorization_denied' }
  )
  t.equal(tc.clientID, '')
})

t.test('login non-json error response', async t => {
  let client_id: string | null = null
  const verifyURI = `${webUrl}/auth/cli/verify/12345`
  const verifyURIComplete = `${verifyURI}?code=ABCD-EFGH`

  const tnock = t.context.web as Nock
  tnock
    .post('/auth/cli', body => {
      t.match(body, { client_id: uuidRE })
      client_id = body.client_id
      return true
    })
    .reply(200, {
      device_code: '12345',
      user_code: 'ABCD-EFGH',
      verification_uri: verifyURI,
      verification_uri_complete: verifyURIComplete,
      // tell it to fetch the token right away,
      // so the test doesn't hang 10s waiting for it.
      interval: 0,
    })
    .post('/auth/cli', body => {
      t.match(body, {
        client_id,
        device_code: '12345',
        grant_type,
      })
      return true
    })
    .reply(400, { error: 'authorization_pending' })
    .post('/auth/cli', body => {
      t.match(body, {
        client_id,
        device_code: '12345',
        grant_type,
      })
      return true
    })
    .reply(400, 'hello i am not json and do not claim to be')

  const tc = TierClient.fromEnv({ tierKey: TierClient.NO_AUTH })
  const res = await tc.initLogin()
  t.strictSame(res, {
    device_code: '12345',
    user_code: 'ABCD-EFGH',
    verification_uri: verifyURI,
    verification_uri_complete: verifyURIComplete,
    interval: 0,
  })
  await t.rejects(
    tc.awaitLogin('/test/path', res as DeviceAuthorizationSuccessResponse),
    {
      constructor: TierError,
      message: 'tier fetch failed',
      request: {
        method: 'POST',
        url: 'http://localhost:3000/auth/cli',
        headers: {
          accept: 'application/json',
          'content-type': 'application/x-www-form-urlencoded',
          'user-agent': /^tier @tier\.run\/sdk@/,
        },
        body: String,
      },
      response: {
        status: 400,
        headers: {},
        body: 'hello i am not json and do not claim to be',
      },
      name: 'TierError',
    }
  )
  t.equal(tc.clientID, '')
})

t.test('login from cwd token, works', async t => {
  const tc = TierClient.fromCwd('/test/path')
  t.equal(tc.tierKey, 'tier key')
  process.env.TIER_KEY = 'tier key'
})

t.test('logout', async t => {
  const f = hash(hash('/test/path') + hash(apiUrl))
  const file = resolve(dir, '.config/tier/tokens', f)
  TierClient.fromEnv({
    apiUrl: 'http://127.0.0.1:8888/path/is/ignored',
    webUrl: 'http://localhost:3000/path/is/ignored',
  }).logout('/test/path')
  t.throws(() => readFileSync(file))
  t.throws(() => TierClient.fromCwd('/test/path'), {
    message: 'please run: tier login',
  })
})

t.test('login broken json error response', async t => {
  let client_id: string | null = null
  const verifyURI = `${webUrl}/auth/cli/verify/12345`
  const verifyURIComplete = `${verifyURI}?code=ABCD-EFGH`

  const tnock = t.context.web as Nock
  tnock
    .post('/auth/cli', body => {
      t.match(body, { client_id: uuidRE })
      client_id = body.client_id
      return true
    })
    .reply(200, {
      device_code: '12345',
      user_code: 'ABCD-EFGH',
      verification_uri: verifyURI,
      verification_uri_complete: verifyURIComplete,
      // tell it to fetch the token right away,
      // so the test doesn't hang 10s waiting for it.
      interval: 0,
    })
    .post('/auth/cli', body => {
      t.match(body, {
        client_id,
        device_code: '12345',
        grant_type,
      })
      return true
    })
    .reply(400, { error: 'authorization_pending' })
    .post('/auth/cli', body => {
      t.match(body, {
        client_id,
        device_code: '12345',
        grant_type,
      })
      return true
    })
    .reply(400, 'hello i am not json but i look like i should be', {
      'content-type': 'application/json',
    })

  const tc = TierClient.fromEnv({ tierKey: TierClient.NO_AUTH })
  const res = await tc.initLogin()
  t.strictSame(res, {
    device_code: '12345',
    user_code: 'ABCD-EFGH',
    verification_uri: verifyURI,
    verification_uri_complete: verifyURIComplete,
    interval: 0,
  })
  await t.rejects(
    tc.awaitLogin('/test/path', res as DeviceAuthorizationSuccessResponse),
    SyntaxError
  )
  t.equal(tc.clientID, '')
})

t.test('login unsupported token type', async t => {
  let client_id: string | null = null
  const verifyURI = `${webUrl}/auth/cli/verify/12345`
  const verifyURIComplete = `${verifyURI}?code=ABCD-EFGH`

  const tnock = t.context.web as Nock
  tnock
    .post('/auth/cli', body => {
      t.match(body, { client_id: uuidRE })
      client_id = body.client_id
      return true
    })
    .reply(200, {
      device_code: '12345',
      user_code: 'ABCD-EFGH',
      verification_uri: verifyURI,
      verification_uri_complete: verifyURIComplete,
      // tell it to fetch the token right away,
      // so the test doesn't hang 10s waiting for it.
      interval: 0,
    })
    .post('/auth/cli', body => {
      t.match(body, {
        client_id,
        device_code: '12345',
        grant_type,
      })
      return true
    })
    .reply(200, {
      access_token: 'tier key',
      // now watch IETF come along and invent such a thing...
      token_type: 'magic-hoodah-token-schmoken',
    })

  const tc = TierClient.fromEnv({ tierKey: TierClient.NO_AUTH })
  const res = await tc.initLogin()
  t.strictSame(res, {
    device_code: '12345',
    user_code: 'ABCD-EFGH',
    verification_uri: verifyURI,
    verification_uri_complete: verifyURIComplete,
    interval: 0,
  })
  await t.rejects(
    tc.awaitLogin('/test/path', res as DeviceAuthorizationSuccessResponse),
    { message: 'Received unsupported token type: magic-hoodah-token-schmoken' }
  )
  t.equal(tc.clientID, '')
})

t.test('failures', async t => {
  const tnock = t.context.api as Nock
  tnock
    .get('/api/v1/fail-fetch')
    .replyWithError('failure')
    .get('/api/v1/fail-400')
    .reply(400, { error: 'bad request' })
    .get('/api/v1/fail-json')
    .reply(200, 'this is not json')
  const tc = TierClient.fromEnv()
  t.rejects(tc.fetchOK('/api/v1/fail-fetch', {}), {
    message:
      'request to http://127.0.0.1:8888/api/v1/fail-fetch failed, reason: failure',
    response: undefined,
  })
  t.rejects(tc.fetchOK('/api/v1/fail-400', {}), {
    message: 'tier fetch failed',
    response: {
      status: 400,
      body: '{"error":"bad request"}',
    },
  })
  t.rejects(tc.fetchOK('/api/v1/fail-json', {}), {
    message: 'tier invalid JSON',
    response: {
      status: 200,
      body: 'this is not json',
    },
  })
})

t.test('ping', async t => {
  const tnock = t.context.api as Nock
  tnock.get('/api/v1/whoami').reply(200, { org: 'org:testereeee' })
  t.match(await TierClient.fromEnv().ping(), { org: 'org:testereeee' })
})

t.test('pushModel, pullModel', async t => {
  const model = {
    plans: {
      'plan:foo@0': {
        features: {
          'feature:bar': {
            tiers: [{}],
          },
        },
      },
    },
  }
  ;(t.context.api as Nock)
    .post('/api/v1/push', body => {
      t.strictSame(body, model)
      return true
    })
    .reply(200, 'null')
    .get('/api/v1/pull')
    .reply(200, model)
  t.equal(await TierClient.fromEnv().pushModel(model), null)
  t.strictSame(await TierClient.fromEnv().pullModel(), model)
})

t.test('appendPhase', async t => {
  const api = t.context.api as Nock
  api
    .post('/api/v1/append', body => {
      t.match(body, {
        org: 'org:o',
        plan: 'plan:p@0',
        effective: dateRE,
      })
      return true
    })
    .reply(200, 'null')
    .post('/api/v1/append', body => {
      t.match(body, {
        org: 'org:o',
        plan: 'plan:p@1',
        effective: '1985-10-26T08:15:00.000Z',
      })
      return true
    })
    .reply(200, 'null')
  const tc = TierClient.fromEnv()
  t.equal(await tc.appendPhase('org:o', 'plan:p@0'), null)
  t.equal(await tc.appendPhase('org:o', 'plan:p@1', 499162500000), null)
})

t.test('stripeOptions', async t => {
  const sopt: StripeOptions = {
    publishableKey: 'pk_foo',
    accountID: 'cs_asdf',
    clientSecret: 'seti_qwer_secret_rtyu',
  }
  const api = t.context.api as Nock
  api
    .post('/api/v1/stripe/options', body => {
      t.strictSame(body, { org: 'org:o' })
      return true
    })
    .reply(200, sopt)
  t.strictSame(await TierClient.fromEnv().stripeOptions('org:o'), sopt)
})

t.test('look up schedule, current plan', async t => {
  const schFromTierd = {
    current: 0,
    phases: [
      {
        plan: 'plan:p@1',
        effective: '1985-10-26T08:15:00.000000Z',
        scheduled: '2022-05-17T15:20:12.744123Z',
      },
      { plan: 'plan:p@2', effective: '2023-01-01' },
    ],
  }
  const sch = {
    current: 0,
    phases: [
      {
        plan: 'plan:p@1',
        effective: new Date('1985-10-26T08:15:00.000000Z'),
        scheduled: new Date('2022-05-17T15:20:12.744123Z'),
      },
      { plan: 'plan:p@2', effective: new Date('2023-01-01') },
    ],
  }
  const api = t.context.api as Nock
  api.get('/api/v1/schedule?org=org:o').twice().reply(200, schFromTierd)

  const tc = TierClient.fromEnv()
  t.strictSame(await tc.lookupSchedule('org:o'), sch)
  t.strictSame(await tc.lookupCurrentPlan('org:o'), 'plan:p@1')
})

t.test('pull pricing page', async t => {
  const defPage = {
    name: 'default',
    plans: [
      { id: 'plan:p@0', features: {} },
      { id: 'plan:r@1', features: {} },
    ],
  }
  const namePage = {
    name: 'named',
    signupURL: 'https://example.com/signup',
    plans: [
      { id: 'plan:p@0', features: {} },
      { id: 'plan:r@1', features: {} },
    ],
  }
  const web = t.context.web as Nock
  web
    .get('/web/pricing-page/')
    .reply(200, defPage)
    .get('/web/pricing-page/-/named')
    .reply(200, namePage)

  const tc = TierClient.fromEnv()
  t.strictSame(await tc.pullPricingPage(), defPage)
  t.strictSame(await tc.pullPricingPage('named'), namePage)
})

t.test('reserve', async t => {
  const org = 'org:o'
  const api = t.context.api as Nock
  api
    .post('/api/v1/reserve', body => {
      t.match(body, {
        org,
        feature: 'feature:f',
        n: 1,
        now: dateRE,
      })
      return true
    })
    .reply(200, { used: 99, limit: 100 })
    .post('/api/v1/reserve', body => {
      t.match(body, {
        org,
        feature: 'feature:nope',
        n: 1,
        now: dateRE,
      })
      return true
    })
    .reply(200, { used: -1, limit: -2 })
    .post('/api/v1/reserve', body => {
      t.match(body, {
        org,
        feature: 'feature:overage',
        n: 1,
        now: dateRE,
      })
      return true
    })
    .reply(200, { used: 100, limit: 99 })
    .post('/api/v1/reserve', body => {
      t.match(body, {
        org,
        feature: 'feature:someAllowed',
        n: 10,
        now: dateRE,
      })
      return true
    })
    .reply(200, { used: 20, limit: 15 })
    .post('/api/v1/reserve', body => {
      t.match(body, {
        org,
        feature: 'feature:someAllowed',
        n: -10,
        now: dateRE,
      })
      return true
    })
    .reply(200, { used: 10, limit: 15 })

  const tc = TierClient.fromEnv()
  const allowed = await tc.reserve(org, 'feature:f')
  t.type(allowed, Reservation)
  t.match(allowed, {
    org: 'org:o',
    feature: 'feature:f',
    n: 1,
    now: Date,
    used: 99,
    limit: 100,
    remaining: 1,
    overage: 0,
    allowed: 1,
    ok: true,
  })

  const nope = await tc.reserve(org, 'feature:nope')
  t.type(nope, Reservation)
  t.match(nope, {
    org: 'org:o',
    feature: 'feature:nope',
    n: 1,
    now: Date,
    used: -1,
    limit: -2,
    remaining: 0,
    overage: 1,
    allowed: 0,
    ok: false,
  })

  const overage = await tc.reserve(org, 'feature:overage')
  t.type(overage, Reservation)
  t.match(overage, {
    org: 'org:o',
    feature: 'feature:overage',
    n: 1,
    now: Date,
    used: 100,
    limit: 99,
    remaining: 0,
    overage: 1,
    allowed: 0,
    ok: false,
  })

  const someAllowed = await tc.reserve(org, 'feature:someAllowed', 10)
  t.type(someAllowed, Reservation)
  t.match(someAllowed, {
    org: 'org:o',
    feature: 'feature:someAllowed',
    n: 10,
    now: Date,
    used: 20,
    limit: 15,
    remaining: 0,
    overage: 5,
    allowed: 5,
    ok: false,
  })

  const allowedRevert = await someAllowed.cancel()
  t.type(allowedRevert, Reservation)
  t.match(allowedRevert, {
    org: 'org:o',
    feature: 'feature:someAllowed',
    n: -10,
    now: Date,
    used: 10,
    limit: 15,
    remaining: 5,
    overage: 0,
    allowed: 5,
    ok: true,
  })
})
