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
  nitro: {
    prerender: {
      ignore: ['/2018/', '/2019/', '/2020/', '/2021/', '/2022/', '/2023/']
    }
  },
  pages: {
    pattern: '**/index.vue',
  },
  routeRules: { '/pages/**': { ssr: false } },

  modules: [
    '@nuxtjs/tailwindcss',
  ],

  css: ['~/assets/main.css'],

  vite: {
    plugins: [pageEntries(), yamlImport()],
  },
})
