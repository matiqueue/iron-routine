import React, { useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { SUPPORTED_LANGUAGES } from '../i18n/translations';
import { AppLanguage } from '../types/workout';
import { triggerSelectionHaptic } from '../services/haptics';

interface LanguageSwitcherProps {
  /** 'pill' = compact button for onboarding top bar / headers; 'row' = settings list button */
  variant?: 'pill' | 'row';
  onLanguageChanged?: (lang: AppLanguage) => void;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  variant = 'pill',
  onLanguageChanged,
}) => {
  const { theme, isDark } = useAppTheme();
  const { language, setLanguage, t } = useLanguage();
  const [modalVisible, setModalVisible] = useState(false);

  const currentMeta =
    SUPPORTED_LANGUAGES.find((l) => l.code === language) || SUPPORTED_LANGUAGES[0];

  const handleSelect = async (code: AppLanguage) => {
    triggerSelectionHaptic();
    await setLanguage(code);
    onLanguageChanged?.(code);
    setModalVisible(false);
  };

  return (
    <>
      {variant === 'pill' ? (
        <TouchableOpacity
          style={[
            styles.compactPill,
            {
              backgroundColor: isDark
                ? 'rgba(255,255,255,0.08)'
                : 'rgba(24,24,27,0.06)',
              borderColor: theme.border,
            },
          ]}
          onPress={() => {
            triggerSelectionHaptic();
            setModalVisible(true);
          }}
          activeOpacity={0.78}
        >
          <Ionicons name="globe-outline" size={14} color={theme.text} />
          <Text style={[styles.compactPillText, { color: theme.text }]}>
            {currentMeta.short}
          </Text>
          <Ionicons name="chevron-down" size={12} color={theme.textMuted} />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.settingsRowBtn, { borderBottomColor: theme.hairline }]}
          onPress={() => {
            triggerSelectionHaptic();
            setModalVisible(true);
          }}
          activeOpacity={0.75}
        >
          <View style={styles.settingsRowLeft}>
            <Text style={[styles.settingsRowTitle, { color: theme.text }]}>
              {t('language')}
            </Text>
            <Text style={[styles.settingsRowSub, { color: theme.textSecondary }]}>
              {currentMeta.nativeName} · {t('languageSub')}
            </Text>
          </View>
          <View style={[styles.settingsBadge, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
            <Ionicons name="globe-outline" size={14} color={theme.text} />
            <Text style={[styles.settingsBadgeText, { color: theme.text }]}>
              {currentMeta.short}
            </Text>
            <Ionicons name="chevron-forward" size={13} color={theme.textMuted} />
          </View>
        </TouchableOpacity>
      )}

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setModalVisible(false)}>
          <View style={styles.backdrop}>
            <TouchableWithoutFeedback>
              <View
                style={[
                  styles.dialog,
                  {
                    backgroundColor: theme.card,
                    borderColor: theme.border,
                  },
                ]}
              >
                <View style={styles.dialogHeader}>
                  <View style={styles.dialogTitleRow}>
                    <Ionicons name="globe-outline" size={18} color={theme.text} />
                    <Text style={[styles.dialogTitle, { color: theme.text }]}>
                      {t('chooseLanguage')}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.closeCircle, { backgroundColor: theme.bgSecondary }]}
                    onPress={() => setModalVisible(false)}
                  >
                    <Ionicons name="close" size={16} color={theme.text} />
                  </TouchableOpacity>
                </View>

                <View style={styles.list}>
                  {SUPPORTED_LANGUAGES.map((item) => {
                    const active = item.code === language;
                    return (
                      <TouchableOpacity
                        key={item.code}
                        style={[
                          styles.langOption,
                          {
                            backgroundColor: active ? theme.primary : theme.bgSecondary,
                            borderColor: active ? theme.primary : theme.border,
                          },
                        ]}
                        onPress={() => handleSelect(item.code)}
                        activeOpacity={0.78}
                      >
                        <View style={styles.langLeft}>
                          <View
                            style={[
                              styles.codeBadge,
                              {
                                backgroundColor: active
                                  ? 'rgba(255,255,255,0.16)'
                                  : theme.card,
                                borderColor: active ? 'transparent' : theme.border,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.codeBadgeText,
                                { color: active ? theme.primaryText : theme.text },
                              ]}
                            >
                              {item.short}
                            </Text>
                          </View>
                          <Text
                            style={[
                              styles.langNative,
                              { color: active ? theme.primaryText : theme.text },
                            ]}
                          >
                            {item.nativeName}
                          </Text>
                        </View>
                        {active && (
                          <Ionicons
                            name="checkmark-circle"
                            size={20}
                            color={theme.primaryText}
                          />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  compactPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  compactPillText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  settingsRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  settingsRowLeft: {
    flex: 1,
    minWidth: 0,
  },
  settingsRowTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  settingsRowSub: {
    fontSize: 12,
    marginTop: 2,
  },
  settingsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  settingsBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 22,
  },
  dialog: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
  },
  dialogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  dialogTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dialogTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  closeCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    gap: 8,
  },
  langOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  langLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  codeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  codeBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  langNative: {
    fontSize: 15,
    fontWeight: '700',
  },
});
