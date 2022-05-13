import { defaultAuthStore } from '../lib/auth-store'
import t from 'tap'

// Note: need to run a tierd and (for now) a tierweb to generate
// snapshots.

const apiUrl = 'http://127.0.0.1:8888'
process.env.TIER_API_URL = apiUrl
process.env.TIER_WEB_URL = 'http://localhost:3000'
const home = process.env.HOME
t.teardown(() => {
  process.env.HOME = home
})
const dir = t.testdir({})
process.env.HOME = dir

import { resolve } from 'path'
import { readFileSync, writeFileSync, appendFileSync } from 'fs'
import { createHash } from 'crypto'

const hash = (str: string) => createHash('sha512').update(str).digest('hex')

t.test('basic operation', t => {
  const p = '/some/path'
  const token = {
    access_token: 'access',
    token_type: 'basic',
  }
  t.equal(defaultAuthStore.set(p, apiUrl, token), undefined)
  const h = hash(hash(p) + hash(apiUrl))
  const file = resolve(dir, '.config/tier/tokens', h)
  const j = JSON.parse(readFileSync(file, 'utf8'))
  t.strictSame(j[0], token)
  const born = j[1]
  t.type(born, 'number')
  t.equal(j[2], apiUrl)
  const sig = j[3]
  t.type(sig, 'string')
  t.equal(sig, hash(JSON.stringify([token, born, apiUrl])))
  t.strictSame(defaultAuthStore.get(p, apiUrl), token)
  t.end()
})

t.test('expiration', t => {
  const p = '/expiring/path'

  const { now } = Date
  t.teardown(() => {
    Date.now = now
  })

  let time = 1
  Date.now = () => time

  const token = {
    access_token: 'access',
    token_type: 'basic',
    expires_in: 60,
  }
  t.equal(defaultAuthStore.set(p, apiUrl, token), undefined)
  const h = hash(hash(p) + hash(apiUrl))
  const file = resolve(dir, '.config/tier/tokens', h)
  const j = JSON.parse(readFileSync(file, 'utf8'))
  t.strictSame(j[0], token)
  const born = j[1]
  t.equal(born, 1)
  t.equal(j[2], apiUrl)
  const sig = j[3]
  t.type(sig, 'string')
  t.equal(sig, hash(JSON.stringify([token, born, apiUrl])))
  t.strictSame(defaultAuthStore.get(p, apiUrl), token)

  time += token.expires_in * 1000 + 1
  t.equal(defaultAuthStore.get(p, apiUrl), undefined)
  t.end()
})

t.test('no access', t => {
  const p = '/no/access/path'

  const token = { token_type: 'basic' }
  // @ts-expect-error
  t.equal(defaultAuthStore.set(p, apiUrl, token), undefined)
  const h = hash(hash(p) + hash(apiUrl))
  const file = resolve(dir, '.config/tier/tokens', h)
  const j = JSON.parse(readFileSync(file, 'utf8'))
  t.strictSame(j[0], token)
  const born = j[1]
  t.type(born, 'number')
  t.equal(j[2], apiUrl)
  const sig = j[3]
  t.type(sig, 'string')
  t.equal(sig, hash(JSON.stringify([token, born, apiUrl])))
  t.strictSame(defaultAuthStore.get(p, apiUrl), undefined)
  t.equal(defaultAuthStore.get(p, apiUrl), undefined)
  t.end()
})

t.test('file not found', t => {
  const p = '/no/login/path'
  t.strictSame(defaultAuthStore.get(p, apiUrl), undefined)
  t.end()
})

t.test('no HOME', t => {
  const { HOME } = process.env
  t.teardown(() => {
    process.env.HOME = HOME
  })
  delete process.env.HOME
  t.throws(() => defaultAuthStore.get('a', 'b'))
  t.throws(() =>
    defaultAuthStore.set('a', 'b', { access_token: 'c', token_type: 'basic' })
  )
  t.throws(() => defaultAuthStore.delete('a', 'b'))
  t.end()
})

t.test('bad json', t => {
  const p = '/bad/json/path'
  const token = {
    access_token: 'access',
    token_type: 'basic',
  }
  t.equal(defaultAuthStore.set(p, apiUrl, token), undefined)
  const h = hash(hash(p) + hash(apiUrl))
  const file = resolve(dir, '.config/tier/tokens', h)
  const j = JSON.parse(readFileSync(file, 'utf8'))
  t.strictSame(j[0], token)
  const born = j[1]
  t.type(born, 'number')
  t.equal(j[2], apiUrl)
  const sig = j[3]
  t.type(sig, 'string')
  t.equal(sig, hash(JSON.stringify([token, born, apiUrl])))
  t.strictSame(defaultAuthStore.get(p, apiUrl), token)
  appendFileSync(file, 'some junk')
  t.strictSame(defaultAuthStore.get(p, apiUrl), undefined)
  writeFileSync(file, JSON.stringify({ j }), { mode: 0o600 })
  t.strictSame(defaultAuthStore.get(p, apiUrl), undefined)
  writeFileSync(file, JSON.stringify(j), { mode: 0o755 })
  t.strictSame(defaultAuthStore.get(p, apiUrl), undefined)
  t.end()
})

t.test('bad sig', t => {
  const p = '/bad/sig/path'
  const token = {
    access_token: 'access',
    token_type: 'basic',
  }
  t.equal(defaultAuthStore.set(p, apiUrl, token), undefined)
  const h = hash(hash(p) + hash(apiUrl))
  const file = resolve(dir, '.config/tier/tokens', h)
  const j = JSON.parse(readFileSync(file, 'utf8'))
  t.strictSame(j[0], token)
  const born = j[1]
  t.type(born, 'number')
  t.equal(j[2], apiUrl)
  const sig = j[3]
  t.type(sig, 'string')
  t.equal(sig, hash(JSON.stringify([token, born, apiUrl])))
  t.strictSame(defaultAuthStore.get(p, apiUrl), token)
  j[3] = 'not a valid signature'
  writeFileSync(file, JSON.stringify(j), { mode: 0o600 })
  t.strictSame(defaultAuthStore.get(p, apiUrl), undefined)
  t.end()
})

t.test('wrong apiurl', t => {
  const p = '/bad/url/path'
  const token = {
    access_token: 'access',
    token_type: 'basic',
  }
  t.equal(defaultAuthStore.set(p, apiUrl, token), undefined)
  const h = hash(hash(p) + hash(apiUrl))
  const file = resolve(dir, '.config/tier/tokens', h)
  const j = JSON.parse(readFileSync(file, 'utf8'))
  t.strictSame(j[0], token)
  const born = j[1]
  t.type(born, 'number')
  t.equal(j[2], apiUrl)
  const sig = j[3]
  t.type(sig, 'string')
  t.equal(sig, hash(JSON.stringify([token, born, apiUrl])))
  t.strictSame(defaultAuthStore.get(p, apiUrl), token)
  j[2] = 'https://example.com/not/tier'
  j[3] = hash(JSON.stringify([token, born, j[2]]))
  writeFileSync(file, JSON.stringify(j), { mode: 0o600 })
  t.strictSame(defaultAuthStore.get(p, apiUrl), undefined)
  t.end()
})
