import { defineConfig } from 'vite';

// Components are written with Vue's render functions in plain TypeScript, so no Vue plugin is needed.
// The example bundles Vue + TipTap in one chunk on purpose, hence the raised warning limit.
// Relative asset URLs, so the build also works inside the docs site (site/public/playground/).
export default defineConfig({ base: './', build: { chunkSizeWarningLimit: 1000 } });
