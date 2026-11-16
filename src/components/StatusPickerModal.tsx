import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { triggerNotificationHaptic, triggerSelectionHaptic } from '../services/haptics';
import { BottomSheetScrollView, InteractiveBottomSheet } from './InteractiveBottomSheet';

interface StatusPickerModalProps {
  visible: boolean;
  nickname: string;
  currentStatus?: string;
  onClose: () => void;
  onSaveStatus: (nextStatus: string) => Promise<void> | void;
}

const PRESET_ICONS: Array<{ icon: keyof typeof Ionicons.glyphMap; color: string }> = [
  { icon: 'flame', color: '#F59E0B' },
  { icon: 'trophy', color: '#FACC15' },
  { icon: 'moon', color: '#38BDF8' },
  { icon: 'barbell', color: '#10B981' },
];

export const StatusPickerModal: React.FC<StatusPickerModalProps> = ({
  visible,
  nickname,
  currentStatus = '',
  onClose,
  onSaveStatus,
}) => {
  const { theme, isDark } = useAppTheme();
  const { t } = useLanguage();
  const [draft, setDraft] = useState(currentStatus);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setDraft(currentStatus || '');
    }
  }, [visible, currentStatus]);

  const presets = [
    t('friendsStatusPreset1'),
    t('friendsStatusPreset2'),
    t('friendsStatusPreset3'),
    t('friendsStatusPreset4'),
  ];

  const handleApply = async (val: string) => {
    if (saving) return;
    setSaving(true);
    triggerNotificationHaptic('success');
    try {
      await onSaveStatus(val.trim());
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <InteractiveBottomSheet
      visible={visible}
      onClose={onClose}
      title={t('friendsStatusChipHint')}
      subtitle={`@${nickname}`}
      initialHeightPercent={0.68}
    >
      <BottomSheetScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Live Preview Pill */}
        <View
          style={[
            styles.previewBox,
            {
              backgroundColor: isDark ? 'rgba(24,24,28,0.9)' : theme.bgSecondary,
              borderColor: theme.border,
            },
          ]}
        >
          <View style={styles.liveDot} />
          <Text style={[styles.previewNick, { color: '#10B981' }]}>@{nickname}</Text>
          <Text style={[styles.previewText, { color: theme.text }]} numberOfLines={1}>
            {draft.trim() || t('statusNotePlaceholder')}
          </Text>
        </View>

        {/* Custom Status Input */}
        <Text style={[styles.eyebrow, { color: theme.textMuted }]}>{t('statusNoteUpper')}</Text>
        <View
          style={[
            styles.inputRow,
            {
              backgroundColor: theme.bgSecondary,
              borderColor: theme.border,
            },
          ]}
        >
          <TextInput
            style={[styles.input, { color: theme.text }]}
            placeholder={t('statusNotePlaceholder')}
            placeholderTextColor={theme.textMuted}
            value={draft}
            onChangeText={setDraft}
            maxLength={48}
            returnKeyType="done"
            onSubmitEditing={() => handleApply(draft)}
          />
          {draft.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                triggerSelectionHaptic();
                setDraft('');
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={18} color={theme.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Quick Preset Grid */}
        <View style={styles.presetsGrid}>
          {presets.map((preset, idx) => {
            const visual = PRESET_ICONS[idx % PRESET_ICONS.length];
            const isSelected = draft.trim() === preset;
            return (
              <TouchableOpacity
                key={preset}
                style={[
                  styles.presetCard,
                  {
                    backgroundColor: isSelected
                      ? `${visual.color}1E`
                      : theme.bgSecondary,
                    borderColor: isSelected ? visual.color : theme.border,
                  },
                ]}
                onPress={() => handleApply(preset)}
                activeOpacity={0.8}
              >
                <View style={[styles.presetIconWrap, { backgroundColor: `${visual.color}20` }]}>
                  <Ionicons name={visual.icon} size={16} color={visual.color} />
                </View>
                <Text
                  style={[styles.presetLabel, { color: theme.text }]}
                  numberOfLines={2}
                >
                  {preset}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Save / Clear Row */}
        <View style={styles.footerRow}>
          <TouchableOpacity
            style={[styles.clearBtn, { borderColor: theme.border, backgroundColor: theme.bgSecondary }]}
            onPress={() => handleApply('')}
            disabled={saving}
            activeOpacity={0.8}
          >
            <Text style={[styles.clearBtnText, { color: theme.textSecondary }]}>
              {t('cancel')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: theme.primary }]}
            onPress={() => handleApply(draft)}
            disabled={saving}
            activeOpacity={0.85}
          >
            <Text style={[styles.saveBtnText, { color: theme.primaryText }]}>{t('save')}</Text>
          </TouchableOpacity>
        </View>
      </BottomSheetScrollView>
    </InteractiveBottomSheet>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 28,
    gap: 12,
  },
  previewBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  previewNick: {
    fontSize: 12,
    fontWeight: '800',
  },
  previewText: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '600',
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
    marginTop: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  presetCard: {
    width: '48%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 15,
    borderWidth: 1,
  },
  presetIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetLabel: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '800',
  },
  footerRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  clearBtn: {
    paddingHorizontal: 18,
    height: 46,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  saveBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '800',
  },
});
