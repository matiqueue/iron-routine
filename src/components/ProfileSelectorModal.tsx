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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '../context/ThemeContext';
import { UserProfile } from '../types/workout';
import { InteractiveBottomSheet } from './InteractiveBottomSheet';

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
    <InteractiveBottomSheet
      visible={visible}
      onClose={onClose}
      title="Wybierz profil"
      subtitle="Osobna historia i rekordy siłowe"
      initialHeightPercent={0.65}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, paddingHorizontal: 20, paddingTop: 16 }}
      >
        {/* Profiles */}
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {profiles.map((profile) => {
            const isSelected = profile.id === activeProfile?.id;

            return (
              <TouchableOpacity
                key={profile.id}
                style={[
                  styles.profileRow,
                  { backgroundColor: theme.bgSecondary, borderColor: theme.border },
                  isSelected && { borderColor: theme.text, backgroundColor: theme.bgTertiary },
                ]}
                onPress={() => onSelectProfile(profile)}
                activeOpacity={0.7}
              >
                <View style={[styles.avatar, { backgroundColor: isSelected ? theme.primary : theme.card }]}>
                  <Text style={[styles.avatarText, { color: isSelected ? theme.primaryText : theme.text }]}>
                    {profile.name.charAt(0).toUpperCase()}
                  </Text>
                </View>

                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[styles.profileName, { color: theme.text }]}>{profile.name}</Text>
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
});
