import child_process, { ChildProcess } from 'child_process'
import t from 'tap'
const port = 10000 + (process.pid % 10000)
const SPAWN_CALLS: any[][] = []
let SPAWN_FAIL = false
let SPAWN_PROC: ChildProcess | undefined
const mock = {
  child_process: {
    ...child_process,
    spawn: (cmd: any, args: any, opts: any) => {
      SPAWN_CALLS.push([cmd, ...args])
      const c = SPAWN_FAIL ? 'no command by this name lol' : 'cat'
      opts.stdio = 'pipe'
      const proc = child_process.spawn(c, [], opts)
      if (!SPAWN_FAIL) {
        proc.stdin.write('this is fine\n')
      }
      SPAWN_PROC = proc
      proc.on('exit', () => {
        SPAWN_PROC = undefined
      })
      return proc
    },
  },
}
const { init, getClient } = t.mock('../dist/cjs/get-client.js', mock)
const tier = t.mock('../', mock).default

t.afterEach(async () => {
  SPAWN_FAIL = false
  delete process.env.TIER_LIVE
  delete process.env.TIER_BASE_URL
  SPAWN_CALLS.length = 0
  // always just kill the sidecar process between tests
  if (SPAWN_PROC) {
    // @ts-ignore
    let t: Timer | undefined = undefined
    const p = new Promise<void>(res => {
      t = setTimeout(() => res(), 200)
      if (SPAWN_PROC) {
        SPAWN_PROC.on('exit', () => res())
        SPAWN_PROC.kill('SIGKILL')
      }
    })
    // @ts-ignore
    SPAWN_PROC.kill('SIGKILL')
    await p
    clearTimeout(t)
  }
})

t.test('reject API calls if init fails', async t => {
  SPAWN_FAIL = true
  await t.rejects(tier.limits('org:o'))
  await t.rejects(getClient())
  // tries 2 times
  t.same(SPAWN_CALLS, [
    ['tier', 'serve', '--addr', `127.0.0.1:${port}`],
    ['tier', 'serve', '--addr', `127.0.0.1:${port}`],
  ])
})

t.test('reject if TIER_BASE_URL gets unset', async t => {
  await init()
  process.env.TIER_BASE_URL = ''
  await t.rejects(getClient())
  t.same(SPAWN_CALLS, [['tier', 'serve', '--addr', `127.0.0.1:${port}`]])
})

t.test('live mode when TIER_LIVE is set', async t => {
  process.env.TIER_LIVE = '1'
  const c = await getClient()
  t.ok(c, 'got a client')
  t.equal(c.baseURL, `http://127.0.0.1:${port}`)
  t.same(SPAWN_CALLS, [
    ['tier', '--live', 'serve', '--addr', `127.0.0.1:${port}`],
  ])
})

t.test('only init one time in parallel', async t => {
  await Promise.all([init(), init()])
  t.same(SPAWN_CALLS, [['tier', 'serve', '--addr', `127.0.0.1:${port}`]])
})

t.test('only init one time ever', async t => {
  await init()
  await init()
  t.same(SPAWN_CALLS, [['tier', 'serve', '--addr', `127.0.0.1:${port}`]])
})

t.test('no init if env says running', async t => {
  process.env.TIER_BASE_URL = `http://127.0.0.1:${port}`
  await init()
  t.same(SPAWN_CALLS, [])
})

t.test('debug runs sidecar in debug mode', async t => {
  process.env.TIER_DEBUG = '1'
  const logs: any[][] = []
  const { error } = console
  t.teardown(() => {
    console.error = error
    delete process.env.TIER_DEBUG
  })
  console.error = (...args: any[]) => logs.push(args)
  const { init } = t.mock('../dist/cjs/get-client.js', mock)
  await init()
  t.match(logs, [
    ['tier:', ['-v', 'serve', '--addr', /^127\.0\.0\.1:\d+$/]],
    ['tier:', 'started sidecar', Number],
  ])
})
