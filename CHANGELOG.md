# change log

## 5.0

- Add support for external Tier API server with Tier API Key
- Rename `TIER_SIDECAR` env to `TIER_BASE_URL`
- Refactor `child_process` into a dynamic import so that the main
  export can be safely used where `child_process` is unavailable.

## 4.1

- Remove previous experimental iteration of Checkout
- Implement Checkout using `/v1/checkout` API endpoint
- This requires version 0.7.1 or higher of the tier binary

## 4.0

- Move growing parameter lists into `SubscribeOptions` and
  `ScheduleOptions` object params.
- Add support for `trialDays` option to `tier.subscribe()`
- Add `tier.cancel()` method
- Add experimental support for `checkout` option to
  `tier.subscribe()` and `tier.schedule()`
- Consistently name option argument types as `{Thing}Params`
  instead of `{Thing}Options`
- Add `tier.can()` interface

## 3.0

- Add `tier.push()` method
- Separate raw client mode from managed sidecar mode, to support
  environments lacking Node's `child_process` module.

## 2.4

- Improve error handling

## 2.3

- `tier.pull()` method
- `tier.pullLatest()` method
- use named exports

## 2.2

- `tier.limit()` method

## 2.1

- `tier.phase()` method
- start sidecar listening on PID-specific port

## 2.x

Initial beta release.

## 1.x

All 1.x versions are actually a different (abandoned) package.
Special thanks to [Tian Jian](http://npm.im/~kiliwalk) for
graciously letting us take over the name he was no longer using.
