const warnings: string[] = []
Object.defineProperty(process, 'emitWarning', {
  value: (msg: string) => {
    warnings.push(msg)
  },
})

import { actualRequestUrl } from 'actual-request-url'
import { createServer } from 'http'
import { createServer as createNetServer } from 'net'
import t from 'tap'

import { default as NodeFetch } from 'node-fetch'
import type { OrgInfo, PushResponse } from '../'
import { Tier } from '../dist/cjs/client.js'
import { LookupOrgResponseJSON, OrgInfoJSON } from '../dist/cjs/tier-types.js'

const port = 10000 + (process.pid % 10000)
const date = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}.[0-9]{3}Z$/

// fake the init for these tests
// don't need to spin up a real sidecar in CI
let initCalled = false

const { default: tier } = t.mock('../', {
  '../dist/cjs/get-client.js': {
    getClient: async (clientOptions?: TierGetClientOptions): Promise<Tier> => {
      initCalled = true
      const baseURL = (process.env.TIER_BASE_URL = `http://localhost:${port}`)
      return new Tier({
        ...(clientOptions || {}),
        baseURL,
        //@ts-ignore
        fetchImpl: (globalThis.fetch || NodeFetch) as typeof fetch,
      })
    },
  },
}) as typeof import('../')

// un-mock this one.
import { isTierError, TierError, TierGetClientOptions } from '../'
tier.isTierError = isTierError

t.match(tier, {
  isOrgName: Function,
  isFeatureName: Function,
  isPlanName: Function,
  isFeatureNameVersioned: Function,
  isFeatures: Function,
  isPhase: Function,
  validatePlan: Function,
  validateModel: Function,
  validateFeatureTier: Function,
  validateFeatureDefinition: Function,
  limits: Function,
  limit: Function,
  report: Function,
  subscribe: Function,
  whois: Function,
  whoami: Function,
  phase: Function,
  push: Function,
  lookupOrg: Function,
  updateOrg: Function,
  checkout: Function,
  withClock: Function,
})

t.equal(initCalled, false, 'have not called init')

t.test('type checks', async t => {
  t.equal(tier.isOrgName('org:foo'), true)
  t.equal(tier.isOrgName('foo'), false)
  t.equal(tier.isPhase({}), false)
  t.equal(tier.isPhase({ trial: 123 }), false)
  t.equal(tier.isFeatures('plan:ok@1'), true)
  t.equal(tier.isFeatures('feature:yup@plan:ok@1'), true)
  t.equal(tier.isFeatures('feature:nope'), false)
  t.equal(tier.isFeatures('feature:nope@2'), false)
  t.equal(tier.isFeatureNameVersioned('feature:nope'), false)
  t.equal(tier.isFeatureNameVersioned('feature:yup@plan:ok@1'), true)
  t.equal(tier.isFeatureName('feature:yup'), true)
  t.equal(tier.isFeatureName('nope'), false)
  t.equal(
    tier.isPhase({
      features: ['feature:foo@plan:bar@1', 'plan:bar@2'],
    }),
    true
  )
  t.equal(
    tier.isPhase({
      effective: 'not a date',
      features: ['feature:foo@plan:bar@1', 'plan:bar@2'],
    }),
    false
  )
  t.equal(
    tier.isPhase({
      effective: new Date(),
      features: [
        'feature:foo@plan:bar@1',
        'plan:bar@2',
        'feature:not features',
      ],
    }),
    false
  )
})

t.test('lookupLimits', t => {
  const server = createServer((req, res) => {
    res.setHeader('connection', 'close')
    server.close()
    t.equal(req.method, 'GET')
    t.match(
      req.headers['user-agent'],
      new RegExp(`tier\/[^ ]+ [a-f0-9]{8} node\/${process.version}$`)
    )
    t.equal(req.url, '/v1/limits?org=org%3Ao')
    res.end(JSON.stringify({ ok: true }))
  })
  server.listen(port, async () => {
    t.same(await tier.lookupLimits('org:o'), { ok: true })
    t.end()
  })
})

t.test('lookupLimit', t => {
  let reqs = 0
  const server = createServer((req, res) => {
    res.setHeader('connection', 'close')
    if (reqs++ === 1) {
      server.close()
    }
    t.equal(req.method, 'GET')
    t.equal(req.url, '/v1/limits?org=org%3Ao')
    res.end(
      JSON.stringify({
        org: 'org:o',
        usage: [
          {
            feature: 'feature:storage',
            used: 341,
            limit: 10000,
          },
          {
            feature: 'feature:transfer',
            used: 234213,
            limit: 10000,
          },
        ],
      })
    )
  })
  server.listen(port, async () => {
    t.same(await tier.lookupLimit('org:o', 'feature:storage'), {
      feature: 'feature:storage',
      used: 341,
      limit: 10000,
    })
    t.same(await tier.lookupLimit('org:o', 'feature:other'), {
      feature: 'feature:other',
      used: 0,
      limit: 0,
    })
    t.end()
  })
})

t.test('pull', t => {
  const server = createServer((req, res) => {
    res.setHeader('connection', 'close')
    server.close()
    t.equal(req.method, 'GET')
    t.equal(req.url, '/v1/pull')
    res.end(JSON.stringify({ plans: {} }))
  })
  server.listen(port, async () => {
    t.same(await tier.pull(), { plans: {} })
    t.end()
  })
})

t.test('pullLatest', t => {
  const server = createServer((req, res) => {
    res.setHeader('connection', 'close')
    server.close()
    t.equal(req.method, 'GET')
    t.equal(req.url, '/v1/pull')
    res.end(
      JSON.stringify({
        plans: {
          'plan:mixednum@9test': {},
          'plan:mixednum@9999999': {},
          'plan:mixednum@0test': {},
          'plan:mixednum@1000': {},
          'plan:alpha@dog': {},
          'plan:alpha@cat': {},
          'plan:longnum@1': {},
          'plan:longnum@888': {},
          'plan:longnum@1000': {},
          'plan:longnum@99': {},
          'plan:foo@1': {},
          'plan:foo@0': {},
          'plan:bar@7': {},
          'plan:foo@2': {},
          'plan:bar@0': {},
        },
      })
    )
  })
  server.listen(port, async () => {
    t.same(await tier.pullLatest(), {
      plans: {
        'plan:foo@2': {},
        'plan:bar@7': {},
        'plan:longnum@1000': {},
        'plan:alpha@dog': {},
        'plan:mixednum@9test': {},
      },
    })
    t.end()
  })
})

t.test('lookupPhase', t => {
  t.teardown(() => {
    server.close()
  })
  const server = createServer((req, res) => {
    res.setHeader('connection', 'close')
    t.equal(req.method, 'GET')
    if (!req.url) throw new Error('no url on req')
    t.equal(req.url.startsWith('/v1/phase?org=org%3A'), true)
    const phase = req.url.endsWith('o')
      ? {
          effective: '2022-10-13T16:52:11-07:00',
          features: [
            'feature:storage@plan:free@1',
            'feature:transfer@plan:free@1',
          ],
          plans: ['plan:free@1'],
          current: {
            effective: '2022-10-13T16:52:11-07:00',
            end: '2022-11-13T16:52:11-07:00',
          },
        }
      : {
          effective: '2022-10-13T16:52:11-07:00',
          end: '2025-01-01T00:00:00.000Z',
          features: [
            'feature:storage@plan:free@1',
            'feature:transfer@plan:free@1',
          ],
          plans: ['plan:free@1'],
          trial: true,
          current: {
            effective: '2022-10-13T16:52:11-07:00',
            end: '2025-01-01T00:00:00.000Z',
          },
        }
    res.end(JSON.stringify(phase))
  })

  server.listen(port, async () => {
    t.same(await tier.lookupPhase('org:o'), {
      effective: new Date('2022-10-13T16:52:11-07:00'),
      end: undefined,
      features: ['feature:storage@plan:free@1', 'feature:transfer@plan:free@1'],
      plans: ['plan:free@1'],
      trial: false,
      current: {
        effective: new Date('2022-10-13T16:52:11-07:00'),
        end: new Date('2022-11-13T16:52:11-07:00'),
      },
    })
    t.same(await tier.lookupPhase('org:p'), {
      effective: new Date('2022-10-13T16:52:11-07:00'),
      end: new Date('2025-01-01T00:00:00.000Z'),
      features: ['feature:storage@plan:free@1', 'feature:transfer@plan:free@1'],
      plans: ['plan:free@1'],
      trial: true,
      current: {
        effective: new Date('2022-10-13T16:52:11-07:00'),
        end: new Date('2025-01-01T00:00:00.000Z'),
      },
    })
    t.end()
  })
})

t.test('whois', t => {
  const server = createServer((req, res) => {
    res.setHeader('connection', 'close')
    server.close()
    t.equal(req.method, 'GET')
    t.equal(req.url, '/v1/whois?org=org%3Ao')
    res.end(JSON.stringify({ org: 'org:o', stripe_id: 'cust_1234' }))
  })
  server.listen(port, async () => {
    t.same(await tier.whois('org:o'), { org: 'org:o', stripe_id: 'cust_1234' })
    t.end()
  })
})

t.test('whoami', t => {
  const server = createServer((req, res) => {
    res.setHeader('connection', 'close')
    server.close()
    t.equal(req.method, 'GET')
    t.equal(req.url, '/v1/whoami')
    res.end(JSON.stringify({ ok: true }))
  })
  server.listen(port, async () => {
    t.same(await tier.whoami(), { ok: true })
    t.end()
  })
})

t.test('report', t => {
  const expects = [
    {
      org: 'org:o',
      feature: 'feature:f',
      n: 1,
      clobber: false,
    },
    {
      org: 'org:o',
      feature: 'feature:f',
      at: '2022-10-24T21:26:24.438Z',
      n: 10,
      clobber: true,
    },
  ]

  const server = createServer((req, res) => {
    res.setHeader('connection', 'close')
    t.equal(req.method, 'POST')
    const chunks: Buffer[] = []
    req.on('data', c => chunks.push(c))
    req.on('end', () => {
      const body = JSON.parse(Buffer.concat(chunks).toString())
      t.same(body, expects.shift())
      res.end(JSON.stringify({ ok: true }))
      if (!expects.length) {
        server.close()
      }
    })
  })

  server.listen(port, async () => {
    t.same(await tier.report('org:o', 'feature:f'), { ok: true })
    t.same(
      await tier.report('org:o', 'feature:f', 10, {
        at: new Date('2022-10-24T21:26:24.438Z'),
        clobber: true,
      }),
      { ok: true }
    )
    t.end()
  })
})

t.test('checkout', t => {
  const checkoutRes = {
    url: 'https://www.example.com/checkout',
  }

  let expect: { [k: string]: any } = { nope: 'invalid' }

  const server = createServer((req, res) => {
    res.setHeader('connection', 'close')
    t.equal(req.method, 'POST')
    t.equal(req.url, '/v1/checkout')
    const chunks: Buffer[] = []
    req.on('data', c => chunks.push(c))
    req.on('end', () => {
      const body = JSON.parse(Buffer.concat(chunks).toString())
      t.match(body, expect)
      expect = { nope: 'invalid' }
      res.end(JSON.stringify(checkoutRes))
    })
  })

  server.listen(port, async () => {
    expect = { org: 'org:o', success_url: 'http://success' }
    t.same(await tier.checkout('org:o', 'http://success'), checkoutRes)

    expect = { org: 'org:o', success_url: 'http://success' }
    t.same(await tier.checkout('org:o', 'http://success', {}), checkoutRes)

    expect = { org: 'org:o', success_url: 'http://success' }
    t.same(
      await tier.checkout('org:o', 'http://success', {
        trialDays: 99,
      }),
      checkoutRes
    )

    expect = {
      org: 'org:o',
      success_url: 'http://success',
      features: ['plan:p@1'],
    }
    t.same(
      await tier.checkout('org:o', 'http://success', {
        features: 'plan:p@1',
      }),
      checkoutRes
    )

    expect = {
      org: 'org:o',
      success_url: 'http://success',
      features: ['feature:foo@plan:x@1', 'plan:p@1'],
    }
    t.same(
      await tier.checkout('org:o', 'http://success', {
        features: ['feature:foo@plan:x@1', 'plan:p@1'],
      }),
      checkoutRes
    )

    expect = {
      org: 'org:o',
      success_url: 'http://success',
      features: ['plan:p@1'],
      trial_days: 99,
    }
    t.same(
      await tier.checkout('org:o', 'http://success', {
        features: 'plan:p@1',
        trialDays: 99,
      }),
      checkoutRes
    )

    expect = {
      org: 'org:o',
      success_url: 'http://success',
      cancel_url: 'https://cancel/',
    }
    t.same(
      await tier.checkout('org:o', 'http://success', {
        cancelUrl: 'https://cancel/',
      }),
      checkoutRes
    )

    expect = {
      org: 'org:o',
      success_url: 'http://success',
      cancel_url: 'https://cancel/',
    }
    t.same(
      await tier.checkout('org:o', 'http://success', {
        cancelUrl: 'https://cancel/',
        trialDays: 99,
      }),
      checkoutRes
    )

    expect = {
      org: 'org:o',
      success_url: 'http://success',
      cancel_url: 'https://cancel/',
      features: ['plan:p@1'],
    }
    t.same(
      await tier.checkout('org:o', 'http://success', {
        cancelUrl: 'https://cancel/',
        features: 'plan:p@1',
      }),
      checkoutRes
    )

    expect = {
      org: 'org:o',
      success_url: 'http://success',
      cancel_url: 'https://cancel/',
      features: ['feature:foo@plan:x@1', 'plan:p@1'],
    }
    t.same(
      await tier.checkout('org:o', 'http://success', {
        cancelUrl: 'https://cancel/',
        features: ['feature:foo@plan:x@1', 'plan:p@1'],
      }),
      checkoutRes
    )

    expect = {
      org: 'org:o',
      success_url: 'http://success',
      cancel_url: 'https://cancel/',
      features: ['plan:p@1'],
      trial_days: 99,
    }
    t.same(
      await tier.checkout('org:o', 'http://success', {
        cancelUrl: 'https://cancel/',
        features: 'plan:p@1',
        trialDays: 99,
      }),
      checkoutRes
    )
    server.close()
    t.end()
  })
})

t.test('subscribe', t => {
  const orgInfo: OrgInfo = {
    email: 'o@o.org',
    name: 'Orggy Org',
    description: 'describe them lolol',
    phone: '+15558675309',
    metadata: {},
  }

  const expects = [
    {
      org: 'org:o',
      phases: [
        {
          features: ['feature:foo@plan:bar@1', 'plan:pro@2'],
        },
      ],
    },
    { org: 'org:o', phases: [{ features: ['plan:basic@0'] }] },
    {
      org: 'org:o',
      phases: [
        {
          effective: '2022-10-24T21:26:24.438Z',
          features: ['plan:basic@0', 'feature:f@plan:p@0'],
        },
      ],
    },
    {
      org: 'org:o',
      phases: [
        {
          features: ['plan:basic@0', 'feature:f@plan:p@0'],
          trial: true,
          effective: '2022-10-24T21:26:24.438Z',
        },
        {
          effective: '2022-10-25T21:26:24.438Z',
          features: ['plan:basic@0', 'feature:f@plan:p@0'],
        },
      ],
    },
    {
      org: 'org:o',
      phases: [
        {
          features: ['plan:basic@0', 'feature:f@plan:p@0'],
          trial: true,
          effective: undefined,
        },
        {
          effective: date,
          features: ['plan:basic@0', 'feature:f@plan:p@0'],
        },
      ],
    },
    {
      org: 'org:o',
      phases: [],
      info: orgInfo,
    },
  ]

  const server = createServer((req, res) => {
    res.setHeader('connection', 'close')
    t.equal(req.method, 'POST')
    const chunks: Buffer[] = []
    req.on('data', c => chunks.push(c))
    req.on('end', () => {
      const body = JSON.parse(Buffer.concat(chunks).toString())
      t.match(body, expects.shift())
      res.end(JSON.stringify({ ok: true }))
      if (!expects.length) {
        server.close()
      }
    })
  })

  server.listen(port, async () => {
    t.same(
      await tier.subscribe('org:o', ['feature:foo@plan:bar@1', 'plan:pro@2']),
      { ok: true }
    )

    t.same(await tier.subscribe('org:o', 'plan:basic@0'), { ok: true })

    t.same(
      await tier.subscribe('org:o', ['plan:basic@0', 'feature:f@plan:p@0'], {
        effective: new Date('2022-10-24T21:26:24.438Z'),
      }),
      { ok: true }
    )

    t.same(
      await tier.subscribe('org:o', ['plan:basic@0', 'feature:f@plan:p@0'], {
        effective: new Date('2022-10-24T21:26:24.438Z'),
        trialDays: 1,
      }),
      { ok: true }
    )

    t.same(
      await tier.subscribe('org:o', ['plan:basic@0', 'feature:f@plan:p@0'], {
        trialDays: 1,
      }),
      { ok: true }
    )

    t.same(await tier.subscribe('org:o', [], { info: orgInfo }), { ok: true })

    await t.rejects(
      tier.subscribe('org:o', ['plan:basic@0', 'feature:f@plan:p@0'], {
        effective: new Date('2022-10-24T21:26:24.438Z'),
        trialDays: -1,
      }),
      { message: 'trialDays must be number >0 if specified' }
    )

    await t.rejects(
      tier.subscribe('org:o', [], {
        trialDays: 1,
      }),
      { message: 'trialDays may not be set without a subscription' }
    )

    await t.rejects(
      tier.subscribe(
        'org:o',
        [
          // @ts-ignore
          {
            features: ['feature:foo@plan:bar@1', 'plan:pro@2'],
          },
        ],
        new Date('2022-10-24T21:26:24.438Z')
      )
    )

    t.end()
  })
})

t.test('cancel', t => {
  const expects = [
    {
      org: 'org:o',
      phases: [{}],
    },
  ]

  const server = createServer((req, res) => {
    res.setHeader('connection', 'close')
    t.equal(req.method, 'POST')
    const chunks: Buffer[] = []
    req.on('data', c => chunks.push(c))
    req.on('end', () => {
      const body = JSON.parse(Buffer.concat(chunks).toString())
      t.same(body, expects.shift())
      res.end(JSON.stringify({ ok: true }))
      if (!expects.length) {
        server.close()
      }
    })
  })

  server.listen(port, async () => {
    t.same(await tier.cancel('org:o'), { ok: true })

    t.end()
  })
})

t.test('schedule', t => {
  const expects = [
    {
      org: 'org:o',
      phases: [
        {
          features: ['feature:foo@plan:bar@1', 'plan:pro@2'],
        },
      ],
    },
    {
      org: 'org:o',
      phases: [
        {
          effective: '2022-10-24T21:26:24.438Z',
          features: ['feature:foo@plan:bar@1', 'plan:pro@2'],
        },
        {
          effective: '2023-10-24T21:26:24.438Z',
          features: ['feature:foo@plan:enterprise@1', 'plan:enterprise@2'],
        },
      ],
    },
  ]

  const server = createServer((req, res) => {
    res.setHeader('connection', 'close')
    t.equal(req.method, 'POST')
    const chunks: Buffer[] = []
    req.on('data', c => chunks.push(c))
    req.on('end', () => {
      const body = JSON.parse(Buffer.concat(chunks).toString())
      t.same(body, expects.shift())
      res.end(JSON.stringify({ ok: true }))
      if (!expects.length) {
        server.close()
      }
    })
  })

  server.listen(port, async () => {
    t.same(
      await tier.schedule('org:o', [
        {
          features: ['feature:foo@plan:bar@1', 'plan:pro@2'],
        },
      ]),
      { ok: true }
    )
    t.same(
      await tier.schedule('org:o', [
        {
          effective: new Date('2022-10-24T21:26:24.438Z'),
          features: ['feature:foo@plan:bar@1', 'plan:pro@2'],
        },
        {
          effective: new Date('2023-10-24T21:26:24.438Z'),
          features: ['feature:foo@plan:enterprise@1', 'plan:enterprise@2'],
        },
      ]),
      { ok: true }
    )

    t.end()
  })
})

t.test('push', t => {
  const expect = {
    plans: {
      'plan:foo@1': {
        features: {
          'feature:bar': {},
        },
      },
    },
  }
  const response: PushResponse = {
    results: [
      {
        feature: 'feature:bar@plan:foo@1',
        status: 'ok',
        reason: 'created',
      },
    ],
  }
  const server = createServer((req, res) => {
    res.setHeader('connection', 'close')
    server.close()
    t.equal(req.method, 'POST')
    t.equal(req.url, '/v1/push')
    const chunks: Buffer[] = []
    req.on('data', c => chunks.push(c))
    req.on('end', () => {
      const body = JSON.parse(Buffer.concat(chunks).toString())
      t.same(body, expect)
      res.end(JSON.stringify(response))
    })
  })

  server.listen(port, async () => {
    const actual = await tier.push(expect)
    t.same(actual, response)
    t.end()
  })
})

t.test('error GET', t => {
  const server = createServer((req, res) => {
    res.setHeader('connection', 'close')
    server.close()
    t.equal(req.method, 'GET')
    t.equal(req.url, '/v1/whois?org=org%3Ao')
    res.statusCode = 404
    res.end(
      JSON.stringify({
        status: 404,
        code: 'not_found',
        message: 'Not Found',
      })
    )
  })
  server.listen(port, async () => {
    await t.rejects(tier.whois('org:o'), {
      status: 404,
      code: 'not_found',
      message: 'Not Found',
      requestData: { org: 'org:o' },
    })
    t.end()
  })
})

t.test('error POST', t => {
  const server = createServer((req, res) => {
    res.setHeader('connection', 'close')
    server.close()
    t.equal(req.method, 'GET')
    t.equal(req.url, '/v1/whois?org=org%3Ao')
    res.statusCode = 404
    res.end(
      JSON.stringify({
        status: 404,
        code: 'not_found',
        message: 'Not Found',
      })
    )
  })
  server.listen(port, async () => {
    await t.rejects(tier.whois('org:o'), {
      status: 404,
      code: 'not_found',
      message: 'Not Found',
      requestData: { org: 'org:o' },
    })
    t.end()
  })
})

t.test('error POST', t => {
  const expect = {
    org: 'org:o',
    feature: 'feature:f',
    n: 1,
    clobber: false,
  }

  const server = createServer((req, res) => {
    res.setHeader('connection', 'close')
    t.equal(req.method, 'POST')
    const chunks: Buffer[] = []
    req.on('data', c => chunks.push(c))
    req.on('end', () => {
      const body = JSON.parse(Buffer.concat(chunks).toString())
      t.same(body, expect)
      res.statusCode = 404
      res.end(
        JSON.stringify({
          status: 404,
          code: 'not_found',
          message: 'Not Found',
        })
      )
      server.close()
    })
  })

  server.listen(port, async () => {
    await t.rejects(tier.report('org:o', 'feature:f'), {
      status: 404,
      code: 'not_found',
      message: 'Not Found',
      requestData: expect,
    })
    t.end()
  })
})

t.test('weird error GET', t => {
  const server = createServer((req, res) => {
    res.setHeader('connection', 'close')
    server.close()
    t.equal(req.method, 'GET')
    t.equal(req.url, '/v1/whois?org=org%3Ao')
    res.end('wtf lol')
  })
  server.listen(port, async () => {
    await t.rejects(tier.whois('org:o'), {
      status: 200,
      code: undefined,
      message: 'Tier request failed',
      requestData: { org: 'org:o' },
      responseData: 'wtf lol',
    })
    t.end()
  })
})

t.test('weird error POST', t => {
  const expect = {
    org: 'org:o',
    feature: 'feature:f',
    n: 1,
    clobber: false,
  }

  const server = createServer((req, res) => {
    res.setHeader('connection', 'close')
    t.equal(req.method, 'POST')
    const chunks: Buffer[] = []
    req.on('data', c => chunks.push(c))
    req.on('end', () => {
      const body = JSON.parse(Buffer.concat(chunks).toString())
      t.same(body, expect)
      res.statusCode = 500
      res.end('not json lol')
      server.close()
    })
  })

  server.listen(port, async () => {
    await t.rejects(
      tier.report('org:o', 'feature:f').catch((e: any) => {
        t.ok(tier.isTierError(e))
        throw e
      }),
      {
        status: 500,
        message: 'Tier request failed',
        requestData: expect,
        responseData: 'not json lol',
      }
    )
    t.end()
  })
})

t.test('API server that is completely broken', t => {
  const server = createNetServer(socket => {
    socket.end(`HTTP/1.1 200 Ok\r
here: we go with http i promise

just kidding here is a pigeon
  __
<( O)
  ||
  ||____/|
  (  >  /
   \___/
     ||
    _||_

your welcome
`)
  })

  server.listen(port, async () => {
    try {
      await tier.whoami()
      t.fail('this should not work, pigeons are not API servers')
    } catch (er) {
      t.equal(isTierError(er), true)
      t.match(
        (er as TierError)?.cause,
        Error,
        'got an Error object as the cause'
      )
    }
    try {
      await tier.report('org:o', 'feature:f')
      t.fail('this should not work, pigeons are not API servers')
    } catch (er) {
      t.equal(isTierError(er), true)
      t.match(
        (er as TierError)?.cause,
        Error,
        'got an Error object as the cause'
      )
    }
    // now with onError
    let onErrorsCalled = 0
    const onError = (er: TierError) => {
      onErrorsCalled++
      t.equal(isTierError(er), true)
      t.match((er as TierError).cause, Error, 'got error object as cause')
    }
    const tc = new Tier({ baseURL: `http://localhost:${port}`, onError })
    // should not throw now, onError catches it
    await tc.whoami()
    await tc.report('org:o', 'feature:f')
    t.equal(onErrorsCalled, 2, 'caught two errors')
    server.close()
    t.end()
  })
})

t.test('API server that hangs up right away', t => {
  const server = createServer((_req, res) => {
    res.setHeader('connection', 'close')
    res.end()
  })

  server.listen(port, async () => {
    try {
      await tier.whoami()
      t.fail('this should not work, pigeons are not API servers')
    } catch (er) {
      t.equal(isTierError(er), true)
      t.match(
        (er as TierError)?.cause,
        Error,
        'got an Error object as the cause'
      )
    }
    try {
      await tier.report('org:o', 'feature:f')
      t.fail('this should not work, pigeons are not API servers')
    } catch (er) {
      t.equal(isTierError(er), true)
      t.match(
        (er as TierError)?.cause,
        Error,
        'got an Error object as the cause'
      )
    }
    server.close()
    t.end()
  })
})

t.test('updateOrg', t => {
  const expect: OrgInfoJSON = {
    email: 'x@y.com',
    name: 'Test User',
    description: '',
    phone: '+15558675309',
    metadata: {
      ok: 'true',
    },
    invoice_settings: {
      default_payment_method: '',
    },
  }
  const response = {}
  const server = createServer((req, res) => {
    res.setHeader('connection', 'close')
    server.close()
    t.equal(req.method, 'POST')
    t.equal(req.url, '/v1/subscribe')
    const chunks: Buffer[] = []
    req.on('data', c => chunks.push(c))
    req.on('end', () => {
      const body = JSON.parse(Buffer.concat(chunks).toString())
      t.same(body, { org: 'org:o', info: expect })
      res.end(JSON.stringify(response))
    })
  })

  const request: OrgInfo = {
    email: 'x@y.com',
    name: 'Test User',
    description: '',
    phone: '+15558675309',
    metadata: {
      ok: 'true',
    },
    invoiceSettings: {
      defaultPaymentMethod: '',
    },
  }
  server.listen(port, async () => {
    const actual = await tier.updateOrg('org:o', request)
    t.same(actual, response)
    t.end()
  })
})

t.test('updateOrg, no invoice settings sent', t => {
  const expect: OrgInfoJSON = {
    email: 'x@y.com',
    name: 'Test User',
    description: '',
    phone: '+15558675309',
    metadata: {
      ok: 'true',
    },
    invoice_settings: {
      default_payment_method: '',
    },
  }
  const response = {}
  const server = createServer((req, res) => {
    res.setHeader('connection', 'close')
    server.close()
    t.equal(req.method, 'POST')
    t.equal(req.url, '/v1/subscribe')
    const chunks: Buffer[] = []
    req.on('data', c => chunks.push(c))
    req.on('end', () => {
      const body = JSON.parse(Buffer.concat(chunks).toString())
      t.same(body, { org: 'org:o', info: expect })
      res.end(JSON.stringify(response))
    })
  })

  const request: OrgInfo = {
    email: 'x@y.com',
    name: 'Test User',
    description: '',
    phone: '+15558675309',
    metadata: {
      ok: 'true',
    },
  }
  server.listen(port, async () => {
    const actual = await tier.updateOrg('org:o', request)
    t.same(actual, response)
    t.end()
  })
})

t.test('lookupOrg', t => {
  const response: LookupOrgResponseJSON = {
    org: 'org:o',
    name: '',
    description: '',
    phone: '+15558675309',
    metadata: {},
    stripe_id: 'cust_1234',
    email: 'x@y.com',
    invoice_settings: {
      default_payment_method: 'pm_card_FAKE',
    },
  }
  const server = createServer((req, res) => {
    res.setHeader('connection', 'close')
    server.close()
    t.equal(req.method, 'GET')
    t.equal(req.url, '/v1/whois?org=org%3Ao&include=info')
    res.end(JSON.stringify(response))
  })
  server.listen(port, async () => {
    t.same(await tier.lookupOrg('org:o'), {
      org: 'org:o',
      name: '',
      description: '',
      phone: '+15558675309',
      metadata: {},
      stripe_id: 'cust_1234',
      email: 'x@y.com',
      invoiceSettings: {
        defaultPaymentMethod: 'pm_card_FAKE',
      },
    })
    t.end()
  })
})

t.test('lookupOrg, no payment method in response', t => {
  const response = {
    org: 'org:o',
    name: '',
    description: '',
    phone: '+15558675309',
    metadata: {},
    stripe_id: 'cust_1234',
    email: 'x@y.com',
  }
  const server = createServer((req, res) => {
    res.setHeader('connection', 'close')
    server.close()
    t.equal(req.method, 'GET')
    t.equal(req.url, '/v1/whois?org=org%3Ao&include=info')
    res.end(JSON.stringify(response))
  })
  server.listen(port, async () => {
    t.same(await tier.lookupOrg('org:o'), {
      org: 'org:o',
      name: '',
      description: '',
      phone: '+15558675309',
      metadata: {},
      stripe_id: 'cust_1234',
      email: 'x@y.com',
      invoiceSettings: {
        defaultPaymentMethod: '',
      },
    })
    t.end()
  })
})

t.test('report', t => {
  const expects = [
    {
      org: 'org:o',
      feature: 'feature:f',
      n: 1,
      clobber: false,
    },
    {
      org: 'org:o',
      feature: 'feature:f',
      at: '2022-10-24T21:26:24.438Z',
      n: 10,
      clobber: true,
    },
  ]

  const server = createServer((req, res) => {
    res.setHeader('connection', 'close')
    t.equal(req.method, 'POST')
    const chunks: Buffer[] = []
    req.on('data', c => chunks.push(c))
    req.on('end', () => {
      const body = JSON.parse(Buffer.concat(chunks).toString())
      t.same(body, expects.shift())
      res.end(JSON.stringify({ ok: true }))
      if (!expects.length) {
        server.close()
      }
    })
  })

  server.listen(port, async () => {
    t.same(await tier.report('org:o', 'feature:f'), { ok: true })
    t.same(
      await tier.report('org:o', 'feature:f', 10, {
        at: new Date('2022-10-24T21:26:24.438Z'),
        clobber: true,
      }),
      { ok: true }
    )
    t.end()
  })
})

t.test('lookupPaymentMethods', t => {
  const server = createServer((req, res) => {
    res.setHeader('connection', 'close')
    t.equal(req.method, 'GET')
    const u = req.url
    if (!u) {
      throw new Error('did not get a request url??')
    }
    t.equal(u.startsWith('/v1/payment_methods?org=org%3A'), true)
    res.end(
      JSON.stringify({
        org: 'org:' + u.substring(u.length - 1),
        methods: u.endsWith('b') ? ['pm_card_FAKE'] : null,
      })
    )
  })
  t.teardown(() => {
    server.close()
  })
  server.listen(port, async () => {
    t.same(await tier.lookupPaymentMethods('org:o'), {
      org: 'org:o',
      methods: [],
    })
    t.same(await tier.lookupPaymentMethods('org:b'), {
      org: 'org:b',
      methods: ['pm_card_FAKE'],
    })
    t.end()
  })
})

t.test('can', t => {
  let sawGet = false
  let sawPost = false
  const expects = [
    {
      org: 'org:o',
      feature: 'feature:can',
      n: 1,
      clobber: false,
    },
    {
      org: 'org:o',
      feature: 'feature:can',
      n: 10,
      clobber: false,
    },
  ]
  const server = createServer((req, res) => {
    res.setHeader('connection', 'close')
    if (req.method === 'GET') {
      // looking up limits
      sawGet = true

      if (req.url === '/v1/limits?org=org%3Ao') {
        res.end(
          JSON.stringify({
            org: 'org:o',
            usage: [
              {
                feature: 'feature:can',
                used: 341,
                limit: 10000,
              },
              {
                feature: 'feature:cannot',
                used: 234213,
                limit: 10000,
              },
            ],
          })
        )
      } else {
        res.statusCode = 500
        res.end(JSON.stringify({ error: 'blorp' }))
      }
    } else if (req.method === 'POST') {
      // reporting usage
      sawPost = true
      const chunks: Buffer[] = []
      req.on('data', c => chunks.push(c))
      req.on('end', () => {
        const body = JSON.parse(Buffer.concat(chunks).toString())
        t.match(body, expects.shift())
        res.end(JSON.stringify({ ok: true }))
      })
    } else {
      throw new Error('unexpected http method used')
    }
  })
  server.listen(port, async () => {
    const cannot = await tier.can('org:o', 'feature:cannot')
    t.match(cannot, { ok: false, err: undefined })

    const err = await tier.can('org:error', 'feature:nope')
    t.match(err, {
      ok: true,
      err: { message: 'Tier request failed', status: 500 },
    })
    t.equal(isTierError(err.err), true)

    const can = await tier.can('org:o', 'feature:can')
    t.match(can, { ok: true })
    t.match(await can.report(), { ok: true, err: undefined })
    t.match(await can.report(10), { ok: true, err: undefined })

    t.equal(sawPost, true)
    t.equal(sawGet, true)

    server.close()

    t.end()
  })
})

t.test(
  'use abort signal',
  { skip: typeof AbortSignal === 'undefined' && 'no AbortSignal' },
  t => {
    const ac = new AbortController()
    const server = createServer((req, res) => {
      res.setHeader('connection', 'close')
      t.equal(req.method, 'GET')
      t.equal(req.url, '/v1/limits?org=org%3Ao')
      res.write('{"ok":')
      ac.abort()
      setTimeout(() => res.end('true}'), 100)
    })
    server.listen(port, async () => {
      const signal = ac.signal
      await t.rejects(tier.lookupLimits('org:o', { signal }))
      server.close()
      t.end()
    })
  }
)

t.test('withClock', t => {
  interface ClockResponse {
    id: string
    link: string
    present: Date
    status: string
  }
  const clocks: { [k: string]: ClockResponse } = {
    foo: {
      id: 'id-foo',
      link: 'http://example.com/clock/foo',
      present: new Date(),
      status: 'not ready',
    },
    bar: {
      id: 'id-bar',
      link: 'http://example.com/clock/bar',
      present: new Date(),
      status: 'not ready',
    },
  }

  t.teardown(() => {
    server.close()
  })
  const server = createServer((req, res) => {
    t.ok(req.url?.startsWith('/v1/clock'))
    res.setHeader('connection', 'close')
    const url = actualRequestUrl(req)
    if (!url) throw new Error('could not discern url')
    if (req.method === 'GET') {
      const id = url.searchParams.get('id')
      if (!id) throw new Error('did not send clockID in GET')
      if (id !== 'id-foo' && id !== 'id-bar') {
        throw new Error('unknown clockID: ' + id)
      }
      const clock = id === 'id-foo' ? clocks.foo : clocks.bar
      clock.status =
        clock.status === 'not ready'
          ? 'waiting 1'
          : clock.status === 'waiting 1'
          ? 'waiting 2'
          : clock.status === 'waiting 2'
          ? 'waiting 3'
          : 'ready'
      res.end(JSON.stringify(clock))
    } else if (req.method === 'POST') {
      // either starting or syncing a clock
      const b: Buffer[] = []
      req.on('data', c => b.push(c))
      req.on('end', () => {
        const body = JSON.parse(Buffer.concat(b).toString())
        t.type(body.present, 'string')
        const p = new Date(body.present)
        if (body.id) {
          t.equal(body.id, req.headers['tier-clock'])
          if (body.id !== 'id-foo' && body.id !== 'id-bar') {
            throw new Error('unknown clockID: ' + body.id)
          }
          const clock = body.id === 'id-foo' ? clocks.foo : clocks.bar
          clock.present = p
          clock.status = 'not ready'
          res.end(JSON.stringify(clock))
        } else if (body.name) {
          const name = body.name
          if (name !== 'foo' && name !== 'bar') {
            throw new Error('invalid clock name: ' + name)
          }
          const clock = clocks[name as 'foo' | 'bar']
          clock.present = p
          clock.status = 'not ready'
          res.end(JSON.stringify(clock))
        } else {
          throw new Error('invalid post request: ' + JSON.stringify(body))
        }
      })
    } else {
      throw new Error('invalid request method: ' + req.method)
    }
  })

  server.listen(port, async () => {
    const ac =
      typeof AbortController !== 'undefined' ? new AbortController() : null
    const noclock = await tier.fromEnv()
    const noclock2 = await tier.fromEnv({ signal: ac?.signal })
    const foo = await tier.withClock('foo', new Date('1979-07-01'))
    const bar = await tier.withClock('bar', new Date('2020-07-01'), {
      signal: ac?.signal,
    })
    //@ts-expect-error
    t.throws(() => noclock.advance(new Date()))
    //@ts-expect-error
    t.throws(() => noclock2.advance(new Date()))
    t.equal(
      clocks.foo.present.toISOString(),
      new Date('1979-07-01').toISOString()
    )
    t.equal(
      clocks.bar.present.toISOString(),
      new Date('2020-07-01').toISOString()
    )
    await foo.advance(new Date('2020-01-01'))
    t.equal(
      clocks.foo.present.toISOString(),
      new Date('2020-01-01').toISOString()
    )
    await bar.advance(new Date('2025-02-03'))
    t.equal(
      clocks.bar.present.toISOString(),
      new Date('2025-02-03').toISOString()
    )
    if (ac) {
      const p = bar.advance(new Date('2038-12-12'))
      ac.abort()
      await t.rejects(p)
      t.equal(
        clocks.bar.present.toISOString(),
        new Date('2025-02-03').toISOString()
      )
    }
    t.end()
  })
})

t.test('called init', async () => t.equal(initCalled, true))

t.test('warnings', t => {
  // because we had a test for it earlier
  t.same(warnings, [
    'pullLatest is deprecated, and will be removed in the next version',
  ])
  const server = createServer((_req, res) => {
    res.setHeader('connection', 'close')
    res.end('{"usage":[],"effective":0,"plans":{}}')
  })
  t.teardown(() => {
    server.close()
  })
  server.listen(port, async () => {
    await tier.pullLatest()
    await tier.limit('org:o', 'feature:foo')
    await tier.phase('org:o')
    await tier.limits('org:o')
    await tier.limit('org:o', 'feature:foo')
    await tier.phase('org:o')
    await tier.limits('org:o')
    t.same(warnings, [
      'pullLatest is deprecated, and will be removed in the next version',
      'Tier.limit is deprecated. Please use Tier.lookupLimit instead.',
      'Tier.phase is deprecated. Please use Tier.lookupPhase instead.',
      'Tier.limits is deprecated. Please use Tier.lookupLimits instead.',
    ])
    t.end()
  })
})
