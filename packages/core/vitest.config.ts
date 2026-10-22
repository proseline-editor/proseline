import { defineProject } from 'vitest/config';

export default defineProject({
  test: { name: 'core', environment: 'happy-dom', include: ['src/**/*.test.ts'] },
});
