/* IMPORTANT
 * This snapshot file is auto-generated, but designed for humans.
 * It should be checked into source control and tracked carefully.
 * Re-generate by setting TAP_SNAPSHOT=1 and running tests.
 * Make sure to inspect the output below.  Do not ignore changes!
 */
'use strict'
exports[`test/is.ts TAP validateFeatureDefinition > must match snapshot 1`] = `
Array [
  "not an object",
  null,
]
`

exports[`test/is.ts TAP validateFeatureDefinition > must match snapshot 10`] = `
Array [
  TypeError: Cannot read properties of undefined (reading 'base'),
  Object {
    "divide": Object {
      "by": 100,
      "rounding": "up",
    },
    "tiers": Array [],
  },
]
`

exports[`test/is.ts TAP validateFeatureDefinition > must match snapshot 11`] = `
Array [
  undefined,
  Object {
    "divide": Object {
      "by": 100,
      "rounding": "up",
    },
    "tiers": Array [
      Object {
        "price": 1,
        "upto": 1,
      },
    ],
  },
]
`

exports[`test/is.ts TAP validateFeatureDefinition > must match snapshot 12`] = `
Array [
  "may not use divide.by with multiple tiers or tier base price",
  Object {
    "divide": Object {
      "by": 100,
      "rounding": "up",
    },
    "tiers": Array [
      Object {
        "price": 1,
        "upto": 1,
      },
      Object {},
    ],
  },
]
`

exports[`test/is.ts TAP validateFeatureDefinition > must match snapshot 13`] = `
Array [
  undefined,
  Object {
    "tiers": Array [],
  },
]
`

exports[`test/is.ts TAP validateFeatureDefinition > must match snapshot 14`] = `
Array [
  undefined,
  Object {
    "aggregate": "sum",
    "base": 1,
    "title": "x",
  },
]
`

exports[`test/is.ts TAP validateFeatureDefinition > must match snapshot 15`] = `
Array [
  "title not a string",
  Object {
    "title": Object {
      "not": "a string",
    },
  },
]
`

exports[`test/is.ts TAP validateFeatureDefinition > must match snapshot 16`] = `
Array [
  "invalid base, must be non-negative number",
  Object {
    "base": 1.2,
  },
]
`

exports[`test/is.ts TAP validateFeatureDefinition > must match snapshot 17`] = `
Array [
  "invalid base, must be non-negative number",
  Object {
    "base": -1,
  },
]
`

exports[`test/is.ts TAP validateFeatureDefinition > must match snapshot 18`] = `
Array [
  undefined,
  Object {
    "base": 0,
  },
]
`

exports[`test/is.ts TAP validateFeatureDefinition > must match snapshot 19`] = `
Array [
  undefined,
  Object {
    "mode": "graduated",
    "tiers": Array [
      Object {},
    ],
    "title": "x",
  },
]
`

exports[`test/is.ts TAP validateFeatureDefinition > must match snapshot 2`] = `
Array [
  "not an object",
  true,
]
`

exports[`test/is.ts TAP validateFeatureDefinition > must match snapshot 20`] = `
Array [
  "tiers and base cannot be set together",
  Object {
    "base": 1,
    "tiers": Array [],
    "title": "x",
  },
]
`

exports[`test/is.ts TAP validateFeatureDefinition > must match snapshot 21`] = `
Array [
  "invalid mode",
  Object {
    "mode": "not a valid mode",
  },
]
`

exports[`test/is.ts TAP validateFeatureDefinition > must match snapshot 22`] = `
Array [
  "non-array tiers field",
  Object {
    "tiers": "tiers not an array",
  },
]
`

exports[`test/is.ts TAP validateFeatureDefinition > must match snapshot 23`] = `
Array [
  "tiers[0]: invalid base, must be non-negative integer",
  Object {
    "tiers": Array [
      Object {
        "base": "tier invalid",
      },
    ],
  },
]
`

exports[`test/is.ts TAP validateFeatureDefinition > must match snapshot 24`] = `
Array [
  "invalid aggregate",
  Object {
    "aggregate": "yolo",
    "base": 123,
  },
]
`

exports[`test/is.ts TAP validateFeatureDefinition > must match snapshot 25`] = `
Array [
  "unexpected field(s): heloo",
  Object {
    "heloo": "world",
  },
]
`

exports[`test/is.ts TAP validateFeatureDefinition > must match snapshot 26`] = `
Array [
  "non-array tiers field",
  Object {
    "tiers": Object {
      "not": "an array",
    },
  },
]
`

exports[`test/is.ts TAP validateFeatureDefinition > must match snapshot 27`] = `
Array [
  "tiers[1]: unexpected field(s): x",
  Object {
    "tiers": Array [
      Object {},
      Object {
        "x": 1,
      },
    ],
  },
]
`

exports[`test/is.ts TAP validateFeatureDefinition > must match snapshot 28`] = `
Array [
  "invalid base, must be non-negative number",
  Object {
    "base": 1.2,
  },
]
`

exports[`test/is.ts TAP validateFeatureDefinition > must match snapshot 3`] = `
Array [
  undefined,
  Object {},
]
`

exports[`test/is.ts TAP validateFeatureDefinition > must match snapshot 4`] = `
Array [
  "divide: not an object",
  Object {
    "base": 100,
    "divide": true,
  },
]
`

exports[`test/is.ts TAP validateFeatureDefinition > must match snapshot 5`] = `
Array [
  undefined,
  Object {
    "base": 100,
    "divide": Object {
      "by": 100,
    },
  },
]
`

exports[`test/is.ts TAP validateFeatureDefinition > must match snapshot 6`] = `
Array [
  "divide: by must be a non-negative integer",
  Object {
    "base": 100,
    "divide": Object {
      "by": 100.123,
    },
  },
]
`

exports[`test/is.ts TAP validateFeatureDefinition > must match snapshot 7`] = `
Array [
  undefined,
  Object {
    "base": 100,
    "divide": Object {
      "by": 100,
      "rounding": "up",
    },
  },
]
`

exports[`test/is.ts TAP validateFeatureDefinition > must match snapshot 8`] = `
Array [
  "divide: rounding must be \\"up\\" if set (\\"down\\" is default)",
  Object {
    "base": 100,
    "divide": Object {
      "by": 100,
      "rounding": "circle",
    },
  },
]
`

exports[`test/is.ts TAP validateFeatureDefinition > must match snapshot 9`] = `
Array [
  "divide: rounding must be \\"up\\" if set (\\"down\\" is default)",
  Object {
    "base": 100,
    "divide": Object {
      "rounding": "circle",
    },
  },
]
`

exports[`test/is.ts TAP validateFeatureTier > must match snapshot 1`] = `
Array [
  undefined,
  Object {},
]
`

exports[`test/is.ts TAP validateFeatureTier > must match snapshot 10`] = `
Array [
  "invalid upto, must be integer greater than 0",
  Object {
    "upto": 0,
  },
]
`

exports[`test/is.ts TAP validateFeatureTier > must match snapshot 11`] = `
Array [
  "not an object",
  null,
]
`

exports[`test/is.ts TAP validateFeatureTier > must match snapshot 12`] = `
Array [
  "not an object",
  true,
]
`

exports[`test/is.ts TAP validateFeatureTier > must match snapshot 13`] = `
Array [
  "invalid base, must be non-negative integer",
  Object {
    "base": "hello",
  },
]
`

exports[`test/is.ts TAP validateFeatureTier > must match snapshot 14`] = `
Array [
  "invalid price, must be non-negative number",
  Object {
    "price": "hello",
  },
]
`

exports[`test/is.ts TAP validateFeatureTier > must match snapshot 15`] = `
Array [
  undefined,
  Object {
    "price": 1.2,
  },
]
`

exports[`test/is.ts TAP validateFeatureTier > must match snapshot 16`] = `
Array [
  "invalid upto, must be integer greater than 0",
  Object {
    "upto": "hello",
  },
]
`

exports[`test/is.ts TAP validateFeatureTier > must match snapshot 17`] = `
Array [
  "invalid upto, must be integer greater than 0",
  Object {
    "upto": 1.2,
  },
]
`

exports[`test/is.ts TAP validateFeatureTier > must match snapshot 18`] = `
Array [
  "invalid base, must be non-negative integer",
  Object {
    "base": -1.2,
  },
]
`

exports[`test/is.ts TAP validateFeatureTier > must match snapshot 19`] = `
Array [
  "unexpected field(s): other",
  Object {
    "other": "thing",
  },
]
`

exports[`test/is.ts TAP validateFeatureTier > must match snapshot 2`] = `
Array [
  undefined,
  Object {
    "base": 123,
  },
]
`

exports[`test/is.ts TAP validateFeatureTier > must match snapshot 3`] = `
Array [
  "invalid base, must be non-negative integer",
  Object {
    "base": 1.3,
  },
]
`

exports[`test/is.ts TAP validateFeatureTier > must match snapshot 4`] = `
Array [
  "invalid base, must be non-negative integer",
  Object {
    "base": -1,
  },
]
`

exports[`test/is.ts TAP validateFeatureTier > must match snapshot 5`] = `
Array [
  undefined,
  Object {
    "base": 0,
  },
]
`

exports[`test/is.ts TAP validateFeatureTier > must match snapshot 6`] = `
Array [
  undefined,
  Object {
    "price": 1,
  },
]
`

exports[`test/is.ts TAP validateFeatureTier > must match snapshot 7`] = `
Array [
  undefined,
  Object {
    "price": 1.2,
  },
]
`

exports[`test/is.ts TAP validateFeatureTier > must match snapshot 8`] = `
Array [
  "invalid price, must be non-negative number",
  Object {
    "price": -1.2,
  },
]
`

exports[`test/is.ts TAP validateFeatureTier > must match snapshot 9`] = `
Array [
  "invalid upto, must be integer greater than 0",
  Object {
    "upto": -2,
  },
]
`

exports[`test/is.ts TAP validateModel > must match snapshot 1`] = `
Array [
  "not an object",
  null,
]
`

exports[`test/is.ts TAP validateModel > must match snapshot 2`] = `
Array [
  "not an object",
  true,
]
`

exports[`test/is.ts TAP validateModel > must match snapshot 3`] = `
Array [
  "missing or invalid plans, must be object",
  Object {},
]
`

exports[`test/is.ts TAP validateModel > must match snapshot 4`] = `
Array [
  undefined,
  Object {
    "plans": Object {},
  },
]
`

exports[`test/is.ts TAP validateModel > must match snapshot 5`] = `
Array [
  undefined,
  Object {
    "plans": Object {
      "plan:p@0": Object {},
    },
  },
]
`

exports[`test/is.ts TAP validateModel > must match snapshot 6`] = `
Array [
  "invalid plan name: not a plan name",
  Object {
    "plans": Object {
      "not a plan name": Object {},
    },
  },
]
`

exports[`test/is.ts TAP validateModel > must match snapshot 7`] = `
Array [
  "plans['plan:notaplan@0']: invalid feature name: not a feature name",
  Object {
    "plans": Object {
      "plan:notaplan@0": Object {
        "features": Object {
          "not a feature name": Object {},
        },
      },
    },
  },
]
`

exports[`test/is.ts TAP validateModel > must match snapshot 8`] = `
Array [
  "unexpected field(s): other",
  Object {
    "other": "stuff",
    "plans": Object {},
  },
]
`

exports[`test/is.ts TAP validateModel > must match snapshot 9`] = `
Array [
  "plans['plan:x@1']: features['feature:name']: tiers[1]: unexpected field(s): x",
  Object {
    "plans": Object {
      "plan:x@1": Object {
        "features": Object {
          "feature:name": Object {
            "tiers": Array [
              Object {
                "upto": 1,
              },
              Object {
                "x": true,
              },
            ],
          },
        },
      },
    },
  },
]
`

exports[`test/is.ts TAP validatePlan > must match snapshot 1`] = `
Array [
  "not an object",
  null,
]
`

exports[`test/is.ts TAP validatePlan > must match snapshot 10`] = `
Array [
  "invalid currency: [object Object]",
  Object {
    "currency": Object {
      "not": "a currency string",
    },
  },
]
`

exports[`test/is.ts TAP validatePlan > must match snapshot 11`] = `
Array [
  undefined,
  Object {
    "currency": "usd",
  },
]
`

exports[`test/is.ts TAP validatePlan > must match snapshot 12`] = `
Array [
  "invalid interval: [object Object]",
  Object {
    "interval": Object {
      "not": "an interval string",
    },
  },
]
`

exports[`test/is.ts TAP validatePlan > must match snapshot 13`] = `
Array [
  "invalid interval: not an interval string",
  Object {
    "interval": "not an interval string",
  },
]
`

exports[`test/is.ts TAP validatePlan > must match snapshot 14`] = `
Array [
  undefined,
  Object {
    "interval": "@monthly",
  },
]
`

exports[`test/is.ts TAP validatePlan > must match snapshot 15`] = `
Array [
  "unexpected field(s): another",
  Object {
    "another": "thing",
  },
]
`

exports[`test/is.ts TAP validatePlan > must match snapshot 2`] = `
Array [
  "not an object",
  true,
]
`

exports[`test/is.ts TAP validatePlan > must match snapshot 3`] = `
Array [
  "invalid title, must be string",
  Object {
    "title": Object {
      "not": "a string",
    },
  },
]
`

exports[`test/is.ts TAP validatePlan > must match snapshot 4`] = `
Array [
  "invalid features field, must be object",
  Object {
    "features": null,
  },
]
`

exports[`test/is.ts TAP validatePlan > must match snapshot 5`] = `
Array [
  "invalid features field, must be object",
  Object {
    "features": "not an object",
  },
]
`

exports[`test/is.ts TAP validatePlan > must match snapshot 6`] = `
Array [
  "invalid feature name: not a feature name",
  Object {
    "features": Object {
      "not a feature name": Object {},
    },
  },
]
`

exports[`test/is.ts TAP validatePlan > must match snapshot 7`] = `
Array [
  undefined,
  Object {},
]
`

exports[`test/is.ts TAP validatePlan > must match snapshot 8`] = `
Array [
  undefined,
  Object {
    "features": Object {
      "feature:name": Object {},
    },
  },
]
`

exports[`test/is.ts TAP validatePlan > must match snapshot 9`] = `
Array [
  "features['feature:name']: tiers[1]: unexpected field(s): x",
  Object {
    "features": Object {
      "feature:name": Object {
        "tiers": Array [
          Object {
            "upto": 1,
          },
          Object {
            "x": true,
          },
        ],
      },
    },
  },
]
`
