# tier-sdk

SDK for using https://tier.run in Node.js applications

## INSTALLING

First, install [the Tier binary](https://tier.run/docs/install).

Run `tier connect` to authorize Tier to your Stripe account, or
provide a `STRIPE_API_KEY` environment variable.

```bash
npm install @tier.run/sdk
```

## Overview

This is the SDK that can may be used to integrate Tier into your
application. More details on the general concepts used by Tier
may be found at <https://www.tier.run/docs/>.

## API

To operate on live Stripe data, set `TIER_LIVE=1` in the
environment prior to using the SDK.

The Tier sidecar will be started automatically on the first API
call, responding only to requests from `localhost`, on a port
derived from the process id.

If you start the sidecar in some other way, set
`TIER_SIDECAR=<url>` in the environment, with the full `url` to
the running sidecar.  For example:

```
$ export TIER_SIDECAR=https://tier-sidecar.acme.com:4321
$ npm start
```

Load the SDK via:

```js
// typescript or esmodule style
import Tier from '@tier.run/sdk'

// or, commonjs style
const Tier = require('@tier.run/sdk').default
```

### Environment Variables

#### `STRIPE_API_KEY=<key>`

If set to a stripe secret key, then this will be used instead of
the key geneated for `tier connect`.

If you do not set `STRIPE_API_KEY` in the environment, then you
must run [`tier connect`](https://tier.run/docs/cli/connect) to
authorize the tier client to access your Stripe account.

#### `TIER_DEBUG=1`, `NODE_DEBUG=tier`

Write debugging output to `stderr`.

#### `TIER_SIDECAR=<url>`

Set to the full base URL of the tier sidecar.  Set this if you
run the sidecar manually using `tier serve`.

If not set, then the Tier SDK will spawn a sidecar on the first
API call.

### `subscribe(org, plan, [effective])`

Subscribe an org to the specified plan. If no effective date is
provided, then the plan is effective immediately.

Plan may be either a versioned plan name, or an array of
versioned plan names.

If no effective date is provided, then the plan is effective
immediately.

### `subscribe(org, phases)`

Subscribe an org to each of the sets of plans specified in the
`phases` array.

Each item in `phases` must be an object containing:

- `features` Array of plan names
- `effective` Optional effective date

If no effective date is provided, then the phase takes effect
immediately.

### `limits(org)`

Retrieve the usage data and limits for an org.

```json
{
  "org": "org:user",
  "usage": [
    {
      "feature": "feature:storage",
      "used": 341,
      "limit": 10000
    },
    {
      "feature": "feature:transfer",
      "used": 234213,
      "limit": 10000
    }
  ]
}
```

### `limit(org, feature)`

Retrieve the usage and limit data for an org and single feature.

```json
{
  "feature": "feature:storage",
  "used": 341,
  "limit": 10000
}
```

If the org does not have access to the feature, then an object is
returned with `usage` and `limit` set to `0`.

```json
{
  "feature": "feature:noaccess",
  "used": 0,
  "limit": 0
}
```

### `report(org, feature, [n = 1], [at = new Date()], [clobber = false])`

Report usage of a feature by an org.

The optional `n` parameter indicates the number of units of the
feature that were consumed.

The optional `at` parameter is a Date object indicating when the
usage took place.

The optional `clobber` parameter indicates that the usage should
override any previously reported usage of the feature for the
current subscription phase.

### `whois(org)`

Retrieve the Stripe Customer ID for an org.

```json
{
  "org": "org:user",
  "stripe_id": "cus_v49o7xMpZaMbzg"
}
```

### `phase(org)`

Retrieve the current schedule phase for the org.  This provides a
list of the features and plans that the org is currently
subscribed to, which can be useful information when creating a
user interface for upgrading/downgrading pricing plans.

```json
{
  "effective": "2022-10-13T16:52:11-07:00",
  "features": [
    "feature:storage@plan:free@1",
    "feature:transfer@plan:free@1"
  ],
  "plans": [
    "plan:free@1"
  ]
}
```

Note: This should **not** be used for checking entitlements and
feature gating.  Instead, use the `Tier.limit()` method and check
the limit and usage for the feature in question.

For example:

```
// Do not do this!  You will regret it!
const phase = await Tier.phase(`org:${customerID}`)
if (phase.plans.some(plan => plan.startsWith('plan:pro')) {
  showSpecialFeature()
}
```

Instead, do this:

```js
const usage = await Tier.limit(`org:${customerID}`, 'feature:special')
if (usage.limit < usage.used) {
  showSpecialFeature()
}
```
