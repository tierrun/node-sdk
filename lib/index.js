const fetch = require('minipass-fetch')
const {name:fn, version: fv} = require('minipass-fetch/package.json')
const URL = require('url').URL
const util = require('util')
const {name, version} = require('../package.json')
const userAgent = `${name}/${version} ${fn}/${fv} node/${process.version}`
const qs = require('querystring')
const crypto = require('crypto')

const asDate = d => {
  if (d || d === 0) {
    try { return new Date(d).toISOString() } catch (e) {}
  }
}

class Tier {
  constructor ({
    tierUrl = process.env.TIER_URL || 'https://tier.run',
    tierApiToken = process.env.TIER_API_TOKEN,
    debug = process.env.TIER_DEBUG === '1' ||
      /\btier\b/.test(process.env.NODE_DEBUG)
  } = {}) {
    this.tierUrl = tierUrl
    if (!tierApiToken) {
      throw new Error('must provide tierApiToken config, or ' +
        'TIER_API_TOKEN environment variable')
    }
    this.instanceId = crypto.randomBytes(4).toString('hex')
    this.tierApiToken = tierApiToken
    this.debug = debug
    if (debug) {
      this.log = (...args) => {
        const m = util.format(...args)
        const prefix = `TIER ${process.pid} `
        console.error(prefix +
          m.trimRight().split('\n').join(`\n${prefix}`))
      }
    }
    this.log(`api url = ${tierUrl}`)
  }

  log () {}

  async fetch (url, options = {}) {
    const headers = options.headers || {}
    options.method = options.method || 'GET'
    headers['tier-api-token'] = this.tierApiToken
    headers['accept'] = 'application/json; 1, text/plain; 0.2'
    headers['user-agent'] = userAgent
    const requestId = crypto.randomBytes(4).toString('hex')
    headers['request-id'] = requestId

    if (options.query) {
      url += (/\?/.test(url) ? '&' : '?') + qs.stringify(options.query)
    }

    const body = !options.body ? null
      : Buffer.isBuffer(options.body) || typeof options.body === 'string'
        ? String(options.body)
      : typeof options.body === 'object' ? JSON.stringify(options.body)
      : null
    if (body) {
      headers['content-length'] = body.length
    }

    const u = new URL(`/api/v1/${url}`, this.tierUrl).href
    this.log(requestId, options.method, `/api/v1/${url}`, headers, body || options.query || '')
    const res = await fetch(u, {
      ...options,
      body,
      headers,
    })

    // XXX remove this wrapper when all responses are always JSON
    // XXX handle consistent error message/code in a cute way
    const text = await res.text()
    try {
      const ret = JSON.parse(text)
      this.log(requestId, res.status, ret)
      if ((res.status < 200 || res.status >299) && ret.code) {
        throw Object.assign(new Error(ret.message), {
          code: ret.code,
          status: res.status,
          headers: res.headers,
        })
      }
      return ret
    } catch (e) {
      const er = new Error(text)
      er.jsonParseError = e.message
      er.statusCode = res.statusCode
      throw er
    }
  }

  async schedule (org, schedule) {
    return schedule ? this.setSchedule(org, schedule)
      : this.getSchedule(org)
  }

  async getSchedule (org) {
    return await this.fetch('schedule', { query: { org } })
  }

  async setSchedule (org, schedule) {
    const now = new Date().toISOString()
    // XXX this should be lowercased in the API
    const Effective = asDate(schedule.effective) || now
    const scheduled_at = asDate(schedule.scheduled_at) || now
    return await this.fetch('schedule', {
      method: 'POST',
      body: {
        org,
        phase: {
          plan: schedule.plan,
          Effective,
          scheduled_at,
        }
      }
    })
  }

  // make a request with n=0, then handle the result
  // async checkEntitlement(org, feature, N = 0, now = null) {
  //   try {
  //     const used = await this.reserve(org, feature, 0, now)
  //     if (used.Total.Overage > 0) {
  //       return false
  //     }
  //     // ok, we aren't in an overage state NOW, but WOULD we be?
  //     // XXX this is hacky af, need an endpoint to tell us this
  //     const add = await this.reserve(org, feature, N, now)
  //     await this.reserve(org, feature, -N, now)
  //     return add.Total.Overage <= 0
  //   } catch (e) {
  //     if (e.code === 'not_exist') {
  //       return false
  //     }
  //     throw er
  //   }
  // }

  async reserve (org, feature, N, options = {
    now: null,
    allowOverage: true,
  }) {
    const result = await this.fetch('reserve', {
      method: 'POST',
      body: {
        org,
        feature,
        N,
        now: asDate(options.now) || new Date().toISOString(),
      },
    })

    // XXX: take an AllowOverage flag in the body so we don't
    // have to do this hacky thing here.
    if (options.allowOverage === false && result.Total.Overage >= 0) {
      await this.fetch('reserve', {
        method: 'POST',
        body: {
          org,
          feature,
          N: -N,
          now: asDate(options.now) || new Date().toISOString(),
        },
      })
      const er = new Error('plan limit reached')
      er.code = 'overage'
      throw er
    }
    return result
  }

  async model (model) {
    return model ? this.setModel(model) : this.getModel()
  }

  async getModel () {
    return await this.fetch('model')
  }

  async setModel (model) {
    return await this.fetch('model', {
      method: 'POST',
      body: model,
    })
  }
}

module.exports = Tier
