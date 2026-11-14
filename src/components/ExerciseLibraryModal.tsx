import React from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { InteractiveBottomSheet } from './InteractiveBottomSheet';
import { ExerciseLibraryContent } from './ExerciseLibraryContent';
import { Exercise } from '../types/workout';

interface ExerciseLibraryModalProps {
  visible: boolean;
  onClose: () => void;
  mode?: 'pick' | 'manage' | 'swap';
  title?: string;
  subtitle?: string;
  alreadyInDayIds?: string[];
  extraExercises?: Exercise[];
  onSelectExercise?: (exercise: Exercise) => void;
  onLibraryChanged?: () => void;
}

export const ExerciseLibraryModal: React.FC<ExerciseLibraryModalProps> = ({
  visible,
  onClose,
  mode = 'manage',
  title,
  subtitle,
  alreadyInDayIds,
  extraExercises,
  onSelectExercise,
  onLibraryChanged,
}) => {
  const resolvedTitle =
    title ||
    (mode === 'swap'
      ? 'Zamień ćwiczenie'
      : mode === 'pick'
      ? 'Dodaj ćwiczenie z bazy'
      : 'Baza ćwiczeń na siłownię');

  const resolvedSubtitle =
    subtitle ||
    (mode === 'manage'
      ? 'Przeglądaj technikę lub twórz własne ćwiczenia'
      : 'Wybierz ćwiczenie z bazy albo dodaj własne');

  return (
    <InteractiveBottomSheet
      visible={visible}
      onClose={onClose}
      title={resolvedTitle}
      subtitle={resolvedSubtitle}
      initialHeightPercent={0.9}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ExerciseLibraryContent
          mode={mode}
          alreadyInDayIds={alreadyInDayIds}
          extraExercises={extraExercises}
          onSelectExercise={onSelectExercise}
          onLibraryChanged={onLibraryChanged}
        />
      </KeyboardAvoidingView>
    </InteractiveBottomSheet>
  );
};
