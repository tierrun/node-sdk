import { TierClient } from '../lib/index.js'
import t from 'tap'

process.env.TIER_API_URL = 'http://127.0.0.1:8888'
process.env.TIER_WEB_URL = 'http://localhost:3000'
process.env.TIER_KEY = 'deadbeefcafebad101'

t.test('init from environment', async t => {
  const tc = TierClient.fromEnv()
  t.equal(tc.apiUrl, 'http://127.0.0.1:8888')
  t.equal(tc.tierUrl('/api/v1/blah'), 'http://127.0.0.1:8888/api/v1/blah')
  t.equal(tc.tierUrl('/auth/cli'), 'http://localhost:3000/auth/cli')
  t.equal(tc.tierUrl('/web/blah'), 'http://localhost:3000/web/blah')
  t.throws(() => tc.tierUrl('/other/thing'))
  t.equal(tc.tierKey, 'deadbeefcafebad101')
  const expectAuth = `Basic ${Buffer.from('deadbeefcafebad101:').toString(
    'base64'
  )}`
  t.equal(
    tc
      .authorize({ authorization: 'Otherthing foobarbaz' })
      .get('authorization'),
    expectAuth
  )

  // override to use bearer
  const b = TierClient.fromEnv({ authType: 'bearer' })
  const bexpectAuth = 'Bearer deadbeefcafebad101'
  t.equal(b.authorize({}).get('authorization'), bexpectAuth)
})

t.test('debug', async t => {
  const logs: any[][] = []
  const { error } = console
  t.teardown(() => {
    console.error = error
  })
  console.error = (...args: any[]) => {
    logs.push(args)
  }
  const tc = TierClient.fromEnv({ debug: true })
  tc.debug('hello', 'world')
  t.strictSame(logs, [['hello', 'world']])
  t.end()
})

t.test('tierJSUrl points to web url host', async t => {
  t.equal(TierClient.fromEnv().tierJSUrl(), 'http://localhost:3000/tier.js')
})

t.test('server urls must match', async t => {
  delete process.env.TIER_API_URL
  delete process.env.TIER_WEB_URL

  const nonSet = new TierClient({
    apiUrl: undefined,
    webUrl: undefined,
  })
  t.equal(nonSet.apiUrl, 'https://api.tier.run')
  t.equal(nonSet.webUrl, 'https://tier.run')

  const defTierd = new TierClient({
    apiUrl: 'https://api.tier.run',
    webUrl: 'https://example.com',
  })
  t.equal(defTierd.apiUrl, 'https://api.tier.run')
  t.equal(defTierd.webUrl, 'https://tier.run')

  const diffTierd = new TierClient({
    apiUrl: 'https://127.0.0.1:8888',
    webUrl: undefined,
  })
  t.equal(diffTierd.apiUrl, 'https://127.0.0.1:8888')
  t.equal(diffTierd.webUrl, undefined)

  const diffTierweb = new TierClient({
    apiUrl: 'https://127.0.0.1:8888',
    webUrl: 'https://tier.run',
  })
  t.equal(diffTierweb.apiUrl, 'https://127.0.0.1:8888')
  t.equal(diffTierweb.webUrl, undefined)
  t.equal(diffTierweb.tierJSUrl(), 'https://tier.run/tier.js')
})

t.test('invalid options that blow up', async t => {
  t.throws(() => new TierClient({ apiUrl: 'hello', webUrl: 'world' }))
  t.throws(() => new TierClient({ authType: 'nope a dopey rope' }))
})

t.test('need tier_key env or login', async t => {
  delete process.env.TIER_KEY
  t.throws(() => new TierClient())
})
