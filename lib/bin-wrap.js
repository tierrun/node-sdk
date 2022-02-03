#!/usr/bin/env node
try {
  // TODO: maybe this file should just clobber itself with a symlink
  // to the actual compiled version on install and/or first run?
  // That's kind of weird self-mutating behavior, but would keep us
  // from routinely running in foreground-child mode, which is also
  // weird.  See https://github.com/npm/cli/issues/4362 for why
  // this is even necessary in the first place.
  const os = process.platform === 'win32' ? 'windows' : process.platform
  const arch = process.arch === 'x64' ? 'amd64' : process.arch
  const compiled = require(`@tier.run/cli-${os}-${arch}`)
  const foreground = require('foreground-child')
  module.exports = foreground(compiled, process.argv.slice(2))
} catch (er) {
  if (er.code !== 'MODULE_NOT_FOUND') {
    throw er
  }
  // an unsupported platform/architecture, or the user did not install
  // optional packages.  Use the JS wrapper around the API calls as
  // a fallback.
  module.exports = require('./bin.js')
}
