import {
  MuscleCategory,
  MuscleSubGroupId,
  SecondaryMuscleWeight,
} from '../types/workout';

export interface MuscleSubGroupMeta {
  id: MuscleSubGroupId;
  label: string;
  shortLabel: string;
  parentCategory: MuscleCategory;
  parentLabel: string;
  side: 'front' | 'back' | 'both';
  /** Target Y-axis rotation in radians so 3D camera rotates straight to this muscle */
  cameraYaw: number;
  description: string;
}

export interface ExerciseMuscleAssignment {
  primary: MuscleSubGroupId;
  secondary: SecondaryMuscleWeight[];
}

export const MUSCLE_SUBGROUPS: MuscleSubGroupMeta[] = [
  // KLATKA
  {
    id: 'upper_chest',
    label: 'Górna klatka',
    shortLabel: 'Klatka Góra',
    parentCategory: 'klatka',
    parentLabel: 'Klatka',
    side: 'front',
    cameraYaw: 0.15,
    description: 'Część obojczykowa mięśnia piersiowego większego (wyciskania na skosie dodatnim).',
  },
  {
    id: 'mid_lower_chest',
    label: 'Środek i dół klatki',
    shortLabel: 'Klatka Środek',
    parentCategory: 'klatka',
    parentLabel: 'Klatka',
    side: 'front',
    cameraYaw: -0.15,
    description: 'Część mostkowo-żebrowa odpowiadająca za pełnię i grubość klatki piersiowej.',
  },
  // BARKI
  {
    id: 'front_delts',
    label: 'Barki - Przód',
    shortLabel: 'Barki Przód',
    parentCategory: 'barki',
    parentLabel: 'Barki',
    side: 'front',
    cameraYaw: 0.35,
    description: 'Przedni akton naramiennego pracujący przy wszystkich wyciskaniach nad głowę i na ławce.',
  },
  {
    id: 'side_delts',
    label: 'Barki - Bok',
    shortLabel: 'Barki Bok',
    parentCategory: 'barki',
    parentLabel: 'Barki',
    side: 'both',
    cameraYaw: 0.75,
    description: 'Boczny akton nadający sylwetce szerokość V-taper (wznosy bokiem z hantlami i na wyciągu).',
  },
  {
    id: 'rear_delts',
    label: 'Barki - Tył',
    shortLabel: 'Barki Tył',
    parentCategory: 'barki',
    parentLabel: 'Barki',
    side: 'back',
    cameraYaw: 2.65,
    description: 'Tylny akton barków odpowiadający za trójwymiarowy profil ramienia i stabilizację stożka rotatorów.',
  },
  // RAMIONA
  {
    id: 'biceps',
    label: 'Biceps',
    shortLabel: 'Biceps',
    parentCategory: 'ramiona',
    parentLabel: 'Ramiona',
    side: 'front',
    cameraYaw: -0.45,
    description: 'Mięsień dwugłowy ramienia i ramienny (uginania ze sztangą, hantlami, na modlitewniku i wyciągu).',
  },
  {
    id: 'triceps',
    label: 'Triceps',
    shortLabel: 'Triceps',
    parentCategory: 'ramiona',
    parentLabel: 'Ramiona',
    side: 'back',
    cameraYaw: 2.45,
    description: 'Mięsień trójgłowy stanowiący ok. 60% masy ramienia (wyprosty na wyciągu, wyciskania francuskie, JM Press).',
  },
  {
    id: 'forearms',
    label: 'Przedramiona',
    shortLabel: 'Przedramię',
    parentCategory: 'ramiona',
    parentLabel: 'Ramiona',
    side: 'both',
    cameraYaw: -0.65,
    description: 'Mięśnie przedramion i ramienno-promieniowy budujące siłę chwytu oraz obwód poniżej łokcia.',
  },
  // PLECY
  {
    id: 'traps',
    label: 'Kaptury (Czworoboczny)',
    shortLabel: 'Kaptury',
    parentCategory: 'plecy',
    parentLabel: 'Plecy',
    side: 'both',
    cameraYaw: 2.95,
    description: 'Górna część mięśnia czworobocznego stabilizująca obręcz barkową i kark.',
  },
  {
    id: 'lats',
    label: 'Najszerszy grzbietu',
    shortLabel: 'Najszerszy',
    parentCategory: 'plecy',
    parentLabel: 'Plecy',
    side: 'back',
    cameraYaw: 2.8,
    description: 'Główne skrzydła pleców budujące szerokość sylwetki (podciągania i ściągania wyciągu górnego).',
  },
  {
    id: 'mid_back',
    label: 'Środek pleców',
    shortLabel: 'Środek Pleców',
    parentCategory: 'plecy',
    parentLabel: 'Plecy',
    side: 'back',
    cameraYaw: 3.14,
    description: 'Mięśnie równoległoboczne i środkowy czworoboczny odpowiadające za grubość i detale grzbietu.',
  },
  {
    id: 'lower_back',
    label: 'Prostowniki grzbietu',
    shortLabel: 'Prostowniki',
    parentCategory: 'plecy',
    parentLabel: 'Plecy',
    side: 'back',
    cameraYaw: 3.14,
    description: 'Dolny odcinek grzbietu utrzymujący sztywność kręgosłupa w ciągach i przysiadach.',
  },
  // BRZUCH
  {
    id: 'abs',
    label: 'Prosty brzucha (Core)',
    shortLabel: 'Brzuch Prosty',
    parentCategory: 'brzuch',
    parentLabel: 'Brzuch',
    side: 'front',
    cameraYaw: 0.0,
    description: 'Mięsień prosty brzucha i głęboki gorset core (Allachy, wznosy nóg, kółko Ab Wheel).',
  },
  {
    id: 'obliques',
    label: 'Skośne brzucha',
    shortLabel: 'Brzuch Skośny',
    parentCategory: 'brzuch',
    parentLabel: 'Brzuch',
    side: 'front',
    cameraYaw: 0.45,
    description: 'Mięśnie skośne odpowiadające za rotację tułowia, talię i boczną stabilizację.',
  },
  // NOGI
  {
    id: 'quads',
    label: 'Czworogłowe uda',
    shortLabel: 'Czworogłowe',
    parentCategory: 'nogi',
    parentLabel: 'Nogi',
    side: 'front',
    cameraYaw: 0.15,
    description: 'Przednia taśma uda (przysiady, suwnica, wyprosty nóg na maszynie, wykroki).',
  },
  {
    id: 'hamstrings',
    label: 'Dwugłowe uda',
    shortLabel: 'Dwugłowe',
    parentCategory: 'nogi',
    parentLabel: 'Nogi',
    side: 'back',
    cameraYaw: 3.05,
    description: 'Tylna taśma uda (rumuński martwy ciąg RDL, uginania nóg leżąc i siedząc).',
  },
  {
    id: 'glutes',
    label: 'Pośladki',
    shortLabel: 'Pośladki',
    parentCategory: 'nogi',
    parentLabel: 'Nogi',
    side: 'back',
    cameraYaw: 2.9,
    description: 'Mięśnie pośladkowe wielkie i średnie (Hip Thrust, przysiady bułgarskie, odwodzenie).',
  },
  {
    id: 'adductors',
    label: 'Przywodziciele uda',
    shortLabel: 'Przywodziciele',
    parentCategory: 'nogi',
    parentLabel: 'Nogi',
    side: 'front',
    cameraYaw: -0.1,
    description: 'Wewnętrzna część uda stabilizująca biodro i dno przysiadu.',
  },
  {
    id: 'calves',
    label: 'Łydki',
    shortLabel: 'Łydki',
    parentCategory: 'nogi',
    parentLabel: 'Nogi',
    side: 'both',
    cameraYaw: 2.75,
    description: 'Mięsień brzuchaty i płaszczkowaty łydki (wspięcia na palce stojąc i siedząc).',
  },
];

export const MUSCLE_SUBGROUP_MAP: Record<MuscleSubGroupId, MuscleSubGroupMeta> =
  MUSCLE_SUBGROUPS.reduce((acc, m) => {
    acc[m.id] = m;
    return acc;
  }, {} as Record<MuscleSubGroupId, MuscleSubGroupMeta>);

export function getInvolvedMuscleCategories(assignment: ExerciseMuscleAssignment): MuscleCategory[] {
  const seen = new Set<MuscleCategory>();
  const primaryCat = MUSCLE_SUBGROUP_MAP[assignment.primary]?.parentCategory;
  if (primaryCat) seen.add(primaryCat);
  for (const sec of assignment.secondary) {
    const cat = MUSCLE_SUBGROUP_MAP[sec.muscle]?.parentCategory;
    if (cat && sec.weight >= 0.25) {
      seen.add(cat);
    }
  }
  return Array.from(seen);
}

/**
 * Detailed biomechanical mapping for every exercise in EXERCISE_LIBRARY (136 exercises).
 * Every multi-joint and isolation movement includes accurate synergists & stabilizers
 * alongside its primary muscle target.
 */
export const EXERCISE_MUSCLE_MAP: Record<string, ExerciseMuscleAssignment> = {
  // ==================== KLATKA ====================
  lib_barbell_bench: {
    primary: 'mid_lower_chest',
    secondary: [
      { muscle: 'triceps', weight: 0.45 },
      { muscle: 'front_delts', weight: 0.4 },
      { muscle: 'upper_chest', weight: 0.3 },
      { muscle: 'abs', weight: 0.15 },
    ],
  },
  lib_incline_barbell_bench: {
    primary: 'upper_chest',
    secondary: [
      { muscle: 'front_delts', weight: 0.45 },
      { muscle: 'triceps', weight: 0.4 },
      { muscle: 'mid_lower_chest', weight: 0.35 },
    ],
  },
  lib_db_bench_flat: {
    primary: 'mid_lower_chest',
    secondary: [
      { muscle: 'front_delts', weight: 0.35 },
      { muscle: 'triceps', weight: 0.35 },
      { muscle: 'upper_chest', weight: 0.25 },
      { muscle: 'forearms', weight: 0.15 },
    ],
  },
  lib_db_incline_press: {
    primary: 'upper_chest',
    secondary: [
      { muscle: 'front_delts', weight: 0.4 },
      { muscle: 'triceps', weight: 0.35 },
      { muscle: 'mid_lower_chest', weight: 0.3 },
    ],
  },
  lib_db_fly: {
    primary: 'mid_lower_chest',
    secondary: [
      { muscle: 'upper_chest', weight: 0.3 },
      { muscle: 'front_delts', weight: 0.25 },
      { muscle: 'biceps', weight: 0.15 },
    ],
  },
  lib_butterfly: {
    primary: 'mid_lower_chest',
    secondary: [
      { muscle: 'upper_chest', weight: 0.3 },
      { muscle: 'front_delts', weight: 0.25 },
    ],
  },
  lib_cable_crossover: {
    primary: 'mid_lower_chest',
    secondary: [
      { muscle: 'upper_chest', weight: 0.3 },
      { muscle: 'front_delts', weight: 0.25 },
      { muscle: 'abs', weight: 0.2 },
    ],
  },
  lib_hammer_chest: {
    primary: 'mid_lower_chest',
    secondary: [
      { muscle: 'triceps', weight: 0.35 },
      { muscle: 'front_delts', weight: 0.3 },
      { muscle: 'upper_chest', weight: 0.25 },
    ],
  },
  lib_dips_chest: {
    primary: 'mid_lower_chest',
    secondary: [
      { muscle: 'triceps', weight: 0.5 },
      { muscle: 'front_delts', weight: 0.35 },
      { muscle: 'abs', weight: 0.2 },
    ],
  },
  lib_pushups: {
    primary: 'mid_lower_chest',
    secondary: [
      { muscle: 'triceps', weight: 0.4 },
      { muscle: 'front_delts', weight: 0.35 },
      { muscle: 'abs', weight: 0.3 },
    ],
  },
  lib_incline_chest_press_machine: {
    primary: 'upper_chest',
    secondary: [
      { muscle: 'front_delts', weight: 0.4 },
      { muscle: 'triceps', weight: 0.35 },
      { muscle: 'mid_lower_chest', weight: 0.25 },
    ],
  },
  lib_decline_barbell_bench: {
    primary: 'mid_lower_chest',
    secondary: [
      { muscle: 'triceps', weight: 0.45 },
      { muscle: 'front_delts', weight: 0.25 },
    ],
  },
  lib_smith_incline_press: {
    primary: 'upper_chest',
    secondary: [
      { muscle: 'front_delts', weight: 0.4 },
      { muscle: 'triceps', weight: 0.35 },
      { muscle: 'mid_lower_chest', weight: 0.3 },
    ],
  },
  lib_low_to_high_cable_fly: {
    primary: 'upper_chest',
    secondary: [
      { muscle: 'front_delts', weight: 0.3 },
      { muscle: 'mid_lower_chest', weight: 0.25 },
      { muscle: 'abs', weight: 0.15 },
    ],
  },
  lib_db_pullover: {
    primary: 'mid_lower_chest',
    secondary: [
      { muscle: 'lats', weight: 0.5 },
      { muscle: 'triceps', weight: 0.25 },
      { muscle: 'abs', weight: 0.2 },
    ],
  },
  lib_floor_press: {
    primary: 'mid_lower_chest',
    secondary: [
      { muscle: 'triceps', weight: 0.55 },
      { muscle: 'front_delts', weight: 0.3 },
    ],
  },
  lib_incline_db_fly: {
    primary: 'upper_chest',
    secondary: [
      { muscle: 'mid_lower_chest', weight: 0.3 },
      { muscle: 'front_delts', weight: 0.25 },
    ],
  },
  lib_svend_press: {
    primary: 'mid_lower_chest',
    secondary: [
      { muscle: 'upper_chest', weight: 0.35 },
      { muscle: 'front_delts', weight: 0.3 },
      { muscle: 'forearms', weight: 0.2 },
    ],
  },
  lib_deficit_pushups: {
    primary: 'mid_lower_chest',
    secondary: [
      { muscle: 'upper_chest', weight: 0.35 },
      { muscle: 'triceps', weight: 0.4 },
      { muscle: 'front_delts', weight: 0.35 },
      { muscle: 'abs', weight: 0.25 },
    ],
  },

  // ==================== PLECY ====================
  lib_deadlift: {
    primary: 'lower_back',
    secondary: [
      { muscle: 'glutes', weight: 0.55 },
      { muscle: 'hamstrings', weight: 0.5 },
      { muscle: 'traps', weight: 0.45 },
      { muscle: 'forearms', weight: 0.45 },
      { muscle: 'quads', weight: 0.35 },
      { muscle: 'mid_back', weight: 0.35 },
      { muscle: 'abs', weight: 0.3 },
    ],
  },
  lib_pullups_overhand: {
    primary: 'lats',
    secondary: [
      { muscle: 'biceps', weight: 0.4 },
      { muscle: 'mid_back', weight: 0.4 },
      { muscle: 'forearms', weight: 0.35 },
      { muscle: 'rear_delts', weight: 0.25 },
      { muscle: 'abs', weight: 0.2 },
    ],
  },
  lib_chinups: {
    primary: 'lats',
    secondary: [
      { muscle: 'biceps', weight: 0.6 },
      { muscle: 'forearms', weight: 0.35 },
      { muscle: 'mid_back', weight: 0.3 },
      { muscle: 'abs', weight: 0.2 },
    ],
  },
  lib_lat_pulldown_wide: {
    primary: 'lats',
    secondary: [
      { muscle: 'biceps', weight: 0.35 },
      { muscle: 'mid_back', weight: 0.35 },
      { muscle: 'rear_delts', weight: 0.25 },
      { muscle: 'forearms', weight: 0.25 },
    ],
  },
  lib_lat_pulldown_vbar: {
    primary: 'lats',
    secondary: [
      { muscle: 'biceps', weight: 0.45 },
      { muscle: 'mid_back', weight: 0.35 },
      { muscle: 'forearms', weight: 0.25 },
      { muscle: 'rear_delts', weight: 0.2 },
    ],
  },
  lib_barbell_row: {
    primary: 'mid_back',
    secondary: [
      { muscle: 'lats', weight: 0.5 },
      { muscle: 'traps', weight: 0.4 },
      { muscle: 'lower_back', weight: 0.4 },
      { muscle: 'rear_delts', weight: 0.35 },
      { muscle: 'biceps', weight: 0.35 },
      { muscle: 'forearms', weight: 0.3 },
      { muscle: 'abs', weight: 0.25 },
    ],
  },
  lib_db_row_bench: {
    primary: 'lats',
    secondary: [
      { muscle: 'mid_back', weight: 0.45 },
      { muscle: 'biceps', weight: 0.35 },
      { muscle: 'rear_delts', weight: 0.3 },
      { muscle: 'forearms', weight: 0.3 },
      { muscle: 'obliques', weight: 0.2 },
    ],
  },
  lib_seated_cable_row: {
    primary: 'mid_back',
    secondary: [
      { muscle: 'lats', weight: 0.45 },
      { muscle: 'traps', weight: 0.35 },
      { muscle: 'rear_delts', weight: 0.3 },
      { muscle: 'biceps', weight: 0.3 },
      { muscle: 'forearms', weight: 0.2 },
    ],
  },
  lib_tbar_row: {
    primary: 'mid_back',
    secondary: [
      { muscle: 'lats', weight: 0.45 },
      { muscle: 'traps', weight: 0.45 },
      { muscle: 'rear_delts', weight: 0.35 },
      { muscle: 'biceps', weight: 0.35 },
      { muscle: 'lower_back', weight: 0.3 },
      { muscle: 'forearms', weight: 0.3 },
    ],
  },
  lib_face_pull: {
    primary: 'rear_delts',
    secondary: [
      { muscle: 'traps', weight: 0.45 },
      { muscle: 'mid_back', weight: 0.4 },
      { muscle: 'biceps', weight: 0.2 },
    ],
  },
  lib_back_extension: {
    primary: 'lower_back',
    secondary: [
      { muscle: 'glutes', weight: 0.45 },
      { muscle: 'hamstrings', weight: 0.35 },
    ],
  },
  lib_single_arm_lat_pulldown: {
    primary: 'lats',
    secondary: [
      { muscle: 'biceps', weight: 0.35 },
      { muscle: 'mid_back', weight: 0.3 },
      { muscle: 'forearms', weight: 0.25 },
      { muscle: 'obliques', weight: 0.2 },
    ],
  },
  lib_partial_chinup: {
    primary: 'lats',
    secondary: [
      { muscle: 'biceps', weight: 0.55 },
      { muscle: 'forearms', weight: 0.35 },
      { muscle: 'mid_back', weight: 0.25 },
    ],
  },
  lib_db_shrugs: {
    primary: 'traps',
    secondary: [
      { muscle: 'forearms', weight: 0.4 },
      { muscle: 'mid_back', weight: 0.25 },
    ],
  },
  lib_pendlay_row: {
    primary: 'mid_back',
    secondary: [
      { muscle: 'lats', weight: 0.45 },
      { muscle: 'traps', weight: 0.45 },
      { muscle: 'rear_delts', weight: 0.35 },
      { muscle: 'lower_back', weight: 0.4 },
      { muscle: 'hamstrings', weight: 0.25 },
      { muscle: 'forearms', weight: 0.3 },
    ],
  },
  lib_seal_row: {
    primary: 'mid_back',
    secondary: [
      { muscle: 'lats', weight: 0.45 },
      { muscle: 'rear_delts', weight: 0.35 },
      { muscle: 'biceps', weight: 0.35 },
      { muscle: 'traps', weight: 0.3 },
    ],
  },
  lib_chest_supported_machine_row: {
    primary: 'mid_back',
    secondary: [
      { muscle: 'lats', weight: 0.45 },
      { muscle: 'traps', weight: 0.35 },
      { muscle: 'rear_delts', weight: 0.3 },
      { muscle: 'biceps', weight: 0.3 },
    ],
  },
  lib_straight_arm_pulldown: {
    primary: 'lats',
    secondary: [
      { muscle: 'triceps', weight: 0.25 },
      { muscle: 'abs', weight: 0.25 },
      { muscle: 'mid_lower_chest', weight: 0.15 },
    ],
  },
  lib_meadows_row: {
    primary: 'lats',
    secondary: [
      { muscle: 'mid_back', weight: 0.45 },
      { muscle: 'rear_delts', weight: 0.4 },
      { muscle: 'forearms', weight: 0.35 },
      { muscle: 'obliques', weight: 0.25 },
    ],
  },
  lib_rack_pull: {
    primary: 'lower_back',
    secondary: [
      { muscle: 'traps', weight: 0.55 },
      { muscle: 'forearms', weight: 0.5 },
      { muscle: 'mid_back', weight: 0.45 },
      { muscle: 'glutes', weight: 0.4 },
      { muscle: 'hamstrings', weight: 0.25 },
    ],
  },
  lib_neutral_pullups: {
    primary: 'lats',
    secondary: [
      { muscle: 'biceps', weight: 0.45 },
      { muscle: 'forearms', weight: 0.4 },
      { muscle: 'mid_back', weight: 0.35 },
      { muscle: 'abs', weight: 0.2 },
    ],
  },
  lib_inverted_row: {
    primary: 'mid_back',
    secondary: [
      { muscle: 'lats', weight: 0.35 },
      { muscle: 'rear_delts', weight: 0.35 },
      { muscle: 'biceps', weight: 0.35 },
      { muscle: 'abs', weight: 0.25 },
    ],
  },
  lib_barbell_shrugs: {
    primary: 'traps',
    secondary: [
      { muscle: 'forearms', weight: 0.4 },
      { muscle: 'mid_back', weight: 0.2 },
    ],
  },
  lib_kelso_shrugs: {
    primary: 'traps',
    secondary: [
      { muscle: 'mid_back', weight: 0.55 },
      { muscle: 'rear_delts', weight: 0.3 },
    ],
  },
  lib_good_morning: {
    primary: 'lower_back',
    secondary: [
      { muscle: 'hamstrings', weight: 0.55 },
      { muscle: 'glutes', weight: 0.45 },
      { muscle: 'abs', weight: 0.25 },
    ],
  },
  lib_single_arm_cable_row: {
    primary: 'lats',
    secondary: [
      { muscle: 'mid_back', weight: 0.4 },
      { muscle: 'biceps', weight: 0.3 },
      { muscle: 'obliques', weight: 0.25 },
      { muscle: 'rear_delts', weight: 0.2 },
    ],
  },

  // ==================== NOGI ====================
  lib_back_squat: {
    primary: 'quads',
    secondary: [
      { muscle: 'glutes', weight: 0.55 },
      { muscle: 'adductors', weight: 0.35 },
      { muscle: 'lower_back', weight: 0.35 },
      { muscle: 'abs', weight: 0.3 },
      { muscle: 'calves', weight: 0.2 },
      { muscle: 'traps', weight: 0.2 },
    ],
  },
  lib_front_squat: {
    primary: 'quads',
    secondary: [
      { muscle: 'glutes', weight: 0.4 },
      { muscle: 'abs', weight: 0.4 },
      { muscle: 'lower_back', weight: 0.35 },
      { muscle: 'mid_back', weight: 0.3 },
      { muscle: 'calves', weight: 0.2 },
    ],
  },
  lib_leg_press: {
    primary: 'quads',
    secondary: [
      { muscle: 'glutes', weight: 0.45 },
      { muscle: 'adductors', weight: 0.3 },
      { muscle: 'hamstrings', weight: 0.2 },
    ],
  },
  lib_rdl: {
    primary: 'hamstrings',
    secondary: [
      { muscle: 'glutes', weight: 0.55 },
      { muscle: 'lower_back', weight: 0.45 },
      { muscle: 'forearms', weight: 0.35 },
      { muscle: 'traps', weight: 0.25 },
      { muscle: 'abs', weight: 0.2 },
    ],
  },
  lib_bulgarian_squat: {
    primary: 'quads',
    secondary: [
      { muscle: 'glutes', weight: 0.55 },
      { muscle: 'adductors', weight: 0.3 },
      { muscle: 'hamstrings', weight: 0.2 },
      { muscle: 'forearms', weight: 0.25 },
      { muscle: 'abs', weight: 0.2 },
    ],
  },
  lib_walking_lunges: {
    primary: 'quads',
    secondary: [
      { muscle: 'glutes', weight: 0.5 },
      { muscle: 'hamstrings', weight: 0.25 },
      { muscle: 'adductors', weight: 0.25 },
      { muscle: 'calves', weight: 0.2 },
      { muscle: 'abs', weight: 0.2 },
    ],
  },
  lib_leg_extension: {
    primary: 'quads',
    secondary: [{ muscle: 'abs', weight: 0.15 }],
  },
  lib_lying_leg_curl: {
    primary: 'hamstrings',
    secondary: [
      { muscle: 'calves', weight: 0.25 },
      { muscle: 'glutes', weight: 0.15 },
    ],
  },
  lib_seated_leg_curl: {
    primary: 'hamstrings',
    secondary: [{ muscle: 'calves', weight: 0.2 }],
  },
  lib_hip_thrust: {
    primary: 'glutes',
    secondary: [
      { muscle: 'hamstrings', weight: 0.35 },
      { muscle: 'quads', weight: 0.25 },
      { muscle: 'adductors', weight: 0.25 },
      { muscle: 'abs', weight: 0.2 },
    ],
  },
  lib_hip_abduction: {
    primary: 'glutes',
    secondary: [{ muscle: 'obliques', weight: 0.15 }],
  },
  lib_calf_raise: {
    primary: 'calves',
    secondary: [{ muscle: 'quads', weight: 0.15 }],
  },
  lib_hip_adduction: {
    primary: 'adductors',
    secondary: [{ muscle: 'glutes', weight: 0.15 }],
  },
  lib_seated_calf_raise: {
    primary: 'calves',
    secondary: [{ muscle: 'hamstrings', weight: 0.1 }],
  },
  lib_hack_squat: {
    primary: 'quads',
    secondary: [
      { muscle: 'glutes', weight: 0.4 },
      { muscle: 'adductors', weight: 0.25 },
      { muscle: 'calves', weight: 0.2 },
    ],
  },
  lib_goblet_squat: {
    primary: 'quads',
    secondary: [
      { muscle: 'glutes', weight: 0.45 },
      { muscle: 'abs', weight: 0.3 },
      { muscle: 'biceps', weight: 0.2 },
      { muscle: 'upper_chest', weight: 0.15 },
    ],
  },
  lib_sumo_deadlift: {
    primary: 'glutes',
    secondary: [
      { muscle: 'adductors', weight: 0.55 },
      { muscle: 'quads', weight: 0.45 },
      { muscle: 'hamstrings', weight: 0.4 },
      { muscle: 'lower_back', weight: 0.35 },
      { muscle: 'forearms', weight: 0.4 },
      { muscle: 'traps', weight: 0.3 },
    ],
  },
  lib_sissy_squat: {
    primary: 'quads',
    secondary: [
      { muscle: 'abs', weight: 0.25 },
      { muscle: 'calves', weight: 0.2 },
    ],
  },
  lib_pendulum_squat: {
    primary: 'quads',
    secondary: [
      { muscle: 'glutes', weight: 0.4 },
      { muscle: 'adductors', weight: 0.25 },
      { muscle: 'calves', weight: 0.2 },
    ],
  },
  lib_nordic_hamstring_curl: {
    primary: 'hamstrings',
    secondary: [
      { muscle: 'glutes', weight: 0.3 },
      { muscle: 'calves', weight: 0.25 },
      { muscle: 'lower_back', weight: 0.2 },
    ],
  },
  lib_single_leg_rdl: {
    primary: 'hamstrings',
    secondary: [
      { muscle: 'glutes', weight: 0.5 },
      { muscle: 'lower_back', weight: 0.3 },
      { muscle: 'forearms', weight: 0.25 },
      { muscle: 'obliques', weight: 0.25 },
    ],
  },
  lib_glute_kickback_cable: {
    primary: 'glutes',
    secondary: [
      { muscle: 'hamstrings', weight: 0.25 },
      { muscle: 'abs', weight: 0.15 },
    ],
  },
  lib_kas_glute_bridge: {
    primary: 'glutes',
    secondary: [
      { muscle: 'hamstrings', weight: 0.25 },
      { muscle: 'adductors', weight: 0.2 },
      { muscle: 'abs', weight: 0.2 },
    ],
  },
  lib_step_ups: {
    primary: 'quads',
    secondary: [
      { muscle: 'glutes', weight: 0.5 },
      { muscle: 'calves', weight: 0.25 },
      { muscle: 'adductors', weight: 0.2 },
      { muscle: 'abs', weight: 0.2 },
    ],
  },
  lib_copenhagen_plank: {
    primary: 'adductors',
    secondary: [
      { muscle: 'obliques', weight: 0.45 },
      { muscle: 'abs', weight: 0.35 },
    ],
  },
  lib_donkey_calf_raise: {
    primary: 'calves',
    secondary: [{ muscle: 'hamstrings', weight: 0.15 }],
  },
  lib_tibialis_raise: {
    primary: 'calves',
    secondary: [{ muscle: 'quads', weight: 0.1 }],
  },
  lib_single_leg_press: {
    primary: 'quads',
    secondary: [
      { muscle: 'glutes', weight: 0.45 },
      { muscle: 'adductors', weight: 0.25 },
    ],
  },

  // ==================== BARKI ====================
  lib_ohp_barbell: {
    primary: 'front_delts',
    secondary: [
      { muscle: 'side_delts', weight: 0.45 },
      { muscle: 'triceps', weight: 0.45 },
      { muscle: 'upper_chest', weight: 0.3 },
      { muscle: 'traps', weight: 0.25 },
      { muscle: 'abs', weight: 0.3 },
    ],
  },
  lib_db_shoulder_press: {
    primary: 'front_delts',
    secondary: [
      { muscle: 'side_delts', weight: 0.45 },
      { muscle: 'triceps', weight: 0.4 },
      { muscle: 'upper_chest', weight: 0.25 },
      { muscle: 'traps', weight: 0.2 },
    ],
  },
  lib_db_lateral_raise: {
    primary: 'side_delts',
    secondary: [
      { muscle: 'traps', weight: 0.25 },
      { muscle: 'front_delts', weight: 0.2 },
      { muscle: 'forearms', weight: 0.15 },
    ],
  },
  lib_cable_lateral_raise: {
    primary: 'side_delts',
    secondary: [
      { muscle: 'traps', weight: 0.2 },
      { muscle: 'front_delts', weight: 0.2 },
    ],
  },
  lib_reverse_pec_deck: {
    primary: 'rear_delts',
    secondary: [
      { muscle: 'mid_back', weight: 0.35 },
      { muscle: 'traps', weight: 0.3 },
      { muscle: 'side_delts', weight: 0.2 },
    ],
  },
  lib_db_rear_delt_fly: {
    primary: 'rear_delts',
    secondary: [
      { muscle: 'mid_back', weight: 0.35 },
      { muscle: 'traps', weight: 0.3 },
      { muscle: 'lower_back', weight: 0.2 },
    ],
  },
  lib_front_raise: {
    primary: 'front_delts',
    secondary: [
      { muscle: 'upper_chest', weight: 0.25 },
      { muscle: 'side_delts', weight: 0.25 },
      { muscle: 'forearms', weight: 0.2 },
    ],
  },
  lib_machine_shoulder_press: {
    primary: 'front_delts',
    secondary: [
      { muscle: 'side_delts', weight: 0.4 },
      { muscle: 'triceps', weight: 0.4 },
      { muscle: 'upper_chest', weight: 0.25 },
    ],
  },
  lib_arnold_press: {
    primary: 'front_delts',
    secondary: [
      { muscle: 'side_delts', weight: 0.5 },
      { muscle: 'triceps', weight: 0.35 },
      { muscle: 'upper_chest', weight: 0.25 },
    ],
  },
  lib_landmine_press: {
    primary: 'front_delts',
    secondary: [
      { muscle: 'upper_chest', weight: 0.45 },
      { muscle: 'triceps', weight: 0.35 },
      { muscle: 'obliques', weight: 0.3 },
      { muscle: 'abs', weight: 0.25 },
    ],
  },
  lib_upright_row: {
    primary: 'side_delts',
    secondary: [
      { muscle: 'traps', weight: 0.5 },
      { muscle: 'front_delts', weight: 0.3 },
      { muscle: 'biceps', weight: 0.25 },
      { muscle: 'forearms', weight: 0.25 },
    ],
  },
  lib_machine_lateral_raise: {
    primary: 'side_delts',
    secondary: [{ muscle: 'traps', weight: 0.2 }],
  },
  lib_egyptian_cable_lateral: {
    primary: 'side_delts',
    secondary: [
      { muscle: 'traps', weight: 0.2 },
      { muscle: 'obliques', weight: 0.15 },
    ],
  },
  lib_cable_rear_delt_fly: {
    primary: 'rear_delts',
    secondary: [
      { muscle: 'mid_back', weight: 0.35 },
      { muscle: 'traps', weight: 0.25 },
      { muscle: 'side_delts', weight: 0.2 },
    ],
  },
  lib_cable_front_raise: {
    primary: 'front_delts',
    secondary: [
      { muscle: 'upper_chest', weight: 0.25 },
      { muscle: 'side_delts', weight: 0.2 },
      { muscle: 'abs', weight: 0.15 },
    ],
  },
  lib_lu_raises: {
    primary: 'side_delts',
    secondary: [
      { muscle: 'traps', weight: 0.45 },
      { muscle: 'front_delts', weight: 0.35 },
      { muscle: 'forearms', weight: 0.2 },
    ],
  },

  // ==================== RAMIONA ====================
  lib_ezbar_curl: {
    primary: 'biceps',
    secondary: [
      { muscle: 'forearms', weight: 0.35 },
      { muscle: 'front_delts', weight: 0.15 },
    ],
  },
  lib_db_supination_curl: {
    primary: 'biceps',
    secondary: [
      { muscle: 'forearms', weight: 0.35 },
      { muscle: 'front_delts', weight: 0.15 },
    ],
  },
  lib_hammer_curl: {
    primary: 'forearms',
    secondary: [
      { muscle: 'biceps', weight: 0.7 },
      { muscle: 'front_delts', weight: 0.15 },
    ],
  },
  lib_preacher_curl: {
    primary: 'biceps',
    secondary: [{ muscle: 'forearms', weight: 0.25 }],
  },
  lib_cable_bicep_curl: {
    primary: 'biceps',
    secondary: [{ muscle: 'forearms', weight: 0.25 }],
  },
  lib_skull_crusher: {
    primary: 'triceps',
    secondary: [
      { muscle: 'forearms', weight: 0.25 },
      { muscle: 'front_delts', weight: 0.2 },
    ],
  },
  lib_tricep_rope_pushdown: {
    primary: 'triceps',
    secondary: [
      { muscle: 'forearms', weight: 0.25 },
      { muscle: 'abs', weight: 0.15 },
    ],
  },
  lib_tricep_bar_pushdown: {
    primary: 'triceps',
    secondary: [
      { muscle: 'forearms', weight: 0.2 },
      { muscle: 'abs', weight: 0.15 },
    ],
  },
  lib_dips_triceps: {
    primary: 'triceps',
    secondary: [
      { muscle: 'mid_lower_chest', weight: 0.4 },
      { muscle: 'front_delts', weight: 0.35 },
      { muscle: 'abs', weight: 0.15 },
    ],
  },
  lib_overhead_db_ext: {
    primary: 'triceps',
    secondary: [
      { muscle: 'forearms', weight: 0.2 },
      { muscle: 'abs', weight: 0.2 },
      { muscle: 'lats', weight: 0.15 },
    ],
  },
  lib_close_grip_bench: {
    primary: 'triceps',
    secondary: [
      { muscle: 'mid_lower_chest', weight: 0.45 },
      { muscle: 'front_delts', weight: 0.35 },
      { muscle: 'upper_chest', weight: 0.25 },
    ],
  },
  lib_cable_tricep_extension: {
    primary: 'triceps',
    secondary: [
      { muscle: 'forearms', weight: 0.2 },
      { muscle: 'abs', weight: 0.15 },
    ],
  },
  lib_jm_press: {
    primary: 'triceps',
    secondary: [
      { muscle: 'mid_lower_chest', weight: 0.3 },
      { muscle: 'front_delts', weight: 0.25 },
    ],
  },
  lib_wrist_curl: {
    primary: 'forearms',
    secondary: [{ muscle: 'biceps', weight: 0.15 }],
  },
  lib_reverse_barbell_curl: {
    primary: 'forearms',
    secondary: [
      { muscle: 'biceps', weight: 0.45 },
      { muscle: 'front_delts', weight: 0.15 },
    ],
  },
  lib_incline_db_curl: {
    primary: 'biceps',
    secondary: [
      { muscle: 'forearms', weight: 0.25 },
      { muscle: 'front_delts', weight: 0.15 },
    ],
  },
  lib_spider_curl: {
    primary: 'biceps',
    secondary: [{ muscle: 'forearms', weight: 0.25 }],
  },
  lib_concentration_curl: {
    primary: 'biceps',
    secondary: [{ muscle: 'forearms', weight: 0.2 }],
  },
  lib_bayesian_cable_curl: {
    primary: 'biceps',
    secondary: [
      { muscle: 'forearms', weight: 0.2 },
      { muscle: 'front_delts', weight: 0.15 },
    ],
  },
  lib_zottman_curl: {
    primary: 'forearms',
    secondary: [{ muscle: 'biceps', weight: 0.65 }],
  },
  lib_overhead_cable_tricep: {
    primary: 'triceps',
    secondary: [
      { muscle: 'abs', weight: 0.2 },
      { muscle: 'forearms', weight: 0.15 },
    ],
  },
  lib_single_arm_pushdown: {
    primary: 'triceps',
    secondary: [{ muscle: 'forearms', weight: 0.2 }],
  },
  lib_diamond_pushups: {
    primary: 'triceps',
    secondary: [
      { muscle: 'mid_lower_chest', weight: 0.45 },
      { muscle: 'front_delts', weight: 0.3 },
      { muscle: 'abs', weight: 0.25 },
    ],
  },
  lib_reverse_wrist_curl: {
    primary: 'forearms',
    secondary: [{ muscle: 'biceps', weight: 0.15 }],
  },
  lib_dead_hang: {
    primary: 'forearms',
    secondary: [
      { muscle: 'lats', weight: 0.3 },
      { muscle: 'traps', weight: 0.25 },
      { muscle: 'abs', weight: 0.2 },
    ],
  },

  // ==================== BRZUCH ====================
  lib_cable_crunch: {
    primary: 'abs',
    secondary: [{ muscle: 'obliques', weight: 0.35 }],
  },
  lib_hanging_leg_raise: {
    primary: 'abs',
    secondary: [
      { muscle: 'obliques', weight: 0.35 },
      { muscle: 'forearms', weight: 0.3 },
      { muscle: 'quads', weight: 0.2 },
    ],
  },
  lib_ab_wheel: {
    primary: 'abs',
    secondary: [
      { muscle: 'obliques', weight: 0.35 },
      { muscle: 'lats', weight: 0.25 },
      { muscle: 'front_delts', weight: 0.2 },
    ],
  },
  lib_plank: {
    primary: 'abs',
    secondary: [
      { muscle: 'obliques', weight: 0.4 },
      { muscle: 'front_delts', weight: 0.2 },
      { muscle: 'glutes', weight: 0.2 },
    ],
  },
  lib_machine_crunch: {
    primary: 'abs',
    secondary: [{ muscle: 'obliques', weight: 0.25 }],
  },
  lib_russian_twist: {
    primary: 'obliques',
    secondary: [
      { muscle: 'abs', weight: 0.45 },
      { muscle: 'forearms', weight: 0.15 },
    ],
  },
  lib_dead_bug: {
    primary: 'abs',
    secondary: [{ muscle: 'obliques', weight: 0.35 }],
  },
  lib_pallof_press: {
    primary: 'obliques',
    secondary: [
      { muscle: 'abs', weight: 0.45 },
      { muscle: 'glutes', weight: 0.2 },
      { muscle: 'front_delts', weight: 0.2 },
    ],
  },
  lib_side_plank: {
    primary: 'obliques',
    secondary: [
      { muscle: 'abs', weight: 0.35 },
      { muscle: 'glutes', weight: 0.25 },
      { muscle: 'side_delts', weight: 0.2 },
    ],
  },
  lib_cable_woodchopper: {
    primary: 'obliques',
    secondary: [
      { muscle: 'abs', weight: 0.4 },
      { muscle: 'front_delts', weight: 0.2 },
    ],
  },
  lib_dragon_flag: {
    primary: 'abs',
    secondary: [
      { muscle: 'obliques', weight: 0.4 },
      { muscle: 'lats', weight: 0.3 },
      { muscle: 'lower_back', weight: 0.2 },
    ],
  },
  lib_l_sit: {
    primary: 'abs',
    secondary: [
      { muscle: 'quads', weight: 0.35 },
      { muscle: 'triceps', weight: 0.25 },
      { muscle: 'lats', weight: 0.2 },
    ],
  },
  lib_bicycle_crunch: {
    primary: 'obliques',
    secondary: [{ muscle: 'abs', weight: 0.55 }],
  },

  // ==================== OGÓLNE & CARDIO ====================
  lib_farmers_walk: {
    primary: 'forearms',
    secondary: [
      { muscle: 'traps', weight: 0.65 },
      { muscle: 'abs', weight: 0.4 },
      { muscle: 'obliques', weight: 0.4 },
      { muscle: 'calves', weight: 0.3 },
      { muscle: 'glutes', weight: 0.25 },
    ],
  },
  lib_kettlebell_swing: {
    primary: 'glutes',
    secondary: [
      { muscle: 'hamstrings', weight: 0.55 },
      { muscle: 'lower_back', weight: 0.4 },
      { muscle: 'forearms', weight: 0.35 },
      { muscle: 'abs', weight: 0.3 },
      { muscle: 'traps', weight: 0.2 },
    ],
  },
  lib_treadmill_incline: {
    primary: 'calves',
    secondary: [
      { muscle: 'glutes', weight: 0.4 },
      { muscle: 'quads', weight: 0.35 },
      { muscle: 'hamstrings', weight: 0.25 },
    ],
  },
  lib_bike_intervals: {
    primary: 'quads',
    secondary: [
      { muscle: 'calves', weight: 0.35 },
      { muscle: 'hamstrings', weight: 0.25 },
      { muscle: 'glutes', weight: 0.25 },
    ],
  },
  lib_elliptical: {
    primary: 'quads',
    secondary: [
      { muscle: 'glutes', weight: 0.35 },
      { muscle: 'calves', weight: 0.3 },
      { muscle: 'hamstrings', weight: 0.25 },
    ],
  },
  lib_rowing_ergometer: {
    primary: 'mid_back',
    secondary: [
      { muscle: 'quads', weight: 0.45 },
      { muscle: 'lats', weight: 0.4 },
      { muscle: 'hamstrings', weight: 0.3 },
      { muscle: 'biceps', weight: 0.25 },
      { muscle: 'lower_back', weight: 0.25 },
    ],
  },
  lib_stairmaster: {
    primary: 'glutes',
    secondary: [
      { muscle: 'quads', weight: 0.45 },
      { muscle: 'calves', weight: 0.4 },
      { muscle: 'hamstrings', weight: 0.25 },
    ],
  },
  lib_sled_push_pull: {
    primary: 'quads',
    secondary: [
      { muscle: 'glutes', weight: 0.5 },
      { muscle: 'calves', weight: 0.45 },
      { muscle: 'hamstrings', weight: 0.3 },
      { muscle: 'abs', weight: 0.3 },
      { muscle: 'front_delts', weight: 0.25 },
    ],
  },
  lib_jump_rope: {
    primary: 'calves',
    secondary: [
      { muscle: 'forearms', weight: 0.3 },
      { muscle: 'quads', weight: 0.25 },
      { muscle: 'side_delts', weight: 0.2 },
      { muscle: 'abs', weight: 0.2 },
    ],
  },
};
