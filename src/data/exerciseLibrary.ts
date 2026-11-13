import {
  DayMetaInfo,
  DayPlan,
  EquipmentType,
  Exercise,
  MuscleCategory,
  PlanTemplateKey,
} from '../types/workout';

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
  return {
    id,
    name,
    category,
    equipment,
    sets,
    reps,
    rest,
    description,
    note,
    imageUrl: '',
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
    'Pompki na poręczach (Dipsy) — klatka',
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
    'Pompki na poręczach (Dipsy) — triceps',
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
    'Allachy — skłony tułowia na wyciągu górnym',
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
    'Bieżnia — marsz pod górę (nachylenie 10–12%)',
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
];

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
  fallbackDays?: DayPlan[]
): DayPlan[] {
  if (templateKey === 'blank') {
    return DEFAULT_DAYS_OF_WEEK.map((d) =>
      makeRestDay(d.id, 'Wolny dzień', 'Skonfiguruj jako trening lub regenerację', 'rest')
    );
  }

  if (templateKey === 'fbw3') {
    const dayA: DayPlan = {
      id: 'mon',
      name: 'FBW A — Siła bazowa',
      subtitle: 'Nogi • Klatka • Plecy • Barki • Brzuch',
      iconName: 'barbell-outline',
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
      name: 'FBW B — Hipertrofia',
      subtitle: 'Dwugłowe • Góra klatki • Drążek • Barki',
      iconName: 'fitness-outline',
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
      name: 'FBW C — Akcesoria & Wyciągi',
      subtitle: 'Suwnica • Rozpiętki • Wiosło • Ramiona',
      iconName: 'flash-outline',
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

    return [
      dayA,
      makeRestDay('tue', 'Regeneracja aktywna', 'Spacer i lekka mobilność', 'walk'),
      dayB,
      makeRestDay('thu', 'Regeneracja', 'Odpoczynek między sesjami FBW', 'rest'),
      dayC,
      makeRestDay('sat', 'Spacer & Rozciąganie', 'Aktywna regeneracja weekendowa', 'walk'),
      makeRestDay('sun', 'Pełen odpoczynek', 'Reset układu nerwowego przed poniedziałkiem', 'rest'),
    ];
  }

  if (templateKey === 'upper_lower') {
    const upperA: DayPlan = {
      id: 'mon',
      name: 'Upper A — Siła Góry',
      subtitle: 'Klatka • Plecy • Barki • Ramiona',
      iconName: 'barbell-outline',
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
      name: 'Lower A — Przysiad & Przód uda',
      subtitle: 'Czworogłowe • Dwugłowe • Łydki • Brzuch',
      iconName: 'walk-outline',
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
      name: 'Upper B — Hipertrofia Góry',
      subtitle: 'Skos dodatni • Wiosłowanie • Barki bok • Tył',
      iconName: 'fitness-outline',
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
      name: 'Lower B — Tył uda & Pośladek',
      subtitle: 'Dwugłowe • Pośladki • Suwnica • Brzuch',
      iconName: 'flame-outline',
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

    return [
      upperA,
      lowerA,
      makeRestDay('wed', 'Dzień regeneracji', 'Sen, białko i spacer', 'rest'),
      upperB,
      lowerB,
      makeRestDay('sat', 'Aktywny spacer', 'Cardio w strefie tlenowej', 'walk'),
      makeRestDay('sun', 'Odpoczynek', 'Pełna regeneracja przed nowym cyklem', 'rest'),
    ];
  }

  if (templateKey === 'ppl') {
    const pushDay = (id: string, name: string): DayPlan => ({
      id,
      name,
      subtitle: 'Klatka • Przedni i boczny bark • Triceps',
      iconName: 'flash-outline',
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

    return [
      pushDay('mon', 'Push A — Wypychanie'),
      pullDay('tue', 'Pull A — Przyciąganie'),
      legsDay('wed', 'Legs A — Nogi'),
      pushDay('thu', 'Push B — Wypychanie'),
      pullDay('fri', 'Pull B — Przyciąganie'),
      legsDay('sat', 'Legs B — Nogi'),
      makeRestDay('sun', 'Regeneracja', 'Odpoczynek po 6 dniach treningu', 'rest'),
    ];
  }

  return fallbackDays ? cloneDays(fallbackDays) : DEFAULT_DAYS_OF_WEEK.map((d) => makeRestDay(d.id));
}
