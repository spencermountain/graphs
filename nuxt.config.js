import { pageEntries } from './scripts/page-entries.js'
import { yamlImport } from './scripts/yaml-import.js'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: false },

  devServer: {
    port: Number(process.env.PORT) || 3021,
  },
  ssr: false,
  nitro: {
    preset: 'static',
    prerender: {
      crawlLinks: true, // Nuxt also seeds every static page route when ssr is false
      autoSubfolderIndex: true, // /example -> .output/public/example/index.html
      failOnError: true
    }
  },
  // Plain JS project — no TypeScript tooling
  typescript: {
    shim: false,
    typeCheck: false,
  },
  pages: {
    pattern: '**/index.vue',
  },
  routeRules: { '/pages/**': { ssr: false } },

  modules: ['@nuxtjs/tailwindcss', '@nuxt/eslint'],

  css: ['~/assets/main.css'],

  vite: {
    plugins: [pageEntries(), yamlImport()],
  },
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      meta: [
        { name: 'author', content: 'Spencer Kelly' },
        { name: 'description', content: 'Spencer Kelly' },
        { name: 'keywords', content: 'spencer kelly, toronto, javascript' },
        { rel: 'manifest', href: '/manifest.json' },
        {
          name: 'viewport',
          content: 'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover'
        },
        { name: 'theme-color', content: '#0f172a' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' }
      ],
      link: [{ rel: 'icon', href: '/favicon.ico' }]
    }
  }
})