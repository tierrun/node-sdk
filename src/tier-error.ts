/**
 * @module tiererror
 */
import { isObj } from './is.js'
/**
 * Test whether a value is a valid {@link TierError}
 */
export const isTierError = (e: any): e is TierError =>
  isObj(e) && e instanceof TierError
/**
 * Error subclass raised for any error returned by the API.
 * Should not be instantiated directly.
 */
export class TierError extends Error {
  /**
   * The API endpoint that was requested
   */
  public path: string
  /**
   * The data that was sent to the API endpoint.  Will be a parsed
   * JavaScript object unless the request JSON was invalid, in which
   * case it will be a string.
   */
  public requestData: any
  /**
   * The HTTP response status code returned
   */
  public status: number
  /**
   * The `code` field in the {@link ErrorResponse}
   */
  public code?: string
  /**
   * The HTTP response body.  Will be a parsed JavaScript object
   * unless the response JSON was invalid, in which case it will
   * be a string.
   */
  public responseData: any

  /**
   * An underlying system error or other cause.
   */
  public cause?: Error

  constructor(
    path: string,
    reqBody: any,
    status: number,
    resBody: any,
    er?: any
  ) {
    if (isErrorResponse(resBody)) {
      super(resBody.message)
      this.code = resBody.code
    } else {
      super('Tier request failed')
    }
    if (er && typeof er === 'object' && er instanceof Error) {
      this.cause = er
    }
    this.path = path
    this.requestData = reqBody
    this.status = status
    this.responseData = resBody
  }
}

/**
 * Response returned by the Tier API on failure
 * @internal
 */
export interface ErrorResponse {
  status: number
  code: string
  message: string
}
/**
 * Test whether a value is a valid {@link ErrorResponse}
 * @internal
 */
export const isErrorResponse = (e: any): e is ErrorResponse =>
  isObj(e) &&
  typeof e.status === 'number' &&
  typeof e.message === 'string' &&
  typeof e.code === 'string'
