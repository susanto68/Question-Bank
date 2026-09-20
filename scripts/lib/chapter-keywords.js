/**
 * Shared chapter classifier for board-paper promotion.
 *
 * Extracted from scripts/promote-cbse-batch1.js so the previous-year-question
 * pipeline and the original batch promoter agree on how a question is mapped to
 * a syllabus chapter. A question that scores no keyword hit stays unclassified
 * rather than being filed under a guessed chapter.
 */
// Chapter keyword classifiers -- mirrors src/data/catalog.ts chapter lists.
// Only chapters actually present in the live catalog are targets; anything
// that doesn't score a hit is left unclassified rather than mistagged.
const CHAPTER_KEYWORDS = {
  Science: {
    'Life Processes': ['nutrition', 'respiration', 'digest', 'excretion', 'translocation', 'autotroph', 'heterotroph', 'saprophyt', 'parasit', 'alveoli', 'villi', 'nephron', 'xylem', 'phloem', 'lactic acid', 'breakdown of the glucose', 'muscle cells', 'peristalsis', 'photosynthes', 'stomata'],
    'Control and Coordination': ['nervous system', 'neuron', 'synapse', 'reflex action', 'hormone', 'cerebrum', 'cerebellum', 'medulla', 'pituitary', 'thyroid', 'insulin', 'pancreas', 'adrenaline', 'tropism', 'auxin', 'gibberellin', 'phototropism', 'geotropism', 'blood pressure', 'brain'],
    Reproduction: ['budding', 'fragmentation', 'regeneration', 'binary fission', 'spore formation', 'vegetative propagation', 'puberty', 'fertiliz', 'placenta', 'contracepti', 'sexually transmitted', 'pollen', 'ovary', 'testes'],
    'Heredity and Evolution': ['heredity', 'gene ', 'allele', 'dominant', 'recessive', 'chromosome', 'mendel', 'cross between', 'offspring', 'inherit', 'fossil', 'evolution', 'natural selection', 'homologous', 'analogous', 'speciation', 'sex determination', 'genetic makeup', 'furred rabbit'],
    'Light - Reflection and Refraction': ['mirror', 'lens', 'reflection of light', 'refraction', 'focal length', 'real image', 'virtual image', 'concave', 'convex', 'magnification'],
    'Human Eye and Colourful World': ['human eye', 'retina', 'cornea', 'myopia', 'hypermetropia', 'presbyopia', 'cataract', 'rainbow', 'scattering of light', 'tyndall', 'dispersion of light', 'power of accommodation'],
    Electricity: ['electric current', 'resistance', 'ohm', 'circuit', 'potential difference', 'resistor', 'ammeter', 'voltmeter', 'series combination', 'parallel combination', 'heating effect', 'electric power', 'resistivity'],
    'Natural Resources': ['ozone', 'biodegradable', 'non-biodegradable', 'food chain', 'food web', 'trophic level', 'ecosystem', 'greenhouse'],
  },
  'Social Science': {
    Federalism: ['federalism', 'union list', 'state list', 'concurrent list', 'centre-state'],
    'Political Parties': ['political part', 'one-party', 'multi-party', 'national part', 'regional part'],
    'Gender Religion Caste': ['gender', 'communal', 'caste system', 'religion and politics'],
    'Popular Struggles and Movements': ['popular struggle', 'pressure group', 'movement demanded'],
    'Sectors of Indian Economy': ['primary sector', 'secondary sector', 'tertiary sector', 'organised sector', 'unorganised sector'],
    'Money and Credit': ['bank loan', 'collateral', 'credit', 'formal sector loan', 'informal sector loan', 'self help group'],
    'Globalisation and the Indian Economy': ['globalisation', 'globalization', 'multinational', 'trade barrier', 'liberalisation'],
    'Consumer Rights': ['consumer', 'copra', 'redressal', 'right to safety', 'right to information'],
    Nationalism_in_India: ['non-cooperation', 'civil disobedience', 'satyagraha', 'gandhi', 'rowlatt', 'khilafat'],
    'Resources and Power': ['mineral resource', 'power resource', 'coal', 'petroleum'],
  },
  Mathematics: {
    Trigonometry: ['trigonometric ratio', 'sin ', 'cos ', 'tan ', 'angle of elevation', 'angle of depression', 'sec ', 'cosec'],
    'Quadratic Equations': ['quadratic equation', 'discriminant'],
    'Arithmetic Progressions': ['arithmetic progression', 'common difference', 'nth term'],
    Circles: ['tangent to a circle', 'chord of a circle', 'tangent drawn'],
    Triangles: ['similar triangle', 'pythagoras', 'congruent triangle'],
    'Coordinate Geometry': ['distance formula', 'section formula', 'coordinate geometry', 'midpoint'],
    Statistics: ['mean of', 'median', 'mode of', 'frequency distribution'],
    Probability: ['probability of'],
    'Surface Areas and Volumes': ['surface area', 'volume of', 'cylinder', 'cone', 'sphere', 'hemisphere'],
    Polynomials: ['polynomial', 'zeroes of'],
    'Linear Equations': ['linear equation', 'pair of linear equations'],
    'Number System': ['euclid', 'hcf', 'lcm', 'rational number', 'irrational number', 'real number'],
  },
  Physics: {
    'Electric Charges and Fields': ['electric charge', "coulomb's law", 'electric field', 'gauss'],
    'Electrostatic Potential and Capacitance': ['capacitance', 'capacitor', 'electric potential'],
    'Current Electricity': ['current electricity', "ohm's law", 'kirchhoff', 'resistivity', 'drift velocity'],
    'Moving Charges and Magnetism': ['moving charge', 'cyclotron', 'biot-savart', 'ampere'],
    'Magnetism and Matter': ['magnetic compass', 'bar magnet', 'magnetic dipole', 'magnetism'],
    'Electromagnetic Induction': ['electromagnetic induction', 'faraday', 'lenz', 'induced emf'],
    'Alternating Current': ['alternating current', 'ac circuit', 'impedance', 'lc circuit'],
    'Electromagnetic Waves': ['electromagnetic wave', 'electromagnetic spectrum'],
    'Ray Optics': ['ray optics', 'total internal reflection', 'refraction of light', 'convex mirror', 'concave mirror', 'convex lens', 'concave lens'],
    'Wave Optics': ['interference', 'diffraction', 'young double slit', 'wavefront'],
    'Dual Nature of Radiation': ['photoelectric effect', 'dual nature', 'work function'],
    Atoms: ['bohr model', 'hydrogen atom', 'energy of an electron in hydrogen'],
    Nuclei: ['radioactivity', 'half life', 'binding energy', 'nucleus', 'nuclear fission', 'nuclear fusion'],
    'Semiconductor Electronics': ['semiconductor', 'p-n junction', 'diode', 'transistor', 'rectifier'],
    Kinematics: ['projectile motion', 'relative velocity', 'equations of motion'],
    Gravitation: ['kepler', 'gravitational', 'escape velocity', 'orbital velocity'],
    Oscillations: ['simple harmonic motion', 'shm', 'pendulum', 'oscillation'],
    Waves: ['doppler', 'sound wave', 'standing wave', 'wave equation'],
    Thermodynamics: ['thermodynamics', 'heat engine', 'carnot', 'isothermal', 'adiabatic'],
  },
  Chemistry: {
    Solutions: ['molality', 'molarity', "raoult's law", 'colligative propert'],
    Electrochemistry: ['electrochemistry', 'electrode potential', 'galvanic cell', 'nernst'],
    'Chemical Kinetics': ['rate of reaction', 'order of reaction', 'rate constant', 'chemical kinetics'],
    'Coordination Compounds': ['coordination compound', 'ligand', 'werner', 'coordination number'],
    'Haloalkanes and Haloarenes': ['haloalkane', 'haloarene', 'sn1', 'sn2'],
    'Alcohols Phenols and Ethers': ['alcohol', 'phenol', 'ether'],
    'Aldehydes Ketones and Carboxylic Acids': ['aldehyde', 'ketone', 'carboxylic acid'],
    Amines: ['amine', 'diazonium'],
    Biomolecules: ['carbohydrate', 'protein', 'enzyme', 'vitamin', 'nucleic acid', 'amino acid'],
    Polymers: ['polymer', 'polymerization', 'polymerisation'],
    'The p-Block Elements': ['p-block', 'group 15', 'group 16', 'group 17', 'group 18', 'nitrogen family', 'halogen family'],
    'The s-Block Elements': ['s-block', 'alkali metal', 'alkaline earth metal'],
    'Surface Chemistry': ['adsorption', 'colloid', 'surface chemistry', 'catalysis'],
    'Chemistry in Everyday Life': ['drug', 'antibiotic', 'antiseptic', 'detergent', 'food preservative'],
  },
  Biology: {
    'Reproduction in Organisms': ['asexual reproduction', 'sexual reproduction in organisms'],
    'Sexual Reproduction in Flowering Plants': ['pollination', 'fertilization in plant', 'double fertilization', 'embryo sac'],
    'Human Reproduction': ['human reproduction', 'testis', 'menstrual cycle', 'spermatogenesis', 'oogenesis'],
    'Reproductive Health': ['contraception', 'infertility', 'sexually transmitted infection', 'amniocentesis'],
    'Principles of Inheritance and Variation': ['mendel', 'monohybrid', 'dihybrid', 'linkage', 'pedigree'],
    'Molecular Basis of Inheritance': ['transcription', 'translation', 'operon', 'dna replication', 'genetic code'],
    Evolution: ['darwin', 'natural selection', 'homologous organ', 'analogous organ', 'speciation', 'evolution'],
    'Human Health and Disease': ['pathogen', 'immunity', 'antigen', 'antibody', 'aids', 'cancer'],
    'Strategies for Enhancement in Food Production': ['plant breeding', 'animal husbandry', 'apiculture', 'poultry'],
    'Microbes in Human Welfare': ['fermentation', 'biogas', 'biofertiliser', 'biofertilizer'],
    'Biotechnology Principles and Processes': ['recombinant dna', 'restriction enzyme', 'pcr', 'gel electrophoresis', 'plasmid'],
    'Biotechnology and its Applications': ['transgenic', 'bt cotton', 'gene therapy', 'gmo'],
    'Organisms and Populations': ['population growth', 'population interaction', 'population density'],
    Ecosystem: ['trophic level', 'energy flow', 'ecological pyramid', 'primary productivity', 'nutrient cycling'],
    'Biodiversity and Conservation': ['biodiversity', 'hotspot', 'red data book', 'conservation'],
    'Environmental Issues': ['pollution', 'ozone depletion', 'greenhouse effect', 'global warming', 'eutrophication'],
  },
  English: {
    Grammar: ['fill in the blank', 'determiner', 'modal', 'clause', 'reported speech', 'error correction', 'omission', 'preposition', 'conjunction', 'tense'],
    'Unseen Passage': ['read the following passage', 'unseen passage'],
    'Letter Writing': ['write a letter', 'letter to the editor', 'formal letter', 'informal letter'],
    'Essay Writing': ['write an essay'],
    Vocabulary: ['synonym', 'antonym', 'meaning of the word'],
    Poetry: ['poem', 'poet', 'stanza'],
    'Writing Skills': ['write a notice', 'write an article', 'write a speech'],
  },
  'Computer Science': {
    'Database Concepts': ['database', 'primary key', 'foreign key', 'table (relation)', 'relational database'],
    'SQL Basics': ['select ', 'sql query', 'from table', 'where clause'],
    Networking_Concepts: ['network topology', 'protocol', 'bandwidth', 'ip address'],
    OSI_Model: ['osi model', 'osi layer'],
    'Boolean Algebra': ['boolean expression', 'truth table', "de morgan"],
    'Logic Gates': ['logic gate', 'and gate', 'or gate', 'not gate', 'nand gate', 'nor gate'],
    'Data Structures - Stacks': ['stack', 'push and pop', 'lifo'],
    'Data Structures - Queues': ['queue', 'enqueue', 'dequeue', 'fifo'],
    'Data Structures - Linked Lists': ['linked list', 'node pointer'],
    'Data Structures - Arrays': ['array traversal', 'two-dimensional array'],
    'Data Structures - Trees': ['binary tree', 'root node', 'tree traversal'],
    'Sorting Algorithms': ['bubble sort', 'selection sort', 'insertion sort', 'merge sort', 'quick sort'],
    'Searching Algorithms': ['linear search', 'binary search'],
    'Object Oriented Programming': ['class and object', 'constructor', 'inheritance', 'polymorphism', 'encapsulation'],
  },
};
// fix key names with underscores back to the exact catalog strings
CHAPTER_KEYWORDS['Social Science']['Nationalism in India'] = CHAPTER_KEYWORDS['Social Science'].Nationalism_in_India;
delete CHAPTER_KEYWORDS['Social Science'].Nationalism_in_India;
CHAPTER_KEYWORDS['Computer Science']['Networking Concepts'] = CHAPTER_KEYWORDS['Computer Science'].Networking_Concepts;
delete CHAPTER_KEYWORDS['Computer Science'].Networking_Concepts;
CHAPTER_KEYWORDS['Computer Science']['OSI Model'] = CHAPTER_KEYWORDS['Computer Science'].OSI_Model;
delete CHAPTER_KEYWORDS['Computer Science'].OSI_Model;

function classifyChapter(subject, text) {
  const map = CHAPTER_KEYWORDS[subject];
  if (!map) return null;
  const lower = text.toLowerCase();
  let best = null;
  let bestScore = 0;
  for (const [chapter, keywords] of Object.entries(map)) {
    let score = 0;
    for (const kw of keywords) {
      if (lower.includes(kw)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = chapter;
    }
  }
  return bestScore >= 1 ? best : null;
}

module.exports = { CHAPTER_KEYWORDS, classifyChapter };
