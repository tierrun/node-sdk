/**
 * Used for backoff in {@link client.TierWithClock.advance}
 */
export class Backoff {
  signal?: AbortSignal
  maxDelay: number
  maxTotalDelay: number
  totalDelay: number = 0
  count: number = 0
  timer?: ReturnType<typeof setTimeout>
  resolve?: () => void
  timedOut: boolean = false
  constructor(
    maxDelay: number,
    maxTotalDelay: number,
    { signal }: { signal?: AbortSignal }
  ) {
    this.maxTotalDelay = maxTotalDelay
    this.maxDelay = maxDelay
    this.signal = signal
    signal?.addEventListener('abort', () => this.abort())
  }
  abort() {
    const { timer, resolve } = this
    this.resolve = undefined
    this.timer = undefined
    if (timer) clearTimeout(timer)
    if (resolve) resolve()
    this.count = 0
  }
  async backoff() {
    // this max total delay is just a convenient safety measure,
    // running tests for 30 seconds is entirely unreasonable.
    /* c8 ignore start */
    const rem = this.maxTotalDelay - this.totalDelay
    if (rem <= 0 && !this.timedOut) {
      this.timedOut = true
      throw new Error('exceeded maximum backoff timeout')
    }
    // this part does get tested, but it's a race as to whether it
    // ends up getting to this point, or aborting the fetch and
    // throwing before ever calling backoff()
    if (this.timedOut || this.signal?.aborted) {
      return
    }
    /* c8 ignore stop */
    this.count++
    const delay = Math.max(
      0,
      Math.min(
        this.maxDelay,
        rem,
        Math.ceil(Math.pow(this.count, 2) * 10 * (Math.random() + 0.5))
      )
    )
    this.totalDelay += delay
    await new Promise<void>(res => {
      this.resolve = res
      this.timer = setTimeout(res, delay)
    })
  }
}
