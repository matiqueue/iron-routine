import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
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
    height = 224,
    size = 52,
    borderRadius = 14,
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

    const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
    const [containerWidth, setContainerWidth] = useState(0);
    const [activeIdx, setActiveIdx] = useState(0);
    const activeIdxRef = useRef(0);
    const [loadedMap, setLoadedMap] = useState<Record<number, boolean>>({});
    const [errorMap, setErrorMap] = useState<Record<number, boolean>>({});

    useEffect(() => {
      activeIdxRef.current = 0;
      setActiveIdx(0);
      setLoadedMap({});
      setErrorMap({});
      scrollRef.current?.scrollTo({ x: 0, animated: false });
    }, [canonicalId, exercise.imageUrl]);

    const handleLayout = (e: LayoutChangeEvent) => {
      const w = Math.round(e.nativeEvent.layout.width);
      if (w > 0 && w !== containerWidth) {
        setContainerWidth(w);
      }
    };

    const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (containerWidth <= 0) return;
      const page = Math.max(
        0,
        Math.min(urls.length - 1, Math.round(e.nativeEvent.contentOffset.x / containerWidth))
      );
      if (page !== activeIdxRef.current) {
        activeIdxRef.current = page;
        setActiveIdx(page);
        triggerSelectionHaptic();
      }
    };

    const handleStepNext = () => {
      if (!interactive || urls.length < 2 || containerWidth <= 0) return;
      const next = (activeIdxRef.current + 1) % urls.length;
      activeIdxRef.current = next;
      setActiveIdx(next);
      triggerSelectionHaptic();
      scrollRef.current?.scrollTo({ x: next * containerWidth, animated: true });
    };

    const allFailed = urls.length === 0 || urls.every((_, idx) => errorMap[idx]);

    if (variant === 'thumb') {
      const firstUrl = urls[0] || '';
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
          {firstUrl && !errorMap[0] ? (
            <Image
              source={{ uri: firstUrl }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
              onError={() => setErrorMap((prev) => ({ ...prev, 0: true }))}
            />
          ) : (
            <Ionicons name="barbell-outline" size={Math.round(size * 0.42)} color={theme.textMuted} />
          )}
        </View>
      );
    }

    return (
      <View
        onLayout={handleLayout}
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
        {!allFailed && containerWidth > 0 ? (
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            scrollEnabled={interactive && urls.length > 1}
            directionalLockEnabled
            nestedScrollEnabled
            bounces={false}
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            scrollEventThrottle={32}
            onScroll={handleScroll}
            onMomentumScrollEnd={handleScroll}
            style={{ width: containerWidth, height }}
          >
            {urls.map((uri, idx) => {
              const failed = Boolean(errorMap[idx]);
              const loaded = Boolean(loadedMap[idx]);
              return (
                <View key={`${canonicalId}_${idx}`} style={{ width: containerWidth, height }}>
                  {!failed ? (
                    <>
                      <Image
                        source={{ uri }}
                        style={StyleSheet.absoluteFill}
                        resizeMode="cover"
                        onLoadEnd={() =>
                          setLoadedMap((prev) => (prev[idx] ? prev : { ...prev, [idx]: true }))
                        }
                        onError={() =>
                          setErrorMap((prev) => (prev[idx] ? prev : { ...prev, [idx]: true }))
                        }
                      />
                      {!loaded && (
                        <View style={styles.loaderOverlay}>
                          <ActivityIndicator size="small" color={theme.text} />
                        </View>
                      )}
                    </>
                  ) : (
                    <View style={styles.placeholder}>
                      <Ionicons name="barbell-outline" size={32} color={theme.textMuted} />
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>
        ) : allFailed ? (
          <View style={styles.placeholder}>
            <Ionicons name="barbell-outline" size={32} color={theme.textMuted} />
            <Text style={[styles.placeholderText, { color: theme.textMuted }]}>
              {exercise.equipment
                ? t('equipmentLabelText', { equipment: equipmentLabel(exercise.equipment) })
                : t('techniquePreview')}
            </Text>
          </View>
        ) : (
          <View style={styles.loaderOverlay}>
            <ActivityIndicator size="small" color={theme.text} />
          </View>
        )}

        {/* Swipe indicator pill ("Pozycja 1 z 2") + subtle dots */}
        {!allFailed && urls.length > 1 && (
          <TouchableOpacity
            onPress={handleStepNext}
            activeOpacity={0.82}
            style={styles.positionIndicatorPill}
          >
            <View style={styles.dotsRow}>
              {urls.map((_, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.dot,
                    idx === activeIdx ? styles.dotActive : styles.dotIdle,
                  ]}
                />
              ))}
            </View>
            <Text style={styles.positionIndicatorText}>
              {t('exercisePhotoOf', { current: activeIdx + 1, total: urls.length })}
            </Text>
            <Ionicons name="swap-horizontal" size={11} color="rgba(255,255,255,0.78)" />
          </TouchableOpacity>
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
  positionIndicatorPill: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(12, 16, 24, 0.74)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3.5,
  },
  dot: {
    height: 5,
    borderRadius: 2.5,
  },
  dotActive: {
    width: 12,
    backgroundColor: '#38BDF8',
  },
  dotIdle: {
    width: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.42)',
  },
  positionIndicatorText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
});
