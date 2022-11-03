# tier Node SDK

SDK for using https://tier.run in Node.js applications

## INSTALLING

First, install [the Tier binary](https://tier.run/docs/install).

Run `tier connect` to authorize Tier to your Stripe account, or
provide a `STRIPE_API_KEY` environment variable.

```bash
npm install tier
```

## Overview

This is the SDK that can may be used to integrate Tier into your
application. More details on the general concepts used by Tier
may be found at <https://www.tier.run/docs/>.

The SDK works by talking to an instance of the Tier binary
running as a sidecar, using `tier serve`.

## USAGE

Note: the Tier client is not designed to be used in web browsers.

This module exports both a zero-dependency client class, suitable
for use in non-Node.js environments such as edge workers and
Deno, as well as a simple functional SDK that manages spinning up
the sidecar automatically.

### Automatic Mode

Import the main module, and use the API methods provided.  The
sidecar will be started on the first API method, or may be
started immediately using the `init()` method.  It will listen on
a port determined by the process ID.

To point at a pre-existing running Tier sidecar, set the
`TIER_SIDECAR` environment variable to its base URL.

To operate on live Stripe data (that is, to start the sidecar in
live mode), set `TIER_LIVE=1` in the environment.

Turn on debug output by setting `TIER_DEBUG=1` or
`NODE_DEBUG=tier` in the environment.

Note that you must have previously run [`tier
connect`](https://tier.run/docs/cli/connect) to authorize Tier to
access your Stripe account, or set the `STRIPE_API_KEY`
environment variable.

This of course requires that Node's `child_process` module is
available.  If `fetch` is not available, then the optional
`node-fetch` dependency will be loaded as a polyfill.

### Client Mode

To use Tier in an environment where `child_process.spawn` is not
available, or where you simply don't need this added
functionality because you are managing the sidecar yourself, you
can load and instantiate the client:

```ts
import { Tier } from 'tier/client'

const tier = new Tier({
  // Required: the base url to the running `tier serve` instance
  sidecar: myTierSidecarBaseURL,
  // Optional, only needed if fetch global is not available
  fetchImpl: myFetchImplementation,
  // Optional, defaults to false
  debug: false
})
```

Then call API methods from the tier instance.

### Error Handling

All methods will raise a `TierError` object if there's a non-2xx
response from the Tier sidecar, or if a response is not valid
JSON.

This Error subclass contains the following fields:

* `status` - number, the HTTP status code received
* `code` - Short string representation of the error, something like `not_found`
* `message` - Human-readable explanation of the error.
* `path` - The API path being accessed
* `requestData` - The data sent to the API path (query string for
  GETs, request body for POSTs.)
* `responseData` - The response data returned by the API
  endpoint.

## API METHODS

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

Retrieve the current schedule phase for the org. This provides a
list of the features and plans that the org is currently
subscribed to, which can be useful information when creating a
user interface for upgrading/downgrading pricing plans.

```json
{
  "effective": "2022-10-13T16:52:11-07:00",
  "features": ["feature:storage@plan:free@1", "feature:transfer@plan:free@1"],
  "plans": ["plan:free@1"]
}
```

Note: This should **not** be used for checking entitlements and
feature gating. Instead, use the `Tier.limit()` method and check
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

### `pull()`

Fetches the pricing model from Stripe.

### `pullLatest()`

**Experimental**

Fetches the pricing model from Stripe, but only shows the plans
with the highest versions (lexically sorted).  This can be useful
in building pricing pages in your application (assuming that
"highest lexically sorted plan version" is the one that you want
to show, of course).

For example, if `Tier.pull()` returns this:

```json
{
  "plans": {
    "plan:foo@1": {},
    "plan:foo@0": {},
    "plan:bar@7": {},
    "plan:foo@2": {},
    "plan:bar@0": {}
  }
}
```

then `Tier.pullLatest()` will return:

```json
{
  "plans": {
    "plan:foo@2": {},
    "plan:bar@7": {}
  }
}
```

### `push(model)`

Creates the `Product` and `Price` objects in Stripe corresponding
to the supplied pricing Model (as would be found in a
[`pricing.json` file](https://tier.run/docs/pricing.json)).

Returns an object detailing which features were created, and
which either had errors or already existed.  Note that a
successful response from this method does not mean that _all_ of
the features were created (since, for example, some may already
exist), only that _some_ of them were.
