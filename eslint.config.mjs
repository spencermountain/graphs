// eslint.config.mjs
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  {
    rules: {
      'vue/require-default-prop': 'off',
      'vue/html-self-closing': 'off',
      'vue/first-attribute-linebreak': 'off',
      'no-prototype-builtins': 'off',
      'import/no-mutable-exports': 'off'
    }
  }
)
