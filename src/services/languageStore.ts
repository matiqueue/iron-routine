import type { AppLanguage } from '../types/workout';

let currentLanguage: AppLanguage = 'pl';

export function getStoredLanguageSync(): AppLanguage {
  return currentLanguage;
}

export function setStoredLanguageSync(lang: AppLanguage): void {
  currentLanguage = lang;
}
