import { AppLanguage, DayPlan } from '../types/workout';

type LocalizedSet = Record<Exclude<AppLanguage, 'pl'>, string>;

const TEMPLATE_TEXT_MAP: Record<string, LocalizedSet> = {
  // Day names
  'Dzień regeneracji': {
    en: 'Rest day',
    de: 'Ruhetag',
    fr: 'Jour de repos',
    es: 'Día de descanso',
  },
  'Wolny dzień': {
    en: 'Free day',
    de: 'Freier Tag',
    fr: 'Jour libre',
    es: 'Día libre',
  },
  'FBW A · Siła bazowa': {
    en: 'FBW A · Base Strength',
    de: 'GK A · Grundkraft',
    fr: 'Full Body A · Force',
    es: 'Full Body A · Fuerza',
  },
  'FBW B · Hipertrofia': {
    en: 'FBW B · Hypertrophy',
    de: 'GK B · Hypertrophie',
    fr: 'Full Body B · Hypertrophie',
    es: 'Full Body B · Hipertrofia',
  },
  'FBW C · Akcesoria i Wyciągi': {
    en: 'FBW C · Accessories & Cables',
    de: 'GK C · Zubehör & Kabel',
    fr: 'Full Body C · Isolation & Poulies',
    es: 'Full Body C · Accesorios y Poleas',
  },
  'Regeneracja aktywna': {
    en: 'Active recovery',
    de: 'Aktive Erholung',
    fr: 'Récupération active',
    es: 'Recuperación activa',
  },
  Regeneracja: {
    en: 'Recovery',
    de: 'Regeneration',
    fr: 'Récupération',
    es: 'Recuperación',
  },
  'Spacer & Rozciąganie': {
    en: 'Walk & Stretching',
    de: 'Spaziergang & Dehnen',
    fr: 'Marche & Étirements',
    es: 'Caminata y Estiramientos',
  },
  'Pełen odpoczynek': {
    en: 'Full rest',
    de: 'Volle Erholung',
    fr: 'Repos complet',
    es: 'Descanso completo',
  },
  'Upper A · Siła Góry': {
    en: 'Upper A · Upper Strength',
    de: 'Oberkörper A · Kraft',
    fr: 'Haut A · Force',
    es: 'Torso A · Fuerza',
  },
  'Lower A · Przysiad i Przód uda': {
    en: 'Lower A · Squat & Quads',
    de: 'Unterkörper A · Kniebeuge & Quad',
    fr: 'Bas A · Squat & Quadriceps',
    es: 'Pierna A · Sentadilla y Cuádriceps',
  },
  'Upper B · Hipertrofia Góry': {
    en: 'Upper B · Upper Hypertrophy',
    de: 'Oberkörper B · Hypertrophie',
    fr: 'Haut B · Hypertrophie',
    es: 'Torso B · Hipertrofia',
  },
  'Lower B · Tył uda i Pośladek': {
    en: 'Lower B · Hamstrings & Glutes',
    de: 'Unterkörper B · Beinbeuger & Gesäß',
    fr: 'Bas B · Ischios & Fessiers',
    es: 'Pierna B · Femoral y Glúteos',
  },
  'Aktywny spacer': {
    en: 'Active walk',
    de: 'Aktiver Spaziergang',
    fr: 'Marche active',
    es: 'Caminata activa',
  },
  Odpoczynek: {
    en: 'Rest day',
    de: 'Ruhetag',
    fr: 'Jour de repos',
    es: 'Descanso',
  },
  'Push A · Wypychanie': {
    en: 'Push A · Pressing',
    de: 'Push A · Drücken',
    fr: 'Push A · Poussée',
    es: 'Push A · Empuje',
  },
  'Pull A · Przyciąganie': {
    en: 'Pull A · Pulling',
    de: 'Pull A · Ziehen',
    fr: 'Pull A · Tirage',
    es: 'Pull A · Tirón',
  },
  'Legs A · Nogi': {
    en: 'Legs A · Lower Body',
    de: 'Legs A · Beine',
    fr: 'Legs A · Jambes',
    es: 'Legs A · Piernas',
  },
  'Push B · Wypychanie': {
    en: 'Push B · Pressing',
    de: 'Push B · Drücken',
    fr: 'Push B · Poussée',
    es: 'Push B · Empuje',
  },
  'Pull B · Przyciąganie': {
    en: 'Pull B · Pulling',
    de: 'Pull B · Ziehen',
    fr: 'Pull B · Tirage',
    es: 'Pull B · Tirón',
  },
  'Legs B · Nogi': {
    en: 'Legs B · Lower Body',
    de: 'Legs B · Beine',
    fr: 'Legs B · Jambes',
    es: 'Legs B · Piernas',
  },
  'Klatka & Triceps': {
    en: 'Chest & Triceps',
    de: 'Brust & Trizeps',
    fr: 'Pectoraux & Triceps',
    es: 'Pecho y Tríceps',
  },
  'Plecy & Biceps': {
    en: 'Back & Biceps',
    de: 'Rücken & Bizeps',
    fr: 'Dos & Biceps',
    es: 'Espalda y Bíceps',
  },
  'Nogi & Pośladki': {
    en: 'Legs & Glutes',
    de: 'Beine & Gesäß',
    fr: 'Jambes & Fessiers',
    es: 'Piernas y Glúteos',
  },
  'Barki & Brzuch': {
    en: 'Shoulders & Abs',
    de: 'Schultern & Bauch',
    fr: 'Épaules & Abdos',
    es: 'Hombros y Abdomen',
  },

  // Subtitles
  'Odpoczynek, sen i nawodnienie': {
    en: 'Rest, sleep, and hydration',
    de: 'Ruhe, Schlaf und Hydration',
    fr: 'Repos, sommeil et hydratation',
    es: 'Descanso, sueño e hidratación',
  },
  'Skonfiguruj jako trening lub regenerację': {
    en: 'Set up as a workout or recovery day',
    de: 'Als Training oder Regeneration einrichten',
    fr: 'Configurer comme séance ou repos',
    es: 'Configura como entreno o descanso',
  },
  'Nogi • Klatka • Plecy • Barki • Brzuch': {
    en: 'Legs • Chest • Back • Shoulders • Abs',
    de: 'Beine • Brust • Rücken • Schultern • Bauch',
    fr: 'Jambes • Pecs • Dos • Épaules • Abdos',
    es: 'Piernas • Pecho • Espalda • Hombros • Abdomen',
  },
  'Dwugłowe • Góra klatki • Drążek • Barki': {
    en: 'Hamstrings • Upper Chest • Pull-ups • Shoulders',
    de: 'Beinbeuger • Obere Brust • Zug • Schultern',
    fr: 'Ischios • Haut Pecs • Tirage • Épaules',
    es: 'Femoral • Pecho Sup. • Dominadas • Hombros',
  },
  'Suwnica • Rozpiętki • Wiosło • Ramiona': {
    en: 'Leg Press • Flyes • Row • Arms',
    de: 'Beinpresse • Flys • Rudern • Arme',
    fr: 'Presse • Écartés • Rowing • Bras',
    es: 'Prensa • Aperturas • Remo • Brazos',
  },
  'Spacer i lekka mobilność': {
    en: 'Walk and light mobility',
    de: 'Spaziergang und leichte Mobilität',
    fr: 'Marche et mobilité légère',
    es: 'Caminata y movilidad ligera',
  },
  'Odpoczynek między sesjami FBW': {
    en: 'Rest between FBW sessions',
    de: 'Pause zwischen GK-Einheiten',
    fr: 'Repos entre séances Full Body',
    es: 'Descanso entre sesiones Full Body',
  },
  'Aktywna regeneracja weekendowa': {
    en: 'Active weekend recovery',
    de: 'Aktive Wochenend-Erholung',
    fr: 'Récupération active du week-end',
    es: 'Recuperación activa de fin de semana',
  },
  'Reset układu nerwowego przed poniedziałkiem': {
    en: 'Nervous system reset before Monday',
    de: 'Nervensystem-Reset vor Montag',
    fr: 'Récupération nerveuse avant lundi',
    es: 'Descanso nervioso antes del lunes',
  },
  'Klatka • Plecy • Barki • Ramiona': {
    en: 'Chest • Back • Shoulders • Arms',
    de: 'Brust • Rücken • Schultern • Arme',
    fr: 'Pecs • Dos • Épaules • Bras',
    es: 'Pecho • Espalda • Hombros • Brazos',
  },
  'Czworogłowe • Dwugłowe • Łydki • Brzuch': {
    en: 'Quads • Hamstrings • Calves • Abs',
    de: 'Quadrizeps • Beinbeuger • Waden • Bauch',
    fr: 'Quadriceps • Ischios • Mollets • Abdos',
    es: 'Cuádriceps • Femoral • Gemelos • Abdomen',
  },
  'Skos dodatni • Wiosłowanie • Barki bok • Tył': {
    en: 'Incline Press • Rows • Side & Rear Delts',
    de: 'Schrägbank • Rudern • Seitl./Hint. Schulter',
    fr: 'Incliné • Rowing • Deltoïdes Côté/Arrière',
    es: 'Inclinado • Remo • Hombro Lat./Post.',
  },
  'Dwugłowe • Pośladki • Suwnica • Brzuch': {
    en: 'Hamstrings • Glutes • Leg Press • Abs',
    de: 'Beinbeuger • Gesäß • Beinpresse • Bauch',
    fr: 'Ischios • Fessiers • Presse • Abdos',
    es: 'Femoral • Glúteos • Prensa • Abdomen',
  },
  'Sen, białko i spacer': {
    en: 'Sleep, protein, and a walk',
    de: 'Schlaf, Protein und Spaziergang',
    fr: 'Sommeil, protéines et marche',
    es: 'Sueño, proteína y caminata',
  },
  'Cardio w strefie tlenowej': {
    en: 'Aerobic zone cardio',
    de: 'Cardio in der aeroben Zone',
    fr: 'Cardio en zone aérobie',
    es: 'Cardio en zona aeróbica',
  },
  'Pełna regeneracja przed nowym cyklem': {
    en: 'Full recovery before the new cycle',
    de: 'Volle Erholung vor dem neuen Zyklus',
    fr: 'Récupération complète avant le cycle',
    es: 'Recuperación total antes del nuevo ciclo',
  },
  'Klatka • Przedni i boczny bark • Triceps': {
    en: 'Chest • Front & Side Delts • Triceps',
    de: 'Brust • Vord./Seitl. Schulter • Trizeps',
    fr: 'Pecs • Épaules Avant/Côté • Triceps',
    es: 'Pecho • Hombro Ant./Lat. • Tríceps',
  },
  'Plecy szerokość i grubość • Tył barku • Biceps': {
    en: 'Back Width & Thickness • Rear Delts • Biceps',
    de: 'Rücken Breite & Tiefe • Hint. Schulter • Bizeps',
    fr: 'Dos Largeur/Épaisseur • Arrière Épaule • Biceps',
    es: 'Espalda Amplitud/Grosor • Hombro Post. • Bíceps',
  },
  'Uda • Pośladki • Łydki • Brzuch': {
    en: 'Quads & Hams • Glutes • Calves • Abs',
    de: 'Beine • Gesäß • Waden • Bauch',
    fr: 'Cuisses • Fessiers • Mollets • Abdos',
    es: 'Muslos • Glúteos • Gemelos • Abdomen',
  },
  'Odpoczynek po 6 dniach treningu': {
    en: 'Rest after 6 training days',
    de: 'Ruhe nach 6 Trainingstagen',
    fr: 'Repos après 6 jours d\'entraînement',
    es: 'Descanso tras 6 días de entrenamiento',
  },
  'Wyciskania • Rozpiętki • Prostowania tricepsa': {
    en: 'Presses • Flyes • Triceps Extensions',
    de: 'Drücken • Flys • Trizepsstrecken',
    fr: 'Développés • Écartés • Extensions Triceps',
    es: 'Presses • Aperturas • Extensiones de Tríceps',
  },
  'Podciąganie • Wiosłowanie • Uginania ramion': {
    en: 'Pull-ups • Rows • Biceps Curls',
    de: 'Klimmzüge • Rudern • Bizepscurls',
    fr: 'Tractions • Rowing • Curls Biceps',
    es: 'Dominadas • Remo • Curls de Bíceps',
  },
  'Przysiady • RDL • Maszyny • Łydki': {
    en: 'Squats • RDL • Machines • Calves',
    de: 'Kniebeugen • RDL • Maschinen • Waden',
    fr: 'Squats • RDL • Machines • Mollets',
    es: 'Sentadillas • RDL • Máquinas • Gemelos',
  },
  'OHP • Wznosy bokiem • Tył barku • Core': {
    en: 'OHP • Lateral Raises • Rear Delts • Core',
    de: 'OHP • Seitheben • Hint. Schulter • Core',
    fr: 'Développé Militaire • Élévations • Arrière Épaule • Core',
    es: 'Press Militar • Laterales • Hombro Post. • Core',
  },
  'Pełna regeneracja przed kolejnym tygodniem': {
    en: 'Full recovery before next week',
    de: 'Volle Erholung vor der nächsten Woche',
    fr: 'Récupération complète avant lundi',
    es: 'Recuperación completa antes de la próxima semana',
  },

  // Warmups
  'Zadbaj o 7–9h snu, białko w diecie i mobilność stawów.': {
    en: 'Aim for 7-9h of sleep, protein intake, and joint mobility.',
    de: 'Achte auf 7-9h Schlaf, ausreichend Protein und Gelenkmobilität.',
    fr: 'Vise 7 à 9h de sommeil, un bon apport en protéines et de la mobilité.',
    es: 'Cuida 7-9h de sueño, buena proteína y movilidad articular.',
  },
  'Lekki spacer 6 000 – 10 000 kroków na świeżym powietrzu i krótkie rozciąganie.': {
    en: 'Light outdoor walk of 6,000-10,000 steps and brief stretching.',
    de: 'Leichter Spaziergang von 6.000-10.000 Schritten und kurzes Dehnen.',
    fr: 'Marche légère de 6 000 à 10 000 pas en extérieur et étirements courts.',
    es: 'Caminata ligera de 6.000-10.000 pasos al aire libre y estiramientos.',
  },
  '5 min orbitrek/bieżnia, krążenia stawów, 2 serie wstępne głównych bojów.': {
    en: '5 min cardio, joint circles, 2 warm-up sets on main lifts.',
    de: '5 Min. Cardio, Gelenkkreise, 2 Aufwärmsätze bei den Hauptübungen.',
    fr: '5 min cardio, rotations articulaires, 2 séries d\'échauffement.',
    es: '5 min cardio, movilidad articular y 2 series de aproximación.',
  },
  'Rozgrzewka bioder i rotatorów barków gumą oporową.': {
    en: 'Hip and rotator cuff warm-up with a resistance band.',
    de: 'Hüft- und Rotatorenmanschetten-Warm-up mit Widerstandsband.',
    fr: 'Échauffement des hanches et rotateurs d\'épaule à l\'élastique.',
    es: 'Calentamiento de cadera y manguito rotador con banda elástica.',
  },
  'Aktywacja pośladków, 2 serie rozgrzewkowe wyciskań.': {
    en: 'Glute activation and 2 warm-up pressing sets.',
    de: 'Gesäß-Aktivierung und 2 Aufwärmsätze beim Drücken.',
    fr: 'Activation des fessiers et 2 séries légères de développé.',
    es: 'Activación de glúteos y 2 series suaves de empuje.',
  },
  'Rotatory barków z gumą, 2 serie wstępne wyciskania.': {
    en: 'Band shoulder rotations and 2 warm-up bench sets.',
    de: 'Schulter-Rotatoren mit Band und 2 Aufwärmsätze Drücken.',
    fr: 'Rotateurs d\'épaule à l\'élastique et 2 séries d\'échauffement.',
    es: 'Rotadores de hombro con banda y 2 series de aproximación.',
  },
  'Mobilizacja stawu skokowego i bioder, przysiady bez ciężaru.': {
    en: 'Ankle and hip mobility, plus bodyweight squats.',
    de: 'Sprunggelenks- und Hüftmobilität sowie Kniebeugen ohne Gewicht.',
    fr: 'Mobilité chevilles/hanches et squats au poids du corps.',
    es: 'Movilidad de tobillo y cadera con sentadillas sin peso.',
  },
  '5 min rozgrzewki ramion i łopatek.': {
    en: '5 min shoulder and scapular warm-up.',
    de: '5 Min. Schulter- und Schulterblatt-Warm-up.',
    fr: '5 min d\'échauffement des épaules et omoplates.',
    es: '5 min de calentamiento de hombros y escápulas.',
  },
  'Glute bridge bez ciężaru i wymachy nóg.': {
    en: 'Bodyweight glute bridges and leg swings.',
    de: 'Glute Bridges ohne Gewicht und Beinschwünge.',
    fr: 'Glute bridge au poids du corps et balancements de jambes.',
    es: 'Puente de glúteo sin peso y balanceos de pierna.',
  },
  'Rotatory zewnętrzne barków i serie wstępne wyciskania.': {
    en: 'External shoulder rotations and warm-up pressing sets.',
    de: 'Außenrotation der Schulter und Aufwärmsätze Drücken.',
    fr: 'Rotations externes d\'épaule et séries d\'échauffement.',
    es: 'Rotaciones externas de hombro y series de aproximación.',
  },
  'Zwis na drążku i ściągania łopatek na wyciągu.': {
    en: 'Dead hang on the bar and scapular pulldowns.',
    de: 'Aushängen an der Stange und Schulterblatt-Ziehen am Kabel.',
    fr: 'Suspension à la barre et rétractions scapulaires à la poulie.',
    es: 'Colgado pasivo en barra y retracciones escapulares en polea.',
  },
  'Rozgrzewka bioder, 2 serie wstępne przysiadu.': {
    en: 'Hip warm-up and 2 light squat sets.',
    de: 'Hüft-Warm-up und 2 leichte Kniebeugen-Sätze.',
    fr: 'Échauffement des hanches et 2 séries légères de squat.',
    es: 'Calentamiento de cadera y 2 series ligeras de sentadilla.',
  },
  'Krążenia ramion i 2 serie wstępne wyciskania na ławce.': {
    en: 'Arm circles and 2 warm-up bench press sets.',
    de: 'Armkreisen und 2 Aufwärmsätze Bankdrücken.',
    fr: 'Rotations de bras et 2 séries d\'échauffement au développé.',
    es: 'Círculos de brazos y 2 series de aproximación en banca.',
  },
  'Aktywny zwis na drążku i ściągania łopatek.': {
    en: 'Active bar hang and scapular pull-downs.',
    de: 'Aktives Hängen an der Stange und Schulterblatt-Aktivierung.',
    fr: 'Suspension active et activation des omoplates.',
    es: 'Colgado activo en barra y activación escapular.',
  },
  'Mobilizacja bioder i 2 serie lekkiego przysiadu.': {
    en: 'Hip mobility and 2 light squat warm-up sets.',
    de: 'Hüftmobilität und 2 leichte Aufwärmsätze Kniebeuge.',
    fr: 'Mobilité des hanches et 2 séries légères de squat.',
    es: 'Movilidad de cadera y 2 series ligeras de sentadilla.',
  },
  'Rotatory zewnętrzne barków z linką lub lekkim hantlem.': {
    en: 'External shoulder rotations with cable or light dumbbell.',
    de: 'Schulter-Außenrotation am Kabel oder mit leichter Kurzhantel.',
    fr: 'Rotations externes à la poulie ou haltère léger.',
    es: 'Rotaciones externas con polea o mancuerna ligera.',
  },
};

function translateTemplateText(text: string, lang: AppLanguage): string {
  if (lang === 'pl') return text;
  const hit = TEMPLATE_TEXT_MAP[text];
  return hit ? hit[lang] : text;
}

export function localizeTemplateDayList(days: DayPlan[], lang: AppLanguage): DayPlan[] {
  if (lang === 'pl') return days;
  return days.map((d) => ({
    ...d,
    name: translateTemplateText(d.name, lang),
    subtitle: translateTemplateText(d.subtitle, lang),
    time: translateTemplateText(d.time, lang),
    warmup: d.warmup ? translateTemplateText(d.warmup, lang) : d.warmup,
  }));
}
