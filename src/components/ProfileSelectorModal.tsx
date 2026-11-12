import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '../context/ThemeContext';
import { UserProfile } from '../types/workout';

interface ProfileSelectorModalProps {
  visible: boolean;
  profiles: UserProfile[];
  activeProfile: UserProfile;
  onSelectProfile: (profile: UserProfile) => void;
  onCreateProfile: (name: string) => Promise<void>;
  onClose: () => void;
}

export const ProfileSelectorModal: React.FC<ProfileSelectorModalProps> = ({
  visible,
  profiles,
  activeProfile,
  onSelectProfile,
  onCreateProfile,
  onClose,
}) => {
  const { theme, isDark } = useAppTheme();
  const [newProfileName, setNewProfileName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!newProfileName.trim()) return;
    try {
      await onCreateProfile(newProfileName.trim());
      setNewProfileName('');
      setIsCreating(false);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <View style={[styles.sheet, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: theme.text }]}>Wybierz profil</Text>
              <Text style={[styles.subtitle, { color: theme.textMuted }]}>
                Osobna historia i rekordy siłowe
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: theme.bgSecondary }]}
            >
              <Ionicons name="close" size={18} color={theme.text} />
            </TouchableOpacity>
          </View>

          {/* Profiles */}
          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {profiles.map((profile) => {
              const isSelected = profile.id === activeProfile?.id;

              return (
                <TouchableOpacity
                  key={profile.id}
                  style={[
                    styles.profileRow,
                    {
                      backgroundColor: isSelected ? theme.bgSecondary : 'transparent',
                      borderColor: isSelected ? theme.text : theme.hairline,
                    },
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    onSelectProfile(profile);
                    onClose();
                  }}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.avatar,
                      {
                        backgroundColor: isSelected ? theme.text : theme.bgTertiary,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.avatarText,
                        { color: isSelected ? theme.card : theme.text },
                      ]}
                    >
                      {profile.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>

                  <View style={styles.profileInfo}>
                    <View style={styles.nameRow}>
                      <Text style={[styles.profileName, { color: theme.text }]}>
                        {profile.name}
                      </Text>
                      {profile.isOwner ? (
                        <View style={[styles.ownerBadge, { backgroundColor: theme.bgTertiary }]}>
                          <Text style={[styles.ownerBadgeText, { color: theme.textSecondary }]}>
                            GŁÓWNY
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={[styles.profileStatus, { color: theme.textMuted }]}>
                      {profile.weight ? `${profile.weight} kg` : ''}
                      {profile.weight && profile.height ? ' • ' : ''}
                      {profile.height ? `${profile.height} cm` : ''}
                      {profile.weight || profile.height ? ` • ${isSelected ? 'Aktywny' : 'Przełącz'}` : isSelected ? 'Aktywny profil' : 'Dotknij, aby przełączyć'}
                    </Text>
                  </View>

                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={20} color={theme.text} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Add Profile */}
          {isCreating ? (
            <View style={[styles.createBox, { backgroundColor: theme.bgSecondary }]}>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: theme.card, color: theme.text, borderColor: theme.border },
                ]}
                placeholder="Imię nowego profilu..."
                placeholderTextColor={theme.textMuted}
                value={newProfileName}
                onChangeText={setNewProfileName}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleCreate}
              />
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
                  <Text style={[styles.confirmBtnText, { color: theme.primaryText }]}>Zapisz</Text>
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
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 42 : 24,
    borderTopWidth: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    maxHeight: 260,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
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
  profileInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profileName: {
    fontSize: 15,
    fontWeight: '700',
  },
  ownerBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  ownerBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  profileStatus: {
    fontSize: 11,
    marginTop: 2,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginTop: 8,
  },
  addBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  createBox: {
    padding: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  input: {
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  createActions: {
    flexDirection: 'row',
    gap: 8,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 8,
  },
  confirmBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
