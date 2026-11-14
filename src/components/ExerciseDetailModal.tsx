import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';
import { Exercise } from '../types/workout';
import { BottomSheetScrollView, InteractiveBottomSheet } from './InteractiveBottomSheet';

interface ExerciseDetailModalProps {
  visible: boolean;
  exercise: Exercise | null;
  onClose: () => void;
  onOpenPR?: (exercise: Exercise) => void;
}

export const ExerciseDetailModal: React.FC<ExerciseDetailModalProps> = ({
  visible,
  exercise,
  onClose,
  onOpenPR,
}) => {
  const { theme } = useAppTheme();
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  if (!exercise) return null;

  return (
    <InteractiveBottomSheet
      visible={visible}
      onClose={onClose}
      title={exercise.name}
      subtitle={`${exercise.category.toUpperCase()} • ${exercise.sets} serie × ${exercise.reps} • ${exercise.rest}s odpoczynku`}
      initialHeightPercent={0.88}
    >
      <BottomSheetScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Exercise Image / Minimal Header */}
        <View
          style={[
            styles.imageContainer,
            !exercise.imageUrl && { height: 112, borderRadius: 14, borderWidth: 1, borderColor: theme.border, marginBottom: 4 },
            { backgroundColor: theme.bgSecondary },
          ]}
        >
          {exercise.imageUrl && !imageError ? (
            <>
              <Image
                source={{ uri: exercise.imageUrl }}
                style={styles.image}
                resizeMode="cover"
                onLoadStart={() => setImageLoading(true)}
                onLoadEnd={() => setImageLoading(false)}
                onError={() => {
                  setImageLoading(false);
                  setImageError(true);
                }}
              />
              {imageLoading && (
                <View style={styles.imageLoader}>
                  <ActivityIndicator size="small" color={theme.text} />
                </View>
              )}
            </>
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="barbell-outline" size={32} color={theme.textMuted} />
              <Text style={[styles.imagePlaceholderText, { color: theme.textMuted }]}>
                {exercise.equipment ? `Sprzęt: ${exercise.equipment}` : 'Podgląd techniki ćwiczenia'}
              </Text>
            </View>
          )}

          <View
            style={[
              styles.categoryBadge,
              {
                backgroundColor: theme.primary,
              },
            ]}
          >
            <Text style={[styles.categoryBadgeText, { color: theme.primaryText }]}>
              {exercise.category.toUpperCase()}
              {exercise.equipment ? ` • ${exercise.equipment.toUpperCase()}` : ''}
            </Text>
          </View>
        </View>

        {/* Content Body */}
        <View style={styles.body}>
          {/* Minimal metrics strip */}
          <View style={[styles.statsStrip, { borderColor: theme.border, backgroundColor: theme.bgSecondary }]}>
            <View style={styles.statBox}>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>SERIE</Text>
              <Text style={[styles.statVal, { color: theme.text }]}>{exercise.sets}</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <View style={styles.statBox}>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>POWTÓRZENIA</Text>
              <Text style={[styles.statVal, { color: theme.text }]}>{exercise.reps}</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <View style={styles.statBox}>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>PRZERWA</Text>
              <Text style={[styles.statVal, { color: theme.text }]}>{exercise.rest}s</Text>
            </View>
          </View>

          {/* Technique section */}
          {exercise.description ? (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Prawidłowa technika</Text>
              <Text style={[styles.descText, { color: theme.textSecondary }]}>
                {exercise.description}
              </Text>
            </View>
          ) : null}

          {/* Note */}
          {exercise.note ? (
            <View style={[styles.noteBox, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
              <Text style={[styles.noteTitle, { color: theme.text }]}>Wskazówka</Text>
              <Text style={[styles.noteText, { color: theme.textSecondary }]}>
                {exercise.note}
              </Text>
            </View>
          ) : null}

          {/* Actions */}
          <View style={styles.actions}>
            {onOpenPR && (
              <TouchableOpacity
                style={[styles.prBtn, { backgroundColor: theme.primary }]}
                onPress={() => {
                  onClose();
                  onOpenPR(exercise);
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="trophy-outline" size={16} color={theme.primaryText} />
                <Text style={[styles.prBtnText, { color: theme.primaryText }]}>
                  Zobacz lub dodaj wynik w Osiągach
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.dismissBtn, { borderColor: theme.border }]}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text style={[styles.dismissBtnText, { color: theme.textMuted }]}>Zamknij</Text>
            </TouchableOpacity>
          </View>
        </View>
      </BottomSheetScrollView>
    </InteractiveBottomSheet>
  );
};

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  imageContainer: {
    width: '100%',
    height: 220,
    position: 'relative',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageLoader: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  imagePlaceholderText: {
    fontSize: 12,
  },
  categoryBadge: {
    position: 'absolute',
    bottom: 12,
    left: 14,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  body: {
    padding: 20,
  },
  statsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  statVal: {
    fontSize: 15,
    fontWeight: '800',
  },
  divider: {
    width: 1,
    height: 20,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 6,
  },
  descText: {
    fontSize: 14,
    lineHeight: 22,
  },
  noteBox: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  noteTitle: {
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 2,
  },
  noteText: {
    fontSize: 13,
    lineHeight: 18,
  },
  actions: {
    gap: 8,
  },
  prBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
  },
  prBtnText: {
    fontSize: 13,
    fontWeight: '800',
  },
  dismissBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  dismissBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
