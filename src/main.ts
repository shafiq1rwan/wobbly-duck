import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/fredoka/700.css';
import './style.css';

import Phaser from 'phaser';
import { CONFIG } from './config';
import { computeRenderSize, installResizeHandling } from './core/Viewport';
import { platform } from './platform/Platform';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';

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
    render: {
      antialias: true,
      mipmapFilter: 'LINEAR_MIPMAP_LINEAR',
      powerPreference: 'high-performance',
    },
    // Input is handled by our own InputManager (keyboard + swipe) and the DOM UI.
    input: { keyboard: false, mouse: false, touch: false, gamepad: false },
    // Audio arrives in Phase 2 (unlocked on first user interaction).
    audio: { noAudio: true },
    scene: [BootScene, GameScene],
  });
  installResizeHandling(game);
}

platform.init().then(start, start);
