export const NICKNAME_COOLDOWN_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

const POLISH_CHAR_MAP: Record<string, string> = {
  ą: 'a',
  ć: 'c',
  ę: 'e',
  ł: 'l',
  ń: 'n',
  ó: 'o',
  ś: 's',
  ź: 'z',
  ż: 'z',
  ä: 'ae',
  ö: 'oe',
  ü: 'ue',
  ß: 'ss',
  é: 'e',
  è: 'e',
  ê: 'e',
  à: 'a',
  á: 'a',
  ñ: 'n',
};

const AUTO_PREFIXES = [
  'iron',
  'steel',
  'apex',
  'titan',
  'pulse',
  'barbell',
  'heavy',
  'nova',
  'prime',
  'atlas',
  'kilo',
  'peak',
];

const AUTO_SUFFIXES = [
  'lifter',
  'athlete',
  'grind',
  'core',
  'rep',
  'lift',
  'pro',
  'fit',
  'gym',
  'max',
  'crew',
  'pr',
];

/**
 * Normalizes raw text into a clean handle (`a-z`, `0-9`, `.`, `_`), max 20 chars.
 */
export function normalizeNickname(raw: string): string {
  const lowered = String(raw || '')
    .trim()
    .replace(/^@+/, '')
    .toLowerCase();

  let transliterated = '';
  for (const ch of lowered) {
    transliterated += POLISH_CHAR_MAP[ch] ?? ch;
  }

  return transliterated
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9._]/g, '')
    .replace(/[._]{2,}/g, '_')
    .replace(/^[._]+|[._]+$/g, '')
    .slice(0, 20);
}

/**
 * Sanitizes live typing in nickname inputs without trimming trailing separator mid-typing.
 */
export function sanitizeNicknameInput(raw: string): string {
  const lowered = String(raw || '')
    .replace(/^@+/, '')
    .toLowerCase();
  let out = '';
  for (const ch of lowered) {
    out += POLISH_CHAR_MAP[ch] ?? ch;
  }
  return out
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9._]/g, '')
    .slice(0, 20);
}

export function isValidNickname(nick?: string | null): boolean {
  if (!nick) return false;
  return /^[a-z0-9][a-z0-9._]{1,18}[a-z0-9]$/.test(nick);
}

/**
 * Generates an athletic handle derived optionally from the athlete's full name.
 */
export function generateRandomNickname(fullName?: string): string {
  const cleanName = normalizeNickname(fullName || '');
  const parts = cleanName.split(/[._]/).filter((p) => p.length >= 2);
  const digits = String(Math.floor(10 + Math.random() * 89));

  if (parts.length >= 2) {
    const first = parts[0].slice(0, 9);
    const second = parts[1].slice(0, 7);
    const variants = [
      `${first}_${second}`,
      `${first}.${second}${digits.slice(0, 1)}`,
      `${first}_${AUTO_SUFFIXES[Math.floor(Math.random() * AUTO_SUFFIXES.length)]}`,
      `${first}${digits}`,
    ];
    const picked = normalizeNickname(variants[Math.floor(Math.random() * variants.length)]);
    if (isValidNickname(picked)) return picked;
  }

  if (parts.length === 1 && parts[0].length >= 3) {
    const base = parts[0].slice(0, 11);
    const sfx = AUTO_SUFFIXES[Math.floor(Math.random() * AUTO_SUFFIXES.length)];
    const variants = [`${base}_${sfx}`, `${base}${digits}`, `${base}.${sfx}`];
    const picked = normalizeNickname(variants[Math.floor(Math.random() * variants.length)]);
    if (isValidNickname(picked)) return picked;
  }

  const p = AUTO_PREFIXES[Math.floor(Math.random() * AUTO_PREFIXES.length)];
  const s = AUTO_SUFFIXES[Math.floor(Math.random() * AUTO_SUFFIXES.length)];
  return normalizeNickname(`${p}_${s}${digits}`);
}

export interface NicknameCooldownInfo {
  canEdit: boolean;
  daysRemaining: number;
  nextEditableDate?: Date;
}

export function getNicknameCooldownInfo(
  nicknameUpdatedAt?: string | null,
  hasExistingNickname = true,
  nowMs = Date.now()
): NicknameCooldownInfo {
  if (!hasExistingNickname || !nicknameUpdatedAt) {
    return { canEdit: true, daysRemaining: 0 };
  }
  const updatedMs = new Date(nicknameUpdatedAt).getTime();
  if (isNaN(updatedMs)) {
    return { canEdit: true, daysRemaining: 0 };
  }
  const unlockMs = updatedMs + NICKNAME_COOLDOWN_DAYS * DAY_MS;
  if (nowMs >= unlockMs) {
    return { canEdit: true, daysRemaining: 0 };
  }
  const daysRemaining = Math.max(1, Math.ceil((unlockMs - nowMs) / DAY_MS));
  return {
    canEdit: false,
    daysRemaining,
    nextEditableDate: new Date(unlockMs),
  };
}
