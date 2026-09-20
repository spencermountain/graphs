// eslint.config.mjs
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  // Custom rule overrides
  {
    rules: {
      'vue/require-default-prop': 'off',
      'vue/html-self-closing': 'off',
      'vue/first-attribute-linebreak': 'off'
    }
  }
)
