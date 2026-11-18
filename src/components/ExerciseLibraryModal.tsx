import React from 'react';
import { InteractiveBottomSheet } from './InteractiveBottomSheet';
import { ExerciseLibraryContent } from './ExerciseLibraryContent';
import { Exercise } from '../types/workout';
import { useLanguage } from '../context/LanguageContext';

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
  const { t } = useLanguage();

  const resolvedTitle =
    title ||
    (mode === 'swap'
      ? t('libraryTitleSwap')
      : mode === 'pick'
      ? t('libraryTitlePick')
      : t('libraryTitleManage'));

  return (
    <InteractiveBottomSheet
      visible={visible}
      onClose={onClose}
      title={resolvedTitle}
      subtitle={subtitle}
      initialHeightPercent={0.9}
    >
      <ExerciseLibraryContent
        mode={mode}
        alreadyInDayIds={alreadyInDayIds}
        extraExercises={extraExercises}
        onSelectExercise={onSelectExercise}
        onLibraryChanged={onLibraryChanged}
      />
    </InteractiveBottomSheet>
  );
};
