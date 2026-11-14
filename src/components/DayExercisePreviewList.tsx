import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';
import { Exercise, PRRecord, SetEntry } from '../types/workout';
import { MUSCLE_CATEGORY_META, resolveCanonicalExerciseId } from '../data/exerciseLibrary';
import { triggerSelectionHaptic } from '../services/haptics';

interface DayExercisePreviewListProps {
  exercises: Exercise[];
  daySets?: { [exerciseId: string]: { [setIndex: number]: SetEntry } };
  bestPRs?: { [exerciseId: string]: PRRecord };
  onPressExercise: (ex: Exercise) => void;
  showIndex?: boolean;
  compact?: boolean;
}

const formatRestShort = (seconds: number): string => {
  if (!seconds || seconds <= 0) return '—';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  if (secs === 0) return `${mins} min`;
  return `${mins}m ${secs}s`;
};

const getCategoryShort = (cat: string): string => {
  return MUSCLE_CATEGORY_META.find((m) => m.id === cat)?.label || 'Ogólne';
};

/**
 * Clean, scannable athletic exercise list used in Today's block preview and Plan tab.
 * Optimized for narrow iPhone widths (375pt+) without photo clutter.
 */
export const DayExercisePreviewList: React.FC<DayExercisePreviewListProps> = ({
  exercises,
  daySets = {},
  bestPRs = {},
  onPressExercise,
  showIndex = true,
  compact = false,
}) => {
  const { theme } = useAppTheme();

  return (
    <View style={styles.container}>
      {exercises.map((ex, idx) => {
        const canonicalId = resolveCanonicalExerciseId(ex.id, ex.name);
        const loggedForEx = daySets[ex.id] || daySets[canonicalId] || {};
        const doneCount = Object.values(loggedForEx).filter((s) => s?.completed).length;
        const isCompleted = doneCount >= ex.sets && ex.sets > 0;
        const pr = bestPRs[canonicalId] || bestPRs[ex.id];
        const equipment = ex.equipment || 'Inne';

        return (
          <TouchableOpacity
            key={`${ex.id}_${idx}`}
            activeOpacity={0.76}
            onPress={() => {
              triggerSelectionHaptic();
              onPressExercise(ex);
            }}
            style={[
              styles.card,
              compact && styles.cardCompact,
              {
                backgroundColor: isCompleted ? theme.bgSecondary : theme.card,
                borderColor: isCompleted ? theme.text : theme.border,
              },
            ]}
          >
            {/* Left Index / Status Block */}
            {showIndex && (
              <View
                style={[
                  styles.indexBox,
                  {
                    backgroundColor: isCompleted ? theme.text : theme.bgTertiary,
                    borderColor: isCompleted ? theme.text : theme.border,
                  },
                ]}
              >
                {isCompleted ? (
                  <Ionicons name="checkmark" size={16} color={theme.bg} />
                ) : (
                  <Text style={[styles.indexText, { color: theme.textSecondary }]}>
                    {String(idx + 1).padStart(2, '0')}
                  </Text>
                )}
              </View>
            )}

            {/* Middle Content */}
            <View style={styles.content}>
              <View style={styles.titleRow}>
                <Text
                  style={[
                    styles.title,
                    { color: theme.text },
                    isCompleted && styles.titleCompleted,
                  ]}
                  numberOfLines={2}
                >
                  {ex.name}
                </Text>
              </View>

              {/* Tag Pills Row */}
              <View style={styles.pillsRow}>
                <View style={[styles.metaChip, { backgroundColor: theme.bgTertiary }]}>
                  <Text style={[styles.metaChipText, { color: theme.textSecondary }]} numberOfLines={1}>
                    {equipment} • {getCategoryShort(ex.category)}
                  </Text>
                </View>

                {ex.isCustom && (
                  <View style={[styles.metaChip, { backgroundColor: theme.bgTertiary }]}>
                    <Text style={[styles.metaChipText, { color: theme.text }]}>WŁASNE</Text>
                  </View>
                )}

                {pr && (
                  <View
                    style={[
                      styles.prChip,
                      { backgroundColor: theme.bgSecondary, borderColor: theme.borderDark },
                    ]}
                  >
                    <Ionicons name="trophy-outline" size={11} color={theme.text} />
                    <Text style={[styles.prChipText, { color: theme.text }]}>
                      PR {pr.weight} kg × {pr.reps}
                    </Text>
                  </View>
                )}
              </View>

              {/* Bottom Spec Row */}
              <View style={styles.specRow}>
                <View style={styles.specGroup}>
                  <Text style={[styles.specHighlight, { color: theme.text }]}>
                    {ex.sets} × {ex.reps}
                  </Text>
                  <Text style={[styles.specMuted, { color: theme.textMuted }]}>powt.</Text>
                </View>

                <View style={[styles.dotSep, { backgroundColor: theme.borderDark }]} />

                <View style={styles.specGroup}>
                  <Ionicons name="timer-outline" size={13} color={theme.textMuted} />
                  <Text style={[styles.specMuted, { color: theme.textSecondary }]}>
                    {formatRestShort(ex.rest)}
                  </Text>
                </View>

                {doneCount > 0 && !isCompleted && (
                  <>
                    <View style={[styles.dotSep, { backgroundColor: theme.borderDark }]} />
                    <Text style={[styles.partialText, { color: theme.text }]}>
                      {doneCount}/{ex.sets} serii
                    </Text>
                  </>
                )}
              </View>
            </View>

            {/* Right Action Chevron */}
            <View style={[styles.chevronWrap, { backgroundColor: theme.bgTertiary }]}>
              <Ionicons name="chevron-forward" size={15} color={theme.textSecondary} />
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 13,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  cardCompact: {
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  indexBox: {
    width: 34,
    height: 34,
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  indexText: {
    fontSize: 12,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.4,
  },
  content: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  titleCompleted: {
    opacity: 0.78,
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  metaChip: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    maxWidth: '100%',
  },
  metaChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  prChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  prChipText: {
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  specRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 1,
  },
  specGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  specHighlight: {
    fontSize: 13,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  specMuted: {
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  dotSep: {
    width: 3,
    height: 3,
    borderRadius: 2,
  },
  partialText: {
    fontSize: 12,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  chevronWrap: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
