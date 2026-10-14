import type { SkinId } from '../art/duckSprite';
import { CONFIG } from '../config';
import { loadString, saveString } from '../core/Storage';

export type SkinInfo = (typeof CONFIG.skins)[number];

export function isSkin(id: string): id is SkinId {
  return CONFIG.skins.some((s) => s.id === id);
}

/**
 * Which duck skins the player owns and wears, saved on the device. Skins are paid for from the
 * score bank; GameScene checks and deducts the price before calling `unlock`.
 */
export class Skins {
  private readonly owned = new Set<SkinId>();
  private current: SkinId = 'classic';

  constructor() {
    for (const id of loadString('skinsOwned').split(',')) if (isSkin(id)) this.owned.add(id);
    for (const s of CONFIG.skins) if (s.price === 0) this.owned.add(s.id);
    const worn = loadString('skin', 'classic');
    if (isSkin(worn) && this.owned.has(worn)) this.current = worn;
  }

  get equipped(): SkinId {
    return this.current;
  }

  get list(): readonly SkinInfo[] {
    return CONFIG.skins;
  }

  info(id: SkinId): SkinInfo {
    return CONFIG.skins.find((s) => s.id === id) ?? CONFIG.skins[0];
  }

  isOwned(id: SkinId): boolean {
    return this.owned.has(id);
  }

  unlock(id: SkinId): void {
    this.owned.add(id);
    saveString('skinsOwned', [...this.owned].join(','));
  }

  equip(id: SkinId): void {
    if (!this.owned.has(id)) return;
    this.current = id;
    saveString('skin', id);
  }

  /** True if some skin not owned yet costs no more than `bank` (the menu shows a dot). */
  canAffordNew(bank: number): boolean {
    return CONFIG.skins.some((s) => !this.owned.has(s.id) && s.price <= bank);
  }
}
