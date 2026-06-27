# Frontend Scratch

A [Nuxt 3](https://nuxt.com) + [Tailwind CSS](https://tailwindcss.com) playground for
quick, throwaway client-side experiments. Each experiment is a dated page; the home
page indexes them automatically.

> Conventions and the experiment page format live in [AGENTS.md](AGENTS.md) — read it
> before adding pages (human or agent).

## Setup

```bash
pnpm install
```

## New experiment

```bash
pnpm new
```

Scaffolds `pages/<year>/<mon>-<day>/index.vue` for today (e.g. `pages/2026/mar-28/`)
and prints its URL (a second idea the same day becomes `.../mar-28-2/`). The home
page picks it up automatically — no manual registration.

Set a title with `definePageMeta({ title: 'My title' })` in the page; the index
shows it, falling back to the `mon-day` slug if omitted.

## Development

```bash
pnpm dev        # http://localhost:3000
```

## Production

```bash
pnpm build      # build for a Node server
pnpm preview    # preview the production build
pnpm generate   # or pre-render a fully static site
```

## How the index works

`pages/index.vue` reads the router (`useRouter().getRoutes()`), keeps the routes
matching `/<year>/<mon>-<day>`, and renders them newest-first on the fly — pulling
each page's `title` from its route meta. Add or delete a folder and the index
updates on save.
