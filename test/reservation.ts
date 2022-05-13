import t from 'tap'
import { FeatureName, OrgName, TierClient } from '../lib'
import { Reservation } from '../lib/reservation'

// lies, damn lies, and types
type Methods = 'reserve' | 'currentUsage' | 'can' | 'cannot'
type MockClient = Pick<TierClient, Methods> & {
  used: number
  reserved: null | Reservation
  limit: number
}
const client: MockClient = {
  reserved: null,
  used: 0,
  limit: 10,

  can: TierClient.prototype.can,
  cannot: TierClient.prototype.cannot,
  currentUsage: TierClient.prototype.currentUsage,

  async reserve(
    org: OrgName,
    feature: FeatureName,
    n: number,
    now: Date | string | number = new Date()
  ): Promise<Reservation> {
    now = new Date(now)
    return new Reservation(
      this as unknown as TierClient,
      org,
      feature,
      n,
      now,
      {
        used: this.used += n,
        limit: this.limit,
      }
    )
  },
}

t.test('basic reservation', async t => {
  const res = await client.reserve('org:o', 'feature:f', 1, new Date())
  t.match(res, {
    org: 'org:o',
    feature: 'feature:f',
    n: 1,
    now: Date,
    used: 1,
    limit: 10,
    remaining: 9,
    overage: 0,
    allowed: 1,
    ok: true,
  })
  t.end()
})

t.test('too many, cancel it', async t => {
  const res = await client.reserve('org:o', 'feature:f', 10, new Date())
  t.match(res, {
    org: 'org:o',
    feature: 'feature:f',
    n: 10,
    now: Date,
    used: 11,
    limit: 10,
    remaining: 0,
    overage: 1,
    allowed: 9,
    ok: false,
  })
  t.equal(client.used, 11)
  t.equal(client.limit, 10)
  await res.cancel()
  t.equal(client.used, 1)
  t.equal(client.limit, 10)
  t.end()
})

t.test('not part of plan', async t => {
  client.used = -1
  client.limit = -2
  const res = await client.currentUsage('org:o', 'feature:f')
  t.match(res, {
    org: 'org:o',
    feature: 'feature:f',
    n: 0,
    now: Date,
    used: -1,
    limit: -2,
    remaining: 0,
    overage: 1,
    allowed: 0,
    ok: false,
  })
  t.equal(client.used, -1)
  t.equal(client.limit, -2)
  const can = await client.can('org:o', 'feature:f')
  t.equal(can, false)
  const cannot = await client.cannot('org:o', 'feature:f')
  t.equal(cannot, true)
  t.end()
})
