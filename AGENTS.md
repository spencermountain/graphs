# Agent guide
This is a playground for self-contained experimental client-side code.
It is a Nuxt 3 repository where AI generated vue3 components can be generated.

You will be given a folder in the ./pages directory. 
You do not need to read other pages in the respository.
You can write code blindly here, with confidence. 
The folder may have a prompt.md file that describes the experiment.

You do not need to run, view, or build the code. You do not need to verify that the page renders. You are discouraged from running commands and executing code. Your task is only to write code.

Work on the current branch. Do not make commits or pull requests. 
The user will be responsible for reviewing the results manually and may edit the code manually.

## Rules
- All experiments live in `pages/` and have no shared components
- Only `index.vue` files become routes (see `pages.pattern` in nuxt.config.js) — sub-components and helper js files can be co-located in the experiment folder
- Plain JavaScript, no TypeScript.
- Use Tailwind CSS for styling
- Package manager: pnpm
- No testing or linting is required
- Do not change other pages unless given permission
- Do not add dependencies unless given permission
- If a task would be better handled by a js dependency, describe why and ask the user to install it manually.

- Prefer the generator for adding a post:  `pnpm new`
This scaffolds `pages/<year>/<mon>-<day>/index.vue` for today, e.g.
`pages/2026/mar-28/index.vue` → route `/2026/mar-28`. 

## Code style
- Write terse javascript for modern browsers with no polyfills
- Defensive try/catch blocks are not required
- Prefer small maintainable files
- Add terse comments for maintainability
- Prefer flexbox over grid or margin-based layouts
- Prefer utility classes like 'row', 'col', and 'row-left'... defined in './assets/main.css'
- 'script setup' tags should be at the top of components, before the 'template' section
- tunable configuration variables should be easy to find, or in a separate config.js file

### Visual style
- Prefer card-based UI with shadows and rounded corners
- Prefer colors in './assets/colors.js'
