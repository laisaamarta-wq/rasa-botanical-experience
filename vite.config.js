import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build`        → normal multi-file site (hashed, lazy-loaded assets) for a future deploy
// `npm run build:single` → one self-contained RASA.html that opens by double-click, no server needed
export default defineConfig(({ mode }) => mode === 'single'
  ? { plugins: [viteSingleFile()], build: { outDir: 'dist-local', assetsInlineLimit: 1e9, cssCodeSplit: false, chunkSizeWarningLimit: 1e6 } }
  : { build: { outDir: 'dist', assetsInlineLimit: 0 } });
