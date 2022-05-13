# tier-sdk

SDK for using https://tier.run in Node.js applications

## INSTALLING

```bash
npm install @tier.run/sdk
```

## Overview

This is the SDK that can may be used to integrate Tier into your
application. More details on the general concepts used by Tier
may be found at <https://tier.run/docs/>.

## CLI USAGE

```
tier: usage: tier [options] <command>

Options:

  --api-url=<url>  Set the tier API server base url.
                   Defaults to TIER_API_URL env, or https://api.tier.run/

  --web-url=<url>  Set the tier web server base url to use for login.
                   Defaults to TIER_WEB_URL env, or https://tier.run/

  --key=<token>    Specify the auth token for Tier to use.
                   Tokens can be generated manually by visiting
                   <https://tier.run/app/account/tokens>, minted for a project
                   by running 'tier login', or set in the environment variable
                   TIER_KEY.

  --auth-type=<basic|bearer>
                   Tell Tier to use the specified auth type.  Default: basic

  --debug -v       Turn debug logging on
  --no-debug -V    Turn debug logging off

  --help -h        Show this usage screen.

Commands:

  login            Log in the CLI by authorizing in your web browser.
                   Tokens are stored scoped to each project working directory
                   and API server, and will not be active outside of that
                   environment.

  logout           Remove a login token from your system.

  projectDir       Show the current project directory that login tokens are
                   scoped to.

  push <jsonfile>  Push the pricing model defined in <jsonfile> to Tier.

  pull             Show the current model.

  whoami           Get the organization ID associated with the current login.

  fetch <path>     Make an arbitrary request to a Tier API endpoint.
```

## API

### TierClient Constructor

```js
import { TierClient } from '@tier.run/sdk'
// or: const { TierClient } = require('@tier.run/sdk')
const tier = new TierClient()
```

#### Options:

The default options are likely fine, with the exception of
`tierKey`, which is of course unique.

- `tierKey`: The API token minted on
  [tier.run](https://tier.run/app/account/tokens). Defaults to
  the value of the `TIER_KEY` environment variable.
- `authStore`: An object implementing `get(cwd, apiUrl)`,
  `set(cwd, apiUrl, token)`, and `delete(cwd, apiUrl)` methods.
  Default implementation stores tokens on the filesystem in
  `~/.config/tier/tokens`, owned by the current user, with mode
  `0o600`.
- `authType`: Either `'basic'` or `'bearer'`. Default is
  `'basic'`. In most cases, there is no reason to change this.
- `apiUrl`: The url to hit for most API requests. Default:
  `https://api.tier.run`. <!-- TODO: move login and pricing
  pages to tierd, and coalesce these into one tierUrl -->
- `webUrl`: The url to hit for fetches to the `tier.run` website.
  Default: `https://tier.run` <!-- TODO: move login and pricing
  pages to tierd, and coalesce these into one tierUrl -->

### `TierClient.fromCwd(options?: TierSettings)`

Load a Tier client with a token found in the `authStore` (see
options above), based on the specified apiUrl and current project
directory.

### `tierJSUrl(): string`

Return the URL to the `tier.js` browser API. Include this
`tier.js` script on every page of your website.

### `tier.stripeOptions(org: OrgName)`

Get the options to pass to the client-side call to
`tier.paymentForm()`.

Posts to `/api/v1/stripe/options`

<!-- TODO: document tier.js, maybe pull into this library? -->

### `tier.appendPhase(org: OrgName, plan: PlanName, effective?: Date)`

Add a phase to the specified org's schedule. If not specified,
the `effective` date is the current time.

Posts to `/api/v1/append`

### Reservations

In order to record usage, Tier calls the `reserve` API.

Usage and limit amounts are based on best available data at the
moment recorded. Amounts reported by the Tier API are eventually
consistent, usually within a few ms. <!-- TKTK: figure out what
actual SLA/reliability guarantee we can make here -->

All of the methods in this section post to `/api/v1/reserve`.

#### Class `Reservation`

Returned by `tier.reserve()`

- Properties:
  - `org`, `feature`, `n`, `now` The values used to make this
    reservation.
  - `used` The number of units of the feature that the org has
    used once the reservation was made, or `-1` if the org
    does not have the feature available on their plan.
  - `limit` The limit of units of the feature that the org is
    allowed, or `-2` if the org does not have the feature
    available on their plan.
  - `ok` True if the reservation was successful and the org
    has not gone into an overage state.
  - `overage` The number of units of the feature that the org
    has consumed above their plan limit. Set to `1` if the
    org does not have the feature available on their plan.
  - `allowed` The number of units of the feature that the org
    _should_ be allowed to consume with this reservation. Ie,
    the value of `n`, minus any overages.
  - `remaining` The number of units of the feature that the org
    is allowed to consume in total.
- Methods
  - `cancel() => Reservation` Roll back the reservation. For
    example, use this if the total amount is not allowed, and
    you do not wish to leave them in an overage state, or if
    the feature could not be delivered to the user for some
    reason. Returns a reservation for the negative amount.

##### Simple Example

Our customer is attempting to consume 1 of the `foo` feature.

```js
const res = await tier.reserve('org:acme', 'feature:foo')
if (res.ok) {
  // proceed, all is good
  try {
    consumeOneFoo('acme')
  } catch (er) {
    // oh no!  it failed!  don't charge them for it
    await res.cancel()
  }
} else {
  // suggest they buy a bigger plan, maybe?
  showUpgradePlanUX('acme')
}
```

##### Example with `n > 1`, partial fulfillment

If the number we're trying to reserve is greater than the amount
allowed, we may end up in a case where _some_ is allowed, but not
_all_ of the amount.

Let them consume the bit that they're allowed, but only that
much.

```js
const res = await tier.reserve('org:acme', 'feature:foo', 10)
if (!res.ok) {
  // user not allowed to consume 10 foos
  if (res.allowed > 0) {
    // but they are allowed to consume SOME foos
    return consumeSomeFoo('acme', res.allowed)
  } else {
    // not allowed any at all
    return fooNotAllowed('acme')
  }
} else {
  // totally fine, proceed
  try {
    return consumeTenFoos('acme')
  } catch (er) {
    // oh no!  we failed to consume the foos!
    // make sure they aren't charged for them
    await res.cancel()
  }
}
```

##### Example with `n > 1`, all or nothing

Maybe the feature cannot be split up in that fashion. For
example, perhaps we are checking disk space usage when the
customer tries to upload a file, so allowing only _part_ of the
file upload doesn't make much sense.

In this case, we don't want to use up their remaining allocation
on something we didn't actually do.

```js
const res = await tier.reserve('org:acme', 'feature:foo', 10)
if (res.ok) {
  try {
    return consumeTenFoos('acme')
  } catch (er) {
    // our feature failed, roll back the reservation
    await res.cancel()
  }
} else {
  await res.cancel()
  showSorryYouNeedToUpgradeMessage('acme')
}
```

##### Example with soft limit

Here, we check to see if they're allowed any, but if the actual
amount puts them into an overage state, we just let them proceed.

```js
// at least 1 is allowed
if (await tier.can('org:acme', 'feature:foo')) {
  const howMany = await figureOutFooCount('acme')
  const res = await tier.reserve('org:acme', 'feature:foo', howMany)
  try {
    consumeSomeFoos('acme', howMany)
    if (!res.remaining) {
      showMessage('acme', 'This is your last foo, need to upgrade')
    }
  } catch (er) {
    await res.cancel()
  }
} else {
  // not entitled to feature
  showMessage('acme', 'You have no foos remaining, please upgrade')
}
```

#### `tier.reserve(org, feature, n = 1, now = new Date())`

Reserve `n` units of feature usage for the specified org, and
return the resulting used/limit amounts after making the
reservation. No guards against overages or limits.

If the user does not have the feature in their plan, returns
`{"used":-1,"limit":-2}`

#### `tier.currentUsage(org, feature, now = new Date())`

Performs a reservation of count `0`, to return a `Reservation`
object reflecting the current usage state.

No side effects, does not increment usage.

#### `tier.can(org, feature, n = 1, now = new Date())`

Returns true if the org is allowed to consume the feature in the
amount specified (default: 1) as of the `now` date specified.

No side effects, does not increment usage.

```js
if (await tier.can(org, feature, 10)) {
  // org is allowed to use 10 of feature
  // we haven't actually consumed them yet, however.
} else {
  // org is not allowed to use 10 of feature
  // they might be allowed to use fewer than that, though
}
```

#### `tier.cannot(org, feature, n = 1, now = new Date())`

Inverse of `can()`.

Returns true if the org is _not_ allowed to consume the feature
in the amount specified (default: 1) as of the `now` date
specified.

No side effects, does not increment usage.

### `tier.lookupSchedule(org: OrgName): Promise<Schedule>`

Look up the org's schedule. This includes a `phases` list of
`Phase` objects, and a `current` number indicating in the phases
array to the currently active phase.

Makes GET request to `/api/v1/schedule`

### `tier.lookupCurrentPlan(org: OrgName): Promise<PlanName>`

Fetch the user's current schedule, and return the name of the
plan that is currently active.

### `tier.ping(): Promise<any>`

Makes a request to the Tier API service to verify that it is
reachable, and that the client's API token is valid.

### `tier.pushModel(model: Model)`

Push the pricing model definition to Tier.

### `tier.pullModel()`

Pull the full pricing model from Tier.

### `tier.pullPricingPage(name: string = 'default'): Promise<PricingPage>`

Pull a pricing page data object from Tier.

If a name is provided, then the named pricing page settings will
be fetched. Otherwise, it will pull the default pricing page
(ie, the latest lexically-sorted version of each plan name in the
model).

<!-- NYI
### `tier.pushPricingPage(name: string, pp: PricingPage): Promise<null | {}>`
-->

## Errors

Any error encountered by Tier, whether a network failure or
non-2xx response code, will raise a `TierError`.

This is similar to a regular Error object, but with the following
data attached:

- `tierError.request` Data about the request being made
  - `tierError.request.method`
  - `tierError.request.url` string
  - `tierError.request.headers` object, with any
    `authorization` header redacted, so it is safe to log
  - `tierError.request.body` (optional)
- `tierError.response` Data about the response. Note that this
  will be missing if a response was not successfully received.
  - `tierError.response.status` number
  - `tierError.response.headers` object
  - `tierError.response.body` string

## INTERNAL API METHODS

These methods are used internally by the Tier SDK, you probably
don't need to call them yourself.

- `async fetchOK<T>(path: string, options: RequestInit): Promise<T>`
- `async getOK<T>(path: string): Promise<T>`
- `async postFormOK<T>(path: string, body: { [key: string]: any }): Promise<T>`
- `async postOK<T>(path: string, body: { [key: string]: any }): Promise<T>`

These each make a request to the Tier API, and verify that the
response is a `2xx` status code.
