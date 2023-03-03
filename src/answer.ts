/**
 * @module answer
 */
import { Tier, TierError } from './client.js'
import { FeatureName, OrgName, ReportParams, Usage } from './tier-types.js'

/**
 * The object returned by the {@link client.Tier.can } method.
 * Should not be instantiated directly.
 */
export class Answer {
  /**
   * Indicates that the org is not over their limit for the feature
   * Note that when an error occurs, `ok` will be set to `true`,
   * so that we fail open by default. In order to prevent access
   * on API failures, you must check *both* `answer.ok` *and*
   * `answer.err`.
   */
  ok: boolean
  /**
   * The feature checked by {@link client.Tier.can }
   */
  feature: FeatureName
  /**
   * The org checked by {@link client.Tier.can }
   */
  org: OrgName
  /**
   * Reference to the {@link client.Tier} client in use.
   * @internal
   */
  client: Tier
  /**
   * Any error encountered during the feature limit check.
   * Note that when an error occurs, `ok` will be set to `true`,
   * so that we fail open by default. In order to prevent access
   * on API failures, you must check *both* `answer.ok` *and*
   * `answer.err`.
   */
  err?: TierError

  constructor(
    client: Tier,
    org: OrgName,
    feature: FeatureName,
    usage?: Usage,
    err?: TierError
  ) {
    this.client = client
    this.org = org
    this.feature = feature
    if (usage && !err) {
      this.ok = usage.used < usage.limit
    } else {
      this.ok = true
      this.err = err
    }
  }

  /**
   * Report usage for the org and feature checked by {@link client.Tier.can}
   */
  public async report(n: number = 1, options?: ReportParams) {
    return this.client.report(this.org, this.feature, n, options)
  }
}
