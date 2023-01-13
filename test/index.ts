import { createServer } from 'http'
import t from 'tap'
import Tier, { OrgInfo, PushResponse, isTierError } from '../'
const port = 10000 + (process.pid % 10000)

t.match(Tier, {
  init: Function,
  exitHandler: Function,
  isOrgName: Function,
  isFeatureName: Function,
  isPlanName: Function,
  isVersionedFeatureName: Function,
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
})

// fake the init for these tests
let initCalled = false
// @ts-ignore
Tier.init = () => {
  initCalled = true
  process.env.TIER_SIDECAR = `http://localhost:${port}`
}

t.equal(initCalled, false, 'have not called init')

t.test('type checks', async t => {
  t.equal(Tier.isOrgName('org:foo'), true)
  t.equal(Tier.isOrgName('foo'), false)
  t.equal(Tier.isPhase({}), false)
  t.equal(Tier.isPhase({ trial: 123 }), false)
  t.equal(Tier.isFeatures('plan:ok@1'), true)
  t.equal(Tier.isFeatures('feature:yup@plan:ok@1'), true)
  t.equal(Tier.isFeatures('feature:nope'), false)
  t.equal(Tier.isFeatures('feature:nope@2'), false)
  t.equal(Tier.isVersionedFeatureName('feature:nope'), false)
  t.equal(Tier.isVersionedFeatureName('feature:yup@plan:ok@1'), true)
  t.equal(Tier.isFeatureName('feature:yup'), true)
  t.equal(Tier.isFeatureName('nope'), false)
  t.equal(
    Tier.isPhase({
      features: ['feature:foo@plan:bar@1', 'plan:bar@2'],
    }),
    true
  )
  t.equal(
    Tier.isPhase({
      effective: 'not a date',
      features: ['feature:foo@plan:bar@1', 'plan:bar@2'],
    }),
    false
  )
  t.equal(
    Tier.isPhase({
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
    t.equal(req.url, '/v1/limits?org=org%3Ao')
    res.end(JSON.stringify({ ok: true }))
  })
  server.listen(port, async () => {
    t.same(await Tier.lookupLimits('org:o'), { ok: true })
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
    t.same(await Tier.lookupLimit('org:o', 'feature:storage'), {
      feature: 'feature:storage',
      used: 341,
      limit: 10000,
    })
    t.same(await Tier.lookupLimit('org:o', 'feature:other'), {
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
    t.same(await Tier.pull(), { plans: {} })
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
    t.same(await Tier.pullLatest(), {
      plans: {
        'plan:foo@2': {},
        'plan:bar@7': {},
      },
    })
    t.end()
  })
})

t.test('lookupPhase', t => {
  const server = createServer((req, res) => {
    res.setHeader('connection', 'close')
    server.close()
    t.equal(req.method, 'GET')
    t.equal(req.url, '/v1/phase?org=org%3Ao')
    res.end(
      JSON.stringify({
        effective: '2022-10-13T16:52:11-07:00',
        features: [
          'feature:storage@plan:free@1',
          'feature:transfer@plan:free@1',
        ],
        plans: ['plan:free@1'],
      })
    )
  })
  server.listen(port, async () => {
    t.same(await Tier.lookupPhase('org:o'), {
      effective: new Date('2022-10-13T16:52:11-07:00'),
      features: ['feature:storage@plan:free@1', 'feature:transfer@plan:free@1'],
      plans: ['plan:free@1'],
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
    t.same(await Tier.whois('org:o'), { org: 'org:o', stripe_id: 'cust_1234' })
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
    t.same(await Tier.whoami(), { ok: true })
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
    t.same(await Tier.report('org:o', 'feature:f'), { ok: true })
    t.same(
      await Tier.report('org:o', 'feature:f', 10, {
        at: new Date('2022-10-24T21:26:24.438Z'),
        clobber: true,
      }),
      { ok: true }
    )
    t.end()
  })
})

t.test('subscribe', t => {
  const { emitWarning } = process
  t.teardown(() => {
    process.emitWarning = emitWarning
  })
  const WARNINGS: any[][] = []
  process.emitWarning = (...m: any[]) => WARNINGS.push(m)

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
          effective: '2022-10-24T21:26:24.438Z',
          features: ['plan:basic@0', 'feature:f@plan:p@0'],
          trial: true,
        },
        {
          effective: '2022-10-25T21:26:24.438Z',
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
      t.same(body, expects.shift())
      res.end(JSON.stringify({ ok: true }))
      if (!expects.length) {
        server.close()
      }
    })
  })

  server.listen(port, async () => {
    t.same(
      await Tier.subscribe('org:o', ['feature:foo@plan:bar@1', 'plan:pro@2']),
      { ok: true }
    )

    t.same(await Tier.subscribe('org:o', 'plan:basic@0'), { ok: true })

    t.same(
      await Tier.subscribe('org:o', ['plan:basic@0', 'feature:f@plan:p@0'], {
        effective: new Date('2022-10-24T21:26:24.438Z'),
      }),
      { ok: true }
    )

    t.same(
      await Tier.subscribe('org:o', ['plan:basic@0', 'feature:f@plan:p@0'], {
        effective: new Date('2022-10-24T21:26:24.438Z'),
        trialDays: 1,
      }),
      { ok: true }
    )

    t.same(await Tier.subscribe('org:o', [], { info: orgInfo }), { ok: true })

    await t.rejects(
      Tier.subscribe('org:o', ['plan:basic@0', 'feature:f@plan:p@0'], {
        effective: new Date('2022-10-24T21:26:24.438Z'),
        trialDays: -1,
      }),
      { message: 'trialDays must be number >0 if specified' }
    )

    await t.rejects(
      Tier.subscribe('org:o', [], {
        trialDays: 1,
      }),
      { message: 'trialDays may not be set without a subscription' }
    )

    await t.rejects(
      Tier.subscribe(
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

    t.same(WARNINGS, [])

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
    t.same(await Tier.cancel('org:o'), { ok: true })

    t.end()
  })
})

t.test('schedule', t => {
  const { emitWarning } = process
  t.teardown(() => {
    process.emitWarning = emitWarning
  })
  const WARNINGS: any[][] = []
  process.emitWarning = (...m: any[]) => WARNINGS.push(m)

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
      await Tier.schedule('org:o', [
        {
          features: ['feature:foo@plan:bar@1', 'plan:pro@2'],
        },
      ]),
      { ok: true }
    )
    t.same(
      await Tier.schedule('org:o', [
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

    t.same(WARNINGS, [])
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
    const actual = await Tier.push(expect)
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
    await t.rejects(Tier.whois('org:o'), {
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
    await t.rejects(Tier.whois('org:o'), {
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
    await t.rejects(Tier.report('org:o', 'feature:f'), {
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
    await t.rejects(Tier.whois('org:o'), {
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
      Tier.report('org:o', 'feature:f').catch((e: any) => {
        t.ok(Tier.isTierError(e))
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

t.test('updateOrg', t => {
  const expect: OrgInfo = {
    email: 'x@y.com',
    name: 'Test User',
    description: '',
    phone: '+15558675309',
    metadata: {
      ok: 'true',
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

  server.listen(port, async () => {
    const actual = await Tier.updateOrg('org:o', expect)
    t.same(actual, response)
    t.end()
  })
})

t.test('lookupOrg', t => {
  const server = createServer((req, res) => {
    res.setHeader('connection', 'close')
    server.close()
    t.equal(req.method, 'GET')
    t.equal(req.url, '/v1/whois?org=org%3Ao&include=info')
    res.end(
      JSON.stringify({ org: 'org:o', stripe_id: 'cust_1234', email: 'x@y.com' })
    )
  })
  server.listen(port, async () => {
    t.same(await Tier.lookupOrg('org:o'), {
      org: 'org:o',
      stripe_id: 'cust_1234',
      email: 'x@y.com',
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
    t.same(await Tier.report('org:o', 'feature:f'), { ok: true })
    t.same(
      await Tier.report('org:o', 'feature:f', 10, {
        at: new Date('2022-10-24T21:26:24.438Z'),
        clobber: true,
      }),
      { ok: true }
    )
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
    const cannot = await Tier.can('org:o', 'feature:cannot')
    t.match(cannot, { ok: false, err: undefined })

    const err = await Tier.can('org:error', 'feature:nope')
    t.match(err, {
      ok: true,
      err: { message: 'Tier request failed', status: 500 },
    })
    t.equal(isTierError(err.err), true)

    const can = await Tier.can('org:o', 'feature:can')
    t.match(can, { ok: true })
    t.match(await can.report(), { ok: true, err: undefined })
    t.match(await can.report(10), { ok: true, err: undefined })

    t.equal(sawPost, true)
    t.equal(sawGet, true)

    server.close()

    t.end()
  })
})

t.test('called init', async () => t.equal(initCalled, true))
