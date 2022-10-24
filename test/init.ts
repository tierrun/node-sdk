import t from 'tap'
import child_process, {ChildProcess} from 'child_process'
const SPAWN_CALLS:any[][] = []
let SPAWN_FAIL = false
let SPAWN_PID:number|undefined
let SPAWN_PROC:ChildProcess|undefined
const Tier = t.mock('../', {
  child_process: {
    ...child_process,
    spawn: (cmd:any, args:any, opts:any) => {
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
        SPAWN_PID = undefined
      })
      SPAWN_PID = proc.pid
      return proc
    },
  },
}).default

t.afterEach(async () => {
  SPAWN_FAIL = false
  delete process.env.TIER_LIVE
  delete process.env.TIER_SIDECAR_RUNNING
  SPAWN_CALLS.length = 0
  // always just kill the sidecar process between tests
  if (SPAWN_PROC) {
    // @ts-ignore
    SPAWN_PROC.kill('SIGTERM')
    // @ts-ignore
    await new Promise(res => SPAWN_PROC.on('close', res))
  }
})

t.test('reject API calls if init fails', async t => {
  SPAWN_FAIL = true
  await t.rejects(Tier.limits('org:o'))
  t.same(SPAWN_CALLS, [['tier', 'serve']])
})

t.test('live mode when TIER_LIVE is set', async t => {
  process.env.TIER_LIVE = '1'
  await Tier.init()
  t.same(SPAWN_CALLS, [['tier', '--live', 'serve']])
})

t.test('only init one time in parallel', async t => {
  await Promise.all([Tier.init(), Tier.init()])
  t.same(SPAWN_CALLS, [['tier', 'serve']])
})

t.test('only init one time ever', async t => {
  await Tier.init()
  await Tier.init()
  t.same(SPAWN_CALLS, [['tier', 'serve']])
})

t.test('no init if env says running', async t => {
  process.env.TIER_SIDECAR_RUNNING = '1'
  await Tier.init()
  t.same(SPAWN_CALLS, [])
})
