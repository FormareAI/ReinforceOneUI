/* eslint-env node */
module.exports = {
  root: true,
  extends: [
    'eslint:recommended'
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'react-refresh'],
  env: { browser: true, es2021: true, node: true },
  settings: { react: { version: 'detect' } },
  overrides: [
    {
      files: ['**/*.{ts,tsx}'],
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
      rules: {
        'no-unused-vars': 'off',
        '@typescript-eslint/no-unused-vars': ['warn'],
        'react-refresh/only-export-components': ['warn', { allowConstantExport: true }]
      }
    }
  ]
};


