import { defineProject } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const core = fileURLToPath(new URL('../core/src', import.meta.url));

export default defineProject({
  // Test against core's sources so `pnpm test` works without building first.
  resolve: {
    alias: [
      { find: /^@proseline-editor\/core\/features\/(.*)$/, replacement: `${core}/features/$1/index.ts` },
      { find: /^@proseline-editor\/core\/features$/, replacement: `${core}/features/index.ts` },
      { find: /^@proseline-editor\/core$/, replacement: `${core}/index.ts` },
    ],
  },
  test: { name: 'sync', environment: 'happy-dom', include: ['src/**/*.test.ts'] },
});
