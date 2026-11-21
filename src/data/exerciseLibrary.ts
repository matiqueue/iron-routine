import {
  AppLanguage,
  DayMetaInfo,
  DayPlan,
  EquipmentType,
  Exercise,
  MuscleCategory,
  PlanTemplateKey,
} from '../types/workout';
import { getStoredLanguageSync } from '../services/languageStore';
import { localizeTemplateDayList } from '../i18n/templateDayLocale';
import {
  EXERCISE_MUSCLE_MAP,
  getInvolvedMuscleCategories,
  MUSCLE_SUBGROUP_MAP,
} from './exerciseAnatomyMap';
import { getExerciseImageUrl } from './exerciseImages';

export const DEFAULT_DAYS_OF_WEEK: DayMetaInfo[] = [
  { id: 'mon', label: 'Poniedziałek', short: 'Pn' },
  { id: 'tue', label: 'Wtorek', short: 'Wt' },
  { id: 'wed', label: 'Środa', short: 'Śr' },
  { id: 'thu', label: 'Czwartek', short: 'Cz' },
  { id: 'fri', label: 'Piątek', short: 'Pt' },
  { id: 'sat', label: 'Sobota', short: 'So' },
  { id: 'sun', label: 'Niedziela', short: 'Nd' },
];

export const MUSCLE_CATEGORY_META: { id: MuscleCategory; label: string }[] = [
  { id: 'klatka', label: 'Klatka' },
  { id: 'plecy', label: 'Plecy' },
  { id: 'nogi', label: 'Nogi' },
  { id: 'barki', label: 'Barki' },
  { id: 'ramiona', label: 'Ramiona' },
  { id: 'brzuch', label: 'Brzuch' },
  { id: 'ogolne', label: 'Ogólne' },
];

export const MUSCLE_LABELS: Record<MuscleCategory, string> = {
  klatka: 'Klatka piersiowa',
  plecy: 'Plecy',
  nogi: 'Nogi',
  barki: 'Barki',
  ramiona: 'Ramiona',
  brzuch: 'Brzuch',
  ogolne: 'Ogólne & Cardio',
};

export const EQUIPMENT_OPTIONS: EquipmentType[] = [
  'Sztanga',
  'Hantle',
  'Maszyna',
  'Wyciąg',
  'Masa ciała',
  'Inne',
];

export const PLAN_TEMPLATE_OPTIONS: {
  id: PlanTemplateKey;
  label: string;
  subtitle: string;
  summary: string;
}[] = [
  {
    id: 'fbw3',
    label: 'FBW 3 dni',
    subtitle: 'Full Body Workout (Pn / Śr / Pt)',
    summary: '3 sesje całego ciała tygodniowo, idealne na start i siłę bazową.',
  },
  {
    id: 'upper_lower',
    label: 'Upper / Lower',
    subtitle: 'Góra / Dół (4 dni)',
    summary: 'Podział 4-dniowy na partie górne i dolne dla optymalnej objętości.',
  },
  {
    id: 'ppl',
    label: 'Push / Pull / Legs',
    subtitle: 'Split 6-dniowy PPL',
    summary: 'Wysoka objętość w systemie wypychanie / przyciąganie / nogi.',
  },
  {
    id: 'split4',
    label: 'Split 4-dniowy (Inne)',
    subtitle: 'Klasyczny podział partiami (4 dni)',
    summary: 'Klatka + Triceps, Plecy + Biceps, Nogi oraz Barki + Brzuch.',
  },
  {
    id: 'blank',
    label: 'Pusty plan',
    subtitle: 'Własna konfiguracja od zera',
    summary: '7 dni gotowych do samodzielnego ułożenia z bazy ćwiczeń.',
  },
];

function ex(
  id: string,
  name: string,
  category: MuscleCategory,
  equipment: EquipmentType,
  sets: number,
  reps: string,
  rest: number,
  description: string,
  note?: string,
  ab?: boolean
): Exercise {
  const mapped = EXERCISE_MUSCLE_MAP[id];
  return {
    id,
    name,
    category,
    primaryMuscle: mapped?.primary,
    secondaryMuscles: mapped?.secondary ? mapped.secondary.map((s) => ({ ...s })) : undefined,
    equipment,
    sets,
    reps,
    rest,
    description,
    note,
    imageUrl: getExerciseImageUrl(id, 0),
    ab,
  };
}

export const EXERCISE_LIBRARY: Exercise[] = [
  // ==================== KLATKA ====================
  ex(
    'lib_barbell_bench',
    'Wyciskanie sztangi na ławce płaskiej',
    'klatka',
    'Sztanga',
    4,
    '6-8',
    150,
    'Ściągnij łopatki w dół i do siebie, utrzymuj stabilny kontakt stóp z podłożem. Opuść sztangę kontrolowanie na dolną część mostka i wypchnij dynamicznie w górę.',
    'Łokcie pod kątem ok. 45° względem tułowia, nadgarstki neutralne.'
  ),
  ex(
    'lib_incline_barbell_bench',
    'Wyciskanie sztangi na skosie dodatnim',
    'klatka',
    'Sztanga',
    3,
    '8-10',
    120,
    'Ustaw oparcie ławki na 30°. Opuść sztangę w okolice górnej części klatki piersiowej i wypchnij w górę bez odrywania pośladków.',
    'Kąt 30° mocniej angażuje górny akton klatki niż zbyt strome 45°.'
  ),
  ex(
    'lib_db_bench_flat',
    'Wyciskanie hantli na ławce płaskiej',
    'klatka',
    'Hantle',
    3,
    '8-10',
    120,
    'Połóż się ze stabilnym mostkiem, hantle prowadź płynnym łukiem w pełnym zakresie ruchu. Zejdź do lekkiego rozciągnięcia klatki na dole.',
    'Unikaj obijania hantli na górze, utrzymuj napięcie.'
  ),
  ex(
    'lib_db_incline_press',
    'Wyciskanie hantli na skosie dodatnim',
    'klatka',
    'Hantle',
    3,
    '8-12',
    90,
    'Na ławce pod kątem 30–35° opuszczaj hantle kontrolowanie na wysokość górnej klatki i wyciskaj z lekkim zbliżeniem na górze.',
    '1 sekunda pauzy na dole poprawia czucie mięśniowe.'
  ),
  ex(
    'lib_db_fly',
    'Rozpiętki z hantlami na ławce',
    'klatka',
    'Hantle',
    3,
    '12-15',
    75,
    'Z lekko ugiętymi łokciami otwieraj ramiona na boki do przyjemnego rozciągnięcia klatki, po czym przyciągaj je łukiem jakbyś obejmował drzewo.',
    'Stały kąt w stawie łokciowym przez cały ruch.'
  ),
  ex(
    'lib_butterfly',
    'Rozpiętki na maszynie (Butterfly)',
    'klatka',
    'Maszyna',
    3,
    '12-15',
    60,
    'Ustaw siedzisko tak, by dłonie znajdowały się na wysokości środka klatki. Złącz ramiona z przodu i przytrzymaj napięcie na 1 sekundę.',
    'Świetne ćwiczenie izolowane na dopięcie serii.'
  ),
  ex(
    'lib_cable_crossover',
    'Krzyżowanie linek wyciągu górnego',
    'klatka',
    'Wyciąg',
    3,
    '12-15',
    60,
    'Zrób krok do przodu w stabilnej pozycji, prowadź linki po łuku w dół i do środka. Wracaj powoli w fazie ekscentrycznej.',
    'Nie szarp tułowiem; kontroluj ciężar szczególnie przy powrocie.'
  ),
  ex(
    'lib_hammer_chest',
    'Wyciskanie na maszynie (Chest Press)',
    'klatka',
    'Maszyna',
    3,
    '10-12',
    90,
    'Ustaw wysokość fotela tak, by uchwyty wypadały na środku klatki piersiowej. Wypchnij przed siebie, nie blokując łokci na siłę.',
    'Bezpieczna praca blisko upadku mięśniowego.'
  ),
  ex(
    'lib_dips_chest',
    'Pompki na poręczach (Dipsy) - klatka',
    'klatka',
    'Masa ciała',
    3,
    '8-12',
    120,
    'Pochyl lekko tułów do przodu (ok. 20–30°) i zejdź do kąta ok. 90° w łokciach, prowadząc je nieco szerzej.',
    'Po osiągnięciu 12+ powtórzeń dodaj ciężar u pasa.'
  ),
  ex(
    'lib_pushups',
    'Pompki klasyczne / z obciążeniem',
    'klatka',
    'Masa ciała',
    3,
    '12-20',
    60,
    'Utrzymuj proste ciało z napiętym brzuchem i pośladkami. Dotknij niemal klatką podłoża i wyprostuj ramiona.',
    'Dłonie minimalnie szerzej niż barki.'
  ),

  // ==================== PLECY ====================
  ex(
    'lib_deadlift',
    'Martwy ciąg klasyczny',
    'plecy',
    'Sztanga',
    3,
    '5-6',
    180,
    'Ustaw stopy na szerokość bioder, sztangę blisko piszczeli. Zablokuj plecy prosto, weź głęboki wdech do brzucha i podnieś ciężar prostując kolana oraz biodra.',
    'Sztanga idzie pionowo po nogach. Bez zaokrąglania odcinka lędźwiowego.'
  ),
  ex(
    'lib_pullups_overhand',
    'Podciąganie na drążku nachwytem',
    'plecy',
    'Masa ciała',
    3,
    '6-10',
    120,
    'Chwyć drążek nieco szerzej niż barki. Zaczynaj ruch od ściągnięcia łopatek w dół, podciągnij klatkę w stronę drążka i opuść się w pełni.',
    'Użyj gumy oporowej lub pasa z ciężarem według poziomu.'
  ),
  ex(
    'lib_chinups',
    'Podciąganie na drążku podchwytem',
    'plecy',
    'Masa ciała',
    3,
    '6-10',
    120,
    'Chwyt na szerokość barków dłońmi do siebie. Płynne podciągnięcie brody nad drążek z mocnym zaangażowaniem najszerszego grzbietu i bicepsów.',
    'Pełen wyprost w zwisie w każdym powtórzeniu.'
  ),
  ex(
    'lib_lat_pulldown_wide',
    'Ściąganie drążka wyciągu górnego szeroko',
    'plecy',
    'Wyciąg',
    3,
    '10-12',
    90,
    'Usiądź stabilnie pod wałkami, lekko odchyl tułów (ok. 15°). Ściągnij drążek do górnej części klatki piersiowej, prowadząc łokcie w dół.',
    'Ciągnij z pleców i łopatek, nie z samych dłoni.'
  ),
  ex(
    'lib_lat_pulldown_vbar',
    'Ściąganie uchwytu V-bar wyciągu górnego',
    'plecy',
    'Wyciąg',
    3,
    '10-12',
    90,
    'Chwyć wąski trójkąt chwytem neutralnym, ściągnij go płynnie do mostka i pozwól łopatkom wrócić wysoko w górze.',
    'Silnie angażuje dolną część najszerszego grzbietu.'
  ),
  ex(
    'lib_barbell_row',
    'Wiosłowanie sztangą w opadzie tułowia',
    'plecy',
    'Sztanga',
    4,
    '8-10',
    120,
    'Pochyl tułów pod kątem ok. 45° z prostym kręgosłupem. Przyciągaj sztangę w stronę dolnej części brzucha / pępka i kontroluj opuszczenie.',
    'Nie podrzucaj ciężaru pracą bioder.'
  ),
  ex(
    'lib_db_row_bench',
    'Wiosłowanie hantlem w oparciu o ławkę',
    'plecy',
    'Hantle',
    3,
    '10-12',
    75,
    'Oprzyj rękę i kolano o ławkę z płaskimi plecami. Prowadź hantel łukiem w kierunku biodra, ściągając mocno łopatkę.',
    'Kontrolowana pauza w górze 1s.'
  ),
  ex(
    'lib_seated_cable_row',
    'Przyciąganie linki wyciągu dolnego siedząc',
    'plecy',
    'Wyciąg',
    3,
    '10-12',
    90,
    'Usiądź prosto z lekko ugiętymi kolanami. Przyciągaj uchwyt do brzucha ze ściągnięciem łopatek na końcu ruchu.',
    'Nie kołysz tułowiem mocno przód–tył.'
  ),
  ex(
    'lib_tbar_row',
    'Wiosłowanie półsztangą / na maszynie T-Bar',
    'plecy',
    'Maszyna',
    3,
    '8-12',
    90,
    'Stabilne podparcie lub pozycja w opadzie. Przyciągaj ciężar płynnie w kierunku klatki piersiowej / brzucha, utrzymując spięcie środka pleców.',
    'Skup się na zbliżeniu łopatek do kręgosłupa.'
  ),
  ex(
    'lib_face_pull',
    'Face Pull na wyciągu ze sznurem',
    'plecy',
    'Wyciąg',
    3,
    '15-20',
    60,
    'Ustaw linkę na wysokości czoła. Przyciągaj sznur do twarzy, rozciągając go na boki z rotacją zewnętrzną ramion.',
    'Kluczowe ćwiczenie dla zdrowia barków i tylnego aktonu.'
  ),
  ex(
    'lib_back_extension',
    'Wyprosty grzbietu na ławce rzymskiej',
    'plecy',
    'Masa ciała',
    3,
    '12-15',
    75,
    'Oprzyj biodra poniżej krawędzi podparcia, opuść tułów w dół z prostymi plecami i unieś do linii ciała napinając pośladki oraz prostowniki.',
    'Możesz trzymać talerz przy klatce jako progresję.'
  ),

  // ==================== NOGI ====================
  ex(
    'lib_back_squat',
    'Przysiad ze sztangą na plecach',
    'nogi',
    'Sztanga',
    4,
    '6-8',
    180,
    'Połóż sztangę na górnym kapturze, weź głęboki oddech brzuszny, zejdź płynnie poniżej równoległości ud i wypchnij się dynamicznie z całej stopy.',
    'Kolana prowadź w linii palców stóp.'
  ),
  ex(
    'lib_front_squat',
    'Przysiad przedni ze sztangą (Front Squat)',
    'nogi',
    'Sztanga',
    3,
    '6-8',
    150,
    'Ułóż sztangę na przednich barkach z wysoko uniesionymi łokciami. Utrzymuj pionowy tułów schodząc głęboko w dół.',
    'Mocno buduje czworogłowe uda i mięśnie core.'
  ),
  ex(
    'lib_leg_press',
    'Wypychanie ciężaru na suwnicy (Leg Press)',
    'nogi',
    'Maszyna',
    4,
    '10-12',
    120,
    'Ustaw stopy na platformie na szerokość barków. Zginaj kolana głęboko bez odrywania dolnych pleców od oparcia i wypychaj przed końcową blokadą.',
    'Nie przeprostowuj kolan w górze.'
  ),
  ex(
    'lib_rdl',
    'Rumuński martwy ciąg (RDL)',
    'nogi',
    'Sztanga',
    3,
    '8-10',
    120,
    'Z lekko ugiętymi, stałymi kolanami wypychaj biodra mocno do tyłu. Opuszczaj sztangę blisko nóg do wyraźnego rozciągnięcia grupy kulszowo-goleniowej.',
    'Ruch zachodzi głównie w stawie biodrowym (hip hinge).'
  ),
  ex(
    'lib_bulgarian_squat',
    'Przysiad bułgarski z hantlami',
    'nogi',
    'Hantle',
    3,
    '8-10',
    90,
    'Oprzyj grzbiet tylnej stopy o ławkę, trzymaj hantle wzdłuż ciała. Schodź płynnie pionowo w dół i wypychaj się z przedniej pięty.',
    'Lekkie pochylenie tułowia zwiększa pracę pośladka.'
  ),
  ex(
    'lib_walking_lunges',
    'Wykroki chodzone z hantlami',
    'nogi',
    'Hantle',
    3,
    '10-12',
    90,
    'Stawiaj stabilny krok naprzód, schodząc tylnym kolanem tuż nad podłogę, po czym dynamicznie przejdź do kolejnego kroku.',
    'Licz powtórzenia osobno lub łącznie (np. po 10 na nogę).'
  ),
  ex(
    'lib_leg_extension',
    'Wyprosty nóg siedząc na maszynie',
    'nogi',
    'Maszyna',
    3,
    '12-15',
    60,
    'Dopasuj wałek tuż nad stawem skokowym. Prostuj nogi płynnie z pełnym spięciem czworogłowych u góry przez 1 sekundę.',
    'Kontrolowany powrót 2-3 sekundy w dół.'
  ),
  ex(
    'lib_lying_leg_curl',
    'Uginanie nóg leżąc na maszynie',
    'nogi',
    'Maszyna',
    3,
    '10-15',
    75,
    'Utrzymuj biodra przyciśnięte do ławki, nie odrywając miednicy. Zginaj kolana dynamicznie i wracaj z pełną kontrolą.',
    'Izolacja dwugłowych uda.'
  ),
  ex(
    'lib_seated_leg_curl',
    'Uginanie nóg siedząc na maszynie',
    'nogi',
    'Maszyna',
    3,
    '10-15',
    75,
    'Zablokuj wałek udowy stabilnie nad kolanami. Zginaj podudzia pod siedzisko do maksymalnego spięcia tylnej taśmy uda.',
    'Duże rozciągnięcie mięśni w pozycji wyjściowej.'
  ),
  ex(
    'lib_hip_thrust',
    'Hip Thrust ze sztangą',
    'nogi',
    'Sztanga',
    3,
    '8-12',
    120,
    'Oprzyj dolny kąt łopatek o ławkę, połóż sztangę z nakładką w zgięciu bioder. Wypychaj biodra w górę do pełnej linii tułów–uda.',
    'Broda skierowana lekko do mostka, pauza 1s na górze.'
  ),
  ex(
    'lib_hip_abduction',
    'Odwodzenie nóg siedząc na maszynie',
    'nogi',
    'Maszyna',
    3,
    '15-20',
    60,
    'Oprzyj tułów stabilnie lub lekko pochyl naprzód i rozchylaj uda na zewnątrz, kontrolując powrót.',
    'Wzmacnia pośladek średni i stabilizację.'
  ),
  ex(
    'lib_calf_raise',
    'Wspięcia na palce stojąc / na suwnicy',
    'nogi',
    'Maszyna',
    4,
    '12-20',
    60,
    'Zrób pełne zejście pięty w dół z pauzą na rozciągnięciu (1–2s), następnie maksymalne wspięcie na palce z krótkim przytrzymaniem.',
    'Bez szybkiego sprężynowania ze ścięgna Achillesa.'
  ),

  // ==================== BARKI ====================
  ex(
    'lib_ohp_barbell',
    'Wyciskanie żołnierskie sztangą (OHP)',
    'barki',
    'Sztanga',
    4,
    '6-8',
    150,
    'Stój pewnie ze spiętym brzuchem i pośladkami. Wyciskaj sztangę z wysokości obojczyków pionowo nad głowę, blokując ją nad karkiem.',
    'Nie wyginaj nadmiernie dolnych pleców w łuk.'
  ),
  ex(
    'lib_db_shoulder_press',
    'Wyciskanie hantli siedząc nad głowę',
    'barki',
    'Hantle',
    3,
    '8-12',
    90,
    'Ustaw oparcie pod kątem ok. 75–85°. Prowadź łokcie lekko przed linią tułowia (płaszczyzna łopatki) i wyciskaj hantle w górę.',
    'Bezpieczniejsza pozycja stawu barkowego niż łokcie szeroko.'
  ),
  ex(
    'lib_db_lateral_raise',
    'Wznosy hantli bokiem stojąc',
    'barki',
    'Hantle',
    4,
    '12-16',
    60,
    'Prowadź ramiona lekko w przód w płaszczyźnie łopatek do poziomu barków. Ruch kontroluj bez bujania całym tułowiem.',
    'Wyobraź sobie odsuwanie hantli daleko na boki, nie tylko w górę.'
  ),
  ex(
    'lib_cable_lateral_raise',
    'Wznosy ramienia bokiem na wyciągu dolnym',
    'barki',
    'Wyciąg',
    3,
    '12-15',
    60,
    'Ustaw linkę na najniższym poziomie i prowadź wyprostowaną rękę w bok na stałym napięciu w całym zakresie ruchu.',
    'Zapewnia równe napięcie od samego startu powtórzenia.'
  ),
  ex(
    'lib_reverse_pec_deck',
    'Odwrotne rozpiętki na maszynie (tył barku)',
    'barki',
    'Maszyna',
    3,
    '12-16',
    60,
    'Usiądź przodem do oparcia. Odwódź wyprostowane ramiona na boki bez nadmiernego ściskania łopatek na siłę.',
    'Celuj izolacyjnie w tylny akton barków.'
  ),
  ex(
    'lib_db_rear_delt_fly',
    'Odwrotne rozpiętki hantlami w opadzie',
    'barki',
    'Hantle',
    3,
    '12-16',
    60,
    'Pochyl tułów niemal równolegle do podłogi (lub oprzyj klatkę o skośną ławkę) i odwódź hantle na boki.',
    'Mniejszy ciężar pozwala utrzymać idealną technikę.'
  ),
  ex(
    'lib_front_raise',
    'Wznosy hantli / talerza w przód',
    'barki',
    'Hantle',
    3,
    '12-15',
    60,
    'Unieś hantle naprzemiennie lub oburącz przed siebie do wysokości oczu, zatrzymując ruch bez kołysania.',
    'Uwzględnij już dużą pracę przedniego aktonu podczas wyciskań.'
  ),
  ex(
    'lib_machine_shoulder_press',
    'Wyciskanie na maszynie na barki',
    'barki',
    'Maszyna',
    3,
    '10-12',
    90,
    'Dostosuj siedzisko do wysokości uchwytów na linii barków. Wyciskaj kontrolowanie w górę i płynnie wracaj.',
    'Stabilny tor ruchu.'
  ),

  // ==================== RAMIONA ====================
  ex(
    'lib_ezbar_curl',
    'Uginanie ramion ze sztangą łamaną',
    'ramiona',
    'Sztanga',
    3,
    '8-12',
    75,
    'Trzymaj łokcie stabilnie przy boku tułowia. Zginaj ramiona do pełnego napięcia bicepsów i powoli opuszczaj sztangę do wyprostu.',
    'Łamany gryf odciąża nadgarstki.'
  ),
  ex(
    'lib_db_supination_curl',
    'Uginanie przedramion z hantlami z supinacją',
    'ramiona',
    'Hantle',
    3,
    '10-12',
    60,
    'Podczas uginania obracaj dłoń małym palcem na zewnątrz, mocno dopinając biceps u góry.',
    'Wersja na skośnej ławce 45° zwiększa rozciągnięcie.'
  ),
  ex(
    'lib_hammer_curl',
    'Uginanie młotkowe z hantlami',
    'ramiona',
    'Hantle',
    3,
    '10-12',
    60,
    'Chwyt neutralny (kciuk skierowany w górę) przez cały ruch. Doskonale rozwija mięsień ramienny i przedramiona.',
    'Utrzymuj stały łokieć bez wysuwania w tył.'
  ),
  ex(
    'lib_preacher_curl',
    'Uginanie ramion na modlitewniku',
    'ramiona',
    'Sztanga',
    3,
    '10-12',
    75,
    'Oprzyj ramiona o skośne podparcie modlitewnika. Kontroluj dolną fazę bez szarpnięcia stawu łokciowego.',
    'Świetna izolacja bez oszukiwania pędem tułowia.'
  ),
  ex(
    'lib_cable_bicep_curl',
    'Uginanie ramion na wyciągu dolnym',
    'ramiona',
    'Wyciąg',
    3,
    '12-15',
    60,
    'Użyj prostego drążka lub sznura na wyciągu dolnym, zachowując pełne napięcie w dolnej i górnej pozycji.',
    'Powolny ruch w dół maksymalizuje pompę mięśniową.'
  ),
  ex(
    'lib_skull_crusher',
    'Wyciskanie francuskie sztangą łamaną leżąc',
    'ramiona',
    'Sztanga',
    3,
    '10-12',
    75,
    'Utrzymując ramiona odchylone minimalnie za głowę, uginaj łokcie opuszczając gryf za czubek głowy i prostuj do góry.',
    'Lekkie odchylenie ramion utrzymuje napięcie nawet w górnej pozycji.'
  ),
  ex(
    'lib_tricep_rope_pushdown',
    'Prostowanie ramion na wyciągu ze sznurem',
    'ramiona',
    'Wyciąg',
    3,
    '12-15',
    60,
    'Łokcie przytulone do żeber. Prostuj przedramiona w dół z delikatnym rozciągnięciem końcówek sznura na boki na dole.',
    'Nie ruszaj barkiem podczas prostowania.'
  ),
  ex(
    'lib_tricep_bar_pushdown',
    'Prostowanie ramion na wyciągu górnym (drążek)',
    'ramiona',
    'Wyciąg',
    3,
    '10-12',
    60,
    'Stabilna postawa lekko pochylona. Wypchnij prosty lub łamany uchwyt do pełnego zablokowania tricepsa.',
    'Pozwala stosować wyższy ciężar niż na samym sznurze.'
  ),
  ex(
    'lib_dips_triceps',
    'Pompki na poręczach (Dipsy) - triceps',
    'ramiona',
    'Masa ciała',
    3,
    '8-12',
    90,
    'Utrzymuj tułów możliwie pionowo, prowadząc łokcie blisko ciała. Zejdź kontrolowanie i wyprostuj ramiona.',
    'Silne ćwiczenie wielostawowe na triceps.'
  ),
  ex(
    'lib_overhead_db_ext',
    'Wyciskanie hantla / wyciągu zza głowy',
    'ramiona',
    'Hantle',
    3,
    '10-12',
    75,
    'Opuść ciężar głęboko za głowę przy uniesionych łokciach dla mocnego rozciągnięcia głowy długiej tricepsa, po czym wyprostuj.',
    'Kluczowe dla pełnej objętości ramienia.'
  ),
  ex(
    'lib_close_grip_bench',
    'Wyciskanie sztangi wąskim chwytem',
    'ramiona',
    'Sztanga',
    3,
    '8-10',
    120,
    'Chwyć sztangę na szerokość barków, prowadź łokcie blisko tułowia i opuść sztangę na dół mostka.',
    'Świetny bodziec siłowy pod triceps i środek klatki.'
  ),

  // ==================== BRZUCH ====================
  ex(
    'lib_cable_crunch',
    'Allachy (skłony tułowia na wyciągu górnym)',
    'brzuch',
    'Wyciąg',
    3,
    '12-15',
    60,
    'Klęknij przed wyciągiem z końcówkami sznura przy czole. Zginaj kręgosłup zwijając żebra w kierunku miednicy, nie bioder.',
    'Najlepsze ćwiczenie na brzuch z łatwo mierzalnym ciężarem.',
    true
  ),
  ex(
    'lib_hanging_leg_raise',
    'Unoszenie nóg / kolan w zwisie na drążku',
    'brzuch',
    'Masa ciała',
    3,
    '10-15',
    60,
    'Zawiśnij spokojnie bez bujania. Podwiń miednicę i unieś kolana lub wyprostowane nogi w stronę drążka.',
    'Pamiętaj o podwinięciu miednicy (posterior pelvic tilt).',
    true
  ),
  ex(
    'lib_ab_wheel',
    'Kółko do ćwiczeń brzucha (Ab Wheel)',
    'brzuch',
    'Inne',
    3,
    '10-12',
    60,
    'Z napiętym pośladkiem i podwiniętą miednicą wyjeżdżaj kółkiem naprzód bez zapadania odcinka lędźwiowego, wróć siłą mięśni brzucha.',
    'Zacznij od mniejszego zasięgu wyjazdu.',
    true
  ),
  ex(
    'lib_plank',
    'Deska (Plank) z napięciem core',
    'brzuch',
    'Masa ciała',
    3,
    '45-60s',
    45,
    'Oprzyj przedramiona na podłożu, ściśnij pośladki oraz brzuch jakbyś chciał przyciągnąć łokcie w stronę palców stóp.',
    'Jakość napięcia ważniejsza niż długość czasu.',
    true
  ),
  ex(
    'lib_machine_crunch',
    'Brzuszki na maszynie (Ab Crunch)',
    'brzuch',
    'Maszyna',
    3,
    '12-15',
    60,
    'Zrób mocny wydech przy skłonie tułowia w dół i kontrolowanie wróć do lekkiego rozciągnięcia.',
    'Utrzymuj stały kontakt dolnej części pleców z oparciem.',
    true
  ),
  ex(
    'lib_russian_twist',
    'Russian Twist z talerzem / hantlem',
    'brzuch',
    'Hantle',
    3,
    '16-20',
    45,
    'Siedząc w lekkim odchyleniu (stopy uniesione lub na ziemi), skręcaj całą klatkę piersiową płynnie z boku na bok.',
    'Pracuj mięśniami skośnymi brzucha, nie samymi rękami.',
    true
  ),
  ex(
    'lib_dead_bug',
    'Dead Bug (Martwy robak)',
    'brzuch',
    'Masa ciała',
    3,
    '12-16',
    45,
    'Leżąc na plecach przyklej lędźwie mocno do podłogi. Naprzemiennie opuszczaj przeciwną rękę i nogę z długim wydechem.',
    'Idealne ćwiczenie stabilizacyjne na zdrowe plecy.',
    true
  ),

  // ==================== OGÓLNE & CARDIO ====================
  ex(
    'lib_farmers_walk',
    'Spacer farmera z ciężkimi hantlami',
    'ogolne',
    'Hantle',
    3,
    '30-40m',
    90,
    'Chwyć ciężkie hantle lub walizki, ściągnij barki w dół i idź szybkim, równym krokiem z wyprostowaną sylwetką.',
    'Wzmacnia chwyt, kaptury, core oraz wydolność.'
  ),
  ex(
    'lib_kettlebell_swing',
    'Kettlebell Swing',
    'ogolne',
    'Inne',
    3,
    '15-20',
    60,
    'Dynamiczny wyprost bioder napędza wahadło odważnika na wysokość klatki. Ramiona pozostają rozluźnione jako linka.',
    'Mocne ćwiczenie kondycyjno-siłowe na tylną taśmę.'
  ),
  ex(
    'lib_treadmill_incline',
    'Bieżnia - marsz pod górę (nachylenie 10-12%)',
    'ogolne',
    'Maszyna',
    1,
    '20-30 min',
    60,
    'Ustaw nachylenie 10–12% i żwawe tempo ok. 4.8–5.5 km/h bez trzymania się poręczy.',
    'Świetne niskoudarowe cardio regeneracyjne.'
  ),
  ex(
    'lib_bike_intervals',
    'Rower stacjonarny / AirBike (interwały)',
    'ogolne',
    'Maszyna',
    6,
    '30s / 60s',
    60,
    '30 sekund szybkiej pracy na wysokim oporze i 60 sekund spokojnego kręcenia regeneracyjnego.',
    'Poprawia wydolność VO2max w krótkim czasie.'
  ),
  ex(
    'lib_elliptical',
    'Orbitrek (Cardio strefa 2)',
    'ogolne',
    'Maszyna',
    1,
    '25 min',
    60,
    'Utrzymuj tętno w strefie konwersacyjnej (ok. 125–140 bpm) dla wspomagania regeneracji i wydolności.',
    'Zero obciążenia udarowego dla stawów kolanowych.'
  ),
  ex(
    'lib_incline_chest_press_machine',
    'Wyciskanie na klatkę (Skos + Maszyna)',
    'klatka',
    'Maszyna',
    2,
    '6-8',
    150,
    'Stabilne wyciskanie na maszynie pod kątem dodatnim: maksymalna izolacja i praca do bliskiego upadku górnej części klatki.',
    'Ściągnij łopatki, kontroluj fazę ekscentryczną przez 2-3 sekundy.'
  ),
  ex(
    'lib_single_arm_lat_pulldown',
    'Ściąganie jednorącz na wyciągu (Lat Pulldown)',
    'plecy',
    'Wyciąg',
    2,
    '6-8',
    120,
    'Jednostronne ściąganie uchwytu w kierunku biodra dla pełnego rozciągnięcia i skurczu mięśnia najszerszego grzbietu.',
    'Utrzymuj lekko pochylony tułów w stronę pracującego ramienia i prowadź łokieć w dół.'
  ),
  ex(
    'lib_cable_tricep_extension',
    'Wyprost ramion na wyciągu (Triceps Extension)',
    'ramiona',
    'Wyciąg',
    2,
    '6-10',
    90,
    'Izolowany wyprost łokci na wyciągu (linka lub prosty drążek) pod stałym napięciem wszystkich głów tricepsa.',
    'Łokcie zablokowane przy żebrach lub lekko przed tułowiem, bez szarpania barkami.'
  ),
  ex(
    'lib_jm_press',
    'JM Press (Sztanga / Maszyna)',
    'ramiona',
    'Sztanga',
    2,
    '5-8',
    120,
    'Hybryda wyciskania wąsko i wyciskania francuskiego: potężne przeciążenie tricepsów bez nadmiernego bólu łokci.',
    'Opuszczaj ciężar pod kontrolą w okolicę brody/szyi, utrzymując przedramiona blisko pionu.'
  ),
  ex(
    'lib_hip_adduction',
    'Przywodzenie nóg na maszynie (Hip Adductor)',
    'nogi',
    'Maszyna',
    2,
    '8-12',
    90,
    'Izolowana praca mięśni przywodzicieli uda zwiększająca obwód nóg i stabilność kolan przy przysiadach.',
    'Wykonuj pełen zakres bez odbijania stosu na dole ruchu.'
  ),
  ex(
    'lib_partial_chinup',
    'Częściowe podciąganie podchwytem (Partial Chin-Up)',
    'plecy',
    'Masa ciała',
    2,
    '6-10',
    120,
    'Podciąganie w zakresie optymalnej dźwigni i najwyższego napięcia dla najszerszych grzbietu oraz bicepsów.',
    'Kontrolowane opuszczenie do pozycji wyjściowej w serii bez szarpania nogami.'
  ),
  ex(
    'lib_wrist_curl',
    'Uginanie nadgarstków ze sztangą / hantlami',
    'ramiona',
    'Sztanga',
    3,
    '12-20',
    60,
    'Oprzyj przedramiona na ławce lub udach dłońmi skierowanymi w górę. Opuść ciężar do palców i mocno zegnij nadgarstki w górę.',
    'Izolowana praca zginaczy przedramienia i siły chwytu.'
  ),
  ex(
    'lib_reverse_barbell_curl',
    'Uginanie ramion nachwytem ze sztangą',
    'ramiona',
    'Sztanga',
    3,
    '10-15',
    60,
    'Chwyć sztangę nachwytem na szerokość barków. Uginaj przedramiona bez odrywania łokci od tułowia i powoli opuszczaj.',
    'Rozbudowuje prostowniki przedramienia i mięsień ramienno-promieniowy.'
  ),
  ex(
    'lib_db_shrugs',
    'Szrugsy z hantlami / sztangą (Kaptury)',
    'plecy',
    'Hantle',
    3,
    '12-15',
    75,
    'Trzymaj ciężkie hantle wzdłuż tułowia i unoś barki pionowo w stronę uszu z 1-sekundowym dopięciem u góry.',
    'Nie kręć barkami w kółko - prowadź ruch czysto góra-dół.'
  ),
  ex(
    'lib_seated_calf_raise',
    'Wspięcia na palce siedząc (maszyna / hantle)',
    'nogi',
    'Maszyna',
    4,
    '15-20',
    60,
    'Z ugiętymi kolanami pod kątem 90° opuść pięty maksymalnie w dół i wykonaj pełne wspięcie na palce z przytrzymaniem.',
    'Ugięte kolano izoluje mięsień płaszczkowaty łydki.'
  ),

  // ==================== ROZSZERZONA BAZA ĆWICZEŃ (KLATKA) ====================
  ex(
    'lib_decline_barbell_bench',
    'Wyciskanie sztangi na skosie ujemnym',
    'klatka',
    'Sztanga',
    3,
    '8-10',
    120,
    'Zablokuj nogi na ławce ujemnej (ok. -15°). Opuść sztangę na dolną krawędź mostka i wypchnij dynamicznie w górę.',
    'Silnie angażuje dolne włókna mięśnia piersiowego większego.'
  ),
  ex(
    'lib_smith_incline_press',
    'Wyciskanie na suwnicy Smitha (skos dodatni)',
    'klatka',
    'Maszyna',
    3,
    '8-12',
    120,
    'Ustaw ławkę pod kątem 30° w suwnicy Smitha tak, by gryf schodził na górną część klatki w okolicy obojczyków.',
    'Stabilny tor ruchu pozwala bezpiecznie pracować blisko upadku mięśniowego.'
  ),
  ex(
    'lib_low_to_high_cable_fly',
    'Rozpiętki na wyciągu dolnym (od dołu do góry)',
    'klatka',
    'Wyciąg',
    3,
    '12-15',
    60,
    'Z dolnych bloczków prowadź wyprostowane ramiona po łuku w górę i do środka na wysokość brody.',
    'Kąt prowadzenia linek idealnie pokrywa się z przebiegiem górnych włókien klatki.'
  ),
  ex(
    'lib_db_pullover',
    'Przenoszenie hantla za głowę leżąc (Pullover)',
    'klatka',
    'Hantle',
    3,
    '10-12',
    75,
    'Oprzyj górną część pleców o ławkę, opuść hantel głęboko za głowę przy lekko ugiętych łokciach i wróć nad klatkę.',
    'Rozciąga klatkę piersiową, mięsień zębaty przedni oraz najszerszy grzbietu.'
  ),
  ex(
    'lib_floor_press',
    'Wyciskanie sztangi / hantli leżąc na podłodze (Floor Press)',
    'klatka',
    'Sztanga',
    3,
    '6-10',
    120,
    'Leżąc płasko na podłodze opuszczaj ciężar do momentu delikatnego dotknięcia tricepsami podłoża, po czym wypchnij w górę.',
    'Odciąża stawy barkowe i wzmacnia górną fazę wyciskania (lockout).'
  ),
  ex(
    'lib_incline_db_fly',
    'Rozpiętki z hantlami na skosie dodatnim',
    'klatka',
    'Hantle',
    3,
    '12-15',
    75,
    'Na ławce pod kątem 30° otwieraj ramiona szeroko z kontrolowanym rozciągnięciem górnej klatki i łącz hantle po łuku.',
    'Nie schodź zbyt głęboko poza naturalną ruchomość stawu ramiennego.'
  ),
  ex(
    'lib_svend_press',
    'Wyciskanie talerzy przed klatką (Svend Press)',
    'klatka',
    'Inne',
    3,
    '15-20',
    60,
    'Ściśnij mocno dwa małe talerze między dłońmi na wysokości mostka i wypychaj je przed siebie, utrzymując stały docisk.',
    'Izometryczny ucisk daje silne czucie przyśrodkowej części klatki.'
  ),
  ex(
    'lib_deficit_pushups',
    'Pompki w deficycie na uchwytach / talerzach',
    'klatka',
    'Masa ciała',
    3,
    '10-15',
    75,
    'Ustaw dłonie na podwyższeniu i schodź klatką poniżej linii dłoni dla maksymalnego rozciągnięcia włókien piersiowych.',
    'Zatrzymaj ruch na 1 sekundę na samym dole.'
  ),

  // ==================== ROZSZERZONA BAZA ĆWICZEŃ (PLECY) ====================
  ex(
    'lib_pendlay_row',
    'Wiosłowanie sztangą z ziemi (Pendlay Row)',
    'plecy',
    'Sztanga',
    4,
    '6-8',
    120,
    'Tułów równolegle do podłoża. Każde powtórzenie zaczyna się i kończy pełnym odłożeniem sztangi na ziemię.',
    'Buduje eksplozywną siłę i grubość środka pleców bez obciążania lędźwi w przerwach między powtórzeniami.'
  ),
  ex(
    'lib_seal_row',
    'Wiosłowanie sztangą / hantlami leżąc na ławce (Seal Row)',
    'plecy',
    'Hantle',
    3,
    '8-12',
    90,
    'Połóż się przodem na podwyższonej lub skośnej ławce i przyciągaj ciężar mocno w górę bez jakiegokolwiek pędu bioder.',
    'Całkowicie odciąża odcinek lędźwiowy i izoluje mięśnie grzbietu.'
  ),
  ex(
    'lib_chest_supported_machine_row',
    'Wiosłowanie na maszynie z podparciem klatki',
    'plecy',
    'Maszyna',
    3,
    '8-12',
    90,
    'Oprzyj mostek o poduszkę maszyny i przyciągaj uchwyty w tył, skupiając się na pracy łopatek i najszerszego grzbietu.',
    'Wybierz chwyt szeroki dla góry pleców lub wąski neutralny dla najszerszego.'
  ),
  ex(
    'lib_straight_arm_pulldown',
    'Ściąganie drążka wyciągu górnego na prostych rękach (Narciarz)',
    'plecy',
    'Wyciąg',
    3,
    '12-15',
    60,
    'W lekkim opadzie tułowia ściągaj drążek lub sznur po łuku do ud przy niemal wyprostowanych łokciach.',
    'Czysta izolacja mięśnia najszerszego grzbietu bez udziału bicepsów.'
  ),
  ex(
    'lib_meadows_row',
    'Wiosłowanie jednorącz półsztangą (Meadows Row)',
    'plecy',
    'Sztanga',
    3,
    '8-12',
    90,
    'Stań bokiem do końca gryfu w uchwycie Landmine i wiosłuj jednorącz prowadząc łokieć nieco szerzej w górę.',
    'Świetne ćwiczenie na grubość górnego i środkowego grzbietu.'
  ),
  ex(
    'lib_rack_pull',
    'Martwy ciąg z podwyższenia (Rack Pull)',
    'plecy',
    'Sztanga',
    3,
    '5-8',
    150,
    'Ustaw sztangę na pinach tuż pod lub nad kolanami. Wykonaj ciąg do pełnego wyprostu z mocnym spięciem kapturów i grzbietu.',
    'Pozwala przyzwyczaić układ nerwowy i chwyt do ciężarów ponad 100% klasycznego ciągu.'
  ),
  ex(
    'lib_neutral_pullups',
    'Podciąganie na drążku chwytem neutralnym',
    'plecy',
    'Masa ciała',
    3,
    '6-10',
    120,
    'Chwyć równoległe rączki drążka dłońmi skierowanymi do siebie i podciągnij klatkę piersiową do uchwytów.',
    'Najbardziej naturalna i przyjazna dla łokci oraz barków pozycja podciągania.'
  ),
  ex(
    'lib_inverted_row',
    'Wiosłowanie australijskie (Inverted Row)',
    'plecy',
    'Masa ciała',
    3,
    '10-15',
    75,
    'Zawiśnij pod nisko ustawioną sztangą lub na kółkach gimnastycznych i przyciągaj mostek do gryfu przy sztywnym ciele.',
    'Im bardziej poziomo ustawisz ciało, tym wyższy poziom trudności.'
  ),
  ex(
    'lib_barbell_shrugs',
    'Szrugsy ze sztangą przed sobą',
    'plecy',
    'Sztanga',
    3,
    '10-15',
    75,
    'Trzymaj sztangę na szerokość barków i unoś obręcz barkową wysoko w kierunku uszu z sekundową pauzą.',
    'Użyj pasków treningowych przy dużym ciężarze.'
  ),
  ex(
    'lib_kelso_shrugs',
    'Szrugsy na ławce skośnej (Kelso Shrugs)',
    'plecy',
    'Hantle',
    3,
    '12-15',
    60,
    'Leżąc przodem na ławce skośnej 30-45° ściągaj same łopatki mocno do siebie i w górę bez uginania łokci.',
    'Izoluje środkową część czworobocznego oraz mięśnie równoległoboczne.'
  ),
  ex(
    'lib_good_morning',
    'Skłony Dzień Dobry ze sztangą (Good Morning)',
    'plecy',
    'Sztanga',
    3,
    '8-10',
    120,
    'Ze sztangą na plecach wypychaj biodra w tył przy lekko ugiętych kolanach i prostym kręgosłupie, po czym wróć do pionu.',
    'Buduje pancerny odcinek lędźwiowy, pośladki i dwugłowe uda.'
  ),
  ex(
    'lib_single_arm_cable_row',
    'Przyciąganie linki wyciągu dolnego jednorącz',
    'plecy',
    'Wyciąg',
    3,
    '10-12',
    75,
    'Siedząc lub w półklęku przyciągaj pojedynczą rączkę wyciągu w okolicę biodra z lekką rotacją łopatki.',
    'Pozwala na pełniejszy zakres ruchu niż wiosłowanie oburącz.'
  ),

  // ==================== ROZSZERZONA BAZA ĆWICZEŃ (NOGI) ====================
  ex(
    'lib_hack_squat',
    'Przysiad na maszynie Hack Squat',
    'nogi',
    'Maszyna',
    4,
    '8-12',
    120,
    'Oprzyj całe plecy i barki na suwnicy Hack Squat. Zejdź głęboko do pełnego zgięcia w kolanach i wypchnij ciężar w górę.',
    'Niskie ułożenie stóp na platformie maksymalizuje pracę czworogłowych uda.'
  ),
  ex(
    'lib_goblet_squat',
    'Przysiad Goblet z hantlem / kettlem',
    'nogi',
    'Hantle',
    3,
    '10-15',
    90,
    'Trzymaj ciężki hantel lub odważnik pionowo przy mostku. Zejdź głęboko między biodra utrzymując pionowy tułów.',
    'Doskonałe ćwiczenie na mobilność bioder i czworogłowe uda.'
  ),
  ex(
    'lib_sumo_deadlift',
    'Martwy ciąg Sumo',
    'nogi',
    'Sztanga',
    3,
    '5-8',
    150,
    'Stań w szerokim rozkroku ze stopami skierowanymi na zewnątrz, chwyć sztangę wąsko między nogami i wypchnij podłogę.',
    'Silnie angażuje przywodziciele, pośladki i czworogłowe przy mniejszym wychyleniu tułowia.'
  ),
  ex(
    'lib_sissy_squat',
    'Przysiad Sissy (izolacja czworogłowych)',
    'nogi',
    'Masa ciała',
    3,
    '10-15',
    75,
    'Wysuwaj kolana mocno w przód przy jednoczesnym odchyleniu prostych bioder i tułowia w tył.',
    'Ekstremalne rozciągnięcie mięśnia prostego uda pod obciążeniem.'
  ),
  ex(
    'lib_pendulum_squat',
    'Przysiad na maszynie Pendulum',
    'nogi',
    'Maszyna',
    3,
    '8-12',
    120,
    'Prowadź ruch po naturalnym łuku maszyny wahadłowej schodząc do pełnej głębokości bez odrywania miednicy.',
    'Odciąża kręgosłup i daje idealny profil oporu dla czworogłowych.'
  ),
  ex(
    'lib_nordic_hamstring_curl',
    'Uginanie nóg Nordic Curl',
    'nogi',
    'Masa ciała',
    3,
    '5-8',
    120,
    'Zablokuj kostki w klęku i powoli opuszczaj wyprostowane od kolan ciało ku podłodze, hamując ruch dwugłowymi uda.',
    'Najlepsze ćwiczenie ekscentryczne chroniące grupę kulszowo-goleniową przed kontuzją.'
  ),
  ex(
    'lib_single_leg_rdl',
    'Rumuński martwy ciąg jednonóż z hantlami',
    'nogi',
    'Hantle',
    3,
    '8-12',
    75,
    'Stojąc na jednej nodze pochylaj tułów w przód z jednoczesnym uniesieniem drugiej nogi w linii ciała.',
    'Wyrównuje dysproporcje stron i silnie angażuje pośladek oraz dwugłowy uda.'
  ),
  ex(
    'lib_glute_kickback_cable',
    'Odwodzenie nogi w tył na wyciągu dolnym (Kickback)',
    'nogi',
    'Wyciąg',
    3,
    '12-15',
    60,
    'Zapnij opaskę na kostkę przy wyciągu dolnym i prowadź nogę w tył oraz lekko na zewnątrz bez wyginania lędźwi.',
    'Izoluje mięsień pośladkowy wielki i średni.'
  ),
  ex(
    'lib_kas_glute_bridge',
    'Mostki biodrowe ze sztangą (KAS Glute Bridge)',
    'nogi',
    'Sztanga',
    3,
    '10-12',
    90,
    'Wersja Hip Thrust w krótszym, górnym zakresie ruchu z pionowymi piszczelami i powolnym tempem.',
    'Skupia 100% pracy na pośladkach z minimalnym udziałem czworogłowych i dwugłowych.'
  ),
  ex(
    'lib_step_ups',
    'Wchodzenie na podwyższenie z hantlami (Step-Ups)',
    'nogi',
    'Hantle',
    3,
    '10-12',
    90,
    'Postaw całą stopę na skrzyni lub ławce i wejdź w górę pracą samej nogi wykrocznej bez odbijania się nogą z ziemi.',
    'Kontroluj powolne zejście w dół przez 2-3 sekundy.'
  ),
  ex(
    'lib_copenhagen_plank',
    'Deska kopenhaska (przywodziciele)',
    'nogi',
    'Masa ciała',
    3,
    '25-40s',
    60,
    'W podporze bocznym oprzyj górną nogę na ławce i unieś biodra utrzymując prostą linię ciała.',
    'Potężnie wzmacnia przywodziciele uda i stabilizację miednicy.'
  ),
  ex(
    'lib_donkey_calf_raise',
    'Wspięcia na palce w opadzie (Donkey Calf Raise)',
    'nogi',
    'Maszyna',
    4,
    '15-20',
    60,
    'W opadzie tułowia pod kątem 90° wykonuj pełne wspięcia na palce z mocnym rozciągnięciem pięt na dole.',
    'Zgięcie w biodrze zwiększa wstępne rozciągnięcie mięśnia brzuchatego łydki.'
  ),
  ex(
    'lib_tibialis_raise',
    'Unoszenie przodostopia stojąc (mięsień piszczelowy)',
    'nogi',
    'Masa ciała',
    3,
    '15-25',
    45,
    'Oprzyj pośladki i plecy o ścianę, wysuń stopy w przód i unoś palce stóp maksymalnie w stronę piszczeli.',
    'Chroni przed bólem piszczeli (shin splints) i stabilizuje staw skokowy.'
  ),
  ex(
    'lib_single_leg_press',
    'Wypychanie ciężaru na suwnicy jednonóż',
    'nogi',
    'Maszyna',
    3,
    '10-12',
    90,
    'Ustaw jedną stopę na środku platformy i wykonuj pełny zakres wypychania bez rotacji miednicy.',
    'Eliminuje asymetrię siły między lewą a prawą nogą.'
  ),

  // ==================== ROZSZERZONA BAZA ĆWICZEŃ (BARKI) ====================
  ex(
    'lib_arnold_press',
    'Wyciskanie Arnoldki z hantlami',
    'barki',
    'Hantle',
    3,
    '8-12',
    90,
    'Zacznij z hantlami przed brodą chwytem podchwytem i w trakcie wyciskania nad głowę wykonaj płynną rotację do nachwytu.',
    'Angażuje przedni i boczny akton barku w dużym zakresie ruchu.'
  ),
  ex(
    'lib_landmine_press',
    'Wyciskanie półsztangi jednorącz (Landmine Press)',
    'barki',
    'Sztanga',
    3,
    '8-12',
    75,
    'Stojąc lub w półklęku wypychaj koniec sztangi po skosie w górę przed sobą bez odchylania tułowia.',
    'Przyjazny dla osób z ograniczeniami mobilności nad głową.'
  ),
  ex(
    'lib_upright_row',
    'Podciąganie sztangi / wyciągu wzdłuż tułowia',
    'barki',
    'Sztanga',
    3,
    '10-12',
    75,
    'Chwytem na szerokość barków lub nieco szerszym unoś gryf do wysokości mostka prowadząc łokcie wyżej niż nadgarstki.',
    'Szerszy chwyt mocniej angażuje bok barku i jest bezpieczniejszy dla stożka rotatorów.'
  ),
  ex(
    'lib_machine_lateral_raise',
    'Wznosy bokiem na maszynie',
    'barki',
    'Maszyna',
    3,
    '12-16',
    60,
    'Oprzyj przedramiona o poduszki maszyny i unoś łokcie do poziomu barków na stałym napięciu.',
    'Eliminuje udział chwytu i pozwala skupić się wyłącznie na bocznym aktonie.'
  ),
  ex(
    'lib_egyptian_cable_lateral',
    'Wznosy bokiem na wyciągu w pochyleniu (Egyptian Raise)',
    'barki',
    'Wyciąg',
    3,
    '12-15',
    60,
    'Trzymając się słupa wyciągu wolną ręką odchyl ciało w bok i wykonuj wznosy linką z wysokości nadgarstka.',
    'Zmieniony kąt tułowia obciąża boczny akton w najbardziej produktywnej fazie rozciągnięcia.'
  ),
  ex(
    'lib_cable_rear_delt_fly',
    'Odwrotne rozpiętki na wyciągu (krzyżowanie linek)',
    'barki',
    'Wyciąg',
    3,
    '12-16',
    60,
    'Chwyć lewą linkę prawą dłonią i prawą linkę lewą dłonią na wysokości oczu, po czym odwódź ramiona szeroko w tył.',
    'Stałe napięcie linek wzdłuż linii włókien tylnego aktonu barków.'
  ),
  ex(
    'lib_cable_front_raise',
    'Wznosy w przód na wyciągu dolnym',
    'barki',
    'Wyciąg',
    3,
    '12-15',
    60,
    'Stań tyłem do wyciągu dolnego z linką między nogami i unoś drążek lub sznur przed siebie do poziomu oczu.',
    'Płynny opór w całym zakresie ruchu.'
  ),
  ex(
    'lib_lu_raises',
    'Wznosy talerzy / hantli w pełnym zakresie (Lu Raises)',
    'barki',
    'Hantle',
    3,
    '10-15',
    60,
    'Unoś lekkie hantle lub talerze bokiem w płaszczyźnie łopatki aż do pełnego złączenia nad głową.',
    'Wzmacnia cały kompleks barkowy, kaptury i mobilność łopatek.'
  ),

  // ==================== ROZSZERZONA BAZA ĆWICZEŃ (RAMIONA) ====================
  ex(
    'lib_incline_db_curl',
    'Uginanie ramion z hantlami na ławce skośnej',
    'ramiona',
    'Hantle',
    3,
    '10-12',
    60,
    'Usiądź na ławce pod kątem 45-60° z ramionami swobodnie cofniętymi za linię tułowia i uginaj przedramiona.',
    'Cofnięty łokieć maksymalnie rozciąga głowę długą bicepsa.'
  ),
  ex(
    'lib_spider_curl',
    'Uginanie ramion w oparciu o ławkę (Spider Curl)',
    'ramiona',
    'Sztanga',
    3,
    '10-12',
    60,
    'Połóż się klatką piersiową na skośnej ławce z ramionami zwisającymi pionowo w dół i uginaj sztangę lub hantle.',
    'Szczytowe napięcie w górnej fazie ruchu (peak contraction).'
  ),
  ex(
    'lib_concentration_curl',
    'Uginanie ramienia z hantlem w oparciu o udo',
    'ramiona',
    'Hantle',
    3,
    '10-15',
    60,
    'Siedząc oprzyj tył ramienia o wewnętrzną stronę uda i wykonuj pełne, kontrolowane ugięcia.',
    'Zero bujania tułowiem i pełna kontrola nad supinacją.'
  ),
  ex(
    'lib_bayesian_cable_curl',
    'Uginanie ramienia na wyciągu za plecami (Bayesian Curl)',
    'ramiona',
    'Wyciąg',
    3,
    '10-15',
    60,
    'Stań tyłem do wyciągu dolnego krok przed bloczkiem tak, by linka ciągnęła ramię w tył, i uginaj przedramię.',
    'Stałe napięcie w pozycji maksymalnego rozciągnięcia bicepsa.'
  ),
  ex(
    'lib_zottman_curl',
    'Uginanie ramion Zottmana z hantlami',
    'ramiona',
    'Hantle',
    3,
    '10-12',
    60,
    'Ugnij ramiona podchwytem z supinacją, na górze obróć nadgarstki do nachwytu i opuszczaj powoli przez 3 sekundy.',
    'Łączy bodziec na biceps w fazie koncentrycznej i przedramiona w fazie ekscentrycznej.'
  ),
  ex(
    'lib_overhead_cable_tricep',
    'Prostowanie ramion ze sznurem zza głowy na wyciągu',
    'ramiona',
    'Wyciąg',
    3,
    '10-15',
    60,
    'Stojąc tyłem do wyciągu prostuj przedramiona ze sznurem nad głową lub w przód przy zablokowanych łokciach.',
    'Doskonale celuje w głowę długą mięśnia trójgłowego ramienia.'
  ),
  ex(
    'lib_single_arm_pushdown',
    'Prostowanie ramienia jednorącz na wyciągu',
    'ramiona',
    'Wyciąg',
    3,
    '12-15',
    60,
    'Chwyć pojedynczy uchwyt lub samą końcówkę linki i prostuj ramię w dół oraz lekko za linię biodra.',
    'Pozwala idealnie dopasować tor ruchu pod anatomię stawu łokciowego.'
  ),
  ex(
    'lib_diamond_pushups',
    'Pompki diamentowe (wąski rozstaw dłoni)',
    'ramiona',
    'Masa ciała',
    3,
    '10-15',
    60,
    'Ułóż dłonie blisko siebie pod mostkiem i wykonuj pompki prowadząc łokcie blisko tułowia.',
    'Wysoka aktywacja tricepsów oraz środka klatki piersiowej.'
  ),
  ex(
    'lib_reverse_wrist_curl',
    'Prostowanie nadgarstków nachwytem ze sztangą / hantlami',
    'ramiona',
    'Sztanga',
    3,
    '15-20',
    45,
    'Oprzyj przedramiona na udach lub ławce dłońmi w dół i unoś grzbiety dłoni jak najwyżej.',
    'Wzmacnia prostowniki nadgarstka i zapobiega tzw. łokciowi tenisisty.'
  ),
  ex(
    'lib_dead_hang',
    'Zwis bierny / aktywny na drążku na czas',
    'ramiona',
    'Masa ciała',
    3,
    '45-60s',
    60,
    'Chwyć drążek pełnym nachwytem z kciukiem zamkniętym i utrzymuj zwis przez założony czas.',
    'Buduje stalowy chwyt, wytrzymałość przedramion i dekompresuje kręgosłup.'
  ),

  // ==================== ROZSZERZONA BAZA ĆWICZEŃ (BRZUCH) ====================
  ex(
    'lib_pallof_press',
    'Pallof Press z gumą lub na wyciągu (antyrotacja)',
    'brzuch',
    'Wyciąg',
    3,
    '12-15',
    45,
    'Stań bokiem do wyciągu na wysokości mostka, wypychaj rączkę przed klatkę i opieraj się sile skręcającej tułów.',
    'Kluczowe ćwiczenie na głęboką stabilizację core i mięśnie skośne.',
    true
  ),
  ex(
    'lib_side_plank',
    'Deska boczna (Side Plank)',
    'brzuch',
    'Masa ciała',
    3,
    '30-45s',
    45,
    'W podporze bokiem na przedramieniu utrzymuj biodra wysoko w jednej linii od stóp do barków.',
    'Izometryczna praca mięśni skośnych brzucha i czworobocznego lędźwi.',
    true
  ),
  ex(
    'lib_cable_woodchopper',
    'Drwal na wyciągu (Woodchopper - skosy)',
    'brzuch',
    'Wyciąg',
    3,
    '12-15',
    60,
    'Ciągnij linkę wyciągu oburącz po przekątnej od góry do dołu (lub od dołu do góry) skręcając tułów.',
    'Dynamiczna siła rotacyjna mięśni skośnych brzucha.',
    true
  ),
  ex(
    'lib_dragon_flag',
    'Dragon Flag / opuszczanie ciała na ławce',
    'brzuch',
    'Masa ciała',
    3,
    '5-8',
    75,
    'Trzymając się krawędzi ławki za głową opuszczaj wyprostowane i napięte ciało powoli w dół bez załamywania w biodrach.',
    'Zaawansowane ćwiczenie kalisteniczne na cały prosty brzucha.',
    true
  ),
  ex(
    'lib_l_sit',
    'Pozycja L-Sit na poręczach lub w zwisie',
    'brzuch',
    'Masa ciała',
    3,
    '20-30s',
    60,
    'W podporze na poręczach lub w zwisie unieś wyprostowane nogi do poziomu bioder i utrzymuj pozycję L.',
    'Wersja z ugiętymi kolanami (Tuck L-Sit) jako łatwiejsza progresja.',
    true
  ),
  ex(
    'lib_bicycle_crunch',
    'Rowerek leżąc (Bicycle Crunch)',
    'brzuch',
    'Masa ciała',
    3,
    '16-24',
    45,
    'Leżąc na plecach powoli przyciągaj przeciwległy łokieć do kolana przy pełnym wyproście drugiej nogi.',
    'Wykonuj ruch powoli z 1-sekundowym spięciem zamiast szybkiego machania.',
    true
  ),

  // ==================== ROZSZERZONA BAZA ĆWICZEŃ (OGÓLNE & CARDIO) ====================
  ex(
    'lib_rowing_ergometer',
    'Ergometr wioślarski (Concept2)',
    'ogolne',
    'Maszyna',
    1,
    '2000m / 15 min',
    60,
    'Kolejność ruchu: mocne odepchnięcie nogami, odchylenie tułowia i dociągnięcie drążka do dolnych żeber.',
    'Kompleksowe cardio angażujące ponad 80% mięśni ciała.'
  ),
  ex(
    'lib_stairmaster',
    'Schody treningowe (StairMaster)',
    'ogolne',
    'Maszyna',
    1,
    '20-30 min',
    60,
    'Wchodź równym tempem stawiając całą stopę na stopniach bez wieszania ciężaru ciała na poręczach.',
    'Wysoki wydatek energetyczny i dodatkowa praca pośladków oraz łydek.'
  ),
  ex(
    'lib_sled_push_pull',
    'Pchanie / ciągnięcie sań treningowych (Prowler Sled)',
    'ogolne',
    'Inne',
    4,
    '20-30m',
    90,
    'Pchaj sanie niskim środkiem ciężkości naprzód lub ciągnij tyłem za taśmy dla zdrowia kolan.',
    'Brak fazy ekscentrycznej oznacza brak zakwasów przy potężnym bodźcu kondycyjnym.'
  ),
  ex(
    'lib_jump_rope',
    'Skakanka bokserska (interwały / rytm)',
    'ogolne',
    'Inne',
    4,
    '3 min',
    60,
    'Skacz nisko na śródstopiu obracając linkę samą pracą nadgarstków przy łokciach blisko ciała.',
    'Poprawia koordynację, sztywność ścięgna Achillesa i wydolność.'
  ),
];

export const EXERCISE_ID_ALIASES: Record<string, string> = {
  // Normalizacja starych i planowych wariantów ID do wspólnej kanonicznej bazy
  hr_pec_deck: 'lib_butterfly',
  hr_incline_chest_machine: 'lib_incline_chest_press_machine',
  hr_cable_lateral: 'lib_cable_lateral_raise',
  hr_shoulder_press_machine: 'lib_machine_shoulder_press',
  hr_wide_lat_pulldown: 'lib_lat_pulldown_wide',
  hr_single_arm_pulldown: 'lib_single_arm_lat_pulldown',
  hr_tbar_row: 'lib_tbar_row',
  hr_cable_tricep_ext: 'lib_cable_tricep_extension',
  hr_jm_press: 'lib_jm_press',
  hr_preacher_curl_machine: 'lib_preacher_curl',
  hr_hammer_curl: 'lib_hammer_curl',
  hr_abs_crunch: 'lib_machine_crunch',
  hr_leg_ext: 'lib_leg_extension',
  hr_leg_curl: 'lib_seated_leg_curl',
  hr_leg_press_45: 'lib_leg_press',
  hr_stiff_leg_deadlift: 'lib_rdl',
  hr_hip_adductor: 'lib_hip_adduction',
  hr_hip_abductor: 'lib_hip_abduction',
  hr_calf_leg_press: 'lib_calf_raise',
  hr_partial_chinup: 'lib_partial_chinup',
  mon_bench: 'lib_barbell_bench',
  mon_fly: 'lib_db_fly',
  mon_tricep_rope: 'lib_tricep_rope_pushdown',
  wed_pullups: 'lib_pullups_overhand',
  wed_row: 'lib_barbell_row',
  wed_lat_pulldown: 'lib_lat_pulldown_wide',
  fri_squat: 'lib_back_squat',
  fri_rdl: 'lib_rdl',
  fri_leg_press: 'lib_leg_press',
  fri_leg_ext: 'lib_leg_extension',
  fri_leg_curl: 'lib_seated_leg_curl',
  fri_calf_raise: 'lib_calf_raise',
};

const NAME_TO_CANONICAL_ID: Record<string, string> = {
  'pec deck': 'lib_butterfly',
  'pec deck (machine)': 'lib_butterfly',
  'incline chest press (machine)': 'lib_incline_chest_press_machine',
  'lateral raise (cable)': 'lib_cable_lateral_raise',
  'shoulder press (machine)': 'lib_machine_shoulder_press',
  'wide grip lat pulldown': 'lib_lat_pulldown_wide',
  'lat pulldown (single arm)': 'lib_single_arm_lat_pulldown',
  't-bar row': 'lib_tbar_row',
  'tricep extension (cable)': 'lib_cable_tricep_extension',
  'jm press': 'lib_jm_press',
  'preacher curl (machine)': 'lib_preacher_curl',
  'hammer curl (dumbbell)': 'lib_hammer_curl',
  'abs crunch (machine)': 'lib_machine_crunch',
  'leg extension': 'lib_leg_extension',
  'leg curl': 'lib_seated_leg_curl',
  'leg press (45 degrees)': 'lib_leg_press',
  'stiff leg deadlift': 'lib_rdl',
  'hip adductor (machine)': 'lib_hip_adduction',
  'hip abductor (machine)': 'lib_hip_abduction',
  'calf raise (leg press)': 'lib_calf_raise',
  'partial chin-up': 'lib_partial_chinup',
};

export function resolveCanonicalExerciseId(exerciseId: string, exerciseName?: string): string {
  if (!exerciseId) return exerciseId;
  const cleanedId = exerciseId.replace(/_(swap|session)_\d+$/, '');
  const directAlias = EXERCISE_ID_ALIASES[cleanedId] || EXERCISE_ID_ALIASES[exerciseId];
  if (directAlias) return directAlias;

  if (EXERCISE_LIBRARY.some((item) => item.id === cleanedId)) {
    return cleanedId;
  }

  if (exerciseName) {
    const clean = exerciseName.trim().toLowerCase();
    if (NAME_TO_CANONICAL_ID[clean]) {
      return NAME_TO_CANONICAL_ID[clean];
    }
    const exactMatch = EXERCISE_LIBRARY.find((item) => item.name.trim().toLowerCase() === clean);
    if (exactMatch) {
      return exactMatch.id;
    }
  }

  return cleanedId;
}

export function normalizeExercise(exercise: Exercise): Exercise {
  const canonicalId = resolveCanonicalExerciseId(exercise.id, exercise.name);
  const libMatch = EXERCISE_LIBRARY.find((item) => item.id === canonicalId);
  const mapped = EXERCISE_MUSCLE_MAP[canonicalId];
  return {
    ...exercise,
    id: canonicalId,
    primaryMuscle: exercise.primaryMuscle || libMatch?.primaryMuscle || mapped?.primary,
    secondaryMuscles:
      exercise.secondaryMuscles && exercise.secondaryMuscles.length > 0
        ? exercise.secondaryMuscles
        : libMatch?.secondaryMuscles || mapped?.secondary,
    equipment: exercise.equipment || libMatch?.equipment || 'Inne',
    description: exercise.description || libMatch?.description || '',
    imageUrl: exercise.imageUrl || libMatch?.imageUrl || getExerciseImageUrl(canonicalId, 0),
  };
}

export function getExerciseCategoriesWorked(exercise: Exercise): MuscleCategory[] {
  const mapped = EXERCISE_MUSCLE_MAP[resolveCanonicalExerciseId(exercise.id, exercise.name)];
  const primary = exercise.primaryMuscle || mapped?.primary;
  const secondary =
    exercise.secondaryMuscles && exercise.secondaryMuscles.length > 0
      ? exercise.secondaryMuscles
      : mapped?.secondary || [];
  if (!primary) {
    return [exercise.category];
  }
  const cats = getInvolvedMuscleCategories({ primary, secondary });
  return cats.includes(exercise.category) ? cats : [exercise.category, ...cats];
}

export function getAlternativeExercisesFor(
  target: Exercise,
  excludeIds: string[] = [],
  extraPool: Exercise[] = []
): Exercise[] {
  const excluded = new Set(excludeIds.map((id) => resolveCanonicalExerciseId(id)));
  excluded.add(resolveCanonicalExerciseId(target.id, target.name));

  const targetPrimary =
    target.primaryMuscle ||
    EXERCISE_MUSCLE_MAP[resolveCanonicalExerciseId(target.id, target.name)]?.primary;
  const targetParentCat = targetPrimary
    ? MUSCLE_SUBGROUP_MAP[targetPrimary]?.parentCategory || target.category
    : target.category;

  const pool = [...extraPool, ...EXERCISE_LIBRARY];
  const samePrimary: Exercise[] = [];
  const sameCategory: Exercise[] = [];
  const secondaryOverlap: Exercise[] = [];

  for (const cand of pool) {
    const cid = resolveCanonicalExerciseId(cand.id, cand.name);
    if (excluded.has(cid)) continue;
    excluded.add(cid);

    const candPrimary = cand.primaryMuscle || EXERCISE_MUSCLE_MAP[cid]?.primary;
    const candSec = cand.secondaryMuscles || EXERCISE_MUSCLE_MAP[cid]?.secondary || [];
    if (targetPrimary && candPrimary === targetPrimary) {
      samePrimary.push(cand);
    } else if (
      cand.category === target.category ||
      (candPrimary && MUSCLE_SUBGROUP_MAP[candPrimary]?.parentCategory === targetParentCat)
    ) {
      sameCategory.push(cand);
    } else if (targetPrimary && candSec.some((s) => s.muscle === targetPrimary && s.weight >= 0.3)) {
      secondaryOverlap.push(cand);
    }
  }

  return [...samePrimary, ...sameCategory, ...secondaryOverlap];
}

export function normalizeDayPlan(day: DayPlan): DayPlan {
  const exercises = (day.exercises || []).map(normalizeExercise);
  return {
    ...day,
    exercises,
  };
}

export function cloneExercise(exercise: Exercise): Exercise {
  return { ...exercise };
}

export function cloneDays(days: DayPlan[]): DayPlan[] {
  return days.map((day) => ({
    ...day,
    exercises: day.exercises ? day.exercises.map(cloneExercise) : [],
  }));
}

function pickLibraryExercises(ids: string[]): Exercise[] {
  const result: Exercise[] = [];
  for (const id of ids) {
    const found = EXERCISE_LIBRARY.find((item) => item.id === id);
    if (found) result.push(cloneExercise(found));
  }
  return result;
}

function makeRestDay(
  id: string,
  name: string = 'Dzień regeneracji',
  subtitle: string = 'Odpoczynek, sen i nawodnienie',
  type: 'rest' | 'walk' = 'rest'
): DayPlan {
  return {
    id,
    name,
    subtitle,
    iconName: type === 'walk' ? 'walk-outline' : 'bed-outline',
    bannerTag: type === 'walk' ? 'cardio' : 'rest',
    time: type === 'walk' ? '30-45 min' : 'Regeneracja',
    type,
    warmup:
      type === 'walk'
        ? 'Lekki spacer 6 000 – 10 000 kroków na świeżym powietrzu i krótkie rozciąganie.'
        : 'Zadbaj o 7–9h snu, białko w diecie i mobilność stawów.',
    exercises: [],
  };
}

export function buildPlanDaysFromTemplate(
  templateKey: Exclude<PlanTemplateKey, 'clone_current'>,
  fallbackDays?: DayPlan[],
  lang: AppLanguage = getStoredLanguageSync()
): DayPlan[] {
  const finish = (days: DayPlan[]): DayPlan[] => localizeTemplateDayList(days, lang);

  if (templateKey === 'blank') {
    return finish(
      DEFAULT_DAYS_OF_WEEK.map((d) =>
        makeRestDay(d.id, 'Wolny dzień', 'Skonfiguruj jako trening lub regenerację', 'rest')
      )
    );
  }

  if (templateKey === 'fbw3') {
    const dayA: DayPlan = {
      id: 'mon',
      name: 'FBW A · Siła bazowa',
      subtitle: 'Nogi • Klatka • Plecy • Barki • Brzuch',
      iconName: 'barbell-outline',
      bannerTag: 'fbw',
      time: '60-75 min',
      type: 'workout',
      warmup: '5 min orbitrek/bieżnia, krążenia stawów, 2 serie wstępne głównych bojów.',
      exercises: pickLibraryExercises([
        'lib_back_squat',
        'lib_barbell_bench',
        'lib_barbell_row',
        'lib_db_lateral_raise',
        'lib_cable_crunch',
      ]),
    };
    const dayB: DayPlan = {
      id: 'wed',
      name: 'FBW B · Hipertrofia',
      subtitle: 'Dwugłowe • Góra klatki • Drążek • Barki',
      iconName: 'fitness-outline',
      bannerTag: 'fbw',
      time: '60-70 min',
      type: 'workout',
      warmup: 'Rozgrzewka bioder i rotatorów barków gumą oporową.',
      exercises: pickLibraryExercises([
        'lib_rdl',
        'lib_db_incline_press',
        'lib_lat_pulldown_wide',
        'lib_ohp_barbell',
        'lib_hammer_curl',
      ]),
    };
    const dayC: DayPlan = {
      id: 'fri',
      name: 'FBW C · Akcesoria i Wyciągi',
      subtitle: 'Suwnica • Rozpiętki • Wiosło • Ramiona',
      iconName: 'flash-outline',
      bannerTag: 'fbw',
      time: '60-70 min',
      type: 'workout',
      warmup: 'Aktywacja pośladków, 2 serie rozgrzewkowe wyciskań.',
      exercises: pickLibraryExercises([
        'lib_leg_press',
        'lib_dips_chest',
        'lib_seated_cable_row',
        'lib_tricep_rope_pushdown',
        'lib_hanging_leg_raise',
      ]),
    };

    return finish([
      dayA,
      makeRestDay('tue', 'Regeneracja aktywna', 'Spacer i lekka mobilność', 'walk'),
      dayB,
      makeRestDay('thu', 'Regeneracja', 'Odpoczynek między sesjami FBW', 'rest'),
      dayC,
      makeRestDay('sat', 'Spacer & Rozciąganie', 'Aktywna regeneracja weekendowa', 'walk'),
      makeRestDay('sun', 'Pełen odpoczynek', 'Reset układu nerwowego przed poniedziałkiem', 'rest'),
    ]);
  }

  if (templateKey === 'upper_lower') {
    const upperA: DayPlan = {
      id: 'mon',
      name: 'Upper A · Siła Góry',
      subtitle: 'Klatka • Plecy • Barki • Ramiona',
      iconName: 'barbell-outline',
      bannerTag: 'upper',
      time: '60-75 min',
      type: 'workout',
      warmup: 'Rotatory barków z gumą, 2 serie wstępne wyciskania.',
      exercises: pickLibraryExercises([
        'lib_barbell_bench',
        'lib_barbell_row',
        'lib_db_shoulder_press',
        'lib_lat_pulldown_wide',
        'lib_tricep_rope_pushdown',
        'lib_ezbar_curl',
      ]),
    };
    const lowerA: DayPlan = {
      id: 'tue',
      name: 'Lower A · Przysiad i Przód uda',
      subtitle: 'Czworogłowe • Dwugłowe • Łydki • Brzuch',
      iconName: 'walk-outline',
      bannerTag: 'lower',
      time: '60-75 min',
      type: 'workout',
      warmup: 'Mobilizacja stawu skokowego i bioder, przysiady bez ciężaru.',
      exercises: pickLibraryExercises([
        'lib_back_squat',
        'lib_rdl',
        'lib_leg_extension',
        'lib_calf_raise',
        'lib_cable_crunch',
      ]),
    };
    const upperB: DayPlan = {
      id: 'thu',
      name: 'Upper B · Hipertrofia Góry',
      subtitle: 'Skos dodatni • Wiosłowanie • Barki bok • Tył',
      iconName: 'fitness-outline',
      bannerTag: 'upper',
      time: '60-75 min',
      type: 'workout',
      warmup: '5 min rozgrzewki ramion i łopatek.',
      exercises: pickLibraryExercises([
        'lib_db_incline_press',
        'lib_seated_cable_row',
        'lib_butterfly',
        'lib_db_lateral_raise',
        'lib_face_pull',
        'lib_hammer_curl',
      ]),
    };
    const lowerB: DayPlan = {
      id: 'fri',
      name: 'Lower B · Tył uda i Pośladek',
      subtitle: 'Dwugłowe • Pośladki • Suwnica • Brzuch',
      iconName: 'flame-outline',
      bannerTag: 'lower',
      time: '60-70 min',
      type: 'workout',
      warmup: 'Glute bridge bez ciężaru i wymachy nóg.',
      exercises: pickLibraryExercises([
        'lib_deadlift',
        'lib_leg_press',
        'lib_seated_leg_curl',
        'lib_bulgarian_squat',
        'lib_hanging_leg_raise',
      ]),
    };

    return finish([
      upperA,
      lowerA,
      makeRestDay('wed', 'Dzień regeneracji', 'Sen, białko i spacer', 'rest'),
      upperB,
      lowerB,
      makeRestDay('sat', 'Aktywny spacer', 'Cardio w strefie tlenowej', 'walk'),
      makeRestDay('sun', 'Odpoczynek', 'Pełna regeneracja przed nowym cyklem', 'rest'),
    ]);
  }

  if (templateKey === 'ppl') {
    const pushDay = (id: string, name: string): DayPlan => ({
      id,
      name,
      subtitle: 'Klatka • Przedni i boczny bark • Triceps',
      iconName: 'flash-outline',
      bannerTag: 'push',
      time: '65-75 min',
      type: 'workout',
      warmup: 'Rotatory zewnętrzne barków i serie wstępne wyciskania.',
      exercises: pickLibraryExercises([
        'lib_barbell_bench',
        'lib_db_incline_press',
        'lib_cable_crossover',
        'lib_db_shoulder_press',
        'lib_db_lateral_raise',
        'lib_tricep_rope_pushdown',
      ]),
    });
    const pullDay = (id: string, name: string): DayPlan => ({
      id,
      name,
      subtitle: 'Plecy szerokość i grubość • Tył barku • Biceps',
      iconName: 'barbell-outline',
      bannerTag: 'pull',
      time: '65-75 min',
      type: 'workout',
      warmup: 'Zwis na drążku i ściągania łopatek na wyciągu.',
      exercises: pickLibraryExercises([
        'lib_pullups_overhand',
        'lib_barbell_row',
        'lib_seated_cable_row',
        'lib_face_pull',
        'lib_ezbar_curl',
        'lib_hammer_curl',
      ]),
    });
    const legsDay = (id: string, name: string): DayPlan => ({
      id,
      name,
      subtitle: 'Uda • Pośladki • Łydki • Brzuch',
      iconName: 'fitness-outline',
      bannerTag: 'legs',
      time: '65-80 min',
      type: 'workout',
      warmup: 'Rozgrzewka bioder, 2 serie wstępne przysiadu.',
      exercises: pickLibraryExercises([
        'lib_back_squat',
        'lib_rdl',
        'lib_leg_press',
        'lib_lying_leg_curl',
        'lib_calf_raise',
        'lib_cable_crunch',
      ]),
    });

    return finish([
      pushDay('mon', 'Push A · Wypychanie'),
      pullDay('tue', 'Pull A · Przyciąganie'),
      legsDay('wed', 'Legs A · Nogi'),
      pushDay('thu', 'Push B · Wypychanie'),
      pullDay('fri', 'Pull B · Przyciąganie'),
      legsDay('sat', 'Legs B · Nogi'),
      makeRestDay('sun', 'Regeneracja', 'Odpoczynek po 6 dniach treningu', 'rest'),
    ]);
  }

  if (templateKey === 'split4') {
    const chestTriceps: DayPlan = {
      id: 'mon',
      name: 'Klatka & Triceps',
      subtitle: 'Wyciskania • Rozpiętki • Prostowania tricepsa',
      iconName: 'flash-outline',
      bannerTag: 'chest',
      time: '60-70 min',
      type: 'workout',
      warmup: 'Krążenia ramion i 2 serie wstępne wyciskania na ławce.',
      exercises: pickLibraryExercises([
        'lib_barbell_bench',
        'lib_db_incline_press',
        'lib_cable_crossover',
        'lib_dips_triceps',
        'lib_tricep_rope_pushdown',
      ]),
    };
    const backBiceps: DayPlan = {
      id: 'tue',
      name: 'Plecy & Biceps',
      subtitle: 'Podciąganie • Wiosłowanie • Uginania ramion',
      iconName: 'barbell-outline',
      bannerTag: 'back',
      time: '65-75 min',
      type: 'workout',
      warmup: 'Aktywny zwis na drążku i ściągania łopatek.',
      exercises: pickLibraryExercises([
        'lib_pullups_overhand',
        'lib_barbell_row',
        'lib_seated_cable_row',
        'lib_ezbar_curl',
        'lib_hammer_curl',
      ]),
    };
    const legsDay: DayPlan = {
      id: 'thu',
      name: 'Nogi & Pośladki',
      subtitle: 'Przysiady • RDL • Maszyny • Łydki',
      iconName: 'walk-outline',
      bannerTag: 'legs',
      time: '65-80 min',
      type: 'workout',
      warmup: 'Mobilizacja bioder i 2 serie lekkiego przysiadu.',
      exercises: pickLibraryExercises([
        'lib_back_squat',
        'lib_rdl',
        'lib_leg_press',
        'lib_lying_leg_curl',
        'lib_calf_raise',
      ]),
    };
    const shouldersAbs: DayPlan = {
      id: 'fri',
      name: 'Barki & Brzuch',
      subtitle: 'OHP • Wznosy bokiem • Tył barku • Core',
      iconName: 'flame-outline',
      bannerTag: 'shoulders',
      time: '55-65 min',
      type: 'workout',
      warmup: 'Rotatory zewnętrzne barków z linką lub lekkim hantlem.',
      exercises: pickLibraryExercises([
        'lib_ohp_barbell',
        'lib_db_lateral_raise',
        'lib_reverse_pec_deck',
        'lib_cable_crunch',
        'lib_hanging_leg_raise',
      ]),
    };

    return finish([
      chestTriceps,
      backBiceps,
      makeRestDay('wed', 'Dzień regeneracji', 'Odpoczynek, sen i nawodnienie', 'rest'),
      legsDay,
      shouldersAbs,
      makeRestDay('sat', 'Aktywny spacer', 'Cardio w strefie tlenowej', 'walk'),
      makeRestDay('sun', 'Odpoczynek', 'Pełna regeneracja przed kolejnym tygodniem', 'rest'),
    ]);
  }

  return fallbackDays
    ? cloneDays(fallbackDays)
    : finish(DEFAULT_DAYS_OF_WEEK.map((d) => makeRestDay(d.id)));
}
