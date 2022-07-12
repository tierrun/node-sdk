# tier-sdk

SDK for using https://app.tier.run in Node.js applications

## INSTALLING

```bash
npm install @tier.run/sdk
```

## Overview

This is the SDK that can may be used to integrate Tier into your
application. More details on the general concepts used by Tier
may be found at <https://app.tier.run/docs/>.

## CLI USAGE

```
tier: usage: tier [options] <command>

Options:

  --api-url=<url>  Set the tier API server base url.
                   Defaults to TIER_API_URL env, or https://api.tier.run/

  --web-url=<url>  Set the tier web server base url to use for login.
                   Defaults to TIER_WEB_URL env, or https://app.tier.run/

  --key=<token>    Specify the auth token for Tier to use.
                   Tokens can be generated manually by visiting
                   <https://app.tier.run/app/account/tokens>,
                   minted for a project by running 'tier login',
                   or set in the environment variable TIER_KEY.

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
  [tier.run](https://app.tier.run/app/account/tokens). Defaults to
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
  Default: `https://app.tier.run` <!-- TODO: move login and pricing
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
`Tier.paymentForm()`.

Posts to `/api/v1/stripe/options`

<!-- TODO: document tier.js, maybe pull into this library? -->

### `tier.stripeSetup(org: OrgName, setup_intent: string)`

Attempt to attach a payment method from a resolved stripe
`SetupIntent` ID.

Call this on the server-side when Stripe redirects the user back
to the page where you called `Tier.paymentForm()`, passing in the
string provided on the url search params.

The returned promise will resolve with the `{status: "succeeded"}` SetupIntent object if the payment method was
attached.

If the SetupIntent requires additional attention, then the
Promise will fail with an object indicating what needs to be
done.

For example:

```js
import { isTierError, TierClient } from '@tier.run/sdk'
const tier = TierClient.fromEnv()

// account settings page
app.get('/account', async (req, res) => {
  const org = await lookupCurrentLoggedInUserSomehow(req)

  const u = new URL(req.url, 'http://x')
  if (u.searchParams.has('setup_intent')) {
    // returning from Stripe payment method setup.
    try {
      await tier.stripeSetup(`org:${org}`, u.searchParams.get('setup_intent'))
      // payment method is now attached!
    } catch (er) {
      if (isTierError(er)) {
        // something bad happened!
        // handle this like any other server error,
        // log it, show error page, etc.
        return serve5xxStatusPage(res, er)
      } else {
        // the user has to do something
        return redirect(res, er.redirect_to_url.url, 303)
      }
    }
  }

  const stripeOptions = await tier.stripeOptions(`org:${org}`)
  showAccountSetupPage(res)
})
```

### `tier.appendPhase(org: OrgName, plan: PlanName, effective?: Date)`

Add a phase to the specified org's schedule. If not specified,
the `effective` date is the current time.

Posts to `/api/v1/append`

### Reporting and Checking Usage

Usage and limit amounts are based on best available data at the
moment reported. Amounts reported by the Tier API are eventually
consistent, usually within a few ms. <!-- TKTK: figure out what
actual SLA/reliability guarantee we can make here -->

Check that a user has access to a feature (ie, it's included in
their plan, and they are not over their limit) using
`tier.can()`. When a feature is successfully consumed, call
`tier.report()` to tell Tier about it.

#### Simple Example

Our customer is attempting to consume 1 of the `foo` feature. We
should allow if they're not over their limit, and report it once
the feature is delivered.

```js
if (await tier.can('org:acme', 'feature:foo')) {
  consumeOneFoo('acme')
  await tier.report('org:acme', 'feature:foo')
} else {
  // suggest they buy a bigger plan, maybe?
  showUpgradePlanUX('acme')
}
```

#### Example with `count > 1`

In this case, the user might have remaining usage allowed by
their plan, but not enough to do what we're trying.

```js
if (await tier.can('org:acme', 'feature:foo', 10)) {
  consumeTenFoos('acme')
  await tier.report('org:acme', 'feature:foo', 10)
} else {
  showSorryYouNeedToUpgradeMessage('acme')
}
```

#### Out of Band Checking/Reporting, On Completion

Sometimes a "feature" is not a single function call. We might
kick off a series of events or chain of messages, and only
want to charge the user if the entire process succeeds.

```js
if (await tier.can('org:acme', 'feature:foo')) {
  // ok they can start it
  myAPI.addToMessageBrokerSystem('acme', 'foo')
}

// elsewhere in my application somewhere, maybe another
// machine, some time later, who knows

const handleFinalStep = async org => {
  // ok it worked!
  // do something
  await tier.report(`org:${org}`, 'feature:foo')
}
```

Note that this highlights a race condition! If the user can
initiate many such processes, they may go over their limit.
(Maybe that's what you want.)

#### Out of Band Checking/Reporting, Up-front and Rollback

In this example, the feature is again a chain of messages being
passed between systems, but since it can take a while to
complete, we don't want to let the user go over their limit. We
_also_ don't want to charge them if the process fails!

```js
if (await tier.can('org:acme', 'feature:foo')) {
  myAPI.addToMessageBrokerSystem('acme', 'foo')
  // report the usage right away
  await tier.report('org:acme', 'feature:foo')
}

const handleError = async org => {
  // oh no, it failed!
  // just report negative usage to "refund" the usage
  await tier.report(`org:${org}`, 'feature:foo', -1)
}

const handleFinalStep = async org => {
  // don't have to tell tier about it, because we already did.
}
```

#### `tier.report(org, feature, count = 1, now = new Date()): Promise<void>`

Reports `count` units of feature usage for the specified org.

Promise resolves when data has been accepted by Tier, rejects if
there is an error report.

#### `tier.can(org, feature, count = 1, now = new Date())`

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

#### `tier.cannot(org, feature, count = 1, now = new Date())`

Inverse of `can()`.

Returns true if the org is _not_ allowed to consume the feature
in the amount specified (default: 1) as of the `now` date
specified.

No side effects, does not increment usage.

### `tier.lookupOrg(org: OrgName): Promise<OrgDetails>`

Look up various information about the org's associated
[customer](https://stripe.com/docs/api/customers/object) as it
exists in Stripe.

Included fields:

- `default_payment_method` The payment method which will be used
  to invoice the customer.
- `delinquent` Boolean
- `phone`, `email` Customer contact information
- `discount` A discount applied to the customer, in cents.
- `live_mode` Boolean. Whether the customer was created in test
  mode or live mode.
- `url` A deep link into the Stripe dashboard for this customer.

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
