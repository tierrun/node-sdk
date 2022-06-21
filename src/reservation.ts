import type { FeatureName, OrgName, TierClient } from './index'

export interface ReservationFromTierd {
  limit: number
  used: number
  org?: OrgName
  feature?: FeatureName
  domain?: OrgName
}

export class Reservation {
  readonly #client: TierClient
  readonly feature: FeatureName
  readonly org: OrgName
  readonly count: number
  readonly now: Date

  readonly used: number
  readonly limit: number
  readonly ok: boolean
  readonly overage: number
  readonly allowed: number
  readonly remaining: number
  readonly isRefund: boolean
  #committed: boolean
  #refunded: boolean
  #refunding: boolean

  get committed(): boolean {
    return this.#committed
  }

  get refunded(): boolean {
    return this.#refunded
  }

  // @deprecated Please use reservation.refund()
  get cancel() {
    return this.refund
  }

  async refund(): Promise<Reservation> {
    if (this.#refunded || this.#refunding) {
      throw new Error('cannot refund more than once')
    }
    this.#refunding = true
    try {
      const ref = await this.#client.refund(this)
      this.#refunded = true
      return ref
    } finally {
      this.#refunding = false
    }
  }

  // once it's committed, we can't refund it, so just return
  // the original reservation to show the state as we left it.
  commit(): Reservation {
    this.#committed = true
    this.refund = async () => this
    return this
  }

  constructor(
    client: TierClient,
    org: OrgName,
    feature: FeatureName,
    count: number,
    now: Date,
    res: ReservationFromTierd,
    isRefund: boolean = false
  ) {
    this.#client = client
    this.org = org
    this.feature = feature
    this.count = count
    this.now = now
    this.isRefund = isRefund
    this.#committed = false
    this.#refunded = false
    this.#refunding = false

    const { used, limit } = res
    this.used = used
    this.limit = limit
    this.remaining = Math.max(0, this.limit - this.used)
    this.overage = Math.max(0, this.used - this.limit)
    this.allowed = this.isRefund
      ? this.remaining
      : Math.max(0, this.count - this.overage)
    this.ok = this.overage === 0 && this.limit > 0
  }
}
