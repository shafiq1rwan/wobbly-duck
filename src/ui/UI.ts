export type Screen = 'menu' | 'shop' | 'playing' | 'paused' | 'revive' | 'gameover';

/** What the skins shop shows; GameScene owns the logic (prices, bank, ownership). */
export interface ShopView {
  bank: number;
  items: readonly { id: string; name: string; file: string; price: number; owned: boolean }[];
  equipped: string;
  selected: string;
}

export interface UIHandlers {
  onPlay(): void;
  onShop(): void;
  onShopBack(): void;
  /** A skin card was tapped (owned: wear it; locked: try it on). */
  onShopPick(id: string): void;
  /** The shop's main button: Play, or Unlock for a locked skin. */
  onShopAction(): void;
  onRevive(): void;
  onReviveSkip(): void;
  onPause(): void;
  onResume(): void;
  onRestart(): void;
  onHome(): void;
  onToggleSound(): void;
  /** Called for every button press (UI click sound). */
  onButton(): void;
}

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el;
}

const numberFormat = new Intl.NumberFormat('en-US');
/** Lets the release wobble start before the screen changes (still feels instant). */
const ACTION_DELAY_MS = 110;
const fmt = (n: number): string => numberFormat.format(n);

function restartAnimation(el: HTMLElement, cls: string): void {
  el.classList.remove('pop', 'shake', 'bump', 'show');
  void el.offsetWidth; // reflow so the animation plays again
  el.classList.add(cls);
}

/**
 * DOM overlay for menus and HUD — crisp text at any DPR, safe-area aware via CSS,
 * and works with mouse and touch. Game rendering stays in the canvas underneath.
 * Layout and styling follow docs/UI_SPEC.md.
 */
export class UI {
  private readonly screens: Record<string, HTMLElement> = {
    hud: $('hud'),
    menu: $('menu'),
    shop: $('shop'),
    pause: $('pause'),
    revive: $('revive'),
    gameover: $('gameover'),
  };
  private readonly shopGrid = $('shop-grid');
  private readonly shopViewport = $('shop-viewport');
  private readonly shopScroll = $('shop-scroll');
  private readonly shopCards = new Map<string, HTMLElement>();
  private readonly distanceEl = $('hud-distance');
  private readonly scoreEl = $('hud-score');
  private readonly paradeChip = $('chip-parade');
  private readonly toastEl = $('toast');
  private lastDistance = -1;
  private lastScore = -1;
  private toastTimer = 0;
  private paradeCount = 0;

  constructor(private readonly handlers: UIHandlers) {
    const bind = (id: string, fn: () => void) => {
      const el = $(id);
      let pending = false;
      // Squishy feedback: squash while held, jelly wobble on release (see .pressed / .jelly in CSS).
      el.addEventListener('pointerdown', (e) => {
        e.stopPropagation(); // keep button presses from being read as jump/dash taps
        el.classList.remove('jelly');
        el.classList.add('pressed');
        handlers.onButton();
      });
      const release = () => {
        if (!el.classList.contains('pressed')) return;
        el.classList.remove('pressed');
        void el.offsetWidth; // restart the animation
        el.classList.add('jelly');
      };
      el.addEventListener('pointerup', release);
      el.addEventListener('pointercancel', release);
      el.addEventListener('pointerleave', release);
      el.addEventListener('animationend', () => el.classList.remove('jelly'));
      el.addEventListener('click', (e) => {
        e.preventDefault();
        (el as HTMLButtonElement).blur();
        if (pending) return;
        pending = true;
        setTimeout(() => {
          pending = false;
          fn();
          // If the button's screen just closed, drop the class so it doesn't replay when shown again.
          if (!el.offsetParent) el.classList.remove('jelly');
        }, ACTION_DELAY_MS);
      });
    };
    this.paradeChip.addEventListener('animationend', () => {
      this.paradeChip.classList.remove('pop', 'shake');
      this.paradeChip.hidden = this.paradeCount === 0;
    });
    bind('btn-play', handlers.onPlay);
    bind('btn-pause', handlers.onPause);
    bind('btn-resume', handlers.onResume);
    bind('btn-restart', handlers.onRestart);
    bind('btn-home', handlers.onHome);
    bind('btn-home-pause', handlers.onHome);
    bind('btn-sound-menu', handlers.onToggleSound);
    bind('btn-sound-pause', handlers.onToggleSound);
    bind('btn-shop', handlers.onShop);
    bind('btn-shop-back', handlers.onShopBack);
    bind('btn-shop-action', handlers.onShopAction);
    bind('btn-revive', handlers.onRevive);
    bind('btn-revive-skip', handlers.onReviveSkip);
    this.initShopScroll();
    // Re-fit when the cards' size settles (fonts, images) or the screen changes.
    new ResizeObserver(() => this.fitShopRows()).observe(this.shopGrid);
    window.addEventListener('resize', () => this.fitShopRows());
  }

  /** Pops "New Record!" in under the score (it floats away by itself). */
  showRecord(): void {
    const el = $('record-banner');
    el.hidden = false;
    el.onanimationend = (e) => {
      if (e.target === el) el.hidden = true;
    };
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
  }

  /** A skin was just bought: its card pops and shines. */
  shopUnlocked(id: string): void {
    const card = this.shopCards.get(id);
    if (!card) return;
    card.classList.remove('unlocked-now');
    void card.offsetWidth;
    card.classList.add('unlocked-now');
    card.addEventListener('animationend', () => card.classList.remove('unlocked-now'), { once: true });
  }

  setMuted(muted: boolean): void {
    for (const id of ['btn-sound-menu', 'btn-sound-pause']) {
      const el = $(id);
      el.setAttribute('aria-pressed', String(!muted));
      el.setAttribute('aria-label', muted ? 'Sound off' : 'Sound on');
    }
  }

  show(screen: Screen): void {
    const s = this.screens;
    s.menu.hidden = screen !== 'menu';
    s.shop.hidden = screen !== 'shop';
    if (screen === 'shop') requestAnimationFrame(() => this.fitShopRows());
    s.hud.hidden = screen !== 'playing' && screen !== 'paused';
    s.pause.hidden = screen !== 'paused';
    s.revive.hidden = screen !== 'revive';
    s.gameover.hidden = screen !== 'gameover';
  }

  /** Orange dot on the menu's shop button when a new skin is affordable. */
  setShopDot(visible: boolean): void {
    $('shop-dot').hidden = !visible;
  }

  setShop(v: ShopView): void {
    $('shop-bank').textContent = fmt(v.bank);
    if (this.shopCards.size !== v.items.length) this.buildShop(v);
    for (const item of v.items) {
      const card = this.shopCards.get(item.id)!;
      const equipped = item.id === v.equipped;
      card.classList.toggle('selected', item.id === v.selected);
      card.classList.toggle('locked', !item.owned);
      card.classList.toggle('equipped', equipped);
      const price = card.querySelector('.skin-price')!;
      price.innerHTML = equipped
        ? '<svg class="icon"><use href="#i-check" /></svg>Wearing'
        : item.owned
          ? 'Owned'
          : `<svg class="icon"><use href="#i-star" /></svg>${fmt(item.price)}`;
    }
    const sel = v.items.find((i) => i.id === v.selected) ?? v.items[0];
    $('shop-skin-name').textContent = sel.name;
    const action = $('btn-shop-action');
    const affordable = sel.price <= v.bank;
    const [icon, text] = sel.owned
      ? ['#i-play', 'Play']
      : affordable
        ? ['#i-star', `Unlock ${fmt(sel.price)}`]
        : ['#i-lock', `Need ${fmt(sel.price - v.bank)} more`];
    $('shop-action-icon').setAttribute('href', icon);
    $('shop-action-text').textContent = text;
    action.classList.toggle('btn-locked', !sel.owned && !affordable);
    action.setAttribute('aria-label', text);
  }

  /** Can't afford the selected skin: shake the button. */
  shopDenied(): void {
    restartAnimation($('btn-shop-action'), 'shake');
  }

  private buildShop(v: ShopView): void {
    this.shopGrid.replaceChildren();
    this.shopCards.clear();
    const base = `${import.meta.env.BASE_URL}assets/`;
    for (const item of v.items) {
      const card = document.createElement('button');
      card.className = 'skin-card';
      card.setAttribute('aria-label', item.name);
      card.innerHTML = `<span class="skin-img" style="background-image:url('${base}${item.file}')"></span><span class="skin-name"></span><span class="skin-price"></span>`;
      card.querySelector('.skin-name')!.textContent = item.name;
      card.addEventListener('pointerdown', (e) => {
        e.stopPropagation(); // not a jump/dash tap
        this.handlers.onButton();
      });
      card.addEventListener('click', (e) => {
        e.preventDefault();
        card.blur();
        this.handlers.onShopPick(item.id);
      });
      this.shopGrid.append(card);
      this.shopCards.set(item.id, card);
    }
    // Teaser for skins still being drawn: a navy silhouette of the duck.
    const soon = document.createElement('div');
    soon.className = 'skin-card coming-soon';
    soon.setAttribute('aria-label', 'More skins coming soon');
    soon.innerHTML = `<span class="skin-img" style="--sheet:url('${base}duck-sheet.webp')"><span class="soon-mark">?</span></span><span class="skin-name">???</span><span class="skin-price">Coming soon</span>`;
    this.shopGrid.append(soon);
    requestAnimationFrame(() => this.fitShopRows());
  }

  /** The list shows at most three rows; more scroll. */
  private fitShopRows(): void {
    const card = this.shopGrid.firstElementChild as HTMLElement | null;
    if (!card || this.screens.shop.hidden) return;
    const gap = parseFloat(getComputedStyle(this.shopGrid).rowGap) || 0;
    this.shopViewport.style.maxHeight = `${card.offsetHeight * 3 + gap * 2 + 8}px`;
    this.updateShopScroll();
  }

  /** Edge fades and the handle follow the scroll position. */
  private updateShopScroll(): void {
    const v = this.shopViewport;
    const max = v.scrollHeight - v.clientHeight;
    const scrollable = max > 2;
    this.shopScroll.classList.toggle('scrollable', scrollable);
    this.shopScroll.classList.toggle('can-up', scrollable && v.scrollTop > 2);
    this.shopScroll.classList.toggle('can-down', scrollable && v.scrollTop < max - 2);
    if (!scrollable) return;
    const track = v.clientHeight - 8;
    const thumbH = Math.max(28, (track * v.clientHeight) / v.scrollHeight);
    const thumb = $('shop-thumb');
    thumb.style.height = `${thumbH}px`;
    thumb.style.transform = `translateY(${((track - thumbH) * v.scrollTop) / max}px)`;
  }

  /**
   * Game-style scrolling for the skins list: drag with a finger or the mouse, it keeps gliding after
   * release, and pulling past an end stretches the list, which springs back. A drag never taps a card.
   */
  private initShopScroll(): void {
    const v = this.shopViewport;
    const grid = this.shopGrid;
    let pointer: number | null = null;
    let startY = 0;
    let startTop = 0;
    let lastY = 0;
    let lastT = 0;
    let velocity = 0; // px per ms, positive = content moving up
    let dragging = false;
    let glide = 0;

    const stretch = (over: number) => {
      grid.classList.remove('settle');
      grid.style.transform = over ? `translateY(${Math.sign(over) * Math.sqrt(Math.abs(over)) * 5}px)` : '';
    };
    const settle = () => {
      grid.classList.add('settle');
      grid.style.transform = '';
    };

    v.addEventListener('scroll', () => this.updateShopScroll());
    // The page-wide wheel block (InputManager) also stops native scrolling here, so scroll by hand.
    v.addEventListener('wheel', (e) => {
      v.scrollTop += e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    });
    v.addEventListener(
      'pointerdown',
      (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        cancelAnimationFrame(glide);
        pointer = e.pointerId;
        startY = lastY = e.clientY;
        startTop = v.scrollTop;
        lastT = performance.now();
        velocity = 0;
        dragging = false;
      },
      true,
    );
    window.addEventListener('pointermove', (e) => {
      if (e.pointerId !== pointer) return;
      const dy = e.clientY - startY;
      if (!dragging && Math.abs(dy) < 8) return;
      if (!dragging) {
        dragging = true;
        this.shopScroll.classList.add('dragging');
      }
      const max = v.scrollHeight - v.clientHeight;
      const want = startTop - dy;
      v.scrollTop = Math.max(0, Math.min(max, want));
      stretch(want < 0 ? -want : want > max ? max - want : 0);
      const now = performance.now();
      const dt = Math.max(1, now - lastT);
      velocity = 0.7 * velocity + 0.3 * ((lastY - e.clientY) / dt);
      lastY = e.clientY;
      lastT = now;
    });
    const release = (e: PointerEvent) => {
      if (e.pointerId !== pointer) return;
      pointer = null;
      this.shopScroll.classList.remove('dragging');
      settle();
      if (!dragging) return;
      // A drag is not a tap: swallow the click that follows.
      v.addEventListener('click', (c) => (c.stopPropagation(), c.preventDefault()), { capture: true, once: true });
      setTimeout(() => (dragging = false), 0);
      let prev = performance.now();
      const step = (now: number) => {
        const dt = now - prev;
        prev = now;
        v.scrollTop += velocity * dt;
        velocity *= Math.pow(0.94, dt / 16);
        if (Math.abs(velocity) > 0.02) glide = requestAnimationFrame(step);
      };
      glide = requestAnimationFrame(step);
    };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
  }

  // ------------------------------------------------------------------ revive

  showRevive(score: number): void {
    $('revive-score').textContent = fmt(score);
    this.setReviveTimer(1);
    this.setReviveBusy(false);
  }

  /** Time left on the offer, 1 → 0. */
  setReviveTimer(fraction: number): void {
    $('revive-bar').style.transform = `scaleX(${Math.max(0, fraction)})`;
  }

  /** While the ad is loading/playing the buttons do nothing. */
  setReviveBusy(busy: boolean): void {
    $('revive-text').textContent = busy ? 'Loading…' : 'Revive';
    for (const id of ['btn-revive', 'btn-revive-skip']) ($(id) as HTMLButtonElement).disabled = busy;
  }

  setMenuBest(best: number): void {
    $('menu-best').textContent = fmt(best);
  }

  /** Controls hint on the main menu — shown until the player has started a run. */
  setHintVisible(visible: boolean): void {
    $('menu-hint').style.visibility = visible ? 'visible' : 'hidden';
  }

  /** Touch devices, first few runs: faint JUMP / DASH over the two tap halves, faded out by CSS. */
  showTouchZones(): void {
    const el = $('touch-zones');
    el.hidden = false;
    el.onanimationend = () => (el.hidden = true); // otherwise it replays whenever the HUD reappears
    restartAnimation(el, 'show');
  }

  setDistance(metres: number): void {
    if (metres === this.lastDistance) return;
    this.lastDistance = metres;
    this.distanceEl.textContent = fmt(metres);
  }

  /** All scores added up (the currency for unlocking skins). */
  setMenuBank(total: number): void {
    $('menu-bank').textContent = fmt(total);
  }

  /** Run score at the top centre; bumps when it goes up. */
  setScore(score: number): void {
    if (score === this.lastScore) return;
    const up = score > this.lastScore && this.lastScore >= 0;
    this.lastScore = score;
    this.scoreEl.textContent = fmt(score);
    if (up) restartAnimation(this.scoreEl, 'bump');
  }

  /** Parade chip: ×(1 + ducklings). Pops on join, shakes red on loss, hidden with an empty parade. */
  setParade(count: number, event: 'join' | 'lost' | 'reset'): void {
    this.paradeCount = count;
    $('hud-mult').textContent = String(1 + count);
    const chip = this.paradeChip;
    if (event === 'reset') {
      chip.classList.remove('pop', 'shake');
      chip.hidden = true;
      return;
    }
    chip.hidden = false;
    restartAnimation(chip, event === 'join' ? 'pop' : 'shake');
  }

  /**
   * A short message on a card low in the water. `tip` (first-time hints) shows a lightbulb badge;
   * `info` is a plain message. It pops up, then sinks and fades after `seconds`.
   */
  showToast(message: string, seconds = 4, kind: 'tip' | 'info' = 'tip'): void {
    $('toast-text').textContent = message;
    this.toastEl.classList.toggle('info', kind === 'info');
    this.toastEl.style.setProperty('--toast-time', `${seconds}s`);
    this.toastEl.hidden = false;
    restartAnimation(this.toastEl, 'show');
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => (this.toastEl.hidden = true), seconds * 1000);
  }

  setGameOver(score: number, distance: number, best: number, isNewBest: boolean, parade: number): void {
    $('go-score').textContent = fmt(score);
    $('go-distance').textContent = fmt(distance);
    $('go-parade').textContent = String(parade);
    $('go-best').textContent = fmt(best);
    $('go-best-label').textContent = isNewBest ? 'New Best!' : 'Best Score';
    $('go-best-badge').classList.toggle('is-new', isNewBest);
  }
}
