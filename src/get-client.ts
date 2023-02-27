/**
 * Internal module for starting a Tier API sidecar on demand.
 *
 * This should not be used directly.
 *
 * @internal
 * @module
 */

// TODO: use the built-in tier binary for the appropriate platform
// can do the platform-specific optional dep trick.

// get a client on-demand for servicing the top-level methods.
//
// This spawns a sidecar on localhost as needed, if baseURL is not set.

import type { ChildProcess } from 'child_process'
import { Tier, TierGetClientOptions, TierOptions } from './client.js'

// just use node-fetch as a polyfill for old node environments
let fetchPromise: Promise<void> | null = null
let FETCH = global.fetch
if (typeof FETCH !== 'function') {
  fetchPromise = import('node-fetch').then(f => {
    //@ts-ignore
    FETCH = f.default
    fetchPromise = null
  })
}

// fill-in for browser bundlers
/* c8 ignore start */
const PROCESS =
  typeof process === 'undefined'
    ? {
        pid: 1,
        env: {
          TIER_DEBUG: '',
          NODE_DEBUG: '',
          TIER_API_KEY: '',
          TIER_BASE_URL: '',
          TIER_LIVE: '',
          STRIPE_DEBUG: '',
        },
        on: () => {},
        removeListener: () => {},
        kill: () => {},
      }
    : process
/* c8 ignore start */

const port = 10000 + (PROCESS.pid % 10000)
let sidecarPID: number | undefined
let initting: undefined | Promise<void>

const debug =
  PROCESS.env.TIER_DEBUG === '1' ||
  /\btier\b/i.test(PROCESS.env.NODE_DEBUG || '')
const debugLog = debug
  ? (...m: any[]) => console.error('tier:', ...m)
  : () => {}

export const getClient = async (
  clientOptions: TierGetClientOptions = {}
): Promise<Tier> => {
  await init()
  const { TIER_BASE_URL } = PROCESS.env
  if (!TIER_BASE_URL && !clientOptions.baseURL) {
    throw new Error('failed sidecar initialization')
  }
  return new Tier(
    Object.assign(
      {
        baseURL: TIER_BASE_URL,
        apiKey: PROCESS.env.TIER_API_KEY,
        debug,
        fetchImpl: FETCH,
      },
      clientOptions
    ) as TierOptions
  )
}

// evade clever bundlers that try to import child_process for the client
// insist that this is always a dynamic import, even though we don't
// actually ever set this to any different value.
let child_process: string = 'child_process'

/**
 * Initialize the Tier sidecar.
 *
 * Exported for testing, do not call directly.
 *
 * @internal
 */
export const init = async () => {
  /* c8 ignore start */
  if (!FETCH) {
    await fetchPromise
    if (!FETCH) {
      throw new Error('could not find a fetch implementation')
    }
  }
  /* c8 ignore stop */

  if (sidecarPID || PROCESS.env.TIER_BASE_URL) {
    return
  }
  if (initting) {
    return initting
  }
  initting = import(child_process)
    .then(({ spawn }) => {
      const args = PROCESS.env.TIER_LIVE === '1' ? ['--live'] : []
      const env = Object.fromEntries(Object.entries(PROCESS.env))
      if (debug) {
        args.push('-v')
        env.STRIPE_DEBUG = '1'
      }
      args.push('serve', '--addr', `127.0.0.1:${port}`)
      debugLog(args)
      return new Promise<ChildProcess>((res, rej) => {
        let proc = spawn('tier', args, {
          env,
          stdio: ['ignore', 'pipe', 'inherit'],
        })
        proc.on('error', rej)
        /* c8 ignore start */
        if (!proc || !proc.stdout) {
          return rej(new Error('failed to start tier sidecar'))
        }
        /* c8 ignore stop */
        proc.stdout.on('data', () => res(proc))
      })
    })
    .then(proc => {
      debugLog('started sidecar', proc.pid)
      proc.on('exit', () => {
        debugLog('sidecar closed', sidecarPID)
        sidecarPID = undefined
        delete PROCESS.env.TIER_BASE_URL
        PROCESS.removeListener('exit', exitHandler)
      })
      PROCESS.on('exit', exitHandler)
      proc.unref()
      PROCESS.env.TIER_BASE_URL = `http://127.0.0.1:${port}`
      sidecarPID = proc.pid
      initting = undefined
    })
    .catch(er => {
      debugLog('sidecar error', er)
      initting = undefined
      sidecarPID = undefined
      throw er
    })
  return initting
}

/**
 * Method to shut down the auto-started sidecar process on
 * exit.  Exported for testing, do not call directly.
 *
 * @internal
 */
/* c8 ignore start */
export const exitHandler = (_: number, signal: string | null) => {
  if (sidecarPID) {
    PROCESS.kill(sidecarPID, signal || 'SIGTERM')
  }
}
/* c8 ignore stop */
