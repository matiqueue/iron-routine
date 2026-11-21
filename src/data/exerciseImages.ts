import { Exercise } from '../types/workout';

const FREE_EXERCISE_CDN =
  'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises';

/**
 * Curated 1:1 mapping of every built-in exercise ID (136/136) to its verified
 * public-domain demonstration photo directory in free-exercise-db (0.jpg start, 1.jpg peak).
 */
export const EXERCISE_IMAGE_SLUGS: Record<string, string> = {
  // === CHEST (19) ===
  lib_barbell_bench: 'Barbell_Bench_Press_-_Medium_Grip',
  lib_incline_barbell_bench: 'Barbell_Incline_Bench_Press_-_Medium_Grip',
  lib_db_bench_flat: 'Dumbbell_Bench_Press',
  lib_db_incline_press: 'Incline_Dumbbell_Press',
  lib_db_fly: 'Dumbbell_Flyes',
  lib_butterfly: 'Butterfly',
  lib_cable_crossover: 'Cable_Crossover',
  lib_hammer_chest: 'Leverage_Chest_Press',
  lib_dips_chest: 'Dips_-_Chest_Version',
  lib_pushups: 'Pushups',
  lib_incline_chest_press_machine: 'Leverage_Incline_Chest_Press',
  lib_decline_barbell_bench: 'Decline_Barbell_Bench_Press',
  lib_smith_incline_press: 'Smith_Machine_Incline_Bench_Press',
  lib_low_to_high_cable_fly: 'Low_Cable_Crossover',
  lib_db_pullover: 'Bent-Arm_Dumbbell_Pullover',
  lib_floor_press: 'Floor_Press',
  lib_incline_db_fly: 'Incline_Dumbbell_Flyes',
  lib_svend_press: 'Svend_Press',
  lib_deficit_pushups: 'Pushups_Close_and_Wide_Hand_Positions',

  // === BACK (26) ===
  lib_deadlift: 'Barbell_Deadlift',
  lib_pullups_overhand: 'Pullups',
  lib_chinups: 'Chin-Up',
  lib_lat_pulldown_wide: 'Wide-Grip_Lat_Pulldown',
  lib_lat_pulldown_vbar: 'V-Bar_Pulldown',
  lib_barbell_row: 'Bent_Over_Barbell_Row',
  lib_db_row_bench: 'One-Arm_Dumbbell_Row',
  lib_seated_cable_row: 'Seated_Cable_Rows',
  lib_tbar_row: 'T-Bar_Row_with_Handle',
  lib_face_pull: 'Face_Pull',
  lib_back_extension: 'Hyperextensions_Back_Extensions',
  lib_single_arm_lat_pulldown: 'One_Arm_Lat_Pulldown',
  lib_partial_chinup: 'Chin-Up',
  lib_db_shrugs: 'Dumbbell_Shrug',
  lib_pendlay_row: 'Reverse_Grip_Bent-Over_Rows',
  lib_seal_row: 'Lying_Cambered_Barbell_Row',
  lib_chest_supported_machine_row: 'Leverage_Iso_Row',
  lib_straight_arm_pulldown: 'Straight-Arm_Pulldown',
  lib_meadows_row: 'Bent_Over_One-Arm_Long_Bar_Row',
  lib_rack_pull: 'Rack_Pulls',
  lib_neutral_pullups: 'V-Bar_Pullup',
  lib_inverted_row: 'Inverted_Row',
  lib_barbell_shrugs: 'Barbell_Shrug',
  lib_kelso_shrugs: 'Dumbbell_Incline_Row',
  lib_good_morning: 'Good_Morning',
  lib_single_arm_cable_row: 'Seated_One-arm_Cable_Pulley_Rows',

  // === LEGS (28) ===
  lib_back_squat: 'Barbell_Squat',
  lib_front_squat: 'Front_Barbell_Squat',
  lib_leg_press: 'Leg_Press',
  lib_rdl: 'Romanian_Deadlift',
  lib_bulgarian_squat: 'Split_Squat_with_Dumbbells',
  lib_walking_lunges: 'Dumbbell_Lunges',
  lib_leg_extension: 'Leg_Extensions',
  lib_lying_leg_curl: 'Lying_Leg_Curls',
  lib_seated_leg_curl: 'Seated_Leg_Curl',
  lib_hip_thrust: 'Barbell_Hip_Thrust',
  lib_hip_abduction: 'Thigh_Abductor',
  lib_calf_raise: 'Standing_Calf_Raises',
  lib_hip_adduction: 'Thigh_Adductor',
  lib_seated_calf_raise: 'Seated_Calf_Raise',
  lib_hack_squat: 'Hack_Squat',
  lib_goblet_squat: 'Goblet_Squat',
  lib_sumo_deadlift: 'Sumo_Deadlift',
  lib_sissy_squat: 'Weighted_Sissy_Squat',
  lib_pendulum_squat: 'Narrow_Stance_Hack_Squats',
  lib_nordic_hamstring_curl: 'Floor_Glute-Ham_Raise',
  lib_single_leg_rdl: 'Kettlebell_One-Legged_Deadlift',
  lib_glute_kickback_cable: 'One-Legged_Cable_Kickback',
  lib_kas_glute_bridge: 'Barbell_Glute_Bridge',
  lib_step_ups: 'Dumbbell_Step_Ups',
  lib_copenhagen_plank: 'Side_Bridge',
  lib_donkey_calf_raise: 'Donkey_Calf_Raises',
  lib_tibialis_raise: 'Anterior_Tibialis-SMR',
  lib_single_leg_press: 'Narrow_Stance_Leg_Press',

  // === SHOULDERS (16) ===
  lib_ohp_barbell: 'Standing_Military_Press',
  lib_db_shoulder_press: 'Dumbbell_Shoulder_Press',
  lib_db_lateral_raise: 'Side_Lateral_Raise',
  lib_cable_lateral_raise: 'One-Arm_Side_Laterals',
  lib_reverse_pec_deck: 'Reverse_Machine_Flyes',
  lib_db_rear_delt_fly: 'Reverse_Flyes',
  lib_front_raise: 'Front_Dumbbell_Raise',
  lib_machine_shoulder_press: 'Machine_Shoulder_Military_Press',
  lib_arnold_press: 'Arnold_Dumbbell_Press',
  lib_landmine_press: 'Landmine_Linear_Jammer',
  lib_upright_row: 'Upright_Barbell_Row',
  lib_machine_lateral_raise: 'Seated_Side_Lateral_Raise',
  lib_egyptian_cable_lateral: 'Bent_Over_Low-Pulley_Side_Lateral',
  lib_cable_rear_delt_fly: 'Cable_Rear_Delt_Fly',
  lib_cable_front_raise: 'Front_Cable_Raise',
  lib_lu_raises: 'Side_Laterals_to_Front_Raise',

  // === ARMS (25) ===
  lib_ezbar_curl: 'EZ-Bar_Curl',
  lib_db_supination_curl: 'Dumbbell_Bicep_Curl',
  lib_hammer_curl: 'Alternate_Hammer_Curl',
  lib_preacher_curl: 'Preacher_Curl',
  lib_cable_bicep_curl: 'Standing_Biceps_Cable_Curl',
  lib_skull_crusher: 'EZ-Bar_Skullcrusher',
  lib_tricep_rope_pushdown: 'Triceps_Pushdown_-_Rope_Attachment',
  lib_tricep_bar_pushdown: 'Triceps_Pushdown',
  lib_dips_triceps: 'Dips_-_Triceps_Version',
  lib_overhead_db_ext: 'Standing_Dumbbell_Triceps_Extension',
  lib_close_grip_bench: 'Close-Grip_Barbell_Bench_Press',
  lib_cable_tricep_extension: 'Cable_One_Arm_Tricep_Extension',
  lib_jm_press: 'JM_Press',
  lib_wrist_curl: 'Palms-Up_Barbell_Wrist_Curl_Over_A_Bench',
  lib_reverse_barbell_curl: 'Reverse_Barbell_Curl',
  lib_incline_db_curl: 'Incline_Dumbbell_Curl',
  lib_spider_curl: 'Spider_Curl',
  lib_concentration_curl: 'Concentration_Curls',
  lib_bayesian_cable_curl: 'Standing_One-Arm_Cable_Curl',
  lib_zottman_curl: 'Zottman_Curl',
  lib_overhead_cable_tricep: 'Cable_Rope_Overhead_Triceps_Extension',
  lib_single_arm_pushdown: 'Reverse_Grip_Triceps_Pushdown',
  lib_diamond_pushups: 'Close-Grip_Push-Up_off_of_a_Dumbbell',
  lib_reverse_wrist_curl: 'Palms-Down_Wrist_Curl_Over_A_Bench',
  lib_dead_hang: 'Scapular_Pull-Up',

  // === ABS / CORE (13) ===
  lib_cable_crunch: 'Cable_Crunch',
  lib_hanging_leg_raise: 'Hanging_Leg_Raise',
  lib_ab_wheel: 'Ab_Roller',
  lib_plank: 'Plank',
  lib_machine_crunch: 'Ab_Crunch_Machine',
  lib_russian_twist: 'Russian_Twist',
  lib_dead_bug: 'Dead_Bug',
  lib_pallof_press: 'Pallof_Press',
  lib_side_plank: 'Push_Up_to_Side_Plank',
  lib_cable_woodchopper: 'Standing_Cable_Wood_Chop',
  lib_dragon_flag: 'Flat_Bench_Lying_Leg_Raise',
  lib_l_sit: 'Knee_Hip_Raise_On_Parallel_Bars',
  lib_bicycle_crunch: 'Air_Bike',

  // === GENERAL / CARDIO (9) ===
  lib_farmers_walk: 'Farmers_Walk',
  lib_kettlebell_swing: 'One-Arm_Kettlebell_Swings',
  lib_treadmill_incline: 'Walking_Treadmill',
  lib_bike_intervals: 'Bicycling_Stationary',
  lib_elliptical: 'Elliptical_Trainer',
  lib_rowing_ergometer: 'Rowing_Stationary',
  lib_stairmaster: 'Stairmaster',
  lib_sled_push_pull: 'Sled_Push',
  lib_jump_rope: 'Rope_Jumping',
};

export function getExerciseImageUrl(canonicalId: string, frame: 0 | 1 = 0): string {
  const cleanId = canonicalId.replace(/_(swap|session)_\d+$/, '');
  const slug = EXERCISE_IMAGE_SLUGS[cleanId];
  if (!slug) return '';
  return `${FREE_EXERCISE_CDN}/${slug}/${frame}.jpg`;
}

export function getExerciseImagePair(
  exercise: Pick<Exercise, 'id' | 'name' | 'imageUrl'>,
  canonicalId?: string
): string[] {
  const resolvedId = (canonicalId || exercise.id || '').replace(/_(swap|session)_\d+$/, '');
  const slug = EXERCISE_IMAGE_SLUGS[resolvedId];
  if (slug) {
    return [`${FREE_EXERCISE_CDN}/${slug}/0.jpg`, `${FREE_EXERCISE_CDN}/${slug}/1.jpg`];
  }
  if (exercise.imageUrl && exercise.imageUrl.trim().length > 0) {
    return [exercise.imageUrl.trim()];
  }
  return [];
}
