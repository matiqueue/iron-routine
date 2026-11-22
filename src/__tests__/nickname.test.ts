import { describe, expect, it } from 'vitest';
import {
  generateRandomNickname,
  isValidNickname,
  normalizeNickname,
} from '../utils/nickname';

describe('Nickname utilities', () => {
  it('normalizes leading @, whitespace, and uppercase letters', () => {
    expect(normalizeNickname('  @Iron_Matique! ')).toBe('iron_matique');
  });

  it('validates nickname length and allowed characters', () => {
    expect(isValidNickname('iron_matique')).toBe(true);
    expect(isValidNickname('ab')).toBe(false);
    expect(isValidNickname('bad space')).toBe(false);
  });

  it('generates valid random fallback nicknames', () => {
    const generated = generateRandomNickname('Szymon Góral');
    expect(isValidNickname(generated)).toBe(true);
  });
});
