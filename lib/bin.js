#!/usr/bin/env node
const Tier = require('./index.js')
const tier = new Tier()
const {readFileSync} = require('fs')

const output = o => console.log(JSON.stringify(o, 0, 2))

const usage = (msg, er) => {
  if (er) {
    console.error(msg)
    if (typeof er === 'object') {
      console.error('')
      console.error(er.stack)
    } else if (er !== true) {
      console.error('ERROR:', er)
    }
    process.exit(1)
  } else {
    console.log(msg)
    process.exit(0)
  }
}

const topUsage = er => usage(
`USAGE
  tier [flags] <subcommand> [command flags]

For help on subcommands, add --help after: "tier em --help".
This CLI is still under active development. Commands and flags will
change in the future.

SUBCOMMANDS
  push       Push a pricing model to Tier
  pull       Pull a pricing model from Tier
  reserve    reserve feature tokens for an org
  schedule   schedule a plan for an org, effective immediatly
  schedules  report the billing schedules for an org
`, er)

const main = async () => {
  const { argv } = process
  const cmd = argv[2]
  const lastArg = argv[argv.length - 1]
  const help = lastArg === '-h' || lastArg === '--help'
  switch (cmd) {
    case 'push':
      return help ? pushUsage()
        : !argv[3] ? pushUsage(true)
        : await push(argv[3]).catch(pushUsage)
    case 'pull':
      return help ? pullUsage() : await pull().catch(pullUsage)
    case 'schedule':
      return help ? scheduleUsage()
        : !argv[3] || !argv[4] ? scheduleUsage(true)
        : await setSchedule(argv[3], argv[4]).catch(scheduleUsage)
    case 'schedules':
      return help ? schedulesUsage()
        : !argv[3] ? schedulesUsage(true)
        : await getSchedule(argv[3]).catch(schedulesUsage)
    case 'reserve':
      return help ? reserveUsage()
        : await reserve(argv.slice(3)).catch(reserveUsage)
    case '-h': case '--help':
      topUsage()
      return
    default:
      topUsage(true)
  }
}

const pull = async () => {
  output(await tier.model(), 0, 2)
}

const pullUsage = er => usage(`
USAGE
  pull

The 'tier pull' command pulls your pricing.json from Tier and reports errors if
any.
`, er)

const push = async (file) => {
  output(await tier.model(readFileSync(file)), 0, 2)
}

const pushUsage = er => usage(`
USAGE
  push pricing.json

The 'tier push' command sends your pricing.json to Tier and reports errors if
any.
`, er)

const setSchedule = async (plan, org) => {
  output(await tier.schedule(org, { plan }))
}

const scheduleUsage = er => usage(`
USAGE
  schedule <plan> <org>

The 'tier schedule' schedules a plan to immediately take effect for org.
`, er)

const getSchedule = async (org) => {
  output(await tier.schedule(org))
}

const schedulesUsage = er => usage(`
USAGE
  schedules <org>

The 'tier schedules' command reports the schedule for an org.
`, er)

const reserve = async (argv) => {
  let org
  let feature
  let n = 0
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    switch (arg) {
      case '-n': case '--n':
        n = parseInt(argv[++i], 10)
        continue
      default:
        if (!org) {
          org = arg
        } else {
          feature = arg
          break
        }
    }
  }
  if (!feature) {
    return reserveUsage(true)
  }
  output(await tier.reserve(org, feature, n))
}

const reserveUsage = er => usage(`
USAGE
  reserve [flags] <org> <feature>

The 'tier reserve' reserves tokens for the specified feature and org. It
reports an estimate if the request was successful.

Examples:

  // Get the current estimate without reserving any tokens:
  tier reserve org:acme feature:todo:add

  // Get the current estimate after reserving one token:
  tier reserve -n 1 org:acme feature:todo:add

FLAGS
  --n int
    	maximum amount of tokens to reserve (default 0)
`, er)

module.exports = main(process.argv)
