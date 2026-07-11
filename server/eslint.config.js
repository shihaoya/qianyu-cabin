import js from '@eslint/js'

export default [
  {
    files: ['**/*.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
  },
  js.configs.recommended,
]
