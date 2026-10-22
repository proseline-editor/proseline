import { defineConfig } from 'vite';

// The window loads dist/index.html from disk, so asset URLs must be relative.
// The example bundles React + TipTap in one chunk on purpose, hence the raised warning limit.
export default defineConfig({ base: './', build: { chunkSizeWarningLimit: 1500 } });
