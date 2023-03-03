// a handful of helpful utilities for testing what things are.

// just keeping the double-negative in one place, since I so often
// type this wrong and get annoyed.
export const isVArray = (arr: any, valTest: (v: any) => boolean) =>
  Array.isArray(arr) && !arr.some(v => !valTest(v))

export const isDate = (d: any): d is Date => isObj(d) && d instanceof Date

export const isObj = (c: any): c is { [k: string]: any } =>
  !!c && typeof c === 'object'

export const optionalType = (c: any, t: string): boolean =>
  c === undefined || typeof c === t

export const optionalString = (c: any): c is string | undefined =>
  optionalType(c, 'string')

export const optionalKV = (
  c: any,
  keyTest: (k: string) => boolean,
  valTest: (v: any) => boolean
): boolean => c === undefined || isKV(c, keyTest, valTest)

export const optionalIs = (c: any, test: (c: any) => boolean) =>
  c === undefined || test(c)

export const optionalIsVArray = (c: any, valTest: (v: any) => boolean) =>
  c === undefined || isVArray(c, valTest)

export const isKV = (
  obj: any,
  keyTest: (k: string) => boolean,
  valTest: (v: any) => boolean
): boolean =>
  isObj(obj) &&
  isVArray(Object.keys(obj), keyTest) &&
  isVArray(Object.values(obj), valTest)

export const unexpectedFields = (
  obj: { [k: string]: any },
  ...keys: string[]
): string[] => {
  const expect = new Set<string>(keys)
  return Object.keys(obj).filter(k => !expect.has(k))
}

export const hasOnly = (obj: any, ...keys: string[]): boolean => {
  if (!isObj(obj)) {
    return false
  }
  const expect = new Set<string>(keys)
  for (const k of Object.keys(obj)) {
    if (!expect.has(k)) {
      return false
    }
  }
  return true
}

export const isPosInt = (n: any): boolean => Number.isInteger(n) && n > 0
export const isNonNegInt = (n: any): boolean => Number.isInteger(n) && n >= 0
export const isNonNegNum = (n: any): boolean =>
  typeof n === 'number' && isFinite(n) && n >= 0
