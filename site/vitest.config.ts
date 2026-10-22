import { defineProject } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const core = fileURLToPath(new URL('../packages/core/src', import.meta.url));

export default defineProject({
  // The guide's code snippets are real, tested files (included into the pages with <<<).
  resolve: { alias: [{ find: /^@proseline-editor\/core$/, replacement: `${core}/index.ts` }] },
  test: { name: 'site', environment: 'happy-dom', include: ['snippets/**/*.test.ts'] },
});
