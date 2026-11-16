import { AppLanguage, MuscleSubGroupId, RankTier } from '../types/workout';

type Localized4 = { en: string; de: string; fr: string; es: string };
type Localized5 = { pl: string; en: string; de: string; fr: string; es: string };

export const EXERCISE_NAME_TRANSLATIONS: Record<string, Localized4> = {
  lib_barbell_bench: {
    en: 'Flat Barbell Bench Press',
    de: 'Flachbankdrücken mit Langhantel',
    fr: 'Développé couché barre à plat',
    es: 'Press de banca plano con barra',
  },
  lib_incline_barbell_bench: {
    en: 'Incline Barbell Bench Press',
    de: 'Schrägbankdrücken mit Langhantel',
    fr: 'Développé incliné à la barre',
    es: 'Press inclinado con barra',
  },
  lib_db_bench_flat: {
    en: 'Flat Dumbbell Bench Press',
    de: 'Flachbankdrücken mit Kurzhanteln',
    fr: 'Développé couché haltères à plat',
    es: 'Press de banca plano con mancuernas',
  },
  lib_db_incline_press: {
    en: 'Incline Dumbbell Press',
    de: 'Schrägbankdrücken mit Kurzhanteln',
    fr: 'Développé incliné aux haltères',
    es: 'Press inclinado con mancuernas',
  },
  lib_db_fly: {
    en: 'Flat Dumbbell Flyes',
    de: 'Fliegende mit Kurzhanteln auf der Flachbank',
    fr: 'Écartés couchés aux haltères',
    es: 'Aperturas en banco plano con mancuernas',
  },
  lib_butterfly: {
    en: 'Pec Deck Machine Fly (Butterfly)',
    de: 'Butterfly-Maschine (Brust)',
    fr: 'Écartés à la machine (Butterfly)',
    es: 'Aperturas en máquina (Butterfly)',
  },
  lib_cable_crossover: {
    en: 'High-to-Low Cable Crossover',
    de: 'Kabelzug über Kreuz von oben',
    fr: 'Écartés à la poulie vis-à-vis haute',
    es: 'Cruces en polea alta',
  },
  lib_hammer_chest: {
    en: 'Machine Chest Press',
    de: 'Brustpresse an der Maschine',
    fr: 'Développé poitrine à la machine',
    es: 'Press de pecho en máquina',
  },
  lib_dips_chest: {
    en: 'Chest Dips',
    de: 'Dips am Holm (Brust-Fokus)',
    fr: 'Dips aux barres parallèles (Pectoraux)',
    es: 'Fondos en paralelas (Pecho)',
  },
  lib_pushups: {
    en: 'Classic / Weighted Push-Ups',
    de: 'Klassische Liegestütze / mit Zusatzgewicht',
    fr: 'Pompes classiques / lestées',
    es: 'Flexiones clásicas / con lastre',
  },
  lib_deadlift: {
    en: 'Conventional Deadlift',
    de: 'Klassisches Kreuzheben',
    fr: 'Soulevé de terre classique',
    es: 'Peso muerto convencional',
  },
  lib_pullups_overhand: {
    en: 'Overhand Pull-Ups',
    de: 'Klimmzüge im Obergriff',
    fr: 'Tractions en pronation',
    es: 'Dominadas pronas',
  },
  lib_chinups: {
    en: 'Underhand Chin-Ups',
    de: 'Klimmzüge im Untergriff',
    fr: 'Tractions en supination',
    es: 'Dominadas supinas',
  },
  lib_lat_pulldown_wide: {
    en: 'Wide-Grip Lat Pulldown',
    de: 'Latzug breit zur Brust',
    fr: 'Tirage vertical prise large',
    es: 'Jalón al pecho agarre ancho',
  },
  lib_lat_pulldown_vbar: {
    en: 'V-Bar Close-Grip Lat Pulldown',
    de: 'Enger Latzug mit V-Griff',
    fr: 'Tirage vertical prise serrée (V-Bar)',
    es: 'Jalón al pecho agarre estrecho (V-Bar)',
  },
  lib_barbell_row: {
    en: 'Bent-Over Barbell Row',
    de: 'Vorgebeugtes Langhantelrudern',
    fr: 'Rowing barre buste penché',
    es: 'Remo con barra inclinado',
  },
  lib_db_row_bench: {
    en: 'Single-Arm Dumbbell Bench Row',
    de: 'Einarmiges Kurzhantelrudern auf der Bank',
    fr: 'Rowing unilatéral haltère sur banc',
    es: 'Remo a una mano con mancuerna en banco',
  },
  lib_seated_cable_row: {
    en: 'Seated Cable Row',
    de: 'Sitzendes Rudern am Kabelzug',
    fr: 'Tirage horizontal à la poulie basse',
    es: 'Remo sentado en polea baja',
  },
  lib_tbar_row: {
    en: 'T-Bar / Landmine Row',
    de: 'T-Bar Rudern',
    fr: 'Rowing à la T-Bar',
    es: 'Remo en barra T',
  },
  lib_face_pull: {
    en: 'Rope Cable Face Pull',
    de: 'Face Pull am Kabelzug mit Seil',
    fr: 'Face Pull à la poulie avec corde',
    es: 'Face Pull en polea con cuerda',
  },
  lib_back_extension: {
    en: '45-Degree Back Extension',
    de: 'Rückenstrecker auf der Schrägbank',
    fr: 'Extensions lombaires au banc',
    es: 'Extensiones de espalda en banco romano',
  },
  lib_back_squat: {
    en: 'Barbell Back Squat',
    de: 'Kniebeugen mit Langhantel',
    fr: 'Squat arrière à la barre',
    es: 'Sentadilla trasera con barra',
  },
  lib_front_squat: {
    en: 'Barbell Front Squat',
    de: 'Frontkniebeugen mit Langhantel',
    fr: 'Front Squat à la barre',
    es: 'Sentadilla frontal con barra',
  },
  lib_leg_press: {
    en: '45-Degree Leg Press',
    de: 'Beinpresse',
    fr: 'Presse à cuisses',
    es: 'Prensa de piernas',
  },
  lib_rdl: {
    en: 'Romanian Deadlift (RDL)',
    de: 'Rumänisches Kreuzheben (RDL)',
    fr: 'Soulevé de terre roumain (RDL)',
    es: 'Peso muerto rumano (RDL)',
  },
  lib_bulgarian_squat: {
    en: 'Bulgarian Split Squat',
    de: 'Bulgarische Kniebeugen mit Kurzhanteln',
    fr: 'Squat bulgare aux haltères',
    es: 'Sentadilla búlgara con mancuernas',
  },
  lib_walking_lunges: {
    en: 'Dumbbell Walking Lunges',
    de: 'Gehende Ausfallschritte mit Kurzhanteln',
    fr: 'Fentes marchées aux haltères',
    es: 'Zancadas caminando con mancuernas',
  },
  lib_leg_extension: {
    en: 'Seated Leg Extension',
    de: 'Beinstrecker an der Maschine',
    fr: 'Leg Extension assis à la machine',
    es: 'Extensiones de cuádriceps en máquina',
  },
  lib_lying_leg_curl: {
    en: 'Lying Leg Curl',
    de: 'Beinbeuger liegend an der Maschine',
    fr: 'Leg Curl allongé à la machine',
    es: 'Curl femoral tumbado en máquina',
  },
  lib_seated_leg_curl: {
    en: 'Seated Leg Curl',
    de: 'Beinbeuger sitzend an der Maschine',
    fr: 'Leg Curl assis à la machine',
    es: 'Curl femoral sentado en máquina',
  },
  lib_hip_thrust: {
    en: 'Barbell Hip Thrust',
    de: 'Hip Thrust mit Langhantel',
    fr: 'Hip Thrust à la barre',
    es: 'Hip Thrust con barra',
  },
  lib_hip_abduction: {
    en: 'Seated Hip Abduction Machine',
    de: 'Abduktoren-Maschine sitzend',
    fr: 'Abduction des hanches à la machine',
    es: 'Abducción de cadera en máquina',
  },
  lib_calf_raise: {
    en: 'Standing / Leg Press Calf Raise',
    de: 'Wadenheben stehend / an der Beinpresse',
    fr: 'Mollets debout / à la presse',
    es: 'Elevación de talones de pie / en prensa',
  },
  lib_ohp_barbell: {
    en: 'Standing Barbell Overhead Press (OHP)',
    de: 'Schulterdrücken stehend mit Langhantel (OHP)',
    fr: 'Développé militaire barre debout (OHP)',
    es: 'Press militar de pie con barra (OHP)',
  },
  lib_db_shoulder_press: {
    en: 'Seated Dumbbell Shoulder Press',
    de: 'Schulterdrücken sitzend mit Kurzhanteln',
    fr: 'Développé épaules assis aux haltères',
    es: 'Press de hombros sentado con mancuernas',
  },
  lib_db_lateral_raise: {
    en: 'Standing Dumbbell Lateral Raise',
    de: 'Seitheben stehend mit Kurzhanteln',
    fr: 'Élévations latérales debout aux haltères',
    es: 'Elevaciones laterales de pie con mancuernas',
  },
  lib_cable_lateral_raise: {
    en: 'Single-Arm Cable Lateral Raise',
    de: 'Einarmiges Seitheben am Kabelzug',
    fr: 'Élévation latérale unilatérale à la poulie basse',
    es: 'Elevación lateral en polea baja a una mano',
  },
  lib_reverse_pec_deck: {
    en: 'Reverse Pec Deck Rear Delt Fly',
    de: 'Reverse Butterfly (Hintere Schulter)',
    fr: 'Oiseau à la machine (Deltoïdes postérieurs)',
    es: 'Aperturas inversas en máquina (Hombro posterior)',
  },
  lib_db_rear_delt_fly: {
    en: 'Bent-Over Dumbbell Rear Delt Fly',
    de: 'Vorgebeugtes Seitheben mit Kurzhanteln',
    fr: 'Oiseau buste penché aux haltères',
    es: 'Pájaros con mancuernas inclinado',
  },
  lib_front_raise: {
    en: 'Dumbbell / Plate Front Raise',
    de: 'Frontheben mit Kurzhanteln / Hantelscheibe',
    fr: 'Élévations frontales haltères / disque',
    es: 'Elevaciones frontales con mancuernas / disco',
  },
  lib_machine_shoulder_press: {
    en: 'Machine Shoulder Press',
    de: 'Schulterpresse an der Maschine',
    fr: 'Développé épaules à la machine',
    es: 'Press de hombros en máquina',
  },
  lib_ezbar_curl: {
    en: 'EZ-Bar Bicep Curl',
    de: 'Bizepscurls mit SZ-Stange',
    fr: 'Curl biceps à la barre EZ',
    es: 'Curl de bíceps con barra Z',
  },
  lib_db_supination_curl: {
    en: 'Supinating Dumbbell Bicep Curl',
    de: 'Kurzhantelcurls mit Supination',
    fr: 'Curl biceps haltères avec supination',
    es: 'Curl de bíceps con mancuernas y supinación',
  },
  lib_hammer_curl: {
    en: 'Dumbbell Hammer Curl',
    de: 'Hammercurls mit Kurzhanteln',
    fr: 'Curl marteau aux haltères',
    es: 'Curl martillo con mancuernas',
  },
  lib_preacher_curl: {
    en: 'Preacher Curl',
    de: 'Scott-Curls am Bizepspult',
    fr: 'Curl au pupitre (Larry Scott)',
    es: 'Curl predicador en banco Scott',
  },
  lib_cable_bicep_curl: {
    en: 'Low-Pulley Cable Bicep Curl',
    de: 'Bizepscurls am tiefen Kabelzug',
    fr: 'Curl biceps à la poulie basse',
    es: 'Curl de bíceps en polea baja',
  },
  lib_skull_crusher: {
    en: 'EZ-Bar Skull Crusher',
    de: 'French Press liegend mit SZ-Stange',
    fr: 'Barre au front couché (Barre EZ)',
    es: 'Press francés tumbado con barra Z',
  },
  lib_tricep_rope_pushdown: {
    en: 'Cable Rope Tricep Pushdown',
    de: 'Trizepsdrücken am Kabelzug mit Seil',
    fr: 'Extension triceps à la poulie haute (Corde)',
    es: 'Extensión de tríceps en polea con cuerda',
  },
  lib_tricep_bar_pushdown: {
    en: 'Cable Straight-Bar Tricep Pushdown',
    de: 'Trizepsdrücken am Kabelzug mit Stange',
    fr: 'Extension triceps à la poulie haute (Barre)',
    es: 'Extensión de tríceps en polea con barra',
  },
  lib_dips_triceps: {
    en: 'Tricep Bench / Parallel Dips',
    de: 'Trizeps-Dips am Holm',
    fr: 'Dips serrés (Triceps)',
    es: 'Fondos para tríceps',
  },
  lib_overhead_db_ext: {
    en: 'Overhead Dumbbell / Cable Extension',
    de: 'Überkopf-Trizepsstrecken mit Kurzhantel / Kabel',
    fr: 'Extension nuque haltère / poulie',
    es: 'Extensión de tríceps tras nuca',
  },
  lib_close_grip_bench: {
    en: 'Close-Grip Barbell Bench Press',
    de: 'Enges Bankdrücken mit Langhantel',
    fr: 'Développé couché prise serrée',
    es: 'Press de banca agarre estrecho',
  },
  lib_cable_crunch: {
    en: 'Kneeling Cable Crunch',
    de: 'Kniende Crunches am Kabelzug',
    fr: 'Crunch à la poulie haute à genoux',
    es: 'Encogimientos en polea alta de rodillas',
  },
  lib_hanging_leg_raise: {
    en: 'Hanging Leg / Knee Raise',
    de: 'Hängendes Bein- / Knieheben',
    fr: 'Relevé de jambes / genoux suspendu',
    es: 'Elevación de piernas / rodillas colgado',
  },
  lib_ab_wheel: {
    en: 'Ab Wheel Rollout',
    de: 'Ab-Wheel Rollouts',
    fr: 'Roulette abdominale (Ab Wheel)',
    es: 'Rueda abdominal (Ab Wheel)',
  },
  lib_plank: {
    en: 'Forearm Core Plank',
    de: 'Unterarmstütz (Plank)',
    fr: 'Gainage planche (Plank)',
    es: 'Plancha abdominal (Plank)',
  },
  lib_machine_crunch: {
    en: 'Ab Crunch Machine',
    de: 'Bauchpresse an der Maschine',
    fr: 'Crunch abdominal à la machine',
    es: 'Encogimientos en máquina abdominal',
  },
  lib_russian_twist: {
    en: 'Weighted Russian Twist',
    de: 'Russian Twist mit Gewicht',
    fr: 'Russian Twist lesté',
    es: 'Giros rusos con disco / mancuerna',
  },
  lib_dead_bug: {
    en: 'Dead Bug Core Stability',
    de: 'Dead Bug (Core-Stabilität)',
    fr: 'Dead Bug (Stabilité du tronc)',
    es: 'Dead Bug (Estabilidad del core)',
  },
  lib_farmers_walk: {
    en: "Heavy Dumbbell Farmer's Walk",
    de: "Farmer's Walk mit schweren Kurzhanteln",
    fr: 'Marche du fermier aux haltères lourds',
    es: 'Paseo del granjero con mancuernas pesadas',
  },
  lib_kettlebell_swing: {
    en: 'Kettlebell Swing',
    de: 'Kettlebell Swing',
    fr: 'Kettlebell Swing',
    es: 'Kettlebell Swing',
  },
  lib_treadmill_incline: {
    en: 'Incline Treadmill Walk (10-12%)',
    de: 'Laufband Steigungsgehen (10-12%)',
    fr: 'Marche inclinée sur tapis (10-12%)',
    es: 'Caminata inclinada en cinta (10-12%)',
  },
  lib_bike_intervals: {
    en: 'Stationary Bike / AirBike Intervals',
    de: 'Standfahrrad / AirBike Intervalle',
    fr: 'Vélo stationnaire / AirBike (Intervalles)',
    es: 'Bicicleta estática / AirBike (Intervalos)',
  },
  lib_elliptical: {
    en: 'Elliptical Trainer (Zone 2 Cardio)',
    de: 'Crosstrainer (Zone 2 Ausdauer)',
    fr: 'Vélo elliptique (Cardio Zone 2)',
    es: 'Elíptica (Cardio Zona 2)',
  },
  lib_incline_chest_press_machine: {
    en: 'Incline Chest Press Machine',
    de: 'Schrägbank-Brustpresse an der Maschine',
    fr: 'Développé incliné à la machine',
    es: 'Press de pecho inclinado en máquina',
  },
  lib_single_arm_lat_pulldown: {
    en: 'Single-Arm Cable Lat Pulldown',
    de: 'Einarmiger Latzug am Kabelzug',
    fr: 'Tirage vertical unilatéral à la poulie',
    es: 'Jalón al pecho a una mano en polea',
  },
  lib_cable_tricep_extension: {
    en: 'Cable Tricep Extension',
    de: 'Trizepsstrecken am Kabelzug',
    fr: 'Extension triceps à la poulie',
    es: 'Extensión de tríceps en polea',
  },
  lib_jm_press: {
    en: 'JM Press (Barbell / Smith)',
    de: 'JM Press (Langhantel / Multipresse)',
    fr: 'JM Press (Barre / Machine)',
    es: 'JM Press (Barra / Máquina)',
  },
  lib_hip_adduction: {
    en: 'Seated Hip Adductor Machine',
    de: 'Adduktoren-Maschine sitzend',
    fr: 'Adduction des hanches à la machine',
    es: 'Aducción de cadera en máquina',
  },
  lib_partial_chinup: {
    en: 'Partial Underhand Chin-Ups',
    de: 'Teil-Klimmzüge im Untergriff',
    fr: 'Tractions supination partielles',
    es: 'Dominadas supinas parciales',
  },
  lib_wrist_curl: {
    en: 'Barbell / Dumbbell Wrist Curl',
    de: 'Handgelenkcurls mit Langhantel / Kurzhanteln',
    fr: 'Flexion des poignets barre / haltères',
    es: 'Curl de muñeca con barra / mancuernas',
  },
  lib_reverse_barbell_curl: {
    en: 'Overhand Reverse Barbell Curl',
    de: 'Reverse-Curls im Obergriff mit Langhantel',
    fr: 'Curl barre en pronation',
    es: 'Curl inverso con barra agarre prono',
  },
  lib_db_shrugs: {
    en: 'Dumbbell / Barbell Shrugs',
    de: 'Schulterheben mit Kurzhanteln / Langhantel',
    fr: 'Haussements d’épaules haltères / barre (Shrugs)',
    es: 'Encogimientos de trapecio con mancuernas / barra',
  },
  lib_seated_calf_raise: {
    en: 'Seated Calf Raise',
    de: 'Sitzendes Wadenheben',
    fr: 'Mollets assis (Machine / Haltères)',
    es: 'Elevación de talones sentado',
  },
  lib_decline_barbell_bench: {
    en: 'Decline Barbell Bench Press',
    de: 'Negativ-Bankdrücken mit Langhantel',
    fr: 'Développé décliné à la barre',
    es: 'Press de banca declinado con barra',
  },
  lib_smith_incline_press: {
    en: 'Incline Smith Machine Bench Press',
    de: 'Schrägbankdrücken an der Multipresse',
    fr: 'Développé incliné à la Smith Machine',
    es: 'Press inclinado en máquina Smith',
  },
  lib_low_to_high_cable_fly: {
    en: 'Low-to-High Cable Chest Fly',
    de: 'Fliegende am Kabelzug von unten nach oben',
    fr: 'Écartés poulie basse de bas en haut',
    es: 'Cruces en polea baja de abajo a arriba',
  },
  lib_db_pullover: {
    en: 'Lying Dumbbell Pullover',
    de: 'Überzüge mit Kurzhantel auf der Bank',
    fr: 'Pullover couché avec haltère',
    es: 'Pullover tumbado con mancuerna',
  },
  lib_floor_press: {
    en: 'Barbell / Dumbbell Floor Press',
    de: 'Floor Press mit Langhantel / Kurzhantel',
    fr: 'Développé au sol (Floor Press)',
    es: 'Press en el suelo (Floor Press)',
  },
  lib_incline_db_fly: {
    en: 'Incline Dumbbell Flyes',
    de: 'Fliegende mit Kurzhanteln auf der Schrägbank',
    fr: 'Écartés inclinés aux haltères',
    es: 'Aperturas inclinadas con mancuernas',
  },
  lib_svend_press: {
    en: 'Standing Plate Svend Press',
    de: 'Svend Press mit Hantelscheiben',
    fr: 'Svend Press avec disques',
    es: 'Svend Press con discos',
  },
  lib_deficit_pushups: {
    en: 'Deficit Push-Ups on Handles / Plates',
    de: 'Defizit-Liegestütze auf Griffen / Scheiben',
    fr: 'Pompes en déficit sur poignées / disques',
    es: 'Flexiones en déficit sobre agarres / discos',
  },
  lib_pendlay_row: {
    en: 'Pendlay Row',
    de: 'Pendlay-Rudern vom Boden',
    fr: 'Pendlay Row (départ au sol)',
    es: 'Remo Pendlay desde el suelo',
  },
  lib_seal_row: {
    en: 'Chest-Supported Seal Row',
    de: 'Seal Row (bauchlings auf der Bank)',
    fr: 'Seal Row sur banc élevé',
    es: 'Remo Seal tumbado en banco',
  },
  lib_chest_supported_machine_row: {
    en: 'Chest-Supported Machine Row',
    de: 'Rudermaschine mit Brustpolster',
    fr: 'Rowing machine avec appui thoracique',
    es: 'Remo en máquina con apoyo en pecho',
  },
  lib_straight_arm_pulldown: {
    en: 'Straight-Arm Cable Pulldown',
    de: 'Überzüge am Kabelzug mit gestreckten Armen',
    fr: 'Pullover debout bras tendus à la poulie haute',
    es: 'Jalón con brazos rectos en polea alta',
  },
  lib_meadows_row: {
    en: 'Single-Arm Landmine Meadows Row',
    de: 'Einarmiges Meadows-Rudern (Landmine)',
    fr: 'Meadows Row unilatéral à la landmine',
    es: 'Remo Meadows a una mano en landmine',
  },
  lib_rack_pull: {
    en: 'Barbell Rack Pull',
    de: 'Rack Pull (erhöhtes Kreuzheben)',
    fr: 'Rack Pull (Soulevé partiel sur rack)',
    es: 'Rack Pull desde soportes',
  },
  lib_neutral_pullups: {
    en: 'Neutral-Grip Pull-Ups',
    de: 'Klimmzüge im Neutralgriff',
    fr: 'Tractions prise neutre',
    es: 'Dominadas con agarre neutro',
  },
  lib_inverted_row: {
    en: 'Bodyweight Inverted Row',
    de: 'Invertiertes Rudern (Australische Klimmzüge)',
    fr: 'Rowing inversé (Tractions australiennes)',
    es: 'Remo invertido (Dominadas australianas)',
  },
  lib_barbell_shrugs: {
    en: 'Front Barbell Shrugs',
    de: 'Langhantel-Shrugs vor dem Körper',
    fr: 'Shrugs barre devant soi',
    es: 'Encogimientos frontales con barra',
  },
  lib_kelso_shrugs: {
    en: 'Incline Bench Kelso Shrugs',
    de: 'Kelso Shrugs auf der Schrägbank',
    fr: 'Kelso Shrugs sur banc incliné',
    es: 'Encogimientos Kelso en banco inclinado',
  },
  lib_good_morning: {
    en: 'Barbell Good Morning',
    de: 'Good Mornings mit Langhantel',
    fr: 'Good Morning à la barre',
    es: 'Buenos días con barra (Good Morning)',
  },
  lib_single_arm_cable_row: {
    en: 'Single-Arm Seated Cable Row',
    de: 'Einarmiges Kabelrudern',
    fr: 'Tirage horizontal unilatéral à la poulie basse',
    es: 'Remo en polea baja a una mano',
  },
  lib_hack_squat: {
    en: 'Hack Squat Machine',
    de: 'Hackenschmidt-Kniebeuge an der Maschine',
    fr: 'Hack Squat à la machine',
    es: 'Sentadilla Hack en máquina',
  },
  lib_goblet_squat: {
    en: 'Dumbbell / Kettlebell Goblet Squat',
    de: 'Goblet Squat mit Kurzhantel / Kettlebell',
    fr: 'Goblet Squat avec haltère / kettlebell',
    es: 'Sentadilla Goblet con mancuerna / pesa rusa',
  },
  lib_sumo_deadlift: {
    en: 'Sumo Deadlift',
    de: 'Sumo-Kreuzheben',
    fr: 'Soulevé de terre Sumo',
    es: 'Peso muerto Sumo',
  },
  lib_sissy_squat: {
    en: 'Sissy Squat (Quad Isolation)',
    de: 'Sissy Squat (Quadrizeps-Isolation)',
    fr: 'Sissy Squat (Isolation quadriceps)',
    es: 'Sissy Squat (Aislamiento de cuádriceps)',
  },
  lib_pendulum_squat: {
    en: 'Pendulum Squat Machine',
    de: 'Pendulum Squat Maschine',
    fr: 'Pendulum Squat à la machine',
    es: 'Sentadilla Pendulum en máquina',
  },
  lib_nordic_hamstring_curl: {
    en: 'Nordic Hamstring Curl',
    de: 'Nordic Hamstring Curls',
    fr: 'Nordic Hamstring Curl',
    es: 'Curl nórdico de isquiotibiales',
  },
  lib_single_leg_rdl: {
    en: 'Single-Leg Dumbbell RDL',
    de: 'Einbeiniges rumänisches Kreuzheben',
    fr: 'Soulevé de terre roumain unilatéral aux haltères',
    es: 'Peso muerto rumano a una pierna con mancuernas',
  },
  lib_glute_kickback_cable: {
    en: 'Cable Glute Kickback',
    de: 'Kickbacks für Gesäß am Kabelzug',
    fr: 'Extension de hanche arrière à la poulie (Kickback)',
    es: 'Patada de glúteo en polea baja',
  },
  lib_kas_glute_bridge: {
    en: 'Barbell KAS Glute Bridge',
    de: 'KAS Glute Bridge mit Langhantel',
    fr: 'KAS Glute Bridge à la barre',
    es: 'Puente de glúteo KAS con barra',
  },
  lib_step_ups: {
    en: 'Weighted Box Step-Ups',
    de: 'Step-Ups auf die Box mit Kurzhanteln',
    fr: 'Step-Ups lestés aux haltères',
    es: 'Subidas al cajón con mancuernas (Step-Ups)',
  },
  lib_copenhagen_plank: {
    en: 'Copenhagen Plank (Adductors)',
    de: 'Kopenhagen-Plank (Adduktoren)',
    fr: 'Gainage de Copenhague (Adducteurs)',
    es: 'Plancha de Copenhague (Aductores)',
  },
  lib_donkey_calf_raise: {
    en: 'Donkey Calf Raise',
    de: 'Donkey-Wadenheben vorgebeugt',
    fr: 'Extension des mollets penché (Donkey Calf Raise)',
    es: 'Elevación de talones tipo burro (Donkey Calf Raise)',
  },
  lib_tibialis_raise: {
    en: 'Standing Tibialis Raise',
    de: 'Tibialis-Heben stehend',
    fr: 'Élévation du tibial antérieur debout',
    es: 'Elevación de tibial de pie',
  },
  lib_single_leg_press: {
    en: 'Single-Leg 45-Degree Press',
    de: 'Einbeinige Beinpresse',
    fr: 'Presse à cuisses unilatérale',
    es: 'Prensa de piernas a una pierna',
  },
  lib_arnold_press: {
    en: 'Seated Dumbbell Arnold Press',
    de: 'Arnold Press mit Kurzhanteln',
    fr: 'Développé Arnold aux haltères',
    es: 'Press Arnold con mancuernas',
  },
  lib_landmine_press: {
    en: 'Single-Arm Landmine Shoulder Press',
    de: 'Einarmiges Landmine-Drücken',
    fr: 'Développé unilatéral à la landmine',
    es: 'Press unilateral en landmine',
  },
  lib_upright_row: {
    en: 'Barbell / Cable Upright Row',
    de: 'Aufrechtes Rudern mit Langhantel / Kabel',
    fr: 'Tirage menton à la barre / poulie',
    es: 'Remo al mentón con barra / polea',
  },
  lib_machine_lateral_raise: {
    en: 'Lateral Raise Machine',
    de: 'Seithebemaschine',
    fr: 'Élévations latérales à la machine',
    es: 'Elevaciones laterales en máquina',
  },
  lib_egyptian_cable_lateral: {
    en: 'Leaning Egyptian Cable Lateral Raise',
    de: 'Vorgelehtes Kabel-Seitheben (Egyptian Raise)',
    fr: 'Élévation latérale poulie inclinée (Egyptian Raise)',
    es: 'Elevación lateral inclinada en polea (Egyptian Raise)',
  },
  lib_cable_rear_delt_fly: {
    en: 'Cable Rear Delt Crossover Fly',
    de: 'Kabelzug-Reverse-Flys über Kreuz',
    fr: 'Oiseau croisé à la poulie (Deltoïdes postérieurs)',
    es: 'Cruces inversos en polea (Hombro posterior)',
  },
  lib_cable_front_raise: {
    en: 'Low-Pulley Cable Front Raise',
    de: 'Frontheben am tiefen Kabelzug',
    fr: 'Élévation frontale à la poulie basse',
    es: 'Elevación frontal en polea baja',
  },
  lib_lu_raises: {
    en: 'Full-Range Lateral Lu Raises',
    de: 'Lu Raises (voller Bewegungsradius)',
    fr: 'Lu Raises en amplitude complète',
    es: 'Elevaciones Lu en rango completo',
  },
  lib_incline_db_curl: {
    en: 'Incline Bench Dumbbell Curl',
    de: 'Schrägbank-Curls mit Kurzhanteln',
    fr: 'Curl incliné aux haltères',
    es: 'Curl inclinado con mancuernas',
  },
  lib_spider_curl: {
    en: 'Incline Chest-Supported Spider Curl',
    de: 'Spider Curls auf der Schrägbank',
    fr: 'Spider Curl sur banc incliné',
    es: 'Spider Curl apoyado en banco inclinado',
  },
  lib_concentration_curl: {
    en: 'Seated Concentration Curl',
    de: 'Konzentrationscurls mit Kurzhantel',
    fr: 'Curl concentration avec haltère',
    es: 'Curl concentrado con mancuerna',
  },
  lib_bayesian_cable_curl: {
    en: 'Behind-the-Body Bayesian Cable Curl',
    de: 'Bayesian Cable Curl (hinter dem Körper)',
    fr: 'Bayesian Curl à la poulie derrière le corps',
    es: 'Curl bayesiano en polea detrás del cuerpo',
  },
  lib_zottman_curl: {
    en: 'Dumbbell Zottman Curl',
    de: 'Zottman-Curls mit Kurzhanteln',
    fr: 'Curl Zottman aux haltères',
    es: 'Curl Zottman con mancuernas',
  },
  lib_overhead_cable_tricep: {
    en: 'Overhead Cable Rope Tricep Extension',
    de: 'Überkopf-Trizepsstrecken am Kabelzug mit Seil',
    fr: 'Extension triceps corde au-dessus de la tête',
    es: 'Extensión de tríceps con cuerda tras nuca en polea',
  },
  lib_single_arm_pushdown: {
    en: 'Single-Arm Cable Tricep Pushdown',
    de: 'Einarmiges Trizepsdrücken am Kabelzug',
    fr: 'Extension triceps unilatérale à la poulie',
    es: 'Extensión de tríceps en polea a una mano',
  },
  lib_diamond_pushups: {
    en: 'Diamond Close-Grip Push-Ups',
    de: 'Diamant-Liegestütze',
    fr: 'Pompes diamant (mains serrées)',
    es: 'Flexiones diamante (manos juntas)',
  },
  lib_reverse_wrist_curl: {
    en: 'Reverse Barbell / Dumbbell Wrist Extension',
    de: 'Umgekehrte Handgelenkcurls im Obergriff',
    fr: 'Extension des poignets en pronation',
    es: 'Extensión de muñecas agarre prono',
  },
  lib_dead_hang: {
    en: 'Timed Bar Dead Hang',
    de: 'Passives / Aktives Hängen an der Klimmzugstange',
    fr: 'Suspension statique à la barre (Dead Hang)',
    es: 'Colgado en barra por tiempo (Dead Hang)',
  },
  lib_pallof_press: {
    en: 'Band / Cable Pallof Press (Anti-Rotation)',
    de: 'Pallof Press (Anti-Rotation)',
    fr: 'Pallof Press (Anti-rotation)',
    es: 'Pallof Press con goma / polea (Antirotación)',
  },
  lib_side_plank: {
    en: 'Side Core Plank',
    de: 'Seitstütz (Side Plank)',
    fr: 'Gainage latéral (Side Plank)',
    es: 'Plancha lateral (Side Plank)',
  },
  lib_cable_woodchopper: {
    en: 'Cable Woodchopper (Obliques)',
    de: 'Kabelzug Woodchopper (Schräge Bauchmuskeln)',
    fr: 'Bûcheron à la poulie (Woodchopper)',
    es: 'Leñador en polea (Woodchopper)',
  },
  lib_dragon_flag: {
    en: 'Bench Dragon Flag',
    de: 'Dragon Flag auf der Bank',
    fr: 'Dragon Flag sur banc',
    es: 'Dragon Flag en banco',
  },
  lib_l_sit: {
    en: 'Parallel Bars / Hanging L-Sit',
    de: 'L-Sit am Holm oder hängend',
    fr: 'L-Sit aux barres ou suspendu',
    es: 'L-Sit en paralelas o colgado',
  },
  lib_bicycle_crunch: {
    en: 'Lying Bicycle Crunch',
    de: 'Fahrrad-Crunches liegend',
    fr: 'Crunch vélo couché (Bicycle Crunch)',
    es: 'Abdominales en bicicleta tumbado',
  },
  lib_rowing_ergometer: {
    en: 'Rowing Ergometer (Concept2)',
    de: 'Ruderergometer (Concept2)',
    fr: 'Rameur ergomètre (Concept2)',
    es: 'Remo ergómetro (Concept2)',
  },
  lib_stairmaster: {
    en: 'StairMaster Climber',
    de: 'StairMaster Treppensteiger',
    fr: 'Escaliers StairMaster',
    es: 'Escaladora StairMaster',
  },
  lib_sled_push_pull: {
    en: 'Prowler Sled Push / Pull',
    de: 'Schlittenschieben / -ziehen (Prowler Sled)',
    fr: 'Poussée / Tirage de traîneau (Prowler Sled)',
    es: 'Empuje / Arrastre de trineo (Prowler Sled)',
  },
  lib_jump_rope: {
    en: 'Boxing Jump Rope (Intervals / Rhythm)',
    de: 'Box-Springseil (Intervalle / Rhythmus)',
    fr: 'Corde à sauter de boxe (Intervalles / Rythme)',
    es: 'Comba de boxeo (Intervalos / Ritmo)',
  },
};

export const RANK_LOCALE: Record<RankTier, { title: Localized5; subtitle: Localized5 }> = {
  F: {
    title: {
      pl: 'Nieodkryty',
      en: 'Uncharted',
      de: 'Unentdeckt',
      fr: 'Inexploré',
      es: 'Sin explorar',
    },
    subtitle: {
      pl: 'Brak lub pierwsze 7 dni na siłowni',
      en: 'New or first 7 days in the gym',
      de: 'Neu oder die ersten 7 Tage im Studio',
      fr: 'Débutant ou 7 premiers jours en salle',
      es: 'Nuevo o primeros 7 días en el gimnasio',
    },
  },
  E: {
    title: {
      pl: 'Wdrażanie',
      en: 'Initiation',
      de: 'Einstieg',
      fr: 'Initiation',
      es: 'Iniciación',
    },
    subtitle: {
      pl: 'Pierwsze regularne serie po tygodniu treningów',
      en: 'First consistent sets after a week of training',
      de: 'Erste regelmäßige Sätze nach einer Trainingswoche',
      fr: 'Premières séries régulières après une semaine',
      es: 'Primeras series constantes tras una semana',
    },
  },
  D: {
    title: {
      pl: 'Adept Żelaza',
      en: 'Iron Adept',
      de: 'Eisen-Adept',
      fr: 'Adepte du Fer',
      es: 'Adepto del Hierro',
    },
    subtitle: {
      pl: 'Adaptacja techniki i pierwszy miesiąc pracy',
      en: 'Technique adaptation and first month of work',
      de: 'Technikanpassung und erster Trainingsmonat',
      fr: 'Maîtrise technique et premier mois de travail',
      es: 'Adaptación técnica y primer mes de trabajo',
    },
  },
  C: {
    title: {
      pl: 'Regularny',
      en: 'Consistent',
      de: 'Beständig',
      fr: 'Régulier',
      es: 'Constante',
    },
    subtitle: {
      pl: 'Solidny fundament objętości (1-3 miesiące)',
      en: 'Solid volume foundation (1-3 months)',
      de: 'Solides Volumenfundament (1-3 Monate)',
      fr: 'Base de volume solide (1-3 mois)',
      es: 'Base sólida de volumen (1-3 meses)',
    },
  },
  B: {
    title: {
      pl: 'Zaawansowany',
      en: 'Advanced',
      de: 'Fortgeschritten',
      fr: 'Avancé',
      es: 'Avanzado',
    },
    subtitle: {
      pl: 'Konsekwencja w mikrocyklach (3-6 miesięcy)',
      en: 'Consistent mesocycle progression (3-6 months)',
      de: 'Konsequente Mikrozyklen (3-6 Monate)',
      fr: 'Régularité sur les microcycles (3-6 mois)',
      es: 'Constancia en microciclos (3-6 meses)',
    },
  },
  A: {
    title: {
      pl: 'Weteran',
      en: 'Veteran',
      de: 'Veteran',
      fr: 'Vétéran',
      es: 'Veterano',
    },
    subtitle: {
      pl: 'Silnie zbudowana partia (pół roku - rok)',
      en: 'Well-developed muscle group (6-12 months)',
      de: 'Stark entwickelte Muskelgruppe (6-12 Monate)',
      fr: 'Groupe musculaire solide (6-12 mois)',
      es: 'Grupo muscular muy desarrollado (6-12 meses)',
    },
  },
  S: {
    title: {
      pl: 'Mistrz Partii',
      en: 'Muscle Master',
      de: 'Meister der Partie',
      fr: 'Maître du Muscle',
      es: 'Maestro Muscular',
    },
    subtitle: {
      pl: 'Wieloletni staż treningowy (1-3 lata)',
      en: 'Multi-year training experience (1-3 years)',
      de: 'Mehrjährige Trainingserfahrung (1-3 Jahre)',
      fr: 'Expérience pluriannuelle (1-3 ans)',
      es: 'Años de entrenamiento constante (1-3 años)',
    },
  },
  'S+': {
    title: {
      pl: 'Elita / Żelazny Szczyt',
      en: 'Elite / Iron Summit',
      de: 'Elite / Eisengipfel',
      fr: 'Élite / Sommet de Fer',
      es: 'Élite / Cima de Hierro',
    },
    subtitle: {
      pl: 'Ponad 3 lata systematycznej pracy i żelaznej rutyny',
      en: 'Over 3 years of disciplined iron routine',
      de: 'Über 3 Jahre systematischer Eisen-Routine',
      fr: 'Plus de 3 ans de discipline et de routine de fer',
      es: 'Más de 3 años de disciplina y rutina de hierro',
    },
  },
};

export const DAY_TAG_LOCALE: Record<string, { label: Localized5; shortLabel: Localized5 }> = {
  fbw: {
    label: {
      pl: 'Całe ciało',
      en: 'Full Body',
      de: 'Ganzkörper',
      fr: 'Full Body',
      es: 'Cuerpo Completo',
    },
    shortLabel: {
      pl: 'FBW',
      en: 'FBW',
      de: 'GK',
      fr: 'FBW',
      es: 'FBW',
    },
  },
  push: {
    label: {
      pl: 'Klatka + Barki + Triceps',
      en: 'Chest + Shoulders + Triceps',
      de: 'Brust + Schultern + Trizeps',
      fr: 'Pecs + Épaules + Triceps',
      es: 'Pecho + Hombros + Tríceps',
    },
    shortLabel: { pl: 'Push', en: 'Push', de: 'Push', fr: 'Push', es: 'Push' },
  },
  pull: {
    label: {
      pl: 'Plecy + Tył barków + Biceps',
      en: 'Back + Rear Delts + Biceps',
      de: 'Rücken + Hint. Schulter + Bizeps',
      fr: 'Dos + Arr. Épaules + Biceps',
      es: 'Espalda + Post. + Bíceps',
    },
    shortLabel: { pl: 'Pull', en: 'Pull', de: 'Pull', fr: 'Pull', es: 'Pull' },
  },
  legs: {
    label: {
      pl: 'Nogi + Pośladki',
      en: 'Legs + Glutes',
      de: 'Beine + Gesäß',
      fr: 'Jambes + Fessiers',
      es: 'Piernas + Glúteos',
    },
    shortLabel: { pl: 'Nogi', en: 'Legs', de: 'Beine', fr: 'Jambes', es: 'Piernas' },
  },
  upper: {
    label: {
      pl: 'Góra ciała',
      en: 'Upper Body',
      de: 'Oberkörper',
      fr: 'Haut du corps',
      es: 'Tren Superior',
    },
    shortLabel: { pl: 'Góra', en: 'Upper', de: 'Oberkörper', fr: 'Haut', es: 'Superior' },
  },
  lower: {
    label: {
      pl: 'Dół ciała',
      en: 'Lower Body',
      de: 'Unterkörper',
      fr: 'Bas du corps',
      es: 'Tren Inferior',
    },
    shortLabel: { pl: 'Dół', en: 'Lower', de: 'Unterkörper', fr: 'Bas', es: 'Inferior' },
  },
  chest: {
    label: {
      pl: 'Klatka piersiowa',
      en: 'Chest Focus',
      de: 'Brust-Fokus',
      fr: 'Focus Pectoraux',
      es: 'Enfoque Pecho',
    },
    shortLabel: { pl: 'Klatka', en: 'Chest', de: 'Brust', fr: 'Pecs', es: 'Pecho' },
  },
  back: {
    label: {
      pl: 'Plecy',
      en: 'Back Focus',
      de: 'Rücken-Fokus',
      fr: 'Focus Dos',
      es: 'Enfoque Espalda',
    },
    shortLabel: { pl: 'Plecy', en: 'Back', de: 'Rücken', fr: 'Dos', es: 'Espalda' },
  },
  shoulders: {
    label: {
      pl: 'Barki',
      en: 'Shoulders',
      de: 'Schultern',
      fr: 'Épaules',
      es: 'Hombros',
    },
    shortLabel: { pl: 'Barki', en: 'Shoulders', de: 'Schultern', fr: 'Épaules', es: 'Hombros' },
  },
  arms: {
    label: {
      pl: 'Biceps + Triceps',
      en: 'Biceps + Triceps',
      de: 'Bizeps + Trizeps',
      fr: 'Biceps + Triceps',
      es: 'Bíceps + Tríceps',
    },
    shortLabel: { pl: 'Ramiona', en: 'Arms', de: 'Arme', fr: 'Bras', es: 'Brazos' },
  },
  cardio: {
    label: {
      pl: 'Kondycja + Brzuch',
      en: 'Cardio + Core',
      de: 'Cardio + Core',
      fr: 'Cardio + Abdos',
      es: 'Cardio + Abdomen',
    },
    shortLabel: { pl: 'Cardio', en: 'Cardio', de: 'Cardio', fr: 'Cardio', es: 'Cardio' },
  },
  rest: {
    label: {
      pl: 'Dzień regeneracji',
      en: 'Recovery Day',
      de: 'Regenerationstag',
      fr: 'Jour de récupération',
      es: 'Día de recuperación',
    },
    shortLabel: { pl: 'Regeneracja', en: 'Rest', de: 'Pause', fr: 'Repos', es: 'Descanso' },
  },
};

export const MUSCLE_DESC_LOCALE: Record<MuscleSubGroupId, Localized4> = {
  upper_chest: {
    en: 'Clavicular head of the pectoralis major (incline presses and low-to-high flyes).',
    de: 'Oberer Schlüsselbeinanteil des großen Brustmuskels (Schrägbankdrücken).',
    fr: 'Faisceau claviculaire du grand pectoral (développés inclinés).',
    es: 'Porción clavicular del pectoral mayor (press inclinado).',
  },
  mid_lower_chest: {
    en: 'Sternal-costal fibers responsible for chest fullness, thickness, and pressing power.',
    de: 'Mittlerer und unterer Brustmuskelanteil für Brustfülle und Druckkraft.',
    fr: 'Faisceau sterno-costal donnant épaisseur et volume aux pectoraux.',
    es: 'Porción esternal que aporta plenitud y grosor al pectoral.',
  },
  front_delts: {
    en: 'Anterior deltoid active during all overhead and horizontal pressing movements.',
    de: 'Vorderer Deltamuskel, aktiv bei allem Überkopf- und Bankdrücken.',
    fr: 'Deltoïde antérieur sollicité dans tous les développés.',
    es: 'Deltoides anterior activo en todos los empujes verticales y horizontales.',
  },
  side_delts: {
    en: 'Lateral deltoid creating upper-body width and a classic V-taper silhouette.',
    de: 'Seitlicher Deltamuskel für breite Schultern und V-Form.',
    fr: 'Deltoïde latéral qui donne de la largeur à la silhouette en V.',
    es: 'Deltoides lateral que aporta amplitud y forma en V.',
  },
  rear_delts: {
    en: 'Posterior deltoid supporting 3D shoulder development and rotator cuff stability.',
    de: 'Hinterer Deltamuskel für 3D-Schultern und Rotatorenstabilität.',
    fr: 'Deltoïde postérieur pour le galbe de l’épaule et la stabilité.',
    es: 'Deltoides posterior clave para el volumen 3D y la estabilidad.',
  },
  biceps: {
    en: 'Biceps brachii and brachialis trained with barbell, dumbbell, preacher, and cable curls.',
    de: 'Bizeps und Brachialis (Langhantel-, Kurzhantel-, Scott- und Kabelcurls).',
    fr: 'Biceps brachial et brachial antérieur (curls barre, haltères, poulie).',
    es: 'Bíceps braquial y braquial anterior (curls con barra, mancuerna y polea).',
  },
  triceps: {
    en: 'Triceps brachii accounting for ~60% of upper arm mass (pushdowns, extensions, JM Press).',
    de: 'Trizeps macht ca. 60 % der Oberarmmasse aus (Pushdowns, French Press, JM Press).',
    fr: 'Triceps représentant ~60 % de la masse du bras (poulie, barre au front, JM Press).',
    es: 'Tríceps que supone ~60 % de la masa del brazo (extensiones, francés, JM Press).',
  },
  forearms: {
    en: 'Forearm flexors, extensors, and brachioradialis driving grip strength and wrist stability.',
    de: 'Unterarmmuskulatur und Brachioradialis für Griffkraft und Unterarmumfang.',
    fr: 'Avant-bras et long supinateur développant la force de préhension.',
    es: 'Antebrazos y braquiorradial que construyen fuerza de agarre.',
  },
  traps: {
    en: 'Upper trapezius stabilizing the shoulder girdle, neck, and heavy carries.',
    de: 'Oberer Trapezmuskel zur Stabilisierung von Schultergürtel und Nacken.',
    fr: 'Trapèze supérieur stabilisant la ceinture scapulaire et le cou.',
    es: 'Trapecio superior que estabiliza la cintura escapular y el cuello.',
  },
  lats: {
    en: 'Latissimus dorsi wings building back width through pull-ups, pulldowns, and pullovers.',
    de: 'Breiter Rückenmuskel (Latissimus) für die Rückenbreite bei Klimmzügen und Latzug.',
    fr: 'Grand dorsal bâtissant la largeur du dos (tractions, tirages verticaux).',
    es: 'Dorsal ancho que da amplitud a la espalda (dominadas y jalones).',
  },
  mid_back: {
    en: 'Rhomboids and middle trapezius adding upper-back thickness, posture, and detail.',
    de: 'Rautenmuskeln und mittlerer Trapez für Rückendichte und Haltung.',
    fr: 'Rhomboïdes et trapèzes moyens apportant épaisseur et relief au dos.',
    es: 'Romboides y trapecio medio que dan densidad y postura a la espalda.',
  },
  lower_back: {
    en: 'Spinal erectors bracing the lumbar spine during heavy deadlifts, rows, and squats.',
    de: 'Rückenstrecker zur Stabilisierung der Lendenwirbelsäule bei Kreuzheben und Kniebeugen.',
    fr: 'Érecteurs du rachis gainant le bas du dos sur les soulevés et squats.',
    es: 'Erectores espinales que protegen la columna lumbar en pesos muertos y sentadillas.',
  },
  abs: {
    en: 'Rectus abdominis and deep core bracing (cable crunches, hanging leg raises, ab wheel).',
    de: 'Gerader Bauchmuskel und tiefer Core (Kabelcrunches, hängendes Beinheben, Ab Wheel).',
    fr: 'Grand droit des abdos et gainage profond (crunch poulie, relevés de jambes).',
    es: 'Recto abdominal y core profundo (polea, elevaciones de piernas, rueda).',
  },
  obliques: {
    en: 'Internal and external obliques controlling torso rotation, waist tension, and lateral stability.',
    de: 'Schräge Bauchmuskeln für Rumpfrotation, Taille und seitliche Stabilität.',
    fr: 'Obliques contrôlant la rotation du buste et la stabilité latérale.',
    es: 'Oblicuos responsables de la rotación del torso y la estabilidad lateral.',
  },
  quads: {
    en: 'Anterior thigh chain (squats, leg press, hack squats, leg extensions, lunges).',
    de: 'Vordere Oberschenkelmuskulatur (Kniebeugen, Beinpresse, Beinstrecker).',
    fr: 'Chaîne antérieure de la cuisse (squats, presse, leg extension, fentes).',
    es: 'Cadena anterior del muslo (sentadillas, prensa, extensiones, zancadas).',
  },
  hamstrings: {
    en: 'Posterior thigh chain (Romanian deadlifts, lying and seated leg curls).',
    de: 'Hintere Oberschenkelmuskulatur (Rumänisches Kreuzheben, Beinbeuger).',
    fr: 'Chaîne postérieure de la cuisse (soulevé roumain, leg curl).',
    es: 'Cadena posterior del muslo (peso muerto rumano, curl femoral).',
  },
  glutes: {
    en: 'Gluteus maximus and medius driving hip extension (hip thrusts, Bulgarian split squats).',
    de: 'Großer und mittlerer Gesäßmuskel (Hip Thrust, bulgarische Kniebeugen, Abduktion).',
    fr: 'Grands et moyens fessiers (Hip Thrust, squat bulgare, abduction).',
    es: 'Glúteo mayor y medio (Hip Thrust, sentadilla búlgara, abducción).',
  },
  adductors: {
    en: 'Inner thigh adductors stabilizing hip alignment and power out of the squat hole.',
    de: 'Innere Oberschenkelmuskulatur (Adduktoren) für Hüftstabilität und Kniebeugentiefe.',
    fr: 'Adducteurs de la cuisse stabilisant la hanche en bas du squat.',
    es: 'Aductores internos del muslo que estabilizan la cadera en sentadilla.',
  },
  calves: {
    en: 'Gastrocnemius and soleus muscles trained with standing and seated calf raises.',
    de: 'Zwillings- und Schollenmuskel der Wade (Wadenheben stehend und sitzend).',
    fr: 'Jumeaux et soléaire travaillés debout et assis.',
    es: 'Gastrocnemio y sóleo entrenados con elevaciones de talones de pie y sentado.',
  },
};

export const SUPPLEMENT_LOCALE: Record<
  string,
  { name: Localized4; recommendedDoseLabel: Localized4; note: Localized4 }
> = {
  supp_creatine: {
    name: {
      en: 'Creatine Monohydrate',
      de: 'Kreatin-Monohydrat',
      fr: 'Créatine Monohydrate',
      es: 'Creatina Monohidrato',
    },
    recommendedDoseLabel: {
      en: '5g daily (or 0.05 g/kg)',
      de: '5 g täglich (oder 0,05 g/kg)',
      fr: '5 g par jour (ou 0,05 g/kg)',
      es: '5 g al día (o 0,05 g/kg)',
    },
    note: {
      en: 'Supports ATP regeneration, strength, and cellular hydration.',
      de: 'Unterstützt ATP-Resynthese, Kraft und Zellhydratation.',
      fr: 'Soutient la régénération de l’ATP, la force et l’hydratation.',
      es: 'Apoya la regeneración de ATP, fuerza e hidratación celular.',
    },
  },
  supp_whey: {
    name: {
      en: 'Whey Protein (WPC/WPI)',
      de: 'Whey-Protein (WPC/WPI)',
      fr: 'Protéine Whey (WPC/WPI)',
      es: 'Proteína Whey (WPC/WPI)',
    },
    recommendedDoseLabel: {
      en: '30g (~1 scoop)',
      de: '30 g (~1 Messlöffel)',
      fr: '30 g (~1 dose)',
      es: '30 g (~1 cazo)',
    },
    note: {
      en: 'Quickly completes daily protein intake after workouts.',
      de: 'Ergänzt schnell den täglichen Proteinbedarf nach dem Training.',
      fr: 'Complète rapidement l’apport protéique après l’entraînement.',
      es: 'Completa rápidamente el aporte diario de proteína tras entrenar.',
    },
  },
  supp_vitd: {
    name: {
      en: 'Vitamin D3 + K2 (MK-7)',
      de: 'Vitamin D3 + K2 (MK-7)',
      fr: 'Vitamine D3 + K2 (MK-7)',
      es: 'Vitamina D3 + K2 (MK-7)',
    },
    recommendedDoseLabel: {
      en: '2000-4000 IU daily',
      de: '2000-4000 IE täglich',
      fr: '2000-4000 UI par jour',
      es: '2000-4000 UI al día',
    },
    note: {
      en: 'Take with a fat-containing meal to support immunity and bones.',
      de: 'Zu einer fetthaltigen Mahlzeit für Immunsystem und Knochen.',
      fr: 'À prendre avec un repas contenant des lipides (immunité, os).',
      es: 'Tomar con una comida con grasas para inmunidad y huesos.',
    },
  },
  supp_magnesium: {
    name: {
      en: 'Magnesium Citrate / Glycinate',
      de: 'Magnesiumcitrat / Bisglycinat',
      fr: 'Magnésium Citrate / Bisglycinate',
      es: 'Magnesio Citrato / Bisglicinato',
    },
    recommendedDoseLabel: {
      en: '300-400 mg elemental',
      de: '300-400 mg elementar',
      fr: '300-400 mg élémentaire',
      es: '300-400 mg elemental',
    },
    note: {
      en: 'Best in the evening for nervous system recovery and sleep quality.',
      de: 'Ideal abends für Nervensystem, Muskelentspannung und Schlaf.',
      fr: 'Idéal le soir pour la récupération nerveuse et le sommeil.',
      es: 'Ideal por la noche para recuperación nerviosa y sueño.',
    },
  },
  supp_omega3: {
    name: {
      en: 'Omega-3 (EPA + DHA)',
      de: 'Omega-3 (EPA + DHA)',
      fr: 'Oméga-3 (EPA + DHA)',
      es: 'Omega-3 (EPA + DHA)',
    },
    recommendedDoseLabel: {
      en: '1000-2000 mg EPA/DHA',
      de: '1000-2000 mg EPA/DHA',
      fr: '1000-2000 mg EPA/DHA',
      es: '1000-2000 mg EPA/DHA',
    },
    note: {
      en: 'Supports cardiovascular health, joints, and inflammation recovery.',
      de: 'Fördert Herz-Kreislauf-Gesundheit, Gelenke und Regeneration.',
      fr: 'Soutient le système cardiovasculaire, les articulations et la récupération.',
      es: 'Apoya la salud cardiovascular, articulaciones y recuperación.',
    },
  },
  supp_citrulline: {
    name: {
      en: 'Citrulline Malate (Pre-workout)',
      de: 'Citrullin-Malat (Pre-Workout)',
      fr: 'Malate de Citrulline (Pré-entraînement)',
      es: 'Malato de Citrulina (Pre-entreno)',
    },
    recommendedDoseLabel: {
      en: '6-8 g before training',
      de: '6-8 g vor dem Training',
      fr: '6-8 g avant la séance',
      es: '6-8 g antes de entrenar',
    },
    note: {
      en: 'Optional, 30 min pre-workout for nitric oxide pump and endurance.',
      de: 'Optional 30 Min. vor dem Training für besseren Pump und Ausdauer.',
      fr: 'Optionnel 30 min avant la séance pour la congestion et l’endurance.',
      es: 'Opcional 30 min antes de entrenar para bombeo y resistencia.',
    },
  },
  supp_electrolytes: {
    name: {
      en: 'Electrolytes + Sodium + Potassium',
      de: 'Elektrolyte + Natrium + Kalium',
      fr: 'Électrolytes + Sodium + Potassium',
      es: 'Electrolitos + Sodio + Potasio',
    },
    recommendedDoseLabel: {
      en: '1 serving during workout',
      de: '1 Portion während des Trainings',
      fr: '1 dose pendant la séance',
      es: '1 dosis durante el entreno',
    },
    note: {
      en: 'Hydration support during heavy sessions and high sweat loss.',
      de: 'Hydratation bei intensiven Einheiten und starkem Schwitzen.',
      fr: 'Soutien d’hydratation pendant les séances intenses.',
      es: 'Soporte de hidratación en sesiones intensas y sudoración.',
    },
  },
};

export function getTranslatedExerciseName(
  exerciseId: string | undefined,
  fallbackPolishName: string,
  lang: AppLanguage
): string {
  if (lang === 'pl' || !exerciseId) return fallbackPolishName;
  const canonicalId = exerciseId.startsWith('lib_') ? exerciseId : exerciseId;
  const entry = EXERCISE_NAME_TRANSLATIONS[canonicalId];
  if (!entry) return fallbackPolishName;
  return entry[lang] || fallbackPolishName;
}

export function getTranslatedRankMeta(
  tier: RankTier,
  lang: AppLanguage
): { title: string; subtitle: string } {
  const entry = RANK_LOCALE[tier];
  return {
    title: entry.title[lang] || entry.title.pl,
    subtitle: entry.subtitle[lang] || entry.subtitle.pl,
  };
}

export function getTranslatedDayTag(
  tagId: string | undefined,
  fallbackLabel: string,
  lang: AppLanguage,
  short = false
): string {
  if (!tagId) return fallbackLabel;
  const entry = DAY_TAG_LOCALE[tagId];
  if (!entry) return fallbackLabel;
  return short ? entry.shortLabel[lang] || entry.shortLabel.pl : entry.label[lang] || entry.label.pl;
}

export function getTranslatedMuscleDesc(
  id: MuscleSubGroupId,
  fallbackDesc: string,
  lang: AppLanguage
): string {
  if (lang === 'pl') return fallbackDesc;
  const entry = MUSCLE_DESC_LOCALE[id];
  return entry ? entry[lang] : fallbackDesc;
}

export function getTranslatedSupplement(
  id: string,
  field: 'name' | 'recommendedDoseLabel' | 'note',
  fallback: string,
  lang: AppLanguage
): string {
  if (lang === 'pl') return fallback;
  const entry = SUPPLEMENT_LOCALE[id];
  if (!entry) return fallback;
  return entry[field][lang] || fallback;
}
