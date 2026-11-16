import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { Exercise, PRRecord, SetEntry } from '../types/workout';
import { resolveCanonicalExerciseId } from '../data/exerciseLibrary';
import { resolveExerciseMuscles } from '../data/muscleMap';
import { triggerSelectionHaptic } from '../services/haptics';

interface DayExercisePreviewListProps {
  exercises: Exercise[];
  daySets?: { [exerciseId: string]: { [setIndex: number]: SetEntry } };
  bestPRs?: { [exerciseId: string]: PRRecord };
  skippedIds?: string[];
  onPressExercise: (ex: Exercise) => void;
  showIndex?: boolean;
  compact?: boolean;
}

const formatRestShort = (seconds: number): string => {
  if (!seconds || seconds <= 0) return '-';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  if (secs === 0) return `${mins} min`;
  return `${mins}m ${secs}s`;
};

const CATEGORY_ACCENT_COLOR: Record<string, string> = {
  chest: '#38BDF8',
  back: '#10B981',
  legs: '#F59E0B',
  shoulders: '#A855F7',
  arms: '#EC4899',
  core: '#14B8A6',
  cardio: '#F97316',
  other: '#71717A',
};

/**
 * Open, fluid editorial exercise timeline used in Today's block preview and Plan tab.
 * Free of heavy card boxes, using glassmorphic index badges, hairline dividers, and category accents.
 */
export const DayExercisePreviewList: React.FC<DayExercisePreviewListProps> = ({
  exercises,
  daySets = {},
  bestPRs = {},
  skippedIds = [],
  onPressExercise,
  showIndex = true,
  compact = false,
}) => {
  const { theme, isDark } = useAppTheme();
  const { t, muscleLabel, equipmentLabel, exerciseName } = useLanguage();
  const skippedSet = React.useMemo(() => new Set(skippedIds), [skippedIds]);

  return (
    <View style={styles.container}>
      {exercises.map((ex, idx) => {
        const canonicalId = resolveCanonicalExerciseId(ex.id, ex.name);
        const loggedForEx = daySets[ex.id] || daySets[canonicalId] || {};
        const doneCount = Object.values(loggedForEx).filter((s) => s?.completed).length;
        const isSkipped = skippedSet.has(ex.id);
        const isCompleted = !isSkipped && doneCount >= ex.sets && ex.sets > 0;
        const pr = bestPRs[canonicalId] || bestPRs[ex.id];
        const equipment = ex.equipment ? equipmentLabel(ex.equipment) : '';
        const anatomy = resolveExerciseMuscles(ex);
        const musclesSummary = [
          muscleLabel(anatomy.primary, true),
          ...anatomy.secondary.filter((s) => s.weight >= 0.3).slice(0, 2).map((s) => muscleLabel(s.muscle, true)),
        ].join(' + ');
        const accentColor = CATEGORY_ACCENT_COLOR[ex.category] || '#10B981';
        const isLast = idx === exercises.length - 1;
        const progressRatio = ex.sets > 0 ? Math.min(1, doneCount / ex.sets) : 0;

        return (
          <TouchableOpacity
            key={`${ex.id}_${idx}`}
            activeOpacity={0.72}
            onPress={() => {
              triggerSelectionHaptic();
              onPressExercise(ex);
            }}
            style={[
              styles.openRow,
              compact && styles.openRowCompact,
              {
                borderBottomColor: isLast ? 'transparent' : theme.hairline,
                opacity: isSkipped ? 0.48 : 1,
              },
            ]}
          >
            {/* Left Timeline Column with Glassmorphic Index Badge */}
            {showIndex && (
              <View style={styles.timelineCol}>
                <View
                  style={[
                    styles.indexGlassBadge,
                    {
                      backgroundColor: isCompleted
                        ? '#10B981'
                        : isDark
                        ? 'rgba(39, 39, 42, 0.65)'
                        : 'rgba(244, 244, 245, 0.85)',
                      borderColor: isCompleted
                        ? '#10B981'
                        : isDark
                        ? 'rgba(255, 255, 255, 0.12)'
                        : 'rgba(24, 24, 27, 0.08)',
                    },
                  ]}
                >
                  {isCompleted ? (
                    <Ionicons name="checkmark" size={15} color="#09090B" />
                  ) : isSkipped ? (
                    <Ionicons name="remove" size={15} color={theme.textMuted} />
                  ) : (
                    <Text style={[styles.indexText, { color: theme.text }]}>
                      {String(idx + 1).padStart(2, '0')}
                    </Text>
                  )}
                </View>
                {!isLast && (
                  <View
                    style={[
                      styles.timelineLine,
                      {
                        backgroundColor: isCompleted
                          ? 'rgba(16, 185, 129, 0.4)'
                          : theme.hairline,
                      },
                    ]}
                  />
                )}
              </View>
            )}

            {/* Middle Open Content */}
            <View style={styles.content}>
              <View style={styles.topHeaderLine}>
                <Text
                  style={[
                    styles.title,
                    { color: theme.text },
                    isCompleted && styles.titleCompleted,
                    isSkipped && {
                      textDecorationLine: 'line-through',
                      color: theme.textMuted,
                    },
                  ]}
                  numberOfLines={2}
                >
                  {exerciseName(canonicalId, ex.name)}
                </Text>

                {/* Sets x Reps Glass Pill */}
                <View
                  style={[
                    styles.setsGlassPill,
                    {
                      backgroundColor: isDark
                        ? 'rgba(39, 39, 42, 0.6)'
                        : 'rgba(244, 244, 245, 0.85)',
                      borderColor: isDark
                        ? 'rgba(255, 255, 255, 0.09)'
                        : 'rgba(24, 24, 27, 0.07)',
                    },
                  ]}
                >
                  <Text style={[styles.setsPillText, { color: theme.text }]}>
                    {ex.sets} × {ex.reps}
                  </Text>
                </View>
              </View>

              {/* Subtle Meta & PR Line */}
              <View style={styles.metaLine}>
                <View style={styles.categoryTag}>
                  <View
                    style={[styles.categoryDot, { backgroundColor: accentColor }]}
                  />
                  <Text
                    style={[styles.metaText, { color: theme.textSecondary }]}
                    numberOfLines={1}
                  >
                    {musclesSummary}{equipment ? ` · ${equipment}` : ''}
                  </Text>
                </View>

                <View style={[styles.dotSep, { backgroundColor: theme.border }]} />

                <View style={styles.restInline}>
                  <Ionicons name="timer-outline" size={12} color={theme.textMuted} />
                  <Text style={[styles.metaText, { color: theme.textMuted }]}>
                    {formatRestShort(ex.rest)}
                  </Text>
                </View>

                {pr && (
                  <>
                    <View style={[styles.dotSep, { backgroundColor: theme.border }]} />
                    <View style={styles.prInline}>
                      <Ionicons name="trophy-outline" size={11} color="#F59E0B" />
                      <Text style={[styles.prInlineText, { color: theme.text }]}>
                        {pr.weight} kg × {pr.reps}
                      </Text>
                    </View>
                  </>
                )}

                {isSkipped && (
                  <Text style={[styles.skippedTag, { color: theme.textMuted }]}>
                    {t('skippedBadge')}
                  </Text>
                )}
              </View>

              {/* Progress Bar if sets started or completed */}
              {doneCount > 0 && !isSkipped && (
                <View style={styles.progressRow}>
                  <View
                    style={[
                      styles.progressTrack,
                      { backgroundColor: theme.bgSecondary },
                    ]}
                  >
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${Math.round(progressRatio * 100)}%`,
                          backgroundColor: isCompleted ? '#10B981' : '#38BDF8',
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.progressLabel, { color: theme.textSecondary }]}>
                    {doneCount}/{ex.sets} serii
                  </Text>
                </View>
              )}
            </View>

            {/* Right Subtle Chevron */}
            <Ionicons
              name="chevron-forward"
              size={15}
              color={theme.textMuted}
              style={{ marginTop: 2 }}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 2,
  },
  openRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  openRowCompact: {
    paddingVertical: 11,
  },
  timelineCol: {
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  indexGlassBadge: {
    width: 32,
    height: 32,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  indexText: {
    fontSize: 11.5,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.3,
  },
  timelineLine: {
    width: 1.5,
    flex: 1,
    marginTop: 6,
    borderRadius: 1,
  },
  content: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  topHeaderLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  titleCompleted: {
    opacity: 0.72,
  },
  setsGlassPill: {
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 999,
    borderWidth: 1,
    flexShrink: 0,
  },
  setsPillText: {
    fontSize: 11.5,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  metaLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  categoryTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  categoryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dotSep: {
    width: 3,
    height: 3,
    borderRadius: 2,
  },
  restInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  prInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  prInlineText: {
    fontSize: 11.5,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  skippedTag: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    borderRadius: 999,
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
