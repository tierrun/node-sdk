import type { TierClient, OrgName, FeatureName } from './index'

export interface ReservationFromTierd {
  limit: number
  used: number
}

export class Reservation {
  readonly #client: TierClient
  readonly feature: FeatureName
  readonly org: OrgName
  readonly n: number
  readonly now: Date

  readonly used: number
  readonly limit: number
  readonly ok: boolean
  readonly overage: number
  readonly allowed: number
  readonly remaining: number

  async cancel(): Promise<Reservation> {
    return this.#client.reserve(this.org, this.feature, -1 * this.n, this.now)
  }

  constructor(
    client: TierClient,
    org: OrgName,
    feature: FeatureName,
    n: number,
    now: Date,
    res: ReservationFromTierd
  ) {
    this.#client = client
    this.org = org
    this.feature = feature
    this.n = n
    this.now = now

    const { used, limit } = res
    this.used = used
    this.limit = limit
    this.remaining = Math.max(0, this.limit - this.used)
    this.overage = Math.max(0, this.used - this.limit)
    this.allowed =
      this.n > 0 ? Math.max(0, this.n - this.overage) : this.remaining
    this.ok = this.overage === 0 && this.limit > 0
  }
}
