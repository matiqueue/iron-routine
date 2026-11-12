import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { THEME } from '../constants/theme';

interface BetaStatusModalProps {
  visible: boolean;
  onClose: () => void;
}

export const BetaStatusModal: React.FC<BetaStatusModalProps> = ({ visible, onClose }) => {
  const [testStatus, setTestStatus] = useState<string | null>(null);

  const runDiagnostics = async () => {
    try {
      setTestStatus('Testowanie pamięci lokalnej...');
      const testKey = '@beta_diag_test';
      await AsyncStorage.setItem(testKey, JSON.stringify({ ts: Date.now(), ok: true }));
      const retrieved = await AsyncStorage.getItem(testKey);
      await AsyncStorage.removeItem(testKey);

      if (!retrieved) throw new Error('AsyncStorage read/write failed');

      setTestStatus('Test wibracji i silnika Taptic Engine...');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      setTestStatus('✅ Wszystkie testy lokalne zaliczone pomyślnie!');
    } catch (err: any) {
      setTestStatus(`❌ Błąd testu: ${err.message}`);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <View style={styles.betaTag}>
              <Text style={styles.betaTagText}>BETA v1.0</Text>
            </View>
            <Text style={styles.title}>Diagnostyka & Zgrywanie</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
            <Ionicons name="close" size={24} color={THEME.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {/* Status Cards */}
          <View style={styles.statusBox}>
            <View style={styles.statusRow}>
              <Ionicons name="phone-portrait-outline" size={20} color={THEME.colors.primary} />
              <View style={styles.statusTextCol}>
                <Text style={styles.statusLabel}>Praca offline (bez kabla i Maca)</Text>
                <Text style={styles.statusValue}>
                  Kompilacja Release zawiera cały kod JS w aplikacji – telefon nie szuka komputera.
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.statusRow}>
              <Ionicons name="server-outline" size={20} color={THEME.colors.accentBlue} />
              <View style={styles.statusTextCol}>
                <Text style={styles.statusLabel}>Konto Apple Developer ($0 zł)</Text>
                <Text style={styles.statusValue}>
                  Personal Team (darmowe konto Apple ID). Certyfikat działa 7 dni, odnawiany kliknięciem Run.
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.statusRow}>
              <Ionicons name="save-outline" size={20} color={THEME.colors.accentOrange} />
              <View style={styles.statusTextCol}>
                <Text style={styles.statusLabel}>Baza danych urządzenia</Text>
                <Text style={styles.statusValue}>
                  AsyncStorage (100% lokalnie na iPhonie, bez chmury).
                </Text>
              </View>
            </View>
          </View>

          {/* Test Button */}
          <TouchableOpacity
            style={styles.testBtn}
            activeOpacity={0.8}
            onPress={runDiagnostics}
          >
            <Ionicons name="flash-outline" size={18} color="#000" />
            <Text style={styles.testBtnText}>Przetestuj Taptic Engine & Zapis danych</Text>
          </TouchableOpacity>

          {testStatus ? (
            <View style={styles.testResultBox}>
              <Text style={styles.testResultText}>{testStatus}</Text>
            </View>
          ) : null}

          {/* How to deploy step by step */}
          <Text style={styles.sectionHeader}>Jak zgrać na iPhone bez kabla na zawsze?</Text>

          <View style={styles.stepCard}>
            <View style={styles.stepNumberBadge}>
              <Text style={styles.stepNumberText}>1</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Włącz Tryb Dewelopera w iPhone</Text>
              <Text style={styles.stepDesc}>
                Ustawienia ➔ Prywatność i ochrona ➔ Tryb dewelopera (na samym dole) ➔ Włącz i zrestartuj iPhone.
              </Text>
            </View>
          </View>

          <View style={styles.stepCard}>
            <View style={styles.stepNumberBadge}>
              <Text style={styles.stepNumberText}>2</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Podłącz iPhone do Maca</Text>
              <Text style={styles.stepDesc}>
                Podepnij kabel (lub upewnij się, że iPhone jest w tej samej sieci Wi-Fi i odblokowany).
              </Text>
            </View>
          </View>

          <View style={styles.stepCard}>
            <View style={styles.stepNumberBadge}>
              <Text style={styles.stepNumberText}>3</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Uruchom komendę Release</Text>
              <Text style={styles.stepDesc}>
                W terminalu projektu wpisz:
              </Text>
              <View style={styles.codeSnippet}>
                <Text style={styles.codeText}>npm run ios:release</Text>
              </View>
              <Text style={styles.stepDesc}>
                lub otwórz folder <Text style={{ color: THEME.colors.primary }}>ios</Text> w Xcode i wybierz Scheme: <Text style={{ color: THEME.colors.primary }}>Release</Text>.
              </Text>
            </View>
          </View>

          <View style={styles.stepCard}>
            <View style={styles.stepNumberBadge}>
              <Text style={styles.stepNumberText}>4</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Zaufaj certyfikatowi na iPhone</Text>
              <Text style={styles.stepDesc}>
                Po instalacji na telefonie: Ustawienia ➔ Ogólne ➔ VPN i zarządzanie urządzeniem ➔ Wybierz swój Apple ID ➔ Zaufaj.
              </Text>
            </View>
          </View>

          <View style={styles.finalTip}>
            <Ionicons name="checkmark-circle" size={20} color={THEME.colors.primary} />
            <Text style={styles.finalTipText}>
              Gotowe! Odłączasz kabel, a aplikacja działa w 100% offline na siłowni bez Maca!
            </Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: THEME.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  betaTag: {
    backgroundColor: THEME.colors.accentOrangeGlow,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: THEME.radius.xs,
    borderWidth: 1,
    borderColor: THEME.colors.accentOrange,
  },
  betaTagText: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.accentOrange,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  closeBtn: {
    padding: 6,
  },
  content: {
    padding: THEME.spacing.lg,
    paddingBottom: 40,
  },
  statusBox: {
    backgroundColor: THEME.colors.bgCard,
    borderRadius: THEME.radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  statusTextCol: {
    flex: 1,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  statusValue: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginTop: 2,
    lineHeight: 17,
  },
  divider: {
    height: 1,
    backgroundColor: THEME.colors.border,
    marginVertical: 12,
  },
  testBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.primary,
    paddingVertical: 12,
    borderRadius: THEME.radius.md,
    gap: 8,
    marginBottom: 12,
  },
  testBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
  },
  testResultBox: {
    backgroundColor: THEME.colors.bgCardElevated,
    padding: 12,
    borderRadius: THEME.radius.md,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  testResultText: {
    fontSize: 13,
    color: THEME.colors.text,
    textAlign: 'center',
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.colors.text,
    marginTop: 10,
    marginBottom: 14,
  },
  stepCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: THEME.colors.bgCard,
    padding: 14,
    borderRadius: THEME.radius.md,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    gap: 12,
  },
  stepNumberBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: THEME.colors.bgCardElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
  },
  stepNumberText: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.colors.primary,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.text,
    marginBottom: 4,
  },
  stepDesc: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    lineHeight: 18,
  },
  codeSnippet: {
    backgroundColor: '#000',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: THEME.radius.xs,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
  },
  codeText: {
    fontFamily: 'Courier',
    fontSize: 12,
    color: THEME.colors.primary,
  },
  finalTip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.primaryGlow,
    padding: 14,
    borderRadius: THEME.radius.md,
    gap: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: THEME.colors.primary,
  },
  finalTipText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.text,
    flex: 1,
    lineHeight: 18,
  },
});
