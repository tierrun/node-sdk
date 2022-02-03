/* IMPORTANT
 * This snapshot file is auto-generated, but designed for humans.
 * It should be checked into source control and tracked carefully.
 * Re-generate by setting TAP_SNAPSHOT=1 and running tests.
 * Make sure to inspect the output below.  Do not ignore changes!
 */
'use strict'
exports[`test/bin.js TAP pull pull --help > errs 1`] = `
Array []
`

exports[`test/bin.js TAP pull pull --help > exits 1`] = `
Array [
  0,
]
`

exports[`test/bin.js TAP pull pull --help > logs 1`] = `
Array [
  Array [
    String(
      
      USAGE
        pull
      
      The 'tier pull' command pulls your pricing.json from Tier and reports errors if
      any.
      
    ),
  ],
]
`

exports[`test/bin.js TAP pull pull -h > errs 1`] = `
Array []
`

exports[`test/bin.js TAP pull pull -h > exits 1`] = `
Array [
  0,
]
`

exports[`test/bin.js TAP pull pull -h > logs 1`] = `
Array [
  Array [
    String(
      
      USAGE
        pull
      
      The 'tier pull' command pulls your pricing.json from Tier and reports errors if
      any.
      
    ),
  ],
]
`

exports[`test/bin.js TAP pull pull > errs 1`] = `
Array []
`

exports[`test/bin.js TAP pull pull > exits 1`] = `
Array []
`

exports[`test/bin.js TAP pull pull > logs 1`] = `
Array [
  Array [
    String(
      [
        "MODEL"
      ]
    ),
  ],
]
`

exports[`test/bin.js TAP pull pull x --help > errs 1`] = `
Array []
`

exports[`test/bin.js TAP pull pull x --help > exits 1`] = `
Array [
  0,
]
`

exports[`test/bin.js TAP pull pull x --help > logs 1`] = `
Array [
  Array [
    String(
      
      USAGE
        pull
      
      The 'tier pull' command pulls your pricing.json from Tier and reports errors if
      any.
      
    ),
  ],
]
`

exports[`test/bin.js TAP push push \${CWD}/test/test-pricing.json > errs 1`] = `
Array []
`

exports[`test/bin.js TAP push push \${CWD}/test/test-pricing.json > exits 1`] = `
Array []
`

exports[`test/bin.js TAP push push \${CWD}/test/test-pricing.json > logs 1`] = `
Array [
  Array [
    String(
      [
        "MODEL",
        {
          "type": "Buffer",
          "data": [
            123,
            112,
            108,
            97,
            110,
            115,
            58,
            123,
            125,
            125
          ]
        }
      ]
    ),
  ],
]
`

exports[`test/bin.js TAP push push --help > errs 1`] = `
Array []
`

exports[`test/bin.js TAP push push --help > exits 1`] = `
Array [
  0,
]
`

exports[`test/bin.js TAP push push --help > logs 1`] = `
Array [
  Array [
    String(
      
      USAGE
        push pricing.json
      
      The 'tier push' command sends your pricing.json to Tier and reports errors if
      any.
      
    ),
  ],
]
`

exports[`test/bin.js TAP push push -h > errs 1`] = `
Array []
`

exports[`test/bin.js TAP push push -h > exits 1`] = `
Array [
  0,
]
`

exports[`test/bin.js TAP push push -h > logs 1`] = `
Array [
  Array [
    String(
      
      USAGE
        push pricing.json
      
      The 'tier push' command sends your pricing.json to Tier and reports errors if
      any.
      
    ),
  ],
]
`

exports[`test/bin.js TAP push push > errs 1`] = `
Array [
  Array [
    String(
      
      USAGE
        push pricing.json
      
      The 'tier push' command sends your pricing.json to Tier and reports errors if
      any.
      
    ),
  ],
]
`

exports[`test/bin.js TAP push push > exits 1`] = `
Array [
  1,
]
`

exports[`test/bin.js TAP push push > logs 1`] = `
Array []
`

exports[`test/bin.js TAP push push x --help > errs 1`] = `
Array []
`

exports[`test/bin.js TAP push push x --help > exits 1`] = `
Array [
  0,
]
`

exports[`test/bin.js TAP push push x --help > logs 1`] = `
Array [
  Array [
    String(
      
      USAGE
        push pricing.json
      
      The 'tier push' command sends your pricing.json to Tier and reports errors if
      any.
      
    ),
  ],
]
`

exports[`test/bin.js TAP reserve reserve --n 100 > errs 1`] = `
Array [
  Array [
    String(
      
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
          /tmaximum amount of tokens to reserve (default 0)
      
    ),
  ],
]
`

exports[`test/bin.js TAP reserve reserve --n 100 > exits 1`] = `
Array [
  1,
]
`

exports[`test/bin.js TAP reserve reserve --n 100 > logs 1`] = `
Array []
`

exports[`test/bin.js TAP reserve reserve --n 100 org:o > errs 1`] = `
Array [
  Array [
    String(
      
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
          /tmaximum amount of tokens to reserve (default 0)
      
    ),
  ],
]
`

exports[`test/bin.js TAP reserve reserve --n 100 org:o > exits 1`] = `
Array [
  1,
]
`

exports[`test/bin.js TAP reserve reserve --n 100 org:o > logs 1`] = `
Array []
`

exports[`test/bin.js TAP reserve reserve --n 100 org:o feature:f --help > errs 1`] = `
Array []
`

exports[`test/bin.js TAP reserve reserve --n 100 org:o feature:f --help > exits 1`] = `
Array [
  0,
]
`

exports[`test/bin.js TAP reserve reserve --n 100 org:o feature:f --help > logs 1`] = `
Array [
  Array [
    String(
      
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
          /tmaximum amount of tokens to reserve (default 0)
      
    ),
  ],
]
`

exports[`test/bin.js TAP reserve reserve --n 100 org:o feature:f > errs 1`] = `
Array []
`

exports[`test/bin.js TAP reserve reserve --n 100 org:o feature:f > exits 1`] = `
Array []
`

exports[`test/bin.js TAP reserve reserve --n 100 org:o feature:f > logs 1`] = `
Array [
  Array [
    String(
      [
        "RESERVE",
        "org:o",
        "feature:f",
        100
      ]
    ),
  ],
]
`

exports[`test/bin.js TAP reserve reserve --n org:o feature:f > errs 1`] = `
Array [
  Array [
    String(
      
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
          /tmaximum amount of tokens to reserve (default 0)
      
    ),
  ],
]
`

exports[`test/bin.js TAP reserve reserve --n org:o feature:f > exits 1`] = `
Array [
  1,
]
`

exports[`test/bin.js TAP reserve reserve --n org:o feature:f > logs 1`] = `
Array []
`

exports[`test/bin.js TAP reserve reserve -h > errs 1`] = `
Array []
`

exports[`test/bin.js TAP reserve reserve -h > exits 1`] = `
Array [
  0,
]
`

exports[`test/bin.js TAP reserve reserve -h > logs 1`] = `
Array [
  Array [
    String(
      
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
          /tmaximum amount of tokens to reserve (default 0)
      
    ),
  ],
]
`

exports[`test/bin.js TAP reserve reserve -n 1 > errs 1`] = `
Array [
  Array [
    String(
      
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
          /tmaximum amount of tokens to reserve (default 0)
      
    ),
  ],
]
`

exports[`test/bin.js TAP reserve reserve -n 1 > exits 1`] = `
Array [
  1,
]
`

exports[`test/bin.js TAP reserve reserve -n 1 > logs 1`] = `
Array []
`

exports[`test/bin.js TAP reserve reserve -n 100 > errs 1`] = `
Array [
  Array [
    String(
      
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
          /tmaximum amount of tokens to reserve (default 0)
      
    ),
  ],
]
`

exports[`test/bin.js TAP reserve reserve -n 100 > exits 1`] = `
Array [
  1,
]
`

exports[`test/bin.js TAP reserve reserve -n 100 > logs 1`] = `
Array []
`

exports[`test/bin.js TAP reserve reserve > errs 1`] = `
Array [
  Array [
    String(
      
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
          /tmaximum amount of tokens to reserve (default 0)
      
    ),
  ],
]
`

exports[`test/bin.js TAP reserve reserve > exits 1`] = `
Array [
  1,
]
`

exports[`test/bin.js TAP reserve reserve > logs 1`] = `
Array []
`

exports[`test/bin.js TAP reserve reserve org:o feature:f > errs 1`] = `
Array []
`

exports[`test/bin.js TAP reserve reserve org:o feature:f > exits 1`] = `
Array []
`

exports[`test/bin.js TAP reserve reserve org:o feature:f > logs 1`] = `
Array [
  Array [
    String(
      [
        "RESERVE",
        "org:o",
        "feature:f",
        0
      ]
    ),
  ],
]
`

exports[`test/bin.js TAP schedule schedule --help > errs 1`] = `
Array []
`

exports[`test/bin.js TAP schedule schedule --help > exits 1`] = `
Array [
  0,
]
`

exports[`test/bin.js TAP schedule schedule --help > logs 1`] = `
Array [
  Array [
    String(
      
      USAGE
        schedule <plan> <org>
      
      The 'tier schedule' schedules a plan to immediately take effect for org.
      
    ),
  ],
]
`

exports[`test/bin.js TAP schedule schedule -h > errs 1`] = `
Array []
`

exports[`test/bin.js TAP schedule schedule -h > exits 1`] = `
Array [
  0,
]
`

exports[`test/bin.js TAP schedule schedule -h > logs 1`] = `
Array [
  Array [
    String(
      
      USAGE
        schedule <plan> <org>
      
      The 'tier schedule' schedules a plan to immediately take effect for org.
      
    ),
  ],
]
`

exports[`test/bin.js TAP schedule schedule > errs 1`] = `
Array [
  Array [
    String(
      
      USAGE
        schedule <plan> <org>
      
      The 'tier schedule' schedules a plan to immediately take effect for org.
      
    ),
  ],
]
`

exports[`test/bin.js TAP schedule schedule > exits 1`] = `
Array [
  1,
]
`

exports[`test/bin.js TAP schedule schedule > logs 1`] = `
Array []
`

exports[`test/bin.js TAP schedule schedule org:o > errs 1`] = `
Array [
  Array [
    String(
      
      USAGE
        schedule <plan> <org>
      
      The 'tier schedule' schedules a plan to immediately take effect for org.
      
    ),
  ],
]
`

exports[`test/bin.js TAP schedule schedule org:o > exits 1`] = `
Array [
  1,
]
`

exports[`test/bin.js TAP schedule schedule org:o > logs 1`] = `
Array []
`

exports[`test/bin.js TAP schedule schedule org:o plan:p --help > errs 1`] = `
Array []
`

exports[`test/bin.js TAP schedule schedule org:o plan:p --help > exits 1`] = `
Array [
  0,
]
`

exports[`test/bin.js TAP schedule schedule org:o plan:p --help > logs 1`] = `
Array [
  Array [
    String(
      
      USAGE
        schedule <plan> <org>
      
      The 'tier schedule' schedules a plan to immediately take effect for org.
      
    ),
  ],
]
`

exports[`test/bin.js TAP schedule schedule org:o plan:p -h > errs 1`] = `
Array []
`

exports[`test/bin.js TAP schedule schedule org:o plan:p -h > exits 1`] = `
Array [
  0,
]
`

exports[`test/bin.js TAP schedule schedule org:o plan:p -h > logs 1`] = `
Array [
  Array [
    String(
      
      USAGE
        schedule <plan> <org>
      
      The 'tier schedule' schedules a plan to immediately take effect for org.
      
    ),
  ],
]
`

exports[`test/bin.js TAP schedule schedule org:o plan:p > errs 1`] = `
Array []
`

exports[`test/bin.js TAP schedule schedule org:o plan:p > exits 1`] = `
Array []
`

exports[`test/bin.js TAP schedule schedule org:o plan:p > logs 1`] = `
Array [
  Array [
    String(
      [
        "SCHEDULE",
        "plan:p",
        {
          "plan": "org:o"
        }
      ]
    ),
  ],
]
`

exports[`test/bin.js TAP schedule schedule x --help > errs 1`] = `
Array []
`

exports[`test/bin.js TAP schedule schedule x --help > exits 1`] = `
Array [
  0,
]
`

exports[`test/bin.js TAP schedule schedule x --help > logs 1`] = `
Array [
  Array [
    String(
      
      USAGE
        schedule <plan> <org>
      
      The 'tier schedule' schedules a plan to immediately take effect for org.
      
    ),
  ],
]
`

exports[`test/bin.js TAP schedules schedules --help > errs 1`] = `
Array []
`

exports[`test/bin.js TAP schedules schedules --help > exits 1`] = `
Array [
  0,
]
`

exports[`test/bin.js TAP schedules schedules --help > logs 1`] = `
Array [
  Array [
    String(
      
      USAGE
        schedules <org>
      
      The 'tier schedules' command reports the schedule for an org.
      
    ),
  ],
]
`

exports[`test/bin.js TAP schedules schedules -h > errs 1`] = `
Array []
`

exports[`test/bin.js TAP schedules schedules -h > exits 1`] = `
Array [
  0,
]
`

exports[`test/bin.js TAP schedules schedules -h > logs 1`] = `
Array [
  Array [
    String(
      
      USAGE
        schedules <org>
      
      The 'tier schedules' command reports the schedule for an org.
      
    ),
  ],
]
`

exports[`test/bin.js TAP schedules schedules > errs 1`] = `
Array [
  Array [
    String(
      
      USAGE
        schedules <org>
      
      The 'tier schedules' command reports the schedule for an org.
      
    ),
  ],
]
`

exports[`test/bin.js TAP schedules schedules > exits 1`] = `
Array [
  1,
]
`

exports[`test/bin.js TAP schedules schedules > logs 1`] = `
Array []
`

exports[`test/bin.js TAP schedules schedules org:o --help > errs 1`] = `
Array []
`

exports[`test/bin.js TAP schedules schedules org:o --help > exits 1`] = `
Array [
  0,
]
`

exports[`test/bin.js TAP schedules schedules org:o --help > logs 1`] = `
Array [
  Array [
    String(
      
      USAGE
        schedules <org>
      
      The 'tier schedules' command reports the schedule for an org.
      
    ),
  ],
]
`

exports[`test/bin.js TAP schedules schedules org:o > errs 1`] = `
Array []
`

exports[`test/bin.js TAP schedules schedules org:o > exits 1`] = `
Array []
`

exports[`test/bin.js TAP schedules schedules org:o > logs 1`] = `
Array [
  Array [
    String(
      [
        "SCHEDULE",
        "org:o"
      ]
    ),
  ],
]
`

exports[`test/bin.js TAP schedules schedules org:o plan:p -h > errs 1`] = `
Array []
`

exports[`test/bin.js TAP schedules schedules org:o plan:p -h > exits 1`] = `
Array [
  0,
]
`

exports[`test/bin.js TAP schedules schedules org:o plan:p -h > logs 1`] = `
Array [
  Array [
    String(
      
      USAGE
        schedules <org>
      
      The 'tier schedules' command reports the schedule for an org.
      
    ),
  ],
]
`

exports[`test/bin.js TAP schedules schedules x --help > errs 1`] = `
Array []
`

exports[`test/bin.js TAP schedules schedules x --help > exits 1`] = `
Array [
  0,
]
`

exports[`test/bin.js TAP schedules schedules x --help > logs 1`] = `
Array [
  Array [
    String(
      
      USAGE
        schedules <org>
      
      The 'tier schedules' command reports the schedule for an org.
      
    ),
  ],
]
`

exports[`test/bin.js TAP top help --help > errs 1`] = `
Array []
`

exports[`test/bin.js TAP top help --help > exits 1`] = `
Array [
  0,
]
`

exports[`test/bin.js TAP top help --help > logs 1`] = `
Array [
  Array [
    String(
      USAGE
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
      
    ),
  ],
]
`

exports[`test/bin.js TAP top help -h > errs 1`] = `
Array []
`

exports[`test/bin.js TAP top help -h > exits 1`] = `
Array [
  0,
]
`

exports[`test/bin.js TAP top help -h > logs 1`] = `
Array [
  Array [
    String(
      USAGE
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
      
    ),
  ],
]
`

exports[`test/bin.js TAP top help <noargs> > errs 1`] = `
Array [
  Array [
    String(
      USAGE
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
      
    ),
  ],
]
`

exports[`test/bin.js TAP top help <noargs> > exits 1`] = `
Array [
  1,
]
`

exports[`test/bin.js TAP top help <noargs> > logs 1`] = `
Array []
`

exports[`test/bin.js TAP weird throws reserve org:throw feature:number -n 123456 > errs 1`] = `
Array [
  Array [
    String(
      
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
          /tmaximum amount of tokens to reserve (default 0)
      
    ),
  ],
  Array [
    "ERROR:",
    123456,
  ],
]
`

exports[`test/bin.js TAP weird throws reserve org:throw feature:number -n 123456 > exits 1`] = `
Array [
  1,
]
`

exports[`test/bin.js TAP weird throws reserve org:throw feature:number -n 123456 > logs 1`] = `
Array []
`

exports[`test/bin.js TAP weird throws reserve org:throw feature:obj > errs 1`] = `
Array [
  Array [
    String(
      
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
          /tmaximum amount of tokens to reserve (default 0)
      
    ),
  ],
  Array [
    "",
  ],
  Array [
    "object throw",
  ],
]
`

exports[`test/bin.js TAP weird throws reserve org:throw feature:obj > exits 1`] = `
Array [
  1,
]
`

exports[`test/bin.js TAP weird throws reserve org:throw feature:obj > logs 1`] = `
Array []
`

exports[`test/bin.js TAP weird throws reserve org:throw feature:true > errs 1`] = `
Array [
  Array [
    String(
      
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
          /tmaximum amount of tokens to reserve (default 0)
      
    ),
  ],
]
`

exports[`test/bin.js TAP weird throws reserve org:throw feature:true > exits 1`] = `
Array [
  1,
]
`

exports[`test/bin.js TAP weird throws reserve org:throw feature:true > logs 1`] = `
Array []
`
