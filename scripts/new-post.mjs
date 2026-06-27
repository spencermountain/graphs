#!/usr/bin/env node
// Scaffolds a new dated experiment page: pages/<year>/<mon-day>/index.vue
// Run with: pnpm new [slug]
import spacetime from 'spacetime'
import { mkdir, writeFile, access } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const s = spacetime.now()
const year = String(s.year())
const mon = s.format('month-short').toLowerCase()
const date = s.format('date-pad')

const exists = async (p) => access(p).then(() => true).catch(() => false)

const customSlug = process.argv[2]

let slug
let dir
if (customSlug) {
  slug = customSlug
  dir = join(root, 'pages', year, slug)
  if (await exists(dir)) {
    console.error(`\n  ✗ Already exists: pages/${year}/${slug}/`)
    process.exit(1)
  }
} else {
  // Allow multiple experiments on the same day: mar-28, then mar-28-2, mar-28-3, ...
  slug = `${mon}-${date}`
  dir = join(root, 'pages', year, slug)
  let n = 1
  while (await exists(dir)) {
    n += 1
    slug = `${mon}-${date}-${n}`
    dir = join(root, 'pages', year, slug)
  }
}

const template = `<script setup>
definePageMeta({ title: ''})
</script>

<template>
  <div>
   
  </div>
</template>
`

await mkdir(dir, { recursive: true })
const file = join(dir, 'index.vue')
const prompts = join(dir, 'prompt.md')
await writeFile(file, template, { flag: 'wx' })
await writeFile(prompts, '', { flag: 'wx' })

console.log(`\n  ✨ Created ${relative(root, file)}`)
console.log(`     ${relative(root, prompts)}`)
