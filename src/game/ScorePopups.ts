import Phaser from 'phaser';

interface Popup {
  text: Phaser.GameObjects.Text;
  life: number;
  x: number;
  y: number;
  big: boolean;
}

const LIFE = 0.7;

/**
 * Floating "+150" numbers where food is collected, so the parade multiplier is visible.
 * Pooled Phaser texts in world space that drift with the scrolling world.
 */
export class ScorePopups {
  private readonly pool: Popup[] = [];
  private cursor = 0;

  constructor(scene: Phaser.Scene, depth: number) {
    for (let i = 0; i < 16; i++) {
      const text = scene.add
        .text(0, 0, '', {
          fontFamily: "'Fredoka', 'Trebuchet MS', sans-serif",
          fontSize: '24px',
          fontStyle: 'bold',
          color: '#ffffff',
          stroke: '#13266a',
          strokeThickness: 6,
        })
        .setOrigin(0.5)
        .setResolution(2.5)
        .setDepth(depth)
        .setVisible(false);
      this.pool.push({ text, life: 0, x: 0, y: 0, big: false });
    }
  }

  show(x: number, y: number, value: number, big: boolean): void {
    const p = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % this.pool.length;
    p.life = LIFE;
    p.x = x;
    p.y = y - 18;
    p.big = big;
    p.text.setText(`+${value}`).setColor(big ? '#ffe45c' : '#ffffff').setVisible(true);
  }

  update(dt: number, dx: number): void {
    for (const p of this.pool) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.text.setVisible(false);
        continue;
      }
      const t = 1 - p.life / LIFE; // 0 → 1
      p.x -= dx;
      p.y -= 55 * dt;
      const pop = t < 0.2 ? 0.6 + 2.6 * t : 1.12 - 0.12 * Math.min(1, (t - 0.2) * 5);
      p.text.setPosition(p.x, p.y).setScale(pop * (p.big ? 1.25 : 1)).setAlpha(t > 0.7 ? (1 - t) / 0.3 : 1);
    }
  }

  clear(): void {
    for (const p of this.pool) {
      p.life = 0;
      p.text.setVisible(false);
    }
  }
}
