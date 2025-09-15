/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  extends: ['next', 'next/core-web-vitals', 'plugin:@typescript-eslint/recommended'],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  rules: {
    // Option A: auto-convert any → unknown, then run --fix
    '@typescript-eslint/no-explicit-any': ['error', {
      fixToUnknown: true,
      ignoreRestArgs: true,
    }],

    // If you just want to unblock builds, you can relax instead:
    // '@typescript-eslint/no-explicit-any': 'off',
  },
  // Example: silence “unused vars” for NextResponse only if you want
  overrides: [
    {
      files: ['lib/reports-guard.ts'],
      rules: {
        '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^NextResponse$' }],
      },
    },
    // Or switch the Kardex file to allow any:
    // {
    //   files: ['lib/kardex/**'],
    //   rules: { '@typescript-eslint/no-explicit-any': 'off' },
    // },
  ],
};
