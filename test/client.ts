import t from 'tap'
import { Tier } from '../'

t.test('debuglog', t => {
  const { error } = console
  t.teardown(() => {
    console.error = error
  })
  const logs: any[][] = []
  console.error = (...m: any[]) => logs.push(m)
  const tier = new Tier({
    sidecar: 'http://localhost:8080',
  })
  //@ts-ignore
  tier.debugLog('hello')
  t.same(logs, [])
  //@ts-ignore
  tier.debug = true
  //@ts-ignore
  tier.debugLog('hello')
  t.same(logs, [['tier:', 'hello']])
  t.end()
})
