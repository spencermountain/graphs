import { pageEntries } from './scripts/page-entries.js'
import { yamlImport } from './scripts/yaml-import.js'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: false },

  devServer: {
    port: Number(process.env.PORT) || 3021,
  },

  // Plain JS project — no TypeScript tooling
  typescript: {
    shim: false,
    typeCheck: false,
  },

  // Only index.vue files become routes — pages can co-locate
  // sub-components and helpers in their folder without creating routes
  pages: {
    pattern: '**/index.vue',
  },

  modules: [
    '@nuxtjs/tailwindcss',
  ],

  css: ['~/assets/main.css'],

  vite: {
    plugins: [pageEntries(), yamlImport()],
  },
})
