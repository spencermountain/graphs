import { readdir, stat } from 'node:fs/promises'
import { join, relative } from 'node:path'

const virtualId = 'virtual:page-entries'
const resolvedId = '\0' + virtualId

export async function scanPageEntries(root = process.cwd()) {
  const pagesDir = join(root, 'pages')
  const rootIndex = join(pagesDir, 'index.vue')

  async function findIndexFiles(dir) {
    const files = []
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) files.push(...await findIndexFiles(path))
      else if (entry.name === 'index.vue' && path !== rootIndex) files.push(path)
    }
    return files
  }

  const toRoute = (filePath) =>
    '/' + relative(pagesDir, filePath).replace(/\/index\.vue$/, '')

  const files = await findIndexFiles(pagesDir)
  const entries = await Promise.all(files.map(async (file) => {
    const { birthtime } = await stat(file)
    return { route: toRoute(file), created: birthtime.toISOString() }
  }))
  return entries.sort((a, b) => a.created.localeCompare(b.created))
}

/** Vite plugin — resolves page index routes + birthtimes at build time. */
export const pageEntries = () => ({
  name: 'page-entries',

  resolveId(id) {
    if (id === virtualId) return resolvedId
  },

  async load(id) {
    if (id !== resolvedId) return
    const entries = await scanPageEntries()
    return `export default ${JSON.stringify(entries)}`
  },

  handleHotUpdate({ file, server }) {
    if (file.includes('/pages/') && file.endsWith('index.vue')) {
      const mod = server.moduleGraph.getModuleById(resolvedId)
      if (mod) server.moduleGraph.invalidateModule(mod)
    }
  },
})
