import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { Exercise } from '../types/workout';
import { resolveCanonicalExerciseId } from '../data/exerciseLibrary';
import { getExerciseImagePair } from '../data/exerciseImages';
import { triggerSelectionHaptic } from '../services/haptics';

interface ExercisePreviewImageProps {
  exercise: Pick<Exercise, 'id' | 'name' | 'imageUrl' | 'equipment' | 'category'>;
  variant?: 'hero' | 'thumb';
  height?: number;
  size?: number;
  borderRadius?: number;
  interactive?: boolean;
}

export const ExercisePreviewImage: React.FC<ExercisePreviewImageProps> = React.memo(
  ({
    exercise,
    variant = 'hero',
    height = 216,
    size = 52,
    borderRadius = 12,
    interactive = true,
  }) => {
    const { theme, isDark } = useAppTheme();
    const { t, equipmentLabel } = useLanguage();

    const canonicalId = useMemo(
      () => resolveCanonicalExerciseId(exercise.id, exercise.name),
      [exercise.id, exercise.name]
    );

    const urls = useMemo(
      () => getExerciseImagePair(exercise, canonicalId),
      [exercise, canonicalId]
    );

    const [frameIdx, setFrameIdx] = useState<0 | 1>(0);
    const [loading, setLoading] = useState<boolean>(urls.length > 0);
    const [hasError, setHasError] = useState<boolean>(false);

    useEffect(() => {
      setFrameIdx(0);
      setHasError(false);
      setLoading(urls.length > 0);
    }, [canonicalId, exercise.imageUrl, urls.length]);

    const activeUrl = urls[frameIdx] || urls[0] || '';
    const hasTwoFrames = urls.length >= 2 && !hasError;

    if (variant === 'thumb') {
      return (
        <View
          style={[
            styles.thumbWrap,
            {
              width: size,
              height: size,
              borderRadius,
              backgroundColor: isDark ? '#18181B' : '#F1F5F9',
              borderColor: theme.border,
            },
          ]}
        >
          {activeUrl && !hasError ? (
            <Image
              source={{ uri: activeUrl }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
              onError={() => setHasError(true)}
            />
          ) : (
            <Ionicons name="barbell-outline" size={Math.round(size * 0.42)} color={theme.textMuted} />
          )}
        </View>
      );
    }

    const toggleFrame = () => {
      if (!hasTwoFrames || !interactive) return;
      triggerSelectionHaptic();
      setFrameIdx((prev) => (prev === 0 ? 1 : 0));
    };

    return (
      <View
        style={[
          styles.heroWrap,
          {
            height,
            borderRadius,
            backgroundColor: isDark ? '#111318' : '#EEF2F6',
            borderColor: theme.border,
          },
        ]}
      >
        {activeUrl && !hasError ? (
          <TouchableOpacity
            activeOpacity={hasTwoFrames && interactive ? 0.92 : 1}
            onPress={toggleFrame}
            disabled={!hasTwoFrames || !interactive}
            style={StyleSheet.absoluteFill}
          >
            <Image
              source={{ uri: activeUrl }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
              onLoadStart={() => setLoading(true)}
              onLoadEnd={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                setHasError(true);
              }}
            />
            {loading && (
              <View style={styles.loaderOverlay}>
                <ActivityIndicator size="small" color={theme.text} />
              </View>
            )}
          </TouchableOpacity>
        ) : (
          <View style={styles.placeholder}>
            <Ionicons name="barbell-outline" size={32} color={theme.textMuted} />
            <Text style={[styles.placeholderText, { color: theme.textMuted }]}>
              {exercise.equipment
                ? t('equipmentLabelText', { equipment: equipmentLabel(exercise.equipment) })
                : t('techniquePreview')}
            </Text>
          </View>
        )}

        {hasTwoFrames && interactive && (
          <View style={styles.frameToggleRow}>
            <TouchableOpacity
              onPress={() => {
                if (frameIdx !== 0) {
                  triggerSelectionHaptic();
                  setFrameIdx(0);
                }
              }}
              activeOpacity={0.85}
              style={[
                styles.framePill,
                {
                  backgroundColor:
                    frameIdx === 0
                      ? 'rgba(15, 23, 42, 0.86)'
                      : 'rgba(15, 23, 42, 0.45)',
                  borderColor:
                    frameIdx === 0
                      ? 'rgba(56, 189, 248, 0.7)'
                      : 'rgba(255, 255, 255, 0.16)',
                },
              ]}
            >
              <Text
                style={[
                  styles.framePillText,
                  { color: frameIdx === 0 ? '#FFFFFF' : 'rgba(255,255,255,0.72)' },
                ]}
              >
                {t('exercisePhotoStart')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                if (frameIdx !== 1) {
                  triggerSelectionHaptic();
                  setFrameIdx(1);
                }
              }}
              activeOpacity={0.85}
              style={[
                styles.framePill,
                {
                  backgroundColor:
                    frameIdx === 1
                      ? 'rgba(15, 23, 42, 0.86)'
                      : 'rgba(15, 23, 42, 0.45)',
                  borderColor:
                    frameIdx === 1
                      ? 'rgba(56, 189, 248, 0.7)'
                      : 'rgba(255, 255, 255, 0.16)',
                },
              ]}
            >
              <Text
                style={[
                  styles.framePillText,
                  { color: frameIdx === 1 ? '#FFFFFF' : 'rgba(255,255,255,0.72)' },
                ]}
              >
                {t('exercisePhotoPeak')}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  thumbWrap: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexShrink: 0,
  },
  heroWrap: {
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
    borderWidth: StyleSheet.hairlineWidth,
  },
  loaderOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  placeholderText: {
    fontSize: 12,
    fontWeight: '700',
  },
  frameToggleRow: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    gap: 5,
  },
  framePill: {
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 999,
    borderWidth: 1,
  },
  framePillText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
