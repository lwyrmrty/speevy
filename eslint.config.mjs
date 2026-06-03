import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  globalIgnores([
    '.next/**',
    '.tools/**',
    '.vercel/**',
    'next-env.d.ts',
    'node_modules/**',
    'public/**',
  ]),
  {
    rules: {
      '@next/next/no-html-link-for-pages': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      'prefer-const': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react/jsx-no-comment-textnodes': 'off',
    },
  },
]);
