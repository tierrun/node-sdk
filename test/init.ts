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
      proc.on('close', () => {
        SPAWN_PROC = undefined
      })
      return proc
    },
  },
}
const Tier = t.mock('../', mock).default

t.afterEach(async () => {
  SPAWN_FAIL = false
  delete process.env.TIER_LIVE
  delete process.env.TIER_SIDECAR
  SPAWN_CALLS.length = 0
  // always just kill the sidecar process between tests
  if (SPAWN_PROC) {
    // @ts-ignore
    let t: Timer | undefined = undefined
    const p = new Promise<void>(res => {
      t = setTimeout(() => res(), 200)
      if (SPAWN_PROC) {
        SPAWN_PROC.on('close', () => res())
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
  await t.rejects(Tier.limits('org:o'))
  t.same(SPAWN_CALLS, [['tier', 'serve', '--addr', `127.0.0.1:${port}`]])
})

t.test('live mode when TIER_LIVE is set', async t => {
  process.env.TIER_LIVE = '1'
  await Tier.init()
  t.same(SPAWN_CALLS, [
    ['tier', '--live', 'serve', '--addr', `127.0.0.1:${port}`],
  ])
})

t.test('only init one time in parallel', async t => {
  await Promise.all([Tier.init(), Tier.init()])
  t.same(SPAWN_CALLS, [['tier', 'serve', '--addr', `127.0.0.1:${port}`]])
})

t.test('only init one time ever', async t => {
  await Tier.init()
  await Tier.init()
  t.same(SPAWN_CALLS, [['tier', 'serve', '--addr', `127.0.0.1:${port}`]])
})

t.test('no init if env says running', async t => {
  process.env.TIER_SIDECAR = `http://127.0.0.1:${port}`
  await Tier.init()
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
  const Tier = t.mock('../', mock).default
  await Tier.init()
  t.match(logs, [['tier:', ['-v', 'serve', '--addr', /^127\.0\.0\.1:\d+$/]]])
})
