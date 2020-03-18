module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint/eslint-plugin'],

  // Taken from here
  // https://www.npmjs.com/package/eslint-config-airbnb-typescript
  extends: [
    "plugin:@typescript-eslint/eslint-recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
    "airbnb-typescript",
  ],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  rules: {
    'no-console': 'off', // Command line scripts
    '@typescript-eslint/no-explicit-any': 'off', // In deployment scripts we do not bother with return type
    '@typescript-eslint/require-await': 'off',  // assert.rejects pattern in tests
    'max-len': ["error", {
      code: 140,
      ignoreComments: true,
      ignoreTrailingComments: true,
      ignoreStrings: true,
      ignoreUrls: true
    }]
  }
}