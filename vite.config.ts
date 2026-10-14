import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths so the build works from any sub-folder (required by most web game portals).
  base: './',
  server: { host: true, port: 5173 },
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: { manualChunks: { phaser: ['phaser'] } },
    },
  },
});
