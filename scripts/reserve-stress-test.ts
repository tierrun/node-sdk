const { TIER_API_URL = 'http://127.0.0.1:8888', TIER_KEY = '<no auth>' } =
  process.env

Object.assign(process.env, {
  TIER_API_URL,
  TIER_KEY,
})

import { Headers } from 'node-fetch'
import { equal } from 'node:assert'
import {
  FeatureName,
  OrgName,
  PlanName,
  Reservation,
  TierClient,
} from '../src/index'

const N = 1000
const refundEvery = 2

const tier = TierClient.fromEnv()
if (process.env.TIER_KEY === '<no auth>') {
  tier.authorize = h => {
    const td = new Headers(h)
    td.delete('authorization')
    td.set('tier-domain', 'org:github:org:8051653')
    return td
  }
}

// feature: { count: [times] }
let timing: { [k: string]: { [t: string]: number[] } } = {}
const avg = (a: number[]): number => a.reduce((x, y) => x + y, 0) / a.length
const reportTimes = () => {
  const ret = Object.fromEntries(
    Object.entries(timing).map(([f, c]) => {
      return [f, avg(Object.values(c).reduce((a, b) => a.concat(b), []))]
    })
  )
  timing = {}
  return ret
}

const plan: PlanName = `plan:stresstest@${Date.now()}`
const model = {
  plans: {
    [plan]: {
      features: {
        'feature:inf': {
          tiers: [{}],
        },
        'feature:hundred': {
          tiers: [{ upto: 100 }],
        },
        'feature:thousand': {
          tiers: [
            { upto: 100 },
            { upto: 200 },
            { upto: 300 },
            { upto: 400 },
            { upto: 500 },
            { upto: 600 },
            { upto: 700 },
            { upto: 800 },
            { upto: 900 },
            { upto: 1000 },
          ],
        },
        'feature:10k': {
          tiers: [
            { upto: 1000 },
            { upto: 2000 },
            { upto: 3000 },
            { upto: 4000 },
            { upto: 5000 },
            { upto: 6000 },
            { upto: 7000 },
            { upto: 8000 },
            { upto: 9000 },
            { upto: 10000 },
          ],
        },
      },
    },
  },
}

const counts: { [k: string]: number } = {}

let refundCounter: number = 0

const res = async (o: OrgName, f: FeatureName, count = 1) => {
  if (!timing[f]) {
    timing[f] = {}
  }
  if (!timing[f][count]) {
    timing[f][count] = []
  }
  const start = performance.now()
  const rsv = await tier.reserve(o, f, count)
  timing[f][count].push(performance.now() - start)

  counts[f] = (counts[f] || 0) + count
  switch (f) {
    case 'feature:inf':
      equal(rsv.ok, true)
      break
    case 'feature:hundred':
      equal(rsv.ok, counts[f] <= 100)
      break
    case 'feature:thousand':
      equal(rsv.ok, counts[f] <= 1000)
      break
    case 'feature:10k':
      equal(rsv.ok, counts[f] <= 10000)
      break
  }

  // refund every so often, or whenever a reservation is not allowed
  if (
    ++refundCounter % refundEvery === 0 ||
    Math.random() * refundEvery < 1 ||
    !rsv.ok
  ) {
    await refund(rsv)
  }

  return rsv
}

const refund = async (rsv: Reservation) => {
  timing.refund = timing.refund || {}
  timing.refund[0] = timing.refund[0] || []
  const start = performance.now()
  await rsv.refund()
  timing.refund[0].push(performance.now() - start)
  counts[rsv.feature] -= rsv.count
  counts.refundCount = counts.refundCount || 0
  counts.refundCount += 1
  counts.refundTotal = counts.refundTotal || 0
  counts.refundTotal += rsv.count
}

const checkUsed = async (o: OrgName, f: FeatureName) => {
  const rsv = await res(o, f, 0)
  equal(rsv.used, counts[f])
}

const shuffle = (a: any[]): any[] => {
  const ret: any[] = []
  for (let i = 0; i < a.length; i++) {
    if (Math.random() < 0.5) ret.push(a[i])
    else ret.unshift(a[i])
  }
  return ret
}

const main = async () => {
  await tier.pushModel(model)
  console.log('pushed model')
  const org: OrgName = `org:stresstester:${Date.now()}`

  // wait for them to be available
  await new Promise(r => setTimeout(r, 5000))
  console.log('trying to appendPhase...')
  while (
    await tier
      .appendPhase(org, plan)
      .then(() => false)
      .catch(() => true)
  ) {
    process.stdout.write('.')
  }
  console.log('did appendPhase')
  await new Promise(r => setTimeout(r, 1000))
  console.log('trying first reserve...')
  let maxTries = 1000
  while (
    await res(org, 'feature:inf', 1)
      .then(() => false)
      .catch(() => true)
  ) {
    process.stdout.write('.')
    if (maxTries-- < 0) {
      await res(org, 'feature:inf', 1)
      break
    }
  }
  console.log('starting actual stress test')

  for (let i = 0; i < N; i++) {
    await Promise.all(
      shuffle([
        res(org, 'feature:inf', Math.floor(Math.random() * 10)),
        res(org, 'feature:hundred', Math.floor(Math.random() * 10)),
        res(org, 'feature:thousand', Math.floor(Math.random() * 10)),
        res(org, 'feature:10k', Math.floor(Math.random() * 10)),
        res(org, 'feature:inf', Math.floor(Math.random() * 100)),
        res(org, 'feature:hundred', Math.floor(Math.random() * 100)),
        res(org, 'feature:thousand', Math.floor(Math.random() * 100)),
        res(org, 'feature:10k', Math.floor(Math.random() * 100)),
        res(org, 'feature:inf', 1),
        res(org, 'feature:hundred', 1),
        res(org, 'feature:thousand', 1),
        res(org, 'feature:10k', 1),
        res(org, 'feature:inf', 0),
        res(org, 'feature:hundred', 0),
        res(org, 'feature:thousand', 0),
        res(org, 'feature:10k', 1),
      ])
    )
    await Promise.all([
      checkUsed(org, 'feature:inf'),
      checkUsed(org, 'feature:hundred'),
      checkUsed(org, 'feature:thousand'),
      checkUsed(org, 'feature:10k'),
    ])
    if (i % 100 === 0) {
      console.log(i, { counts, responseTimes: reportTimes() })
    }
  }
  console.log('ok')
}

main()
