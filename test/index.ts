import { createServer } from 'http'
import t from 'tap'
import Tier from '../'
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
  limits: Function,
  limit: Function,
  report: Function,
  subscribe: Function,
  whois: Function,
  phase: Function,
})

// fake the init for these tests
let initCalled = false
// @ts-ignore
Tier.init = () => {
  initCalled = true
}

t.equal(initCalled, false, 'have not called init')

t.test('type checks', async t => {
  t.equal(Tier.isOrgName('org:foo'), true)
  t.equal(Tier.isOrgName('foo'), false)
  t.equal(Tier.isPhase({}), false)
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

t.test('limits', t => {
  const server = createServer((req, res) => {
    res.setHeader('connection', 'close')
    server.close()
    t.equal(req.method, 'GET')
    t.equal(req.url, '/v1/limits?org=org%3Ao')
    res.end(JSON.stringify({ ok: true }))
  })
  server.listen(port, async () => {
    t.same(await Tier.limits('org:o'), { ok: true })
    t.end()
  })
})

t.test('limit', t => {
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
    t.same(await Tier.limit('org:o', 'feature:storage'), {
      feature: 'feature:storage',
      used: 341,
      limit: 10000,
    })
    t.same(await Tier.limit('org:o', 'feature:other'), {
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
t.test('phase', t => {
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
    t.same(await Tier.phase('org:o'), {
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
    res.end(JSON.stringify({ ok: true }))
  })
  server.listen(port, async () => {
    t.same(await Tier.whois('org:o'), { ok: true })
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
    t.same(await Tier.report('org:o', 'feature:f'), '{"ok":true}')
    t.same(
      await Tier.report(
        'org:o',
        'feature:f',
        10,
        new Date('2022-10-24T21:26:24.438Z'),
        true
      ),
      '{"ok":true}'
    )
    t.end()
  })
})

t.test('subscribe', t => {
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
      await Tier.subscribe('org:o', [
        {
          features: ['feature:foo@plan:bar@1', 'plan:pro@2'],
        },
      ]),
      '{"ok":true}'
    )
    t.same(
      await Tier.subscribe('org:o', [
        {
          effective: new Date('2022-10-24T21:26:24.438Z'),
          features: ['feature:foo@plan:bar@1', 'plan:pro@2'],
        },

        {
          effective: new Date('2023-10-24T21:26:24.438Z'),
          features: ['feature:foo@plan:enterprise@1', 'plan:enterprise@2'],
        },
      ]),
      '{"ok":true}'
    )

    t.same(await Tier.subscribe('org:o', 'plan:basic@0'), '{"ok":true}')

    t.same(
      await Tier.subscribe(
        'org:o',
        ['plan:basic@0', 'feature:f@plan:p@0'],
        new Date('2022-10-24T21:26:24.438Z')
      ),
      '{"ok":true}'
    )

    t.rejects(
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

    t.end()
  })
})

t.test('called init', async () => t.equal(initCalled, true))
