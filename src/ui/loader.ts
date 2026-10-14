/**
 * The loading screen is plain HTML/CSS in index.html so it paints instantly. The JS bundle's own
 * download can't be measured, so the bar starts at 10% once code runs and maps asset loading
 * progress onto the remaining 90%.
 */
const root = document.getElementById('loader');
const fill = document.getElementById('loader-fill');

export function setLoadProgress(progress: number): void {
  const pct = Math.round(10 + Math.max(0, Math.min(1, progress)) * 90);
  if (fill) fill.style.width = `${pct}%`;
  root?.setAttribute('aria-valuenow', String(pct));
}

export function hideLoader(): void {
  if (!root) return;
  setLoadProgress(1);
  root.classList.add('done');
  setTimeout(() => root.remove(), 300);
}
