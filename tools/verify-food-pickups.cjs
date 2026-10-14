// Runtime checks for scoring and pooled pickup effects without a browser.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, dependencies = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { exports, require: (key) => dependencies[key], Math });
  return exports;
}

const { CONFIG } = load('src/config.ts');
const { FoodManager } = load('src/game/FoodManager.ts', { '../config': { CONFIG } });
const sprites = [];
class ImageStub {
  visible = false;
  alpha = 1;
  setDepth() { return this; }
  setVisible(value) { this.visible = value; return this; }
  setTexture(value) { this.texture = value; return this; }
  setAlpha(value) { this.alpha = value; return this; }
  setPosition(x, y) { this.x = x; this.y = y; return this; }
  setScale(x, y = x) { this.scaleX = x; this.scaleY = y; return this; }
  setRotation(value) { this.rotation = value; return this; }
}
const scene = { add: { image: () => { const image = new ImageStub(); sprites.push(image); return image; } } };
const food = new FoodManager(scene, 12);
const water = { heightAt: () => CONFIG.water.restY };
const view = { left: -1000 };
const circle = { x: 0, y: CONFIG.water.restY - CONFIG.duck.floatOffset - CONFIG.food.lowHeight, r: 26 };
let pickups = 0;
const pickup = () => { pickups++; };

for (const kind of ['corn', 'peas', 'bigCorn']) {
  food.spawn(kind, 0, CONFIG.food.lowHeight, 1, false, water);
  assert.equal(food.collect(circle, pickup), CONFIG.food.kinds[kind].points);
  assert.equal(food.collect(circle, pickup), 0, 'A fading pickup must not award twice');
  food.update(CONFIG.food.pickup.duration / 2, 0, water, view);
  const visible = sprites.filter((s) => s.visible);
  assert.equal(visible.length, 1);
  assert(visible[0].alpha > 0 && visible[0].alpha < 1);
  food.update(CONFIG.food.pickup.duration, 0, water, view);
  assert.equal(sprites.filter((s) => s.visible).length, 0, 'Completed pop must release its sprite');
}
assert.equal(pickups, 3);

food.spawn('bigCorn', 0, CONFIG.food.lowHeight, 1, true, water);
assert.equal(food.collectOnTop(0, 54, pickup), 5, 'Crate pickup uses the same score');
assert.equal(food.collectOnTop(0, 54, pickup), 0);
food.clear();
assert.equal(sprites.filter((s) => s.visible).length, 0, 'Restart clears unfinished effects');
for (let i = 0; i < CONFIG.food.poolSize; i++) food.spawn('corn', 0, CONFIG.food.lowHeight, 1, false, water);
assert.equal(sprites.length, CONFIG.food.poolSize, 'Spawning and effects must not allocate extra images');
assert.equal(food.collect(circle, pickup), CONFIG.food.poolSize, 'Every cleared pool slot is reusable');
food.clear();
assert(sprites.every((s) => !s.visible && s.alpha === 1));
console.log('Pickup checks passed: single scoring, all food values, crate pickup, fade completion, restart and pool reuse.');

const rings = [];
const graphics = {
  setDepth() { return this; }, clear() { rings.length = 0; return this; },
  lineStyle() { return this; }, strokeCircle(x, y, radius) { rings.push({ x, y, radius }); return this; },
};
const { Splashes } = load('src/game/Splashes.ts', { '../config': { CONFIG } });
const effects = new Splashes({ add: { graphics: () => graphics } }, 35);
effects.pickupRing(100, 200, 0xffe45c, false);
effects.update(CONFIG.food.pickup.ringDuration / 2, 10, water);
effects.draw();
assert.equal(rings.length, 1);
assert.equal(rings[0].x, 90, 'Pickup ring follows world scrolling');
assert(rings[0].radius > CONFIG.food.pickup.ringStartRadius);
effects.update(CONFIG.food.pickup.ringDuration, 0, water);
effects.draw();
assert.equal(rings.length, 0, 'Expired ring must disappear');
effects.pickupRing(0, 0, 0xffe45c, true);
effects.clear();
effects.draw();
assert.equal(rings.length, 0, 'Restart clears bonus rings');
console.log('Ring checks passed: expansion, scrolling, expiry and reset.');
