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

Import the main module, and use the API methods provided. The
sidecar will be started on the first API method, or may be
started immediately using the `init()` method. It will listen on
a port determined by the process ID.

```ts
import tier from 'tier'
// that's it, it'll start the sidecar as needed
```

To point at a pre-existing running Tier sidecar, set the
`TIER_SIDECAR` environment variable to its base URL.

To operate on live Stripe data (that is, to start the sidecar in
live mode), set `TIER_LIVE=1` in the environment.

Turn on debug output by setting `TIER_DEBUG=1` or
`NODE_DEBUG=tier` in the environment.

Note that you must have previously run [`tier connect`](https://tier.run/docs/cli/connect) to authorize Tier to
access your Stripe account, or set the `STRIPE_API_KEY`
environment variable.

This of course requires that Node's `child_process` module is
available. If `fetch` is not available, then the optional
`node-fetch` dependency will be loaded as a polyfill.

### Raw Client Mode

To use Tier in an environment where `child_process.spawn` is not
available, or where you simply don't need this added
functionality because you are managing the sidecar yourself, you
can load and instantiate the client:

```ts
import { Tier } from 'tier/client'
// or, if you don't have import maps:
// import { Tier } from 'https://unpkg.com/tier@^3.1.1/dist/mjs/client.js'

const tier = new Tier({
  // Required: the base url to the running `tier serve` instance
  sidecar: myTierSidecarBaseURL,

  // Optional, only needed if fetch global is not available
  // fetchImpl: myFetchImplementation,

  // Optional, defaults to false, will make a lot of
  // console.error() calls.
  // debug: false
})
```

Then call API methods from the tier instance.

This is how you can use the Tier SDK from Cloudflare Workers,
Deno, and other non-Node JavaScript environments.

### Error Handling

All methods will raise a `TierError` object if there's a non-2xx
response from the Tier sidecar, or if a response is not valid
JSON.

This Error subclass contains the following fields:

- `status` - number, the HTTP status code received
- `code` - Short string representation of the error, something like `not_found`
- `message` - Human-readable explanation of the error.
- `path` - The API path being accessed
- `requestData` - The data sent to the API path (query string for
  GETs, request body for POSTs.)
- `responseData` - The response data returned by the API
  endpoint.

## API METHODS

### `subscribe(org, plan, { info, trialDays, checkout })`

Subscribe an org to the specified plan effective immediately.

Plan may be either a versioned plan name, or an array of
versioned plan names.

If no effective date is provided, then the plan is effective
immediately.

If `info` is provided, it updates the org with info in the same
way as calling `updateOrg(org, info)`.

If `trialDays` is a number greater than 0, then a trial phase
will be prepended with the same features, and the effective date
will on the non-trial phase will be delayed until the end of the
trial period.

**Experimental**: If `checkout` is set to an object with a
`success_url` string and optionally a `cancel_url` string, then
the response will contain a `checkout_url`, and the subscription
will not be created until the user completes the steps at the
provided URL. **This API is experimental, and may change in a
future update.**

### `schedule(org, phases, { info, checkout })`

Create a subscription schedule phase for each of the sets of
plans specified in the `phases` array.

Each item in `phases` must be an object containing:

- `features` Array of versioned plan names
- `effective` Optional effective date. Note that the first phase
  in the list MUST have an effective date of right now (which is
  the default).
- `trial` Optional boolean indicating whether this is a trial or
  an actual billed phase, default `false`

If no effective date is provided, then the phase takes effect
immediately.

If `info` is provided, it updates the org with info in the same
way as calling `updateOrg(org, info)`.

**Experimental**: If `checkout` is set to an object with a
`success_url` string and optionally a `cancel_url` string, then
the response will contain a `checkout_url`, and the subscription
will not be created until the user completes the steps at the
provided URL. **This API is experimental, and may change in a
future update.**


### `updateOrg(org, info)`

Update the specified org with the supplied information.

`info` is an object containing the following fields:

- `email` string
- `name` string
- `description` string
- `phone` string
- `metadata` Object with any arbitrary keys and `string` values

Note that any string fields that are missing will result in that
data being removed from the org's Customer record in Stripe, as
if `''` was specified.

### `cancel(org)`

Immediately cancels all current and pending subscriptions for the
specified org.

### `lookupLimits(org)`

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

### `lookupLimit(org, feature)`

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

### `report(org, feature, [n = 1], [options = {}])`

Report usage of a feature by an org.

The optional `n` parameter indicates the number of units of the
feature that were consumed.

Options object may contain the following fields:

- `at` Date object indicating when the usage took place.
- `clobber` boolean indicating that the usage amount should
  override any previously reported usage of the feature for the
  current subscription phase.

### `can(org, feature)`

`can` is a convenience function for checking if an org has used
more of a feature than they are entitled to and optionally
reporting usage post check and consumption.

If reporting consumption is not required, it can be used in the
form:

```js
const answer = await tier.can('org:acme', 'feature:convert')
if (answer.ok) {
  //...
}
```

reporting usage post consumption looks like:

```js
const answer = await tier.can('org:acme', 'feature:convert')
if (!answer.ok) {
  return ''
}
answer.report().catch(er => {
  // error occurred reporting usage, log or handle it here
})

// but don't wait to deliver the feature
return convert(temp)
```

### `whois(org)`

Retrieve the Stripe Customer ID for an org.

```json
{
  "org": "org:user",
  "stripe_id": "cus_v49o7xMpZaMbzg"
}
```

### `lookupOrg(org)`

Retrieve the full org info, with `stripe_id`, along with email,
name, description, phone, and metadata.

### `whoami()`

Retrieve information about the current logged in Stripe account.

### `lookupPhase(org)`

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
feature gating. Instead, use the `Tier.lookupLimit()` method and check
the limit and usage for the feature in question.

For example:

```
// Do not do this!  You will regret it!
const phase = await Tier.lookupPhase(`org:${customerID}`)
if (phase.plans.some(plan => plan.startsWith('plan:pro')) {
  showSpecialFeature()
}
```

Instead, do this:

```js
const usage = await Tier.lookupLimit(`org:${customerID}`, 'feature:special')
if (usage.limit < usage.used) {
  showSpecialFeature()
}
```

### `pull()`

Fetches the pricing model from Stripe.

### `pullLatest()`

**Experimental**

Fetches the pricing model from Stripe, but only shows the plans
with the highest versions (lexically sorted). This can be useful
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
which either had errors or already existed. Note that a
successful response from this method does not mean that _all_ of
the features were created (since, for example, some may already
exist), only that _some_ of them were.

### Class: `Answer`

`Answer` is the type of object returned by `tier.can()`.

#### `answer.ok`

`ok` reports if the program should proceed with a user request or
not. To prevent total failure if `can()` needed to reach the sidecar
and was unable to, `ok` will fail optimistically and report true.
If the opposite is desired, clients can check `err`.

#### `answer.err`

Any error encountered fetching the `Usage` record for the org and
feature.

#### `answer.report([n = 1])`

Report the usage in the amount specified, default `1`.

#### `answer.limit`

Number specifying the limit for the feature usage.

#### `answer.used`

Number specifying the amount of the feature that the org has
consumed.

#### `answer.remaining`

Number specifying the amount of feature consumption that is
remaining.

### Class: `TierError`

`TierError` is a subclass of `Error` which is raised whenever
Tier encounters a problem fetching data.

- `message`: the `message` field from the sidear, if present, or
  `"Tier request failed"`
- `path`: the path on the sidecar API that was requested
- `requestData`: the data that was sent to the sidecar
- `status`: the HTTP response status code from the sidecar, if a
  response was returned
- `code`: response error code returned by the sidecar, if present
- `responseData`: the raw HTTP body sent by the sidecar
