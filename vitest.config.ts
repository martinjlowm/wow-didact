import * as path from 'path';

import { defineConfig } from 'vitest/config';

// Mirrors the `@/*` and `$/*` path aliases from tsconfig.json so tests and the
// WoW build resolve source modules the same way.
export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\//, replacement: path.resolve(__dirname, 'src') + '/' },
      { find: /^\$\//, replacement: path.resolve(__dirname, 'test') + '/' },
    ],
  },
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
});
