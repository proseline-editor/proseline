import { defineConfig } from 'vite';

// Vite 8 compiles TSX with the automatic React runtime; no plugin is needed for this example.
export default defineConfig({ build: { chunkSizeWarningLimit: 1500 } });
