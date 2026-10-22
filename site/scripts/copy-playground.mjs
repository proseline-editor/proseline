// Copies the built react-basic and vue-basic examples into the site, where the playground page
// embeds them. Build them first (`pnpm docs:build` does).
import { cpSync, existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const site = join(dirname(fileURLToPath(import.meta.url)), '..');
for (const [example, target] of [['react-basic', 'react'], ['vue-basic', 'vue']]) {
  const from = join(site, '..', 'examples', example, 'dist');
  if (!existsSync(join(from, 'index.html'))) throw new Error(`Build ${example} first: pnpm --filter ${example} build`);
  const to = join(site, 'public', 'playground', target);
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true });
}
