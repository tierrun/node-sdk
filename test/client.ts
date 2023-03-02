import { createServer } from 'http'
import t from 'tap'
import { Tier } from '../'

// node 16 didn't have fetch built in
import { default as NodeFetch } from 'node-fetch'
//@ts-ignore
if (!globalThis.fetch) globalThis.fetch = NodeFetch
//@ts-ignore
const f = globalThis.fetch
//@ts-ignore
globalThis.fetch = function (...args) {
  if (this && this !== globalThis) {
    throw new Error('can only call fetch() on globalThis')
  }
  return f.call(this, ...args)
}

const port = 10000 + (process.pid % 10000)

t.test('debuglog', t => {
  const { error } = console
  t.teardown(() => {
    console.error = error
  })
  const logs: any[][] = []
  console.info = (...m: any[]) => logs.push(m)
  const apiKey = 'donotprintthisever'
  const tier = new Tier({
    baseURL: `http://localhost:${port}`,
    apiKey,
  })
  //@ts-ignore
  tier.debugLog('hello')
  t.same(logs, [])
  //@ts-ignore
  tier.debug = true
  //@ts-ignore
  tier.debugLog('hello')
  t.same(logs, [['tier:', 'hello']])

  const server = createServer((req, res) => {
    t.equal(
      req.headers.authorization,
      `Basic ${Buffer.from(apiKey + ':').toString('base64')}`
    )
    res.setHeader('connection', 'close')
    res.end(JSON.stringify({ ok: true }))
  }).listen(port, async () => {
    //@ts-ignore
    const okGet = await tier.apiGet('/v1/get')
    t.same(okGet, { ok: true })
    //@ts-ignore
    const okPost = await tier.apiPost('/v1/post', { some: 'data' })
    t.same(okPost, { ok: true })
    const dumpLogs = JSON.stringify(logs)
    t.notMatch(dumpLogs, apiKey)
    t.notMatch(dumpLogs, Buffer.from(apiKey).toString('base64'))
    t.notMatch(dumpLogs, Buffer.from(apiKey + ':').toString('base64'))
    t.notMatch(dumpLogs, Buffer.from(':' + apiKey).toString('base64'))
    server.close()
    t.end()
  })
})
