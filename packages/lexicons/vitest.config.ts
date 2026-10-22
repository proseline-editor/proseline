import { defineProject } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const src = (pkg: string) => fileURLToPath(new URL(`../${pkg}/src`, import.meta.url));

export default defineProject({
  // Test against workspace sources so `pnpm test` works without building first.
  resolve: {
    alias: [
      { find: /^@proseline-editor\/core\/features$/, replacement: `${src('core')}/features/index.ts` },
      { find: /^@proseline-editor\/core$/, replacement: `${src('core')}/index.ts` },
    ],
  },
  test: { name: 'lexicons', environment: 'node', include: ['src/**/*.test.ts'] },
});
