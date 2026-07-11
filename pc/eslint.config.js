import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'

export default [
  {
    files: ['**/*.{js,vue}'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
  },
  js.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    rules: {
      'vue/multi-word-component-names': 'off',
    },
  },
]
