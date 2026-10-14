/**
 * UI icons from Phosphor Icons (MIT, https://phosphoricons.com), "fill" weight — chunky and rounded,
 * which suits the cartoon style. Only the icons imported here are bundled. They are injected once as
 * an SVG sprite; markup uses them with <svg class="icon"><use href="#i-name" /></svg>.
 */
import replay from '@phosphor-icons/core/fill/arrow-clockwise-fill.svg?raw';
import crown from '@phosphor-icons/core/fill/crown-fill.svg?raw';
import flag from '@phosphor-icons/core/fill/flag-fill.svg?raw';
import home from '@phosphor-icons/core/fill/house-fill.svg?raw';
import pause from '@phosphor-icons/core/fill/pause-fill.svg?raw';
import play from '@phosphor-icons/core/fill/play-fill.svg?raw';
import soundOn from '@phosphor-icons/core/fill/speaker-high-fill.svg?raw';
import soundOff from '@phosphor-icons/core/fill/speaker-slash-fill.svg?raw';
import star from '@phosphor-icons/core/fill/star-fill.svg?raw';

const ICONS: Record<string, string> = {
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
