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

  /** A short message under the score (e.g. the first-duckling hint). */
  showToast(message: string, seconds = 3.5): void {
    this.toastEl.textContent = message;
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
