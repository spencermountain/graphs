import { readFileSync } from 'node:fs'
import { parse as parseYaml } from 'yaml'

const YAML_RE = /\.ya?ml$/

/** Vite plugin — import .yaml/.yml as parsed JS (default + named top-level keys). */
export const yamlImport = () => ({
  name: 'yaml-import',
  enforce: 'pre',

  load(id) {
    const [path, query] = id.split('?')
    if (!YAML_RE.test(path)) return
    if (query?.includes('raw')) return // ?raw still returns the source string

    const data = parseYaml(readFileSync(path, 'utf8'))
    const lines = [`export default ${JSON.stringify(data)}`]

    if (data && typeof data === 'object' && !Array.isArray(data)) {
      for (const key of Object.keys(data)) {
        if (/^[A-Za-z_$][\w$]*$/.test(key)) {
          lines.push(`export const ${key} = ${JSON.stringify(data[key])}`)
        }
      }
    }

    return { code: lines.join('\n'), map: null }
  },
})
