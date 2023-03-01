# tier Node SDK

SDK for using https://tier.run in Node.js applications

[Generated typedocs](https://tierrun.github.io/node-sdk/)

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

Note: support for using the Tier JavaScript client in web
browsers is **EXPERIMENTAL**. Whatever you do, please don't put
your private Stripe keys where web browsers can see them.

This module exports both a zero-dependency client class, suitable
for use in non-Node.js environments such as edge workers and
Deno, as well as a simple functional SDK that manages spinning up
the sidecar automatically.

### Automatic Mode, Remote API Service

This works on any server-side contexts where you can set
environment variables.

Set the `TIER_BASE_URL` and `TIER_API_KEY` environment variables
to the URL to the remote Tier service and the API key for the
service.

Import the main module, and use the methods provided.

```ts
// Set process.env.TIER_BASE_URL and process.env.TIER_API_KEY

// hybrid module, either form works
import tier from 'tier'
// or
const { default: tier } = require('tier')
// that's it, it'll talk to the API server you set
```

### Automatic Mode, Sidecar on Localhost

This works if you have Tier installed locally.

Don't set any environment variables, just import the main module,
and use the API methods provided.

A Tier API sidecar process will be started on the first API
method call. It will listen on a port determined by the process
ID, and automatically shut down when the process terminates.

To operate on live Stripe data (that is, to start the sidecar in
live mode), set `TIER_LIVE=1` in the environment.

```ts
// hybrid module, either form works
import tier from 'tier'
// or
const { default: tier } = require('tier')
// that's it, it'll start the sidecar as needed
```

Note that you must have previously run [`tier
connect`](https://tier.run/docs/cli/connect) to authorize Tier to
access your Stripe account, or set the `STRIPE_API_KEY`
environment variable.

This requires that Node's `child_process` module is available, so
does not work with environments that do not have access to it. If
`fetch` is not available, then the optional `node-fetch`
dependency will be loaded as a polyfill.

If you want a client instance that is automatically configured by
the environment settings, with an on-demand started tier API
sidecar, you can call:

```ts
const client = await tier.fromEnv()
```

### Custom Client Custom Mode

To use Tier in an environment where `child_process.spawn` is not
available, or where you cannot set environment variables, you
can load and instantiate the client yourself:

```ts
// hybrid module, either works
import { Tier } from 'tier/client'
// or
const { Tier } = require('tier/client')
// or, if using deno or CFW and you don't have import maps:
import { Tier } from 'https://unpkg.com/tier@^5/dist/mjs/client.js'

const tier = new Tier({
  // Required: the base url to the running `tier serve` instance
  baseURL: tierAPIServiceURL,

  // optional, defaults to '', set an API key to access the service
  apiKey: tierAPIKey,

  // optional, if set will catch all API errors.
  // Note that this makes the promises from API calls resolve,
  // unless the onError function re-throws!  Use with caution!
  //
  // onError: (er: TierError) => {
  //   console.error(er)
  //   throw er
  // }

  // Optional, only needed if fetch global is not available
  // fetchImpl: myFetchImplementation,

  // Optional, defaults to false, will make a lot of
  // console.error() calls.
  // debug: false

  // Optional, can be used to terminate all actions by this client
  // signal: myAbortSignal
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

### `subscribe(org, plan, { info, trialDays, paymentMethodID })`

Subscribe an org to the specified plan effective immediately.

Plan may be either a versioned plan name (for example,
`plan:bar@1`), or "feature plan" name (for example
`feature:foo@plan:bar@1`), or an array of versioned plan names
and feature plan names.

If no effective date is provided, then the plan is effective
immediately.

If `info` is provided, it updates the org with info in the same
way as calling `updateOrg(org, info)`.

If `trialDays` is a number greater than 0, then a trial phase
will be prepended with the same features, and the effective date
will on the non-trial phase will be delayed until the end of the
trial period.

If a string `paymentMethodID` is specified, then it will be used
as the billing method for the subscription.

### `schedule(org, phases, { info, paymentMethodID })`

Create a subscription schedule phase for each of the sets of
plans specified in the `phases` array.

Each item in `phases` must be an object containing:

- `features` Array of versioned plan names (for example,
  `plan:bar@1`), or "feature plan" names (for example,
  `feature:foo@plan:bar@1`)
- `effective` Optional effective date.
- `trial` Optional boolean indicating whether this is a trial or
  an actual billed phase, default `false`

If no effective date is provided, then the phase takes effect
immediately. Note that the first phase in the list MUST NOT
have an effective date, and start immediately.

If `info` is provided, it updates the org with info in the same
way as calling `updateOrg(org, info)`.

If a string `paymentMethodID` is specified, then it will be used
as the billing method for the subscription.

### `checkout(org, successUrl, { cancelUrl, features, trialDays, requireBillingAddress })`

Generate a Stripe Checkout flow, and return a `{ url }` object.
Redirect the user to that `url` to have them complete the
checkout flow. Stripe will redirect them back to the
`successUrl` when the flow is completed successfully.

Optional parameters:

- `cancelUrl` if provided, then the user will be redirected to
  the supplied url if they cancel the process.
- `features` Either a versioned plan name (for example,
  `plan:bar@1`), or "feature plan" name (for example
  `feature:foo@plan:bar@1`), or an array of versioned plan names
  and feature plan names. If provided, then the user will be
  subscribed to the relevant plan(s) once they complete the
  Checkout flow. If not provided, then the Checkout flow will
  only gather customer information.
- `trialDays` Number of days to put the user on a "trial plan",
  where they are not charged for any usage. Only allowed when
  `features` is provided.
- `requireBillingAddress` If set to `true`, then the user will be
  required to add a billing address to complete the checkout
  flow.

### `updateOrg(org, info)`

Update the specified org with the supplied information.

`info` is an object containing the following fields:

- `email` string
- `name` string
- `description` string
- `phone` string
- `metadata` Object with any arbitrary keys and `string` values
- `invoiceSettings` An object which may contain a
  `defaultPaymentMethod` string. If set, it will be attached as
  the org's default invoice payment method.

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
name, description, phone, metadata, and invoiceSettings.

### `lookupPaymentMethods(org)`

Return a `PaymentMethodsResponse` object, containing the org name
and an array of their available payment method IDs.

```json
{
  "org": "org:acme",
  "methods": ["pm_card_3h39ehaiweheawfhiawhfasi"]
}
```

If the org does not have any payment methods, then the returned
object will contain an empty array.

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
in building pricing pages in your application.

Plan versions are sorted numerically if they are decimal
integers, or lexically in the `en` locale otherwise.

So, for example, the plan version `20test` will be considered
"lower" than `9test`, because the non-numeric string causes it to
be lexically sorted. But the plan version `20` sill be
considered "higher" than the plan version `9`, because both are
strictly numeric.

For example, if `Tier.pull()` returns this:

```json
{
  "plans": {
    "plan:mixednum@9test": {},
    "plan:mixednum@9999999": {},
    "plan:mixednum@0test": {},
    "plan:mixednum@1000": {},
    "plan:alpha@dog": {},
    "plan:alpha@cat": {},
    "plan:longnum@1000": {},
    "plan:longnum@99": {},
    "plan:foo@1": {},
    "plan:foo@0": {},
    "plan:bar@7": {},
    "plan:foo@2": {},
    "plan:bar@0": {}
  }
}
```

then `Tier.pullLatest()` will return:

```js
{
  plans: {
    // these are all sorted numerically, because the versions
    // are simple positive integers without any leading 0
    // characters.
    'plan:foo@2': {},
    'plan:bar@7': {},
    'plan:longnum@1000': {},
    // 'dog' and 'cat' sorted lexically, 'd' > 'c'
    'plan:alpha@dog': {},
    // these are sorted lexically, because even though SOME of
    // are strictly numeric, this one is not.
    'plan:mixednum@9test': {}
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

### `async withClock(name: string, present?: Date)`

Create a test clock with the given name, and return a `Tier`
client configured to use that clock.

### `async syncClock()`

Fetch the currently configured clock.

Rejects if the client was not created by `tier.withClock()`.

### `async advance(present: Date)`

Advance the clock to the specified date.

Rejects if the client was not created by `tier.withClock()`.

### `async awaitClockReady()`

Ping the server with exponential backoff until the configured
clock returns a 'ready' status.

Rejects if the client was not created by `tier.withClock()`.

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
- `cause`: If triggered by an underlying system or JSON.parse
  error, it will be provided here.
