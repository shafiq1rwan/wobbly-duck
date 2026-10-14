import './fonts.css';
import './style.css';

import Phaser from 'phaser';
import { CONFIG } from './config';
import { computeRenderSize, installResizeHandling } from './core/Viewport';
import { platform } from './platform/Platform';
import { BootScene } from './scenes/BootScene';
import { installIcons } from './ui/icons';
import { GameScene } from './scenes/GameScene';

installIcons();
// Build version on the menu (for bug reports) and in the console.
document.getElementById('version')!.textContent = `v${__APP_VERSION__}`;
console.info(`Wobbly Duck v${__APP_VERSION__}`);
// Poki allows a studio logo on the loading screen only, so the in-game credit stays out of that build.
if (import.meta.env.MODE === 'poki') document.getElementById('credit')?.remove();

function start(): void {
  const { width, height } = computeRenderSize();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width,
    height,
    backgroundColor: CONFIG.water.color, // briefly visible before the first frame
    banner: false,
    scale: {
      // The game size always matches the window aspect × DPR, so FIT fills the screen exactly.
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    // Load images as <img> so they reuse the <link rel="preload"> downloads started in index.html.
    loader: { imageLoadType: 'HTMLImageElement' },
    render: {
      antialias: true,
      mipmapFilter: 'LINEAR_MIPMAP_LINEAR',
      powerPreference: 'high-performance',
    },
    // Input is handled by our own InputManager (keyboard + left/right tap halves) and the DOM UI.
    input: { keyboard: false, mouse: false, touch: false, gamepad: false },
    // Phaser audio is off: sound effects use our own Web Audio player (src/core/Audio.ts).
    audio: { noAudio: true },
    scene: [BootScene, GameScene],
  });
  installResizeHandling(game);
}

platform.init().then(start, start);
