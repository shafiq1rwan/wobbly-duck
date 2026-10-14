/**
 * UI icons from Phosphor Icons (MIT, https://phosphoricons.com), "fill" weight — chunky and rounded,
 * which suits the cartoon style. Only the icons imported here are bundled. They are injected once as
 * an SVG sprite; markup uses them with <svg class="icon"><use href="#i-name" /></svg>.
 */
import back from '@phosphor-icons/core/fill/arrow-left-fill.svg?raw';
import replay from '@phosphor-icons/core/fill/arrow-clockwise-fill.svg?raw';
import check from '@phosphor-icons/core/fill/check-circle-fill.svg?raw';
import skins from '@phosphor-icons/core/fill/coat-hanger-fill.svg?raw';
import crown from '@phosphor-icons/core/fill/crown-fill.svg?raw';
import flag from '@phosphor-icons/core/fill/flag-fill.svg?raw';
import home from '@phosphor-icons/core/fill/house-fill.svg?raw';
import tip from '@phosphor-icons/core/fill/lightbulb-fill.svg?raw';
import jump from '@phosphor-icons/core/fill/arrow-fat-up-fill.svg?raw';
import dash from '@phosphor-icons/core/fill/lightning-fill.svg?raw';
import pointLeft from '@phosphor-icons/core/fill/arrow-fat-left-fill.svg?raw';
import pointRight from '@phosphor-icons/core/fill/arrow-fat-right-fill.svg?raw';
import lock from '@phosphor-icons/core/fill/lock-simple-fill.svg?raw';
import ad from '@phosphor-icons/core/fill/monitor-play-fill.svg?raw';
import pause from '@phosphor-icons/core/fill/pause-fill.svg?raw';
import play from '@phosphor-icons/core/fill/play-fill.svg?raw';
import soundOn from '@phosphor-icons/core/fill/speaker-high-fill.svg?raw';
import soundOff from '@phosphor-icons/core/fill/speaker-slash-fill.svg?raw';
import star from '@phosphor-icons/core/fill/star-fill.svg?raw';

const ICONS: Record<string, string> = {
  ad,
  back,
  check,
  lock,
  skins,
  tip,
  jump,
  dash,
  'point-left': pointLeft,
  'point-right': pointRight,
  replay,
  crown,
  flag,
  home,
  pause,
  play,
  'sound-on': soundOn,
  'sound-off': soundOff,
  star,
};

export function installIcons(): void {
  const symbols = Object.entries(ICONS)
    .map(([name, svg]) => {
      const viewBox = /viewBox="([^"]+)"/.exec(svg)?.[1] ?? '0 0 256 256';
      const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
      return `<symbol id="i-${name}" viewBox="${viewBox}">${inner}</symbol>`;
    })
    .join('');
  const sprite = document.createElement('div');
  sprite.setAttribute('aria-hidden', 'true');
  sprite.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  sprite.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg">${symbols}</svg>`;
  document.body.prepend(sprite);
}
