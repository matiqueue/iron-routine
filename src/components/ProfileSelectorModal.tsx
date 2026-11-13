import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '../context/ThemeContext';
import { PlanTemplateKey, UserProfile } from '../types/workout';
import { PLAN_TEMPLATE_OPTIONS } from '../data/exerciseLibrary';
import {
  deleteProfile,
  exportProfileBackup,
  importProfileBackup,
  updateProfile,
} from '../services/storage';
import { InteractiveBottomSheet } from './InteractiveBottomSheet';

export interface CreateProfileOptions {
  height?: number;
  weight?: number;
  templateKey?: Exclude<PlanTemplateKey, 'clone_current'>;
}

interface ProfileSelectorModalProps {
  visible: boolean;
  profiles: UserProfile[];
  activeProfile: UserProfile | null;
  onSelectProfile: (profile: UserProfile) => void;
  onCreateProfile: (name: string, options?: CreateProfileOptions) => Promise<void>;
  onProfilesChanged?: (nextActiveProfile?: UserProfile | null) => Promise<void> | void;
  onClose: () => void;
}

export const ProfileSelectorModal: React.FC<ProfileSelectorModalProps> = ({
  visible,
  profiles,
  activeProfile,
  onSelectProfile,
  onCreateProfile,
  onProfilesChanged,
  onClose,
}) => {
  const { theme } = useAppTheme();
  const [newProfileName, setNewProfileName] = useState('');
  const [newHeight, setNewHeight] = useState('');
  const [newWeight, setNewWeight] = useState('');
  const [newTemplate, setNewTemplate] = useState<Exclude<PlanTemplateKey, 'clone_current'>>('blank');
  const [isCreating, setIsCreating] = useState(false);

  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [editNameText, setEditNameText] = useState('');

  const [showBackupPanel, setShowBackupPanel] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');

  const handleCreate = async () => {
    if (!newProfileName.trim()) return;
    try {
      const h = parseFloat(newHeight.replace(',', '.'));
      const w = parseFloat(newWeight.replace(',', '.'));
      await onCreateProfile(newProfileName.trim(), {
        height: !isNaN(h) && h > 0 ? h : undefined,
        weight: !isNaN(w) && w > 0 ? w : undefined,
        templateKey: newTemplate,
      });
      setNewProfileName('');
      setNewHeight('');
      setNewWeight('');
      setIsCreating(false);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveRename = async (profileId: string) => {
    const trimmed = editNameText.trim();
    if (!trimmed) return;
    const updated = await updateProfile(profileId, { name: trimmed });
    setEditingProfileId(null);
    await onProfilesChanged?.(updated.id === activeProfile?.id ? updated : undefined);
  };

  const handleDeleteProfile = (profile: UserProfile) => {
    const isLast = profiles.length <= 1;
    Alert.alert(
      'Usunąć profil?',
      isLast
        ? `Wszystkie plany, rekordy i historia profilu „${profile.name}” zostaną trwale usunięte, a aplikacja wróci do ekranu startowego.`
        : `Wszystkie plany, rekordy i historia profilu „${profile.name}” zostaną trwale usunięte.`,
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'Usuń profil',
          style: 'destructive',
          onPress: async () => {
            try {
              const fallback = await deleteProfile(profile.id);
              await onProfilesChanged?.(fallback);
              if (!fallback) {
                onClose();
              }
            } catch (e: any) {
              Alert.alert('Błąd', e?.message || 'Nie udało się usunąć profilu.');
            }
          },
        },
      ]
    );
  };

  const handleExportBackup = async () => {
    if (!activeProfile) return;
    try {
      const payload = await exportProfileBackup(activeProfile.id);
      const jsonStr = JSON.stringify(payload, null, 2);
      try {
        Haptics.selectionAsync();
      } catch {}
      await Share.share({
        message: jsonStr,
        title: `IronRoutine_${activeProfile.name.replace(/\s+/g, '_')}.json`,
      });
    } catch (e: any) {
      Alert.alert('Błąd eksportu', e?.message || 'Nie udało się wygenerować kopii.');
    }
  };

  const handleImportBackup = async (mode: 'create_new' | 'overwrite_active') => {
    if (!importJsonText.trim()) {
      Alert.alert('Brak danych', 'Wklej najpierw zawartość pliku JSON z kopią zapasową.');
      return;
    }
    try {
      const result = await importProfileBackup(importJsonText, mode);
      setImportJsonText('');
      setShowBackupPanel(false);
      await onProfilesChanged?.(result.profile);
      Alert.alert(
        'Zaimportowano kopię',
        `Profil: ${result.profile.name}\nPlany: ${result.plansCount} • Rekordy PR: ${result.prsCount}`
      );
    } catch (e: any) {
      Alert.alert('Błąd importu', e?.message || 'Nieprawidłowy format kopii JSON.');
    }
  };

  return (
    <InteractiveBottomSheet
      visible={visible}
      onClose={onClose}
      title="Profile & Kopia zapasowa"
      subtitle="Osobne plany treningowe, rekordy i eksport JSON"
      initialHeightPercent={0.82}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Profiles */}
          {profiles.map((profile) => {
            const isSelected = profile.id === activeProfile?.id;
            const isEditing = editingProfileId === profile.id;

            return (
              <View
                key={profile.id}
                style={[
                  styles.profileRowWrap,
                  { backgroundColor: theme.bgSecondary, borderColor: theme.border },
                  isSelected && { borderColor: theme.text, backgroundColor: theme.bgTertiary },
                ]}
              >
                <TouchableOpacity
                  style={styles.profileRowMain}
                  onPress={() => onSelectProfile(profile)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.avatar, { backgroundColor: isSelected ? theme.primary : theme.card }]}>
                    <Text style={[styles.avatarText, { color: isSelected ? theme.primaryText : theme.text }]}>
                      {profile.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={[styles.profileName, { color: theme.text }]}>{profile.name}</Text>
                    <Text style={[styles.profileStatus, { color: theme.textMuted }]}>
                      {profile.weight ? `${profile.weight} kg` : ''}
                      {profile.weight && profile.height ? ' • ' : ''}
                      {profile.height ? `${profile.height} cm` : ''}
                      {profile.weight || profile.height
                        ? ` • ${isSelected ? 'Aktywny' : 'Przełącz'}`
                        : isSelected
                        ? 'Aktywny profil'
                        : 'Dotknij, aby przełączyć'}
                    </Text>
                  </View>

                  <View style={styles.rowActions}>
                    <TouchableOpacity
                      style={styles.miniActionBtn}
                      onPress={() => {
                        if (isEditing) {
                          setEditingProfileId(null);
                        } else {
                          setEditingProfileId(profile.id);
                          setEditNameText(profile.name);
                        }
                      }}
                    >
                      <Ionicons name="pencil-outline" size={16} color={theme.textMuted} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.miniActionBtn}
                      onPress={() => handleDeleteProfile(profile)}
                    >
                      <Ionicons name="trash-outline" size={16} color={theme.textMuted} />
                    </TouchableOpacity>

                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={20} color={theme.text} />
                    )}
                  </View>
                </TouchableOpacity>

                {isEditing && (
                  <View style={[styles.inlineEditRow, { borderTopColor: theme.hairline }]}>
                    <TextInput
                      style={[
                        styles.editInput,
                        { backgroundColor: theme.card, borderColor: theme.border, color: theme.text },
                      ]}
                      value={editNameText}
                      onChangeText={setEditNameText}
                      placeholder="Nowa nazwa profilu"
                      placeholderTextColor={theme.textMuted}
                    />
                    <TouchableOpacity
                      style={[styles.confirmBtn, { backgroundColor: theme.primary }]}
                      onPress={() => handleSaveRename(profile.id)}
                    >
                      <Text style={[styles.confirmBtnText, { color: theme.primaryText }]}>OK</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}

          {/* Add Profile */}
          {isCreating ? (
            <View style={[styles.createBox, { backgroundColor: theme.bgSecondary, borderColor: theme.border, borderWidth: 1 }]}>
              <Text style={[styles.boxKicker, { color: theme.textMuted }]}>NOWY UŻYTKOWNIK</Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: theme.card, color: theme.text, borderColor: theme.border },
                ]}
                placeholder="Imię lub pseudonim..."
                placeholderTextColor={theme.textMuted}
                value={newProfileName}
                onChangeText={setNewProfileName}
                autoFocus
              />

              <View style={styles.statsInputRow}>
                <TextInput
                  style={[
                    styles.input,
                    { flex: 1, backgroundColor: theme.card, color: theme.text, borderColor: theme.border },
                  ]}
                  placeholder="Wzrost (cm)"
                  placeholderTextColor={theme.textMuted}
                  keyboardType="number-pad"
                  value={newHeight}
                  onChangeText={setNewHeight}
                />
                <TextInput
                  style={[
                    styles.input,
                    { flex: 1, backgroundColor: theme.card, color: theme.text, borderColor: theme.border },
                  ]}
                  placeholder="Waga (kg)"
                  placeholderTextColor={theme.textMuted}
                  keyboardType="decimal-pad"
                  value={newWeight}
                  onChangeText={setNewWeight}
                />
              </View>

              <Text style={[styles.boxKicker, { color: theme.textMuted, marginTop: 2 }]}>
                PLAN STARTOWY
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 6, marginBottom: 12 }}
              >
                {PLAN_TEMPLATE_OPTIONS.map((tpl) => {
                  const selected = newTemplate === tpl.id;
                  return (
                    <TouchableOpacity
                      key={tpl.id}
                      style={[
                        styles.tplPill,
                        {
                          backgroundColor: selected ? theme.primary : theme.card,
                          borderColor: selected ? theme.primary : theme.border,
                        },
                      ]}
                      onPress={() => setNewTemplate(tpl.id as Exclude<PlanTemplateKey, 'clone_current'>)}
                    >
                      <Text
                        style={[
                          styles.tplPillText,
                          { color: selected ? theme.primaryText : theme.text },
                        ]}
                      >
                        {tpl.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <View style={styles.createActions}>
                <TouchableOpacity
                  style={[styles.cancelBtn, { borderColor: theme.border }]}
                  onPress={() => {
                    setIsCreating(false);
                    setNewProfileName('');
                  }}
                >
                  <Text style={[styles.cancelBtnText, { color: theme.textMuted }]}>Anuluj</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.confirmBtn,
                    { backgroundColor: theme.primary },
                    !newProfileName.trim() && { opacity: 0.4 },
                  ]}
                  onPress={handleCreate}
                  disabled={!newProfileName.trim()}
                >
                  <Text style={[styles.confirmBtnText, { color: theme.primaryText }]}>Utwórz profil</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.addBtn, { borderColor: theme.borderDark }]}
              onPress={() => setIsCreating(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={18} color={theme.text} />
              <Text style={[styles.addBtnText, { color: theme.text }]}>Utwórz nowy profil</Text>
            </TouchableOpacity>
          )}

          {/* Offline JSON Backup Section */}
          <View style={[styles.backupSection, { borderTopColor: theme.hairline }]}>
            <Text style={[styles.boxKicker, { color: theme.textMuted }]}>
              KOPIA ZAPASOWA OFFLINE (JSON)
            </Text>

            <View style={styles.backupActionsRow}>
              <TouchableOpacity
                style={[styles.backupBtn, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}
                onPress={handleExportBackup}
                activeOpacity={0.75}
              >
                <Ionicons name="share-outline" size={16} color={theme.text} />
                <Text style={[styles.backupBtnText, { color: theme.text }]}>Eksportuj dane</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.backupBtn, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}
                onPress={() => setShowBackupPanel((prev) => !prev)}
                activeOpacity={0.75}
              >
                <Ionicons name="download-outline" size={16} color={theme.text} />
                <Text style={[styles.backupBtnText, { color: theme.text }]}>
                  {showBackupPanel ? 'Zamknij import' : 'Importuj JSON'}
                </Text>
              </TouchableOpacity>
            </View>

            {showBackupPanel && (
              <View style={[styles.importBox, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
                <TextInput
                  style={[
                    styles.importTextarea,
                    { backgroundColor: theme.card, borderColor: theme.border, color: theme.text },
                  ]}
                  placeholder="Wklej tutaj kod JSON wyeksportowany wcześniej z Iron Routine..."
                  placeholderTextColor={theme.textMuted}
                  multiline
                  value={importJsonText}
                  onChangeText={setImportJsonText}
                />

                <View style={styles.importBtnsRow}>
                  <TouchableOpacity
                    style={[styles.importActionBtn, { borderColor: theme.border, backgroundColor: theme.card }]}
                    onPress={() => handleImportBackup('overwrite_active')}
                  >
                    <Text style={[styles.importActionText, { color: theme.text }]}>
                      Nadpisz obecny
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.importActionBtn, { backgroundColor: theme.primary, borderColor: theme.primary }]}
                    onPress={() => handleImportBackup('create_new')}
                  >
                    <Text style={[styles.importActionText, { color: theme.primaryText }]}>
                      Importuj jako nowy
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </InteractiveBottomSheet>
  );
};

const styles = StyleSheet.create({
  list: {
    maxHeight: 280,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '800',
  },
  profileName: {
    fontSize: 15,
    fontWeight: '700',
  },
  profileStatus: {
    fontSize: 12,
    marginTop: 2,
  },
  createBox: {
    padding: 14,
    borderRadius: 14,
    marginTop: 8,
    marginBottom: 16,
  },
  input: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
    marginBottom: 10,
  },
  createActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  cancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
  },
  cancelBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  confirmBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  confirmBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginTop: 8,
    marginBottom: 20,
  },
  addBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  profileRowWrap: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
    overflow: 'hidden',
  },
  profileRowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  miniActionBtn: {
    padding: 4,
  },
  inlineEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  editInput: {
    flex: 1,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    fontSize: 13,
  },
  boxKicker: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.7,
    marginBottom: 8,
  },
  statsInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tplPill: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  tplPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  backupSection: {
    marginTop: 12,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  backupActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  backupBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
  },
  backupBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  importBox: {
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  importTextarea: {
    minHeight: 90,
    maxHeight: 150,
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    fontSize: 12,
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  importBtnsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  importActionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  importActionText: {
    fontSize: 12,
    fontWeight: '800',
  },
});
