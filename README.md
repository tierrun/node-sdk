# tier-sdk

SDK for using https://app.tier.run in Node.js applications

## INSTALLING

First, install [the Tier binary](https://github.com/tierrun/tier).

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
call.  If you start the sidecar in some other way, set
`TIER_SIDECAR_RUNNING=1` in the environment.

### `subscribe(org, plan, [effective])`

Subscribe the named org to the specified plan. If no effective
date is provided, then the plan is effective immediately.

Plan may be either a versioned plan name, or an array of
versioned plan names.

If no effective date is provided, then the plan is effective
immediately.

### `subscribe(org, phases)`

Subscribe the named org to each of the sets of plans specified in
the `phases` array.

Each item in `phases` must be an object containing:

- `features` Array of plan names
- `effective` Optional effective date

If no effective date is provided, then the phase takes effect
immediately.

### `limits(org)`

Retrieve the usage data and limits for the named org.

### `report(org, feature, [n = 1], [at = new Date()], [clobber = false])`

Report usage of the feature by the org.

The optional `n` parameter indicates the number of units of the
feature that were consumed.

The optional `at` parameter is a Date object indicating when the
usage took place.

The optional `clobber` parameter indicates that the usage should
override any previously reported usage of the feature for the
current subscription phase.

### `whois(org)`

Retrieve the Stripe Customer ID for the org.
