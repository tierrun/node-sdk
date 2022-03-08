const Tier = require('../')
const t = require('tap')
const http = require('http')
const pkg = require('../package.json')

// don't pick up configs from the environment
delete process.env.TIER_URL
delete process.env.TIER_API_TOKEN
delete process.env.TIER_DEBUG
delete process.env.NODE_DEBUG
const PORT = 12345 + (+process.env.TAP_CHILD_ID || 0)

t.test('required config', async t => {
  t.throws(() => new Tier(), { message: /tierApiToken/ })
  t.throws(() => new Tier({}), { message: /tierApiToken/ })
})

t.test('configs in arg', async t => {
  const { error } = console
  const errorLogs = []
  console.error = m => errorLogs.push(m)
  t.teardown(() => console.error = error)

  const tier = new Tier({tierApiToken: 'yolo'})
  t.match(tier, { tierApiToken: 'yolo', tierUrl: 'https://tier.run' })
  const debugTier = new Tier({tierApiToken: 'yolo', debug: true })
  t.equal(debugTier.debug, true)
  t.equal(tier.debug, false)
  errorLogs.length = 0
  debugTier.log('hello')
  tier.log('ignore this')
  t.strictSame(errorLogs, [`TIER ${process.pid} hello`])
})

t.test('so fetch', async t => {
  const tier = new Tier({
    tierApiToken: 'fetch-test-api-token',
    tierUrl: `http://localhost:${PORT}`,
  })

  let statusCode = 200
  let response = null
  let responseNotJson = null
  let currentTest = t
  let expectQuery = [['this', 'is fine']]

  const s = http.createServer((req, res) => {
    const t = currentTest
    t.equal(req.headers.authorization, 'Bearer fetch-test-api-token')
    t.match(req.headers.accept, 'application/json')
    t.match(req.headers['user-agent'], `${pkg.name}/${pkg.version}`)
    t.match(req.headers['request-id'], /^[a-f0-9]{8}$/)
    t.match(req.url, /^\/api\/v1\//)

    if (req.method !== 'GET') {
      t.equal(req.headers['content-type'], 'application/json')
      t.strictSame([...(new URL(req.url, `http://localhost:${PORT}/`).searchParams)], [])
      let s = ''
      req.on('data', c => {
        s += c
      })
      req.on('end', () => {
        res.setHeader('connection', 'close')
        t.equal(s.length, +req.headers['content-length'], 'got expected number of bytes')
        const data = JSON.parse(s)
        t.match(data, {this: 'is fine'}, 'got uploaded data')
        res.statusCode = statusCode
        res.end(responseNotJson || JSON.stringify(response))
      })
      req.resume()
      req.pause()
      req.resume()
    } else {
      t.equal(req.headers['content-type'], undefined)
      const q = [...(new URL(req.url, `http://localhost:${PORT}/`).searchParams)]
      t.match(q, expectQuery)
      res.statusCode = statusCode
      res.setHeader('connection', 'close')
      res.end(responseNotJson || JSON.stringify(response))
    }
  })
  t.teardown(() => new Promise(res => s.close(res)))

  t.before(() => new Promise(res => s.listen(PORT, res)))
  t.beforeEach(t => currentTest = t)

  t.test('fetch POST', async t => {
    statusCode = 200
    response = null
    const result = await tier.fetch('some-endpoint', {
      method: 'POST',
      body: { this: 'is fine' },
    })
    t.strictSame(result, response, 'got expected response')
  })

  t.test('fetch POST body string', async t => {
    statusCode = 200
    response = null
    const result = await tier.fetch('some-endpoint', {
      method: 'POST',
      body: JSON.stringify({ this: 'is fine' }),
    })
    t.strictSame(result, response, 'got expected response')
  })

  t.test('fetch POST body buffer', async t => {
    statusCode = 200
    response = null
    const result = await tier.fetch('some-endpoint', {
      method: 'POST',
      body: Buffer.from(JSON.stringify({ this: 'is fine' })),
    })
    t.strictSame(result, response, 'got expected response')
  })

  t.test('fetch POST fail', async t => {
    statusCode = 400
    response = { code: 'not_so_fine', message: 'less fine than thought' }

    await t.rejects(tier.fetch('some-endpoint', {
      method: 'POST',
      body: { this: 'is fine' },
    }), {
      message: 'less fine than thought',
      code: 'not_so_fine',
      status: 400,
    })
  })

  t.test('fetch GET', async t => {
    statusCode = 200
    response = { hello: 'world' }
    const result = await tier.fetch('some-endpoint', {
      query: { this: 'is fine' },
      // throw a weird body at it too, why not?
      body: 123456,
    })
    t.strictSame(result, response, 'got expected response')
  })

  t.test('fetch GET fail', async t => {
    statusCode = 400
    response = { code: 'goodbye', message: 'so long' }

    await t.rejects(tier.fetch('some-endpoint', {
      query: { this: 'is fine' },
    }), {
      message: 'so long',
      code: 'goodbye',
      status: 400,
    })
  })

  t.test('fetch json fail', async t => {
    statusCode = 200
    responseNotJson = 'this is not json'
    await t.rejects(tier.fetch('some-endpoint', {
      query: { this: 'is fine' },
    }), {
      message: 'this is not json',
      jsonParseError: 'Unexpected token h in JSON at position 1',
    })
    responseNotJson = null
  })

  t.test('fetch GET no query', async t => {
    statusCode = 200
    expectQuery = []
    response = { hello: 'world' }
    const result = await tier.fetch('no-query')
    t.strictSame(result, response, 'got expected response')
  })

  t.test('fetch GET double query', async t => {
    statusCode = 200
    expectQuery = [['this', 'is fine'], ['and so', 'is this']]
    response = { hello: 'world' }
    const result = await tier.fetch('double?this=is%20fine', {
      query: { 'and so': 'is this' },
    })
    t.strictSame(result, response, 'got expected response')
  })

  t.end()
})

t.test('API methods', async t => {
  // use a fixed date so tests are consistent
  const nowString = new Date('2022-01-01T00:00:00.000Z').toISOString()
  const D = global.Date
  global.Date = class Date extends D {
    constructor (arg) {
      super(arg || nowString)
    }
  }
  t.teardown(() => global.Date = D)

  const tier = new Tier({
    tierApiToken: 'fetch-test-api-token',
    tierUrl: `http://localhost:${PORT}`,
  })
  const fetches = []

  let result = null
  tier.fetch = async (...args) => {
    fetches.push(args)
    return result
  }

  t.beforeEach(() => fetches.length = 0)
  t.test('get schedule', async t => {
    await tier.schedule('org:porg')
    t.strictSame(fetches, [['schedule', { query: { org: 'org:porg' }}]])
  })
  t.test('set schedule', async t => {
    await tier.schedule('org:porg', { plan: 'plan:nalp' })
    t.strictSame(fetches, [['schedule', {
      method: 'POST',
      body: {
        org: 'org:porg',
        phase: {
          plan: 'plan:nalp',
          Effective: nowString,
          scheduled_at: nowString,
        },
      },
    }]])
  })
  t.test('set schedule different times', async t => {
    await tier.schedule('org:porg', {
      plan: 'plan:nalp',
      effective: '2022-02-01T12:34:56.789Z',
      scheduled_at: '2021-12-31T23:59:59.999Z',
    })
    t.strictSame(fetches, [['schedule', {
      method: 'POST',
      body: {
        org: 'org:porg',
        phase: {
          plan: 'plan:nalp',
          Effective: '2022-02-01T12:34:56.789Z',
          scheduled_at: '2021-12-31T23:59:59.999Z',
        },
      },
    }]])
  })

  t.test('get model', async t => {
    await tier.model()
    t.strictSame(fetches, [['model']])
  })
  t.test('set model', async t => {
    await tier.model({ plans: {} })
    t.strictSame(fetches, [['model', {
      method: 'POST',
      body: { plans: {} },
    }]])
  })

  t.test('reserve, no overage', async t => {
    result = { Total: { Overage: 0 }}
    const res = await tier.reserve('org:o', 'feature:f')
    t.match(res, { amountAuthorized: 1 })
    t.strictSame(fetches, [['reserve', {
      method: 'POST',
      body: {
        org: 'org:o',
        feature: 'feature:f',
        N: 1,
        now: nowString,
      },
    }]])
  })

  t.test('reserve, partial overage', async t => {
    result = { Total: { Overage: 10 }}
    const res = await tier.reserve('org:o', 'feature:f', 100)
    t.match(res, { amountAuthorized: 90 })
    t.strictSame(fetches, [['reserve', {
      method: 'POST',
      body: {
        org: 'org:o',
        feature: 'feature:f',
        N: 100,
        now: nowString,
      },
    }]])
  })

  t.test('reserve, total overage', async t => {
    result = { Total: { Overage: 1000 }}
    const res = await tier.reserve('org:o', 'feature:f', 100)
    t.match(res, { amountAuthorized: 0 })
    t.strictSame(fetches, [['reserve', {
      method: 'POST',
      body: {
        org: 'org:o',
        feature: 'feature:f',
        N: 100,
        now: nowString,
      },
    }]])
  })

  t.test('reserve, total overage, allowOverage=false', async t => {
    result = { Total: { Overage: 1000 }}
    await t.rejects(tier.reserve('org:o', 'feature:f', 100, {
      now: '2021-12-12T12:12:12.121Z',
      allowOverage: false,
    }), {
      message: 'plan limit reached',
      overage: 1000,
      code: 'overage',
    })
    t.strictSame(fetches, [['reserve', {
      method: 'POST',
      body: {
        org: 'org:o',
        feature: 'feature:f',
        N: 100,
        now: '2021-12-12T12:12:12.121Z',
      },
    }]])
  })
})
