import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '../context/ThemeContext';
import { PlanTemplateKey, UserProfile } from '../types/workout';
import { PLAN_TEMPLATE_OPTIONS } from '../data/exerciseLibrary';
import { createProfile, importProfileBackup } from '../services/storage';

interface OnboardingScreenProps {
  onCompleted: (profile: UserProfile) => Promise<void> | void;
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onCompleted }) => {
  const { theme, isDark, toggleTheme } = useAppTheme();

  const [name, setName] = useState('');
  const [weightText, setWeightText] = useState('');
  const [heightText, setHeightText] = useState('');
  const [templateKey, setTemplateKey] =
    useState<Exclude<PlanTemplateKey, 'clone_current'>>('blank');
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleStart = async () => {
    if (isSubmitting) return;
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Podaj nazwę profilu', 'Wpisz swoje imię lub pseudonim, aby utworzyć profil.');
      return;
    }

    setIsSubmitting(true);
    try {
      const parsedWeight = parseFloat(weightText.replace(',', '.'));
      const parsedHeight = parseFloat(heightText.replace(',', '.'));
      const profile = await createProfile(trimmed, {
        weight: !isNaN(parsedWeight) && parsedWeight > 0 ? parsedWeight : undefined,
        height: !isNaN(parsedHeight) && parsedHeight > 0 ? parsedHeight : undefined,
        templateKey,
      });
      await onCompleted(profile);
    } catch (e: any) {
      Alert.alert('Błąd', e?.message || 'Nie udało się utworzyć profilu.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkipBlank = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const profile = await createProfile('Mój Profil', { templateKey: 'blank' });
      await onCompleted(profile);
    } catch (e: any) {
      Alert.alert('Błąd', e?.message || 'Nie udało się utworzyć pustego profilu.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImportJson = async () => {
    if (isSubmitting) return;
    if (!importText.trim()) {
      Alert.alert('Brak danych', 'Wklej najpierw wyeksportowaną kopię zapasową JSON.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await importProfileBackup(importText, 'create_new');
      await onCompleted(result.profile);
    } catch (e: any) {
      Alert.alert('Błąd importu', e?.message || 'Nieprawidłowy format JSON.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topRow}>
          <View style={styles.brandRow}>
            <View style={[styles.logoBox, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
              <Ionicons name="barbell-outline" size={20} color={theme.text} />
            </View>
            <View>
              <Text style={[styles.brandTitle, { color: theme.text }]}>IRON ROUTINE</Text>
              <Text style={[styles.brandSub, { color: theme.textMuted }]}>
                CZYSTY START • 100% OFFLINE
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.themeBtn, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}
            onPress={() => {
              try {
                Haptics.selectionAsync();
              } catch {}
              toggleTheme();
            }}
            activeOpacity={0.7}
            accessibilityLabel="Przełącz motyw"
          >
            <Ionicons
              name={isDark ? 'sunny-outline' : 'moon-outline'}
              size={18}
              color={theme.text}
            />
          </TouchableOpacity>
        </View>

        <Text style={[styles.heroHeadline, { color: theme.text }]}>
          Zacznij od zera lub ułóż własny plan.
        </Text>
        <Text style={[styles.heroCopy, { color: theme.textSecondary }]}>
          Wszystkie dane zostają lokalnie na Twoim urządzeniu. Utwórz swój pierwszy profil, żeby rozpocząć treningi i śledzić rekordy.
        </Text>

        {/* Main Create Card */}
        <View style={[styles.card, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
          <Text style={[styles.kicker, { color: theme.textMuted }]}>TWÓJ PROFIL</Text>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: theme.card, borderColor: theme.border, color: theme.text },
            ]}
            placeholder="Imię lub nazwa profilu..."
            placeholderTextColor={theme.textMuted}
            value={name}
            onChangeText={setName}
            returnKeyType="done"
          />

          <View style={styles.twoCols}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>Waga (opcjonalnie)</Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: theme.card, borderColor: theme.border, color: theme.text },
                ]}
                placeholder="np. 75 kg"
                placeholderTextColor={theme.textMuted}
                keyboardType="decimal-pad"
                value={weightText}
                onChangeText={setWeightText}
              />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>Wzrost (opcjonalnie)</Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: theme.card, borderColor: theme.border, color: theme.text },
                ]}
                placeholder="np. 180 cm"
                placeholderTextColor={theme.textMuted}
                keyboardType="number-pad"
                value={heightText}
                onChangeText={setHeightText}
              />
            </View>
          </View>

          <Text style={[styles.kicker, { color: theme.textMuted, marginTop: 4 }]}>
            PLAN NA START
          </Text>
          <View style={styles.templatesWrap}>
            {PLAN_TEMPLATE_OPTIONS.map((tpl) => {
              const selected = templateKey === tpl.id;
              return (
                <TouchableOpacity
                  key={tpl.id}
                  style={[
                    styles.templateCard,
                    {
                      backgroundColor: selected ? theme.primary : theme.card,
                      borderColor: selected ? theme.primary : theme.border,
                    },
                  ]}
                  onPress={() => {
                    try {
                      Haptics.selectionAsync();
                    } catch {}
                    setTemplateKey(tpl.id as Exclude<PlanTemplateKey, 'clone_current'>);
                  }}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      styles.templateTitle,
                      { color: selected ? theme.primaryText : theme.text },
                    ]}
                  >
                    {tpl.label}
                  </Text>
                  <Text
                    style={[
                      styles.templateSub,
                      { color: selected ? theme.primaryText : theme.textMuted, opacity: selected ? 0.85 : 1 },
                    ]}
                  >
                    {tpl.subtitle}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={[
              styles.primaryBtn,
              { backgroundColor: theme.primary, opacity: isSubmitting ? 0.65 : 1 },
            ]}
            onPress={handleStart}
            disabled={isSubmitting}
            activeOpacity={0.8}
          >
            <Text style={[styles.primaryBtnText, { color: theme.primaryText }]}>
              Utwórz profil i wejdź
            </Text>
            <Ionicons name="arrow-forward" size={18} color={theme.primaryText} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.skipBtn}
            onPress={handleSkipBlank}
            disabled={isSubmitting}
            activeOpacity={0.7}
          >
            <Text style={[styles.skipBtnText, { color: theme.textMuted }]}>
              Pomiń — wejdź od razu z pustym kontem
            </Text>
          </TouchableOpacity>
        </View>

        {/* JSON Import Toggle */}
        <TouchableOpacity
          style={[styles.importToggle, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}
          onPress={() => setShowImport((v) => !v)}
          activeOpacity={0.75}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Ionicons name="download-outline" size={18} color={theme.text} />
            <Text style={[styles.importToggleText, { color: theme.text }]}>
              Przywróć profil z kopii JSON
            </Text>
          </View>
          <Ionicons
            name={showImport ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={theme.textMuted}
          />
        </TouchableOpacity>

        {showImport && (
          <View style={[styles.card, { backgroundColor: theme.bgSecondary, borderColor: theme.border, marginTop: 10 }]}>
            <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>
              Wklej zawartość wyeksportowanego pliku JSON:
            </Text>
            <TextInput
              style={[
                styles.importTextArea,
                { backgroundColor: theme.card, borderColor: theme.border, color: theme.text },
              ]}
              placeholder='{"app":"iron-routine",...}'
              placeholderTextColor={theme.textMuted}
              value={importText}
              onChangeText={setImportText}
              multiline
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: theme.primary }]}
              onPress={handleImportJson}
              disabled={isSubmitting}
              activeOpacity={0.8}
            >
              <Ionicons name="cloud-download-outline" size={18} color={theme.primaryText} />
              <Text style={[styles.primaryBtnText, { color: theme.primaryText }]}>
                Zaimportuj profil
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 48,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 26,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  brandSub: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 2,
  },
  themeBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroHeadline: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
    lineHeight: 34,
    marginBottom: 8,
  },
  heroCopy: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 22,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    marginBottom: 14,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 12,
  },
  twoCols: {
    flexDirection: 'row',
    gap: 10,
  },
  templatesWrap: {
    gap: 8,
    marginBottom: 16,
  },
  templateCard: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  templateTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  templateSub: {
    fontSize: 12,
    marginTop: 2,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 15,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '800',
  },
  skipBtn: {
    alignItems: 'center',
    paddingTop: 14,
    paddingBottom: 2,
  },
  skipBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  importToggle: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  importToggleText: {
    fontSize: 14,
    fontWeight: '700',
  },
  importTextArea: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    minHeight: 110,
    fontSize: 12,
    marginBottom: 12,
  },
});
