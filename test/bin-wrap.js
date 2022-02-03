const t = require('tap')
const bin = require.resolve('../lib/bin-wrap.js')
console.error('TESTING BIN', bin)

const OS = ['darwin', 'linux', 'windows']
const ARCH = ['arm64', 'amd64']

const mocks = {
  '../lib/bin.js': 'js wrapper around API calls'
}

// the files have to actually be there for t.mock to work, that's annoying
const { sync: touch } = require('touch')
const { sync: mkdirp } = require('mkdirp')
const { resolve } = require('path')
const { existsSync } = require('fs')
const { sync: rimraf } = require('rimraf')
const made = []
t.teardown(() => made.forEach(m => rimraf(m)))
for (const os of OS) {
  for (const arch of ARCH) {
    const p = `@tier.run/cli-${os}-${arch}`
    const mod = resolve(__dirname, `../node_modules/${p}`)
    if (!existsSync(mod)) {
      mkdirp(mod)
      touch(resolve(mod, 'index.js'))
      made.push(mod)
    }
    mocks[p] = `mockbin ${os}-${arch}`
  }
}

const spawned = []
mocks['foreground-child'] = (exe, args) => {
  spawned.push([exe, args])
  return exe
}

const testOS = ['linux', 'darwin', 'win32', 'sunos']
const testARCH = ['amd64', 'arm64', 'x64', 'mips']

for (const testos of testOS) {
  for (const testarch of testARCH) {
    t.test(`${testos}-${testarch}`, async t => {
      const {arch, platform} = process
      Object.defineProperty(process, 'arch', {
        value: testarch,
        writable: true,
      })
      Object.defineProperty(process, 'platform', {
        value: testos,
        writable: true,
      })
      t.teardown(() => {
        Object.assign(process, {arch, platform})
        spawned.length = 0
      })
      const loaded = t.mock(bin, mocks)
      t.matchSnapshot(spawned, 'spawned')
      t.matchSnapshot(loaded, 'loaded')
    })
  }
}

t.test('other kinds of throws just throw', async t => {
  const {platform, arch} = process
  Object.defineProperty(process, 'platform', {
    value: 'darwin',
    writable: true,
  })
  Object.defineProperty(process, 'arch', {
    value: 'arm64',
    writable: true,
  })
  t.teardown(() => Object.assign(process, {platform, arch}))
  t.throws(() => {
    t.mock(bin, {
      ...mocks,
      'foreground-child': () => { throw new Error('oops') },
    })
  }, { message: 'oops' })
})
