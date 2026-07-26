const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const root = path.join(__dirname, '..');

function loadEnvFile(filename) {
  const filePath = path.join(root, filename);
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const [name, ...rest] = trimmed.split('=');
    if (!name || process.env[name]) continue;
    let value = rest.join('=').trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[name] = value.replace(/\\n/g, '\n');
  }
}
loadEnvFile('.env.local');
loadEnvFile('.env');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const RUN_ID = process.argv[2] || 'cbse-run-2026-07-26-02';

const ASSERTION_REASON_OPTIONS = [
  'Both A and R are true and R is the correct explanation of A.',
  'Both A and R are true but R is not the correct explanation of A.',
  'A is true but R is false.',
  'A is false but R is true.',
];

const SUBJECT_REMAP = {
  'Mathematics (Standard)': 'Mathematics',
  'English (Language & Literature)': 'English',
  'English Core': 'English',
};

const CLASS_REMAP = { 10: 'Class 10', 12: 'Class 12' };

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

function stripOptionPrefix(opt) {
  return String(opt || '').replace(/^\s*[A-D][.)]\s*/, '').trim();
}

const BLEED_MARKERS = /please note|assessment scheme|continue in the current session|section\s*[-–]|the following (two|three) questions|page \d+ of \d+/i;

function optionsLookBled(options) {
  if (options.some((o) => BLEED_MARKERS.test(o))) return true;
  const lengths = options.map((o) => o.length).sort((a, b) => a - b);
  const median = lengths[Math.floor(lengths.length / 2)];
  const longest = lengths[lengths.length - 1];
  if (median > 0 && longest > median * 3 && longest > 60) return true;
  return false;
}

function letterToIndex(letter) {
  const m = String(letter || '').trim().match(/^\(?([A-D])[.)\s]?/i);
  return m ? m[1].toUpperCase().charCodeAt(0) - 65 : -1;
}

function classifyArAnswerIndex(answerText) {
  const idx = letterToIndex(answerText);
  if (idx >= 0 && idx <= 3) return idx;
  const lower = String(answerText || '').toLowerCase();
  if (/true.*correct explanation/.test(lower)) return 0;
  if (/true.*not.*correct explanation/.test(lower)) return 1;
  if (/true but .*(reason|r).*false/.test(lower) || /assertion.*true.*reason.*false/.test(lower)) return 2;
  if (/false but .*(reason|r).*true/.test(lower) || /assertion.*false.*reason.*true/.test(lower)) return 3;
  return -1;
}

function marksToTypeAndDifficulty(marks) {
  if (marks === 2) return { type: 'Very Short Answer', difficulty: 'Medium', bloom: 'Understand' };
  if (marks === 3) return { type: 'Short Answer', difficulty: 'Medium', bloom: 'Apply' };
  if (marks === 5) return { type: 'Long Answer', difficulty: 'Hard', bloom: 'Analyze' };
  return null;
}

function estimatedTime(difficulty) {
  return difficulty === 'Easy' ? 60 : difficulty === 'Medium' ? 120 : 240;
}

function buildCacheKey(board, className, subject, chapter) {
  return crypto.createHash('sha256').update(`${board}|${className}|${subject}|${chapter}`.toLowerCase()).digest('hex');
}

async function main() {
  const { data: allRows, error: allErr } = await supabase
    .from('raw_extracted_questions')
    .select('*')
    .eq('agent_run_id', RUN_ID)
    .in('review_status', ['pending', 'needs_review']);
  if (allErr) throw new Error(allErr.message);

  const stats = {
    total: allRows.length,
    promoted: 0,
    rejected_structural: 0,
    rejected_unclassified_chapter: 0,
    rejected_untyped: 0,
    by_subject_chapter: {},
  };

  const promotions = []; // { rawId, questionBankRow }
  const rejections = []; // { rawId, reason }

  for (const row of allRows) {
    if (BLEED_MARKERS.test(row.question || '')) {
      rejections.push({ rawId: row.id, reason: 'Question stem contains boilerplate/bleed marker text' });
      stats.rejected_structural += 1;
      continue;
    }

    const subject = SUBJECT_REMAP[row.subject] || row.subject;
    const className = CLASS_REMAP[Number(row.class_or_phase)] || `Class ${row.class_or_phase}`;
    const isAr = /assertion\s*\(a\)/i.test(row.question) && /reason\s*\(r\)/i.test(row.question);

    let type;
    let options = [];
    let answer;
    let marks = row.marks;
    let difficulty;
    let bloom;

    if (isAr) {
      type = 'Assertion Reason';
      options = ASSERTION_REASON_OPTIONS.slice();
      const idx = classifyArAnswerIndex(row.answer);
      if (idx < 0) {
        rejections.push({ rawId: row.id, reason: 'AR answer letter/content not recognized' });
        stats.rejected_structural += 1;
        continue;
      }
      answer = options[idx];
      marks = marks || 1;
      difficulty = 'Easy';
      bloom = 'Understand';
    } else if (row.type === 'MCQ' && Array.isArray(row.options) && row.options.length === 4) {
      type = 'MCQ';
      options = row.options.map(stripOptionPrefix);
      if (options.some((o) => o.length === 0 || o.length > 220) || optionsLookBled(options)) {
        rejections.push({ rawId: row.id, reason: 'MCQ option empty, suspiciously long, or contains boilerplate bleed' });
        stats.rejected_structural += 1;
        continue;
      }
      const idx = letterToIndex(row.answer);
      if (idx < 0 || idx > 3) {
        rejections.push({ rawId: row.id, reason: 'MCQ answer letter not recognized' });
        stats.rejected_structural += 1;
        continue;
      }
      answer = options[idx];
      marks = marks || 1;
      difficulty = 'Easy';
      bloom = 'Understand';
    } else if (row.type === 'MCQ') {
      rejections.push({ rawId: row.id, reason: `MCQ has ${(row.options || []).length} options, expected exactly 4 (likely parser bleed)` });
      stats.rejected_structural += 1;
      continue;
    } else {
      const mapped = marksToTypeAndDifficulty(marks);
      if (!mapped) {
        rejections.push({ rawId: row.id, reason: `Unsupported marks value (${marks}) for non-MCQ/non-AR row -- cannot map to a CBSE section type` });
        stats.rejected_untyped += 1;
        continue;
      }
      const answerText = (row.answer || row.explanation || '').replace(/^answer:\s*/i, '').trim();
      if (answerText.length < 10) {
        rejections.push({ rawId: row.id, reason: 'Answer/explanation text too short or missing' });
        stats.rejected_structural += 1;
        continue;
      }
      type = mapped.type;
      difficulty = mapped.difficulty;
      bloom = mapped.bloom;
      options = [];
      answer = answerText.slice(0, 2000);
    }

    const classificationText = `${row.question} ${options.join(' ')} ${row.explanation || ''}`;
    const chapter = classifyChapter(subject, classificationText);
    if (!chapter) {
      rejections.push({ rawId: row.id, reason: `No confident chapter match for subject "${subject}" (catalog gap or off-syllabus topic)` });
      stats.rejected_unclassified_chapter += 1;
      continue;
    }

    const questionBankRow = {
      board: 'CBSE',
      class_name: className,
      subject,
      chapter,
      type,
      difficulty,
      bloom_level: bloom,
      concept_tag: chapter,
      learning_outcome: `Understand ${chapter} in CBSE ${subject}.`,
      estimated_time: estimatedTime(difficulty),
      marks,
      source: 'board-official',
      official_source: true,
      question: row.question,
      options,
      answer,
      explanation: row.explanation || '',
      normalized_question: row.normalized_question_text,
      exact_hash: row.exact_hash,
      source_document_hash: row.source_document_hash,
      source_url: row.source_url,
      source_title: row.source_title,
      source_years: row.source_year ? [row.source_year] : null,
      source_kind: row.source_kind,
      source_checked_at: new Date().toISOString(),
      agent_run_id: row.agent_run_id,
      cache_key: buildCacheKey('CBSE', className, subject, chapter),
    };

    promotions.push({ rawId: row.id, documentId: row.document_id, questionBankRow });
    const key = `${subject} / ${className} / ${chapter}`;
    stats.by_subject_chapter[key] = (stats.by_subject_chapter[key] || 0) + 1;
  }

  console.log(`Classified ${promotions.length} promotable rows, ${rejections.length} held back, out of ${allRows.length} total.`);

  const insertFailures = [];
  for (const p of promotions) {
    const { data: inserted, error: insErr } = await supabase
      .from('question_bank')
      .insert(p.questionBankRow)
      .select('id')
      .single();

    if (insErr) {
      insertFailures.push({ rawId: p.rawId, reason: insErr.message });
      await supabase
        .from('raw_extracted_questions')
        .update({ review_status: 'needs_review' })
        .eq('id', p.rawId);
      continue;
    }

    const qId = inserted.id;
    stats.promoted += 1;

    await supabase.from('question_sources').insert({
      question_id: qId,
      document_id: p.documentId,
      raw_extracted_question_id: p.rawId,
      source_url: p.questionBankRow.source_url,
      source_title: p.questionBankRow.source_title,
      source_domain: 'cbseacademic.nic.in',
      source_kind: p.questionBankRow.source_kind,
      source_year: p.questionBankRow.source_years ? p.questionBankRow.source_years[0] : null,
      official_source: true,
    });

    await supabase
      .from('raw_extracted_questions')
      .update({ review_status: 'promoted', promoted_question_id: qId })
      .eq('id', p.rawId);
  }
  stats.insert_failures = insertFailures.length;

  for (const r of rejections) {
    await supabase
      .from('raw_extracted_questions')
      .update({ review_status: 'needs_review' })
      .eq('id', r.rawId);
  }

  const outPath = path.join(root, 'research', 'cbse', `promotion_summary_${RUN_ID}.json`);
  fs.writeFileSync(outPath, JSON.stringify({ run_id: RUN_ID, stats, rejections, insertFailures }, null, 2));
  console.log(JSON.stringify(stats, null, 2));
  console.log(`\nWrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
