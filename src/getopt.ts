// mutates the array passed in by plucing off and emitting
// all the parsed `--key val`, `--key=val`, and `-sHoRtFlags`
// as [key, val || '']
export const getOpt = function* (
  argv: string[],
  options: Set<string>, // options take a value
  switches: Set<string> // switches value is always ''
): Generator<[string, string | undefined]> {
  while (argv.length > 0) {
    const m = argv[0].match(/^--([^=]+)(?:=(.*))?$|^-([a-zA-Z]+)$/)
    if (!m) {
      return
    }

    const [_, k, v, flags] = m
    if (k) {
      if (!options.has(k) && !switches.has(k)) {
        return
      }
      if (switches.has(k)) {
        if (v) {
          return
        }
        argv.shift()
        yield [k, v]
        continue
      }
      if (!v && argv.length === 0) {
        return
      }
      argv.shift()
      yield [k, v || argv.shift()]
      continue
    }

    const flagYields:[string,string][] = []
    for (let i = 0; i < flags.length; i++) {
      const c = flags.charAt(i)
      if (!options.has(c) && !switches.has(c)) {
        return
      }
      const val = options.has(c) ? flags.substring(i) : ''
      flagYields.push([c, val])
      if (val) {
        break
      }
    }
    argv.shift()
    for (const y of flagYields) {
      yield y
    }
  }
  return
}
