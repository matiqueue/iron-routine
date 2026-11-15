import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AppLanguage, EquipmentType, MuscleCategory, MuscleSubGroupId } from '../types/workout';
import {
  DEFAULT_APP_SETTINGS,
  getAppSettings,
  getCachedAppSettings,
  updateAppSettings,
} from '../services/settings';
import { scheduleAutoCloudSync } from '../services/cloudSync';
import {
  getTranslatedCategory,
  getTranslatedDay,
  getTranslatedEquipment,
  getTranslatedMuscle,
  translateText,
  TranslationKey,
} from '../i18n/translations';

interface LanguageContextValue {
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => Promise<void>;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  categoryLabel: (cat: MuscleCategory) => string;
  muscleLabel: (id: MuscleSubGroupId, short?: boolean) => string;
  equipmentLabel: (eq: EquipmentType) => string;
  dayLabel: (dayId: string, short?: boolean) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  language: DEFAULT_APP_SETTINGS.language,
  setLanguage: async () => {},
  t: (key, params) => translateText('pl', key, params),
  categoryLabel: (cat) => getTranslatedCategory(cat, 'pl'),
  muscleLabel: (id, short) => getTranslatedMuscle(id, 'pl', short),
  equipmentLabel: (eq) => getTranslatedEquipment(eq, 'pl'),
  dayLabel: (dayId, short) => getTranslatedDay(dayId, 'pl', short),
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
          setLanguageState(settings.language);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const setLanguage = useCallback(async (next: AppLanguage) => {
    setLanguageState(next);
    try {
      await updateAppSettings({ language: next });
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

  const equipmentLabel = useCallback(
    (eq: EquipmentType) => getTranslatedEquipment(eq, language),
    [language]
  );

  const dayLabel = useCallback(
    (dayId: string, short: boolean = false) => getTranslatedDay(dayId, language, short),
    [language]
  );

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t,
        categoryLabel,
        muscleLabel,
        equipmentLabel,
        dayLabel,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext);
}
