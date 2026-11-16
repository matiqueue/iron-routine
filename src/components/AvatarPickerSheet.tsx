import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { triggerNotificationHaptic, triggerSelectionHaptic } from '../services/haptics';
import { InteractiveBottomSheet, BottomSheetScrollView } from './InteractiveBottomSheet';
import { UserAvatarBadge } from './UserAvatarBadge';

interface AvatarPickerSheetProps {
  visible: boolean;
  displayName: string;
  currentAvatarUrl?: string | null;
  cloudAvatarUrl?: string | null;
  onSelectAvatar: (nextUrl: string | null) => Promise<void> | void;
  onClose: () => void;
  allowSkip?: boolean;
}

export async function pickSquareAvatarFromGallery(deniedMsg: string): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('', deniedMsg);
    return null;
  }

  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.3,
    base64: true,
  });

  if (res.canceled || !res.assets || res.assets.length === 0) {
    return null;
  }

  const asset = res.assets[0];
  if (asset.base64) {
    const mime = asset.mimeType || 'image/jpeg';
    return `data:${mime};base64,${asset.base64}`;
  }
  return asset.uri || null;
}

export const AvatarPickerSheet: React.FC<AvatarPickerSheetProps> = ({
  visible,
  displayName,
  currentAvatarUrl,
  cloudAvatarUrl,
  onSelectAvatar,
  onClose,
  allowSkip = false,
}) => {
  const { theme } = useAppTheme();
  const { t } = useLanguage();
  const [draftUrl, setDraftUrl] = useState<string | null>(
    currentAvatarUrl ?? cloudAvatarUrl ?? null
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setDraftUrl(currentAvatarUrl ?? cloudAvatarUrl ?? null);
    }
  }, [visible, currentAvatarUrl, cloudAvatarUrl]);

  const handlePickGallery = async () => {
    triggerSelectionHaptic();
    const picked = await pickSquareAvatarFromGallery(t('avatarPermDeniedBody'));
    if (picked) {
      setDraftUrl(picked);
    }
  };

  const handleConfirm = async (valueToSave: string | null) => {
    if (saving) return;
    setSaving(true);
    try {
      await onSelectAvatar(valueToSave);
      triggerNotificationHaptic('success');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <InteractiveBottomSheet
      visible={visible}
      onClose={onClose}
      title={t('avatarSetupTitle')}
      subtitle={t('avatarSetupSub')}
      initialHeightPercent={0.62}
    >
      <BottomSheetScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.previewWrap}>
          <UserAvatarBadge
            avatarUrl={draftUrl}
            displayName={displayName}
            avatarColor="#10B981"
            size={92}
            ringColor="#10B981"
          />
          <Text style={[styles.previewHint, { color: theme.textSecondary }]}>
            {t('avatarSectionHint')}
          </Text>
        </View>

        <View style={styles.actionsList}>
          <TouchableOpacity
            style={[styles.optBtn, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}
            onPress={handlePickGallery}
            activeOpacity={0.8}
          >
            <Ionicons name="images-outline" size={18} color="#38BDF8" />
            <Text style={[styles.optText, { color: theme.text }]}>{t('avatarPickGalleryBtn')}</Text>
          </TouchableOpacity>

          {cloudAvatarUrl ? (
            <TouchableOpacity
              style={[
                styles.optBtn,
                {
                  backgroundColor:
                    draftUrl === cloudAvatarUrl ? 'rgba(16,185,129,0.14)' : theme.bgSecondary,
                  borderColor: draftUrl === cloudAvatarUrl ? '#10B981' : theme.border,
                },
              ]}
              onPress={() => {
                triggerSelectionHaptic();
                setDraftUrl(cloudAvatarUrl);
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="cloud-outline" size={18} color="#10B981" />
              <Text style={[styles.optText, { color: theme.text }]}>{t('avatarUseCloudBtn')}</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={[
              styles.optBtn,
              {
                backgroundColor: draftUrl === null ? 'rgba(168,85,247,0.12)' : theme.bgSecondary,
                borderColor: draftUrl === null ? '#A855F7' : theme.border,
              },
            ]}
            onPress={() => {
              triggerSelectionHaptic();
              setDraftUrl(null);
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="person-circle-outline" size={18} color="#A855F7" />
            <Text style={[styles.optText, { color: theme.text }]}>{t('avatarUseDefaultBtn')}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: theme.primary }]}
          onPress={() => handleConfirm(draftUrl)}
          disabled={saving}
          activeOpacity={0.86}
        >
          {saving ? (
            <ActivityIndicator size="small" color={theme.primaryText} />
          ) : (
            <Text style={[styles.saveBtnText, { color: theme.primaryText }]}>{t('save')}</Text>
          )}
        </TouchableOpacity>

        {allowSkip && (
          <TouchableOpacity
            style={styles.skipBtn}
            onPress={() => handleConfirm(null)}
            disabled={saving}
            activeOpacity={0.75}
          >
            <Text style={[styles.skipText, { color: theme.textMuted }]}>{t('avatarSkipBtn')}</Text>
          </TouchableOpacity>
        )}
      </BottomSheetScrollView>
    </InteractiveBottomSheet>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 34,
    gap: 16,
  },
  previewWrap: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  previewHint: {
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 18,
  },
  actionsList: {
    gap: 10,
  },
  optBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
  },
  optText: {
    fontSize: 14,
    fontWeight: '700',
  },
  saveBtn: {
    height: 48,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '900',
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  skipText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
