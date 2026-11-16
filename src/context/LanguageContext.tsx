import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  AppLanguage,
  EquipmentType,
  MuscleCategory,
  MuscleSubGroupId,
  RankTier,
} from '../types/workout';
import {
  DEFAULT_APP_SETTINGS,
  getAppSettings,
  getCachedAppSettings,
  updateAppSettings,
} from '../services/settings';
import { scheduleAutoCloudSync } from '../services/cloudSync';
import { setupCreatineNotificationCategories } from '../services/notifications';
import { setStoredLanguageSync } from '../services/languageStore';
import { resolveCanonicalExerciseId } from '../data/exerciseLibrary';
import {
  getLocaleCode,
  getTranslatedCategory,
  getTranslatedDay,
  getTranslatedDayTag,
  getTranslatedEquipment,
  getTranslatedExerciseName,
  getTranslatedMuscle,
  getTranslatedMuscleDesc,
  getTranslatedRankMeta,
  getTranslatedSupplement,
  translateText,
  TranslationKey,
} from '../i18n/translations';

interface LanguageContextValue {
  language: AppLanguage;
  localeCode: string;
  setLanguage: (lang: AppLanguage) => Promise<void>;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  categoryLabel: (cat: MuscleCategory) => string;
  muscleLabel: (id: MuscleSubGroupId, short?: boolean) => string;
  muscleDesc: (id: MuscleSubGroupId, fallbackDesc: string) => string;
  equipmentLabel: (eq: EquipmentType) => string;
  dayLabel: (dayId: string, short?: boolean) => string;
  exerciseName: (exerciseId: string | undefined, fallbackName: string) => string;
  rankTitle: (tier: RankTier) => string;
  rankSubtitle: (tier: RankTier) => string;
  dayTagLabel: (tagId: string | undefined, fallbackLabel: string, short?: boolean) => string;
  supplementName: (id: string, fallbackName: string) => string;
  supplementRec: (id: string, fallbackRec: string) => string;
  supplementNote: (id: string, fallbackNote: string) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  language: DEFAULT_APP_SETTINGS.language,
  localeCode: 'pl-PL',
  setLanguage: async () => {},
  t: (key, params) => translateText('pl', key, params),
  categoryLabel: (cat) => getTranslatedCategory(cat, 'pl'),
  muscleLabel: (id, short) => getTranslatedMuscle(id, 'pl', short),
  muscleDesc: (id, fb) => getTranslatedMuscleDesc(id, fb, 'pl'),
  equipmentLabel: (eq) => getTranslatedEquipment(eq, 'pl'),
  dayLabel: (dayId, short) => getTranslatedDay(dayId, 'pl', short),
  exerciseName: (id, fb) => getTranslatedExerciseName(id, fb, 'pl'),
  rankTitle: (tier) => getTranslatedRankMeta(tier, 'pl').title,
  rankSubtitle: (tier) => getTranslatedRankMeta(tier, 'pl').subtitle,
  dayTagLabel: (tagId, fb, short) => getTranslatedDayTag(tagId, fb, 'pl', short),
  supplementName: (id, fb) => getTranslatedSupplement(id, 'name', fb, 'pl'),
  supplementRec: (id, fb) => getTranslatedSupplement(id, 'recommendedDoseLabel', fb, 'pl'),
  supplementNote: (id, fb) => getTranslatedSupplement(id, 'note', fb, 'pl'),
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<AppLanguage>(
    getCachedAppSettings().language || 'pl'
  );

  useEffect(() => {
    let mounted = true;
    getAppSettings()
      .then((settings) => {
        if (mounted && settings.language) {
          setStoredLanguageSync(settings.language);
          setLanguageState(settings.language);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const setLanguage = useCallback(async (next: AppLanguage) => {
    setStoredLanguageSync(next);
    setLanguageState(next);
    try {
      await updateAppSettings({ language: next });
      await setupCreatineNotificationCategories();
      scheduleAutoCloudSync();
    } catch {}
  }, []);

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>) =>
      translateText(language, key, params),
    [language]
  );

  const categoryLabel = useCallback(
    (cat: MuscleCategory) => getTranslatedCategory(cat, language),
    [language]
  );

  const muscleLabel = useCallback(
    (id: MuscleSubGroupId, short: boolean = false) => getTranslatedMuscle(id, language, short),
    [language]
  );

  const muscleDesc = useCallback(
    (id: MuscleSubGroupId, fallbackDesc: string) =>
      getTranslatedMuscleDesc(id, fallbackDesc, language),
    [language]
  );

  const equipmentLabel = useCallback(
    (eq: EquipmentType) => getTranslatedEquipment(eq, language),
    [language]
  );

  const dayLabel = useCallback(
    (dayId: string, short: boolean = false) => getTranslatedDay(dayId, language, short),
    [language]
  );

  const exerciseName = useCallback(
    (exerciseId: string | undefined, fallbackName: string) => {
      const canonical = resolveCanonicalExerciseId(exerciseId || fallbackName, fallbackName);
      return getTranslatedExerciseName(canonical, fallbackName, language);
    },
    [language]
  );

  const rankTitle = useCallback(
    (tier: RankTier) => getTranslatedRankMeta(tier, language).title,
    [language]
  );

  const rankSubtitle = useCallback(
    (tier: RankTier) => getTranslatedRankMeta(tier, language).subtitle,
    [language]
  );

  const dayTagLabel = useCallback(
    (tagId: string | undefined, fallbackLabel: string, short: boolean = false) =>
      getTranslatedDayTag(tagId, fallbackLabel, language, short),
    [language]
  );

  const supplementName = useCallback(
    (id: string, fallbackName: string) =>
      getTranslatedSupplement(id, 'name', fallbackName, language),
    [language]
  );

  const supplementRec = useCallback(
    (id: string, fallbackRec: string) =>
      getTranslatedSupplement(id, 'recommendedDoseLabel', fallbackRec, language),
    [language]
  );

  const supplementNote = useCallback(
    (id: string, fallbackNote: string) =>
      getTranslatedSupplement(id, 'note', fallbackNote, language),
    [language]
  );

  return (
    <LanguageContext.Provider
      value={{
        language,
        localeCode: getLocaleCode(language),
        setLanguage,
        t,
        categoryLabel,
        muscleLabel,
        muscleDesc,
        equipmentLabel,
        dayLabel,
        exerciseName,
        rankTitle,
        rankSubtitle,
        dayTagLabel,
        supplementName,
        supplementRec,
        supplementNote,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext);
}
