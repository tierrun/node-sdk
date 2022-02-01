const fetch = require('minipass-fetch')
const {name:fn, version: fv} = require('minipass-fetch/package.json')
const URL = require('url').URL
const util = require('util')
const {name, version} = require('../package.json')
const userAgent = `${name}/${version} ${fn}/${fv} node/${process.version}`
const qs = require('querystring')

const asDate = d => { try { return new Date(d).toISOString() } catch (e) {} }

class Tier {
  constructor ({
    tierUrl = process.env.TIER_URL || 'https://tier.run',
    tierApiToken = process.env.TIER_API_TOKEN,
    debug = process.env.TIER_DEBUG === '1' ||
      /\btier\b/.test(process.env.NODE_DEBUG)
  }) {
    this.tierUrl = tierUrl
    if (!tierApiToken) {
      throw new Error('must provide tierApiToken config, or ' +
        'TIER_API_TOKEN environment variable')
    }
    this.tierApiToken = tierApiToken
    this.debug = debug
    if (debug) {
      this.log = (...args) => {
        const m = util.format(...args)
        const prefix = `TIER ${process.pid} `
        console.error(prefix +
          m.trimRight().split('\n').join(prefix))
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

    if (options.query) {
      url += (/\?/.test(url) ? '&' : '?') + qs.stringify(options.query)
    }

    const body = !options.body ? null
      : typeof body === 'object' ? JSON.stringify(options.body)
      : body
    if (body) {
      headers['content-length'] = body.length
    }

    const u = new URL(`/api/v1/${url}`, this.tierUrl).href
    this.log(options.method, url, options.headers)
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
      this.log(options.method, options.url, ret)
      return ret
    } catch (e) {
      const er = new Error(text)
      er.jsonParseError = e.message
      er.statusCode = res.statusCode
      throw er
    }
  }

  async schedule (org, schedule) {
    return setSchedule ? this.setSchedule(org, schedule)
      : this.getSchedule(org)
  }

  async getSchedule (org) {
    return await this.fetch('schedule', { query: { org } })
  }

  async setSchedule (org, schedule) {
    const now = new Date().toISOString()
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
  async checkEntitlement(org, feature, n = 0, now = null) {
    try {
      await this.reserve(org, feature, 0, now)
      // XXX return false if none are left, but the feature exists
      return true
    } catch (e) {
      return false
    }
  }

  async reserve (org, feature, n, now = null) {
    return await this.fetch('reserve', {
      method: 'POST',
      body: {
        org,
        feature,
        n,
        now: now || new Date().toISOString(),
      },
    })
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
