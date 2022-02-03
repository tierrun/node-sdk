// this just verifies which API calls get called with which args
// the actual SDK is tested in test/index.js

const t = require('tap')

const bin = require.resolve('../lib/bin.js')

const TierMock = class Tier {
  async model (...args) {
    return ['MODEL', ...args]
  }
  async schedule (...args) {
    return ['SCHEDULE', ...args]
  }
  async reserve (...args) {
    return ['RESERVE', ...args]
  }
}

const cwd = process.cwd()
const normalizePaths = a => a.split(cwd).join('${CWD}').replace(/\\/g, '/')
t.cleanSnapshot = normalizePaths

const run = (t, ...args) => {
  const LOGS = []
  const ERRS = []
  const EXITS = []
  return t.test(args.map(normalizePaths).join(' ') || '<noargs>', async t => {
    const { exit, argv } = process
    const { log, error } = console
    console.log = (...args) => LOGS.push(args)
    console.error = (...args) => ERRS.push(args)
    process.exit = code => EXITS.push(code)
    process.argv = [process.execPath, bin, ...args]

    await t.mock(bin, { '../lib/index.js': TierMock })

    // have to repair process so tap can generate snapshots properly
    Object.assign(process, { argv, exit })
    Object.assign(console, { error, log })

    t.matchSnapshot(EXITS, 'exits')
    t.matchSnapshot(LOGS, 'logs')
    t.matchSnapshot(ERRS, 'errs')
  })
}

t.test('top help', async t => {
  run(t)
  run(t, '-h')
  run(t, '--help')
})

t.test('push', async t => {
  const { writeFileSync, unlinkSync } = require('fs')
  const { resolve } = require('path')
  const f = resolve(__dirname, 'test-pricing.json')
  writeFileSync(f, '{plans:{}}')
  t.teardown(() => unlinkSync(f))

  run(t, 'push')
  run(t, 'push', '-h')
  run(t, 'push', '--help')
  run(t, 'push', 'x', '--help')
  run(t, 'push', f)
})

t.test('pull', async t => {
  run(t, 'pull')
  run(t, 'pull', '-h')
  run(t, 'pull', '--help')
  run(t, 'pull', 'x', '--help')
})

t.test('schedule', async t => {
  run(t, 'schedule')
  run(t, 'schedule', '-h')
  run(t, 'schedule', '--help')
  run(t, 'schedule', 'x', '--help')
  run(t, 'schedule', 'org:o', 'plan:p', '-h')
  run(t, 'schedule', 'org:o', 'plan:p', '--help')
  run(t, 'schedule', 'org:o')
  run(t, 'schedule', 'org:o', 'plan:p')
})

t.test('schedules', async t => {
  run(t, 'schedules')
  run(t, 'schedules', '-h')
  run(t, 'schedules', '--help')
  run(t, 'schedules', 'x', '--help')
  run(t, 'schedules', 'org:o', 'plan:p', '-h')
  run(t, 'schedules', 'org:o', '--help')
  run(t, 'schedules', 'org:o')
})

t.test('reserve', async t => {
  run(t, 'reserve')
  run(t, 'reserve', '-h')
  run(t, 'reserve', '-n', '1')
  run(t, 'reserve', '-n', '100')
  run(t, 'reserve', '--n', '100')
  run(t, 'reserve', '--n', '100', 'org:o')
  run(t, 'reserve', '--n', '100', 'org:o', 'feature:f')
  run(t, 'reserve', '--n', '100', 'org:o', 'feature:f', '--help')
  run(t, 'reserve', '--n', 'org:o', 'feature:f')
  run(t, 'reserve', 'org:o', 'feature:f')
})

t.test('weird throws', async t => {
  // have to await here cuz we're making changes out of band
  const { reserve } = TierMock.prototype
  t.teardown(() => Object.assign(TierMock.prototype, { reserve }))
  TierMock.prototype.reserve = async () => {
    throw true
  }
  await run(t, 'reserve', 'org:throw', 'feature:true')
  TierMock.prototype.reserve = async () => {
    process.stderr.write('throw object\n')
    throw { stack: 'object throw' }
  }
  await run(t, 'reserve', 'org:throw', 'feature:obj')
  TierMock.prototype.reserve = async () => {
    throw 123456
  }
  await run(t, 'reserve', 'org:throw', 'feature:number', '-n', '123456')
})
