import { defineProject } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const src = (pkg: string) => fileURLToPath(new URL(`../${pkg}/src`, import.meta.url));

export default defineProject({
  // Test against workspace sources so `pnpm test` works without building first.
  resolve: {
    alias: [
      { find: /^@proseline-editor\/sync\/testing$/, replacement: `${src('sync')}/testing/index.ts` },
      { find: /^@proseline-editor\/sync$/, replacement: `${src('sync')}/index.ts` },
      { find: /^@proseline-editor\/core$/, replacement: `${src('core')}/index.ts` },
    ],
  },
  test: { name: 'sync-hocuspocus', environment: 'node', include: ['src/**/*.test.ts'] },
});
