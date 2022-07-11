// TODO: abstract all login stuff into a TierClientCLI class, so that we're
// not importing it where tierweb uses it.
// store tokens in ~/.config/tier/tokens/${hash(cwd)}

import { createHash } from 'crypto'
import { resolve } from 'path'
import type { DeviceAccessTokenSuccessResponse } from './index'

/* c8 ignore next */
const READONLY = process.platform === 'win32' ? 0o666 : 0o600

const hash = (str: string) => createHash('sha512').update(str).digest('hex')
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  unlinkSync,
  lstatSync,
} from 'fs'

export interface AuthStore {
  get: (
    cwd: string,
    apiUrl: string
  ) => DeviceAccessTokenSuccessResponse | undefined
  set: (
    cwd: string,
    apiUrl: string,
    token: DeviceAccessTokenSuccessResponse
  ) => any
  delete: (cwd: string, apiUrl: string) => any
  [key: string]: any
}

export const defaultAuthStore: AuthStore = {
  /* c8 ignore start */
  debug:
    /\btier\b/.test(process.env.NODE_DEBUG || '') ||
    process.env.TIER_DEBUG === '1'
      ? console.error
      : () => {},
  /* c8 ignore stop */

  get: (cwd, apiUrl) => {
    defaultAuthStore.debug('get token', { cwd, apiUrl })
    if (!process.env.HOME) {
      throw new Error('no $HOME directory set')
    }

    const h = hash(hash(cwd) + hash(apiUrl))
    const file = resolve(process.env.HOME, '.config/tier/tokens', h)
    defaultAuthStore.debug('file', file)

    try {
      const st = lstatSync(file)
      // immediately stop trusting it if it smells funny.
      // inapplicable on windows
      /* c8 ignore start */
      if (!st.isFile() || (st.mode & 0o777) !== READONLY || st.nlink !== 1) {
        throw new Error('invalid token store file type')
      }
      /* c8 ignore stop */
      const record = JSON.parse(readFileSync(file, 'utf8'))
      if (!Array.isArray(record) || record.length !== 4) {
        throw new Error('token file invalid')
      }
      const [token, born, url, sig] = record
      if (url !== apiUrl) {
        throw new Error('token file invalid host')
      }
      // not security really, just fs corruption defense
      if (sig !== hash(JSON.stringify([token, born, url]))) {
        throw new Error('token file corrupted')
      }
      if (token.expires_in) {
        // TODO: refresh_token flow?  would need to expose this case somehow,
        // rather than just deleting the record.
        if (Date.now() > born + token.expires_in * 1000) {
          throw new Error('token expired')
        }
      }
      if (!token.access_token) {
        throw new Error('no access_token found in record')
      }
      return token
      /* c8 ignore start */
    } catch (er) {
      /* c8 ignore stop */
      defaultAuthStore.debug(cwd, er)
      defaultAuthStore.delete(cwd, apiUrl)
    }
  },

  set: (cwd, apiUrl, token) => {
    if (!process.env.HOME) {
      throw new Error('no $HOME directory set')
    }
    const h = hash(hash(cwd) + hash(apiUrl))
    const root = resolve(process.env.HOME, '.config/tier/tokens')
    const file = resolve(root, h)
    mkdirSync(root, { recursive: true, mode: 0o700 })
    const born = Date.now()
    const sig = hash(JSON.stringify([token, born, apiUrl]))
    defaultAuthStore.debug('write token file', file)
    const j = JSON.stringify([token, born, apiUrl, sig])
    writeFileSync(file, j, { mode: READONLY })
  },

  delete: (cwd, apiUrl) => {
    if (!process.env.HOME) {
      throw new Error('no $HOME directory set')
    }
    const h = hash(hash(cwd) + hash(apiUrl))
    const root = resolve(process.env.HOME, '.config/tier/tokens')
    const file = resolve(root, h)
    try {
      unlinkSync(file)
      /* c8 ignore start */
    } catch (er) {
      if (
        !er ||
        typeof er !== 'object' ||
        (er as { code?: string })?.code !== 'ENOENT'
      ) {
        throw er
      }
    }
    /* c8 ignore stop */
  },
}
