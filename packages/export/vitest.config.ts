import { defineProject } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const core = fileURLToPath(new URL('../core/src', import.meta.url));

export default defineProject({
  // Test against core's sources so `pnpm test` works without building first.
  resolve: {
    alias: [
      { find: /^@proseline-editor\/core\/features$/, replacement: `${core}/features/index.ts` },
      { find: /^@proseline-editor\/core$/, replacement: `${core}/index.ts` },
    ],
  },
  // Node, as on a server: HTML input goes through @tiptap/html's server build (happy-dom).
  test: { name: 'export', environment: 'node', include: ['src/**/*.test.ts'] },
});
