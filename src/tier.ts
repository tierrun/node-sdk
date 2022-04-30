#!/usr/bin/env node

// vim: ft=typescript

import { TierClient } from './index.js'
import type {
  TierError,
  ErrorResponse,
  DeviceAuthorizationSuccessResponse,
} from './index.js'
import { readFileSync, existsSync } from 'fs'
import { dirname, resolve } from 'path'

const cleanErr = (er: any): any => {
  if (!er || typeof er !== 'object') {
    return er
  }
  if (Array.isArray(er)) {
    return er.map(v => cleanErr(v))
  }
  if (er && typeof er === 'object') {
    for (const [k, v] of Object.entries(er)) {
      if (k === 'authorization') {
        er[k] = '{redacted}'
      } else {
        er[k] = cleanErr(v)
      }
    }
  }
  return er
}

const usage = (msg: string, er?: any) => {
  if (er) {
    console.error(msg)
    if (typeof er === 'object') {
      console.error('')
      const body = er?.response?.body
      const h = er?.response?.headers
      const ct = (h || {})['content-type'] || ''
      if (typeof body === 'string' && ct.startsWith('application/json')) {
        console.error(JSON.parse(body))
      } else {
        console.error(cleanErr(er))
      }
    } else if (er !== true) {
      console.error('ERROR:', er)
    }
    process.exit(1)
  } else {
    console.log(msg)
    process.exit(0)
  }
}

const topUsage = (er?: any) =>
  usage(`tier: usage: tier [options] <command>

Options:

  --api=<url>      Set the tier API server base url.
                   Defaults to TIER_API_URL env, or https://api.tier.run/

  --web=<url>      Set the tier web server base url to use for login.
                   Defaults to TIER_WEB_URL env, or https://tier.run/

  --key=<token>    Specify the auth token for Tier to use.
                   Tokens can be generated manually by visiting
                   <https://tier.run/app/account/tokens>, minted for a project
                   by running 'tier login', or set in the environment variable
                   TIER_KEY.

  --auth-type=<basic|bearer>
                   Tell Tier to use the specified auth type.  Default: basic

  --debug -d       Turn debug logging on
  --no-debug -D    Turn debug logging off

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
`, er)

const projectRootFiles = [
  '.git',
  '.hg',
  'package.json',
  'node_modules',
  'go.mod',
  'go.sum',
  'tsconfig.json',
]
const projectDir = (
  top: string = process.env.HOME || process.cwd(),
  dir: string = process.cwd(),
  start?: string
): string | null => {
  const dn = dirname(dir)

  if (dir === top && !start) {
    return dir
  }

  // if we hit the end, then just use whatever cwd we started with
  if (dn === dir || dir === top) {
    return null
  }

  // evidence of a project root of some kind
  if (projectRootFiles.find(f => existsSync(resolve(dir, f)))) {
    return dir
  }

  return projectDir(top, dn, start || dir) || start || dir
}

import {getOpt} from './getopt'

const consumeOptions = (argv: string[]):void => {
  const options = new Set(['api', 'web', 'key', 'auth-type'])
  const switches = new Set(['debug', 'no-debug', 'd', 'D', 'help', 'H', 'h', '?'])

  for (const [key, val] of getOpt(argv, options, switches)) {
    switch (key) {
      case 'debug':
      case 'd':
        process.env.TIER_DEBUG = '1'
        continue

      case 'no-debug':
      case 'D':
        process.env.TIER_DEBUG = '0'
        continue

      case 'help':
      case 'h':
      case 'H':
      case '?':
        topUsage()
        return

      case 'api':
        process.env.TIER_API_URL = val
        continue

      case 'web':
        process.env.TIER_WEB_URL = val
        continue

      case 'key':
        process.env.TIER_KEY = val
        continue

      case 'auth-type':
        process.env.TIER_AUTH_TYPE = val
        continue

      default:
        topUsage(`unknown option: ${key}`)
        return
    }
  }
}

const main = async (argv: string[]) => {
  argv.shift()
  argv.shift()

  consumeOptions(argv)

  const cmd = argv.shift()

  if (!cmd) {
    return topUsage()
  }

  if (cmd === 'login') {
    return doLogin(argv)
  }

  if (cmd === 'logout') {
    return doLogout(argv)
  }

  if (cmd === 'projectDir') {
    return showProjectDir(argv)
  }

  switch (cmd) {
    case 'push':
      return doPush(argv)
    case 'pull':
      return doPull(argv)
    case 'whoami':
      return whoami(argv)
    default:
      return topUsage(`Unrecognized option or command: ${cmd}`)
  }
}

const getClient = (): TierClient => {
  // if it's not a login request, we need to log in
  try {
    return TierClient.fromEnv()
  } catch (er) {
    try {
      // TODO: walk up until we find indications of a project, but no higher
      // than process.env.HOME
      return TierClient.fromCwd(projectDir() || process.cwd())
    } catch (er) {
      console.error(er)
      process.exit(1)
    }
  }
}

const showProjectDir = (argv: string[]) => {
  consumeOptions(argv)
  console.log(projectDir())
}

const doLogin = async (argv: string[]): Promise<void> => {
  consumeOptions(argv)
  const { default: opener } = await import('opener')
  const cwd = projectDir() || process.cwd()
  const tc = TierClient.fromEnv({ tierKey: TierClient.NO_AUTH })
  const authResponse = await tc.initLogin(cwd)
  const eres = authResponse as ErrorResponse
  if (eres.error) {
    throw new Error(eres.error)
  }
  const res = authResponse as DeviceAuthorizationSuccessResponse

  if (res.verification_uri_complete) {
    console.error(`
Attempting to open your browser to complete the authorization.

If that fails, please navigate to: ${res.verification_uri}
and enter the code: ${res.user_code}

Waiting...`)
    const proc = opener(res.verification_uri_complete, { stdio: 'ignore' })
    proc.unref()
  } else {
    console.error(`
To complete the verification, copy this code: ${res.user_code}
and enter it at: ${res.verification_uri}

Waiting...`)
  }
  await tc.awaitLogin(cwd, res)
  console.log(`Logged into tier!\nproject: ${cwd}`)
}

const doLogout = (argv: string[]): void => {
  consumeOptions(argv)
  const cwd = projectDir() || process.cwd()
  TierClient.fromEnv({ tierKey: TierClient.NO_AUTH }).logout(cwd)
}

const pushUsage = (er?: any) => usage(`usage: tier push <pricing.json>`, er)

const whoami = async (argv: string[]): Promise<void> => {
  consumeOptions(argv)
  console.log(JSON.stringify(await getClient().ping(), null, 2))
}

const pullUsage = (er?: any) => usage(`usage: tier pull`, er)
const doPull = async (argv: string[]): Promise<void> => {
  consumeOptions(argv)
  try {
    const data = await getClient().pullModel()
    console.log(JSON.stringify(data, null, 2))
  } catch (er) {
    pullUsage(er)
  }
}

const doPush = async (
  argv: string[]
): Promise<void> => {
  consumeOptions(argv)
  const fname = argv.shift()
  if (!fname) {
    return pushUsage(new Error('must supply filename'))
  }
  consumeOptions(argv)
  try {
    const data = JSON.parse(readFileSync(fname, 'utf8'))
    console.log(await getClient().pushModel(data))
  } catch (er) {
    pushUsage(er)
  }
}

main(process.argv)
