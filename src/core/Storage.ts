/** localStorage wrapper that never throws (private mode, blocked storage, sandboxed iframes). */
const PREFIX = 'wobblyduck.';
const memory = new Map<string, string>();

function backend(): Storage | null {
  try {
    const s = window.localStorage;
    const probe = PREFIX + '__probe';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

const store = backend();

export function loadNumber(key: string, fallback = 0): number {
  let raw: string | null | undefined;
  try {
    raw = store ? store.getItem(PREFIX + key) : memory.get(key);
  } catch {
    raw = memory.get(key);
  }
  const n = raw == null ? NaN : Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export function saveNumber(key: string, value: number): void {
  memory.set(key, String(value));
  try {
    store?.setItem(PREFIX + key, String(value));
  } catch {
    /* quota or access error — keep the in-memory copy */
  }
}
