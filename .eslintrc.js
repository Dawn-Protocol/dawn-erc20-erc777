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
    // "airbnb/hooks", React hooks specific
    //'plugin:@typescript-eslint/eslint-recommended',
    //'plugin:@typescript-eslint/recommended',
    //'prettier',
    //'prettier/@typescript-eslint',

  ],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  rules: {
    //'@typescript-eslint/interface-name-prefix': 'off',
    //'@typescript-eslint/explicit-function-return-type': 'off',
    //'@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/require-await': 'off',  // assert.rejects pattern in tests
    'max-len': ["error", {
      code: 140,
      ignoreComments: true,
      ignoreTrailingComments: true,
      ignoreStrings: true
    }]
  }
}