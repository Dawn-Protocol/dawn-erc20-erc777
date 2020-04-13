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
    '@typescript-eslint/no-var-requires': 'off',  // web3 JS dependencies and default exports
    'no-restricted-syntax': 'off', // for...of loops enabled
    'no-await-in-loop': 'off', // Readability
    'import/prefer-default-export': 'off', // Export individual functions
    'max-len': ["error", {
      code: 180,
      ignoreComments: true,
      ignoreTrailingComments: true,
      ignoreStrings: true,
      ignoreUrls: true
    }]
  }
}