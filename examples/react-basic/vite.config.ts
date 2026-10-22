import { defineConfig } from 'vite';

// Vite 8 compiles TSX with the automatic React runtime; no plugin is needed for this example.
// The example bundles React + TipTap in one chunk on purpose, hence the raised warning limit.
// Relative asset URLs, so the build also works inside the docs site (site/public/playground/).
export default defineConfig({ base: './', build: { chunkSizeWarningLimit: 1000 } });
