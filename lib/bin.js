#!/usr/bin/env node
const Tier = require('./index.js')
const {readFileSync} = require('fs')

const usage = (msg, er) => {
  if (er) {
    console.error(msg)
    console.error('')
    console.error(er.message)
  } else {
    console.log(msg)
  }
}

const topUsage = usage(
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
`, e)

async main = (argv = process.argv) => {
  const cmd = argv[2]
  const lastArg = argv[argv.length - 1]
  const help = lastArg === '-h' || lastArg === '--help'
  const tier = new Tier()
  switch (cmd) {
    case 'push':
      return help ? pushUsage() : await push(argv[3]).catch(pushUsage)
    case 'pull':
      return help ? pullUsage() : await pull().catch(pullUsage)
    case 'schedule':
      return help ? scheduleUsage()
        : await setSchedule(argv[3], argv[4]).catch(scheduleUsage)
    case 'schedules':
      return help ? schedulesUsage()
        : await getSchedule(argv[3]).catch(schedulesUsage)
    case 'reserve':
      return help ? reserveUsage()
        : await reserve(argv.slice(2)).catch(reserveUsage)
    case '-h': case '--help':
      console.log(topUsage())
      return
    default:
      console.error(topUsage())
      process.exit(1)
  }
}

const pull = async () => {
  console.log(await tier.model())
}

const pullUsage = er => usage(`
USAGE
  pull

The 'tier pull' command pulls your pricing.json from Tier and reports errors if
any.
`, er)

const push = async (file) => {
  console.log(await tier.model(readFileSync(file)))
}

const pushUsage = er => usage(`
USAGE
  push pricing.json

The 'tier push' command sends your pricing.json to Tier and reports errors if
any.
`, er)

const setSchedule = async (plan, org) => {
  console.log(await tier.schedule(org, { plan }))
}

const scheduleUsage = er => usage(`
USAGE
  schedule <plan> <org>

The 'tier schedule' schedules a plan to immediately take effect for org.
`, er)

const getSchedule = async (org) => {
  console.log(await tier.schedule(org))
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
      case '-n':
        n = argv[++i]
        continue
      default:
        if (!org) {
          org = arg
        } else if (!feature) {
          feature = arg
          break
        }
    }
  }
  console.log(await tier.reserve(org, feature, n))
}

const reserveUsage = er => usage(`
USAGE
  reserve [flags] <org> <feature>

// TODO(bmizerany): 
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
`)

module.exports = main
if (module === require.main)
  main(process.argv)
