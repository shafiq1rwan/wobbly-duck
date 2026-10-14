/// <reference types="node" />
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

/** "0.1.0+a1b2c3d" (package version + commit; "-dirty" if built with uncommitted changes). */
function buildVersion(): string {
  const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };
  try {
    const hash = execSync('git rev-parse --short HEAD').toString().trim();
    const dirty = execSync('git status --porcelain').toString().trim() !== '';
    return `${version}+${hash}${dirty ? '-dirty' : ''}`;
  } catch {
    return version;
  }
}

/** Poki HTML5 SDK, per https://developers.poki.com/guide/sdk-html5 (Poki builds only). */
const POKI_SDK = '<script src="https://game-cdn.poki.com/scripts/v2/poki-sdk.js"></script>';

export default defineConfig(({ mode }) => ({
  // Relative asset paths so the build works from any sub-folder (required by most web game portals).
  base: './',
  define: { __APP_VERSION__: JSON.stringify(buildVersion()) },
  plugins: [
    {
      name: 'poki-sdk',
      transformIndexHtml: (html: string) => (mode === 'poki' ? html.replace('</title>', `</title>\n    ${POKI_SDK}`) : html),
    },
  ],
  server: { host: true, port: 5173 },
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: { manualChunks: { phaser: ['phaser'] } },
    },
  },
}));
