import { TierClient } from '../lib/index.js'
import t from 'tap'

t.test('init from environment', async t => {
  process.env.TIER_API_URL = 'https://example.com'
  process.env.TIER_KEY = 'deadbeefcafebad101'
  const tc = TierClient.fromEnv()
  t.equal(tc.apiUrl, 'https://example.com')
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
})
