export interface Board {
  id: string;
  name: string;
  short: string;
  description: string;
  accent: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// BOARDS — complete list including all state boards and competitive exams
// ─────────────────────────────────────────────────────────────────────────────
export const boards: Board[] = [
  // School Boards
  { id: 'icse', name: 'ICSE', short: 'IC', description: 'Classes 1–10, CISCE curriculum', accent: 'from-cyan-300 to-blue-400' },
  { id: 'isc', name: 'ISC', short: 'IS', description: 'Classes 11–12, CISCE curriculum', accent: 'from-sky-300 to-indigo-400' },
  { id: 'cbse', name: 'CBSE', short: 'CB', description: 'NCERT-aligned, Classes 1–12', accent: 'from-emerald-300 to-cyan-400' },

  // State Boards
  { id: 'jharkhand', name: 'Jharkhand Board', short: 'JH', description: 'JAC Board, Classes 9–12', accent: 'from-green-300 to-emerald-400' },
  { id: 'bihar', name: 'Bihar Board', short: 'BR', description: 'BSEB, Matric & Intermediate', accent: 'from-amber-300 to-yellow-400' },
  { id: 'up-board', name: 'UP Board', short: 'UP', description: 'UPMSP, Classes 9–12', accent: 'from-orange-300 to-amber-400' },
  { id: 'wb-board', name: 'West Bengal Board', short: 'WB', description: 'WBBSE/WBCHSE, Madhyamik & HS', accent: 'from-violet-300 to-purple-400' },
  { id: 'mh-board', name: 'Maharashtra Board', short: 'MH', description: 'MSBSHSE, SSC & HSC', accent: 'from-rose-300 to-pink-400' },
  { id: 'ka-board', name: 'Karnataka Board', short: 'KA', description: 'KSEEB, SSLC & PUC', accent: 'from-red-300 to-rose-400' },
  { id: 'tn-board', name: 'Tamil Nadu Board', short: 'TN', description: 'Samacheer Kalvi, SSLC & HSC', accent: 'from-teal-300 to-cyan-400' },
  { id: 'kl-board', name: 'Kerala Board', short: 'KL', description: 'KBPE, SSLC & Plus Two', accent: 'from-lime-300 to-green-400' },
  { id: 'state-boards', name: 'Other State Boards', short: 'SB', description: 'Regional state board exams', accent: 'from-amber-300 to-orange-400' },

  // Civil Services
  { id: 'upsc', name: 'UPSC', short: 'UP', description: 'IAS/IPS/IFS Prelims & Mains', accent: 'from-rose-300 to-red-400' },
  { id: 'jpsc', name: 'JPSC', short: 'JP', description: 'Jharkhand Civil Services', accent: 'from-lime-300 to-emerald-400' },
  { id: 'bpsc', name: 'BPSC', short: 'BP', description: 'Bihar Civil Services', accent: 'from-yellow-300 to-amber-400' },

  // Staff Selection & Government
  { id: 'ssc', name: 'SSC', short: 'SS', description: 'CGL, CHSL, CPO, MTS', accent: 'from-sky-300 to-indigo-400' },
  { id: 'railway', name: 'Railway (RRB)', short: 'RL', description: 'NTPC, Group D, JE, ALP', accent: 'from-yellow-300 to-lime-400' },

  // Banking & Finance
  { id: 'banking', name: 'Banking (IBPS)', short: 'BK', description: 'IBPS PO/Clerk, SBI PO/Clerk, RBI', accent: 'from-teal-300 to-green-400' },

  // Defence
  { id: 'nda', name: 'NDA', short: 'ND', description: 'National Defence Academy', accent: 'from-slate-300 to-blue-400' },
  { id: 'cds', name: 'CDS', short: 'CD', description: 'Combined Defence Services', accent: 'from-blue-300 to-slate-400' },

  // Engineering & Medical Entrance
  { id: 'jee', name: 'JEE', short: 'JE', description: 'JEE Main + Advanced, IIT entrance', accent: 'from-orange-300 to-red-400' },
  { id: 'neet', name: 'NEET', short: 'NE', description: 'Medical entrance (UG)', accent: 'from-pink-300 to-rose-400' },

  // Other Entrance
  { id: 'cuet', name: 'CUET', short: 'CU', description: 'Central University Entrance Test', accent: 'from-violet-300 to-fuchsia-400' },
  { id: 'cat', name: 'CAT', short: 'CA', description: 'MBA entrance, IIM admissions', accent: 'from-indigo-300 to-violet-400' },
];

// ─────────────────────────────────────────────────────────────────────────────
// CLASS GROUPS per board
// ─────────────────────────────────────────────────────────────────────────────
const schoolClasses: string[] = ['Nursery', 'LKG', 'UKG', ...Array.from({ length: 12 }, (_, i) => `Class ${i + 1}`)];
const seniorSchoolClasses: string[] = Array.from({ length: 12 }, (_, i) => `Class ${i + 1}`);
const classes9to12: string[] = ['Class 9', 'Class 10', 'Class 11', 'Class 12'];
const classes11to12: string[] = ['Class 11', 'Class 12'];

const classGroups: Record<string, string[]> = {
  icse: schoolClasses,
  isc: classes11to12,
  cbse: schoolClasses,
  jharkhand: classes9to12,
  bihar: classes9to12,
  'up-board': classes9to12,
  'wb-board': classes9to12,
  'mh-board': classes9to12,
  'ka-board': classes9to12,
  'tn-board': classes9to12,
  'kl-board': classes9to12,
  'state-boards': seniorSchoolClasses,

  // Civil Services
  upsc: ['Foundation', 'Prelims', 'Mains', 'Interview'],
  jpsc: ['Foundation', 'Prelims', 'Mains', 'Interview'],
  bpsc: ['Foundation', 'Prelims', 'Mains', 'Interview'],

  // Government Exams
  ssc: ['Foundation', 'Tier I', 'Tier II', 'Skill Test'],
  railway: ['Foundation', 'CBT 1', 'CBT 2', 'Technical'],
  banking: ['Foundation', 'Prelims', 'Mains', 'Interview'],

  // Defence
  nda: ['Class 11', 'Class 12', 'Mathematics', 'General Ability Test'],
  cds: ['English', 'General Knowledge', 'Elementary Mathematics'],

  // Entrance Exams
  neet: ['Class 11', 'Class 12', 'Dropper', 'Revision'],
  jee: ['Class 11', 'Class 12', 'Dropper', 'Advanced'],
  cuet: ['Class 12', 'Dropper'],
  cat: ['Foundation', 'VARC', 'DILR', 'QA'],
};

// ─────────────────────────────────────────────────────────────────────────────
// SUBJECT GROUPS per board type
// ─────────────────────────────────────────────────────────────────────────────
const subjectGroups: Record<string, string[]> = {
  // ICSE Classes 1-8
  schoolJunior: ['English', 'Mathematics', 'Environmental Science', 'General Knowledge', 'Hindi', 'Computer Basics'],
  // ICSE/CBSE Classes 6-10
  schoolMiddle: ['English', 'Mathematics', 'Science', 'Social Science', 'Hindi', 'Computer Applications', 'Geography'],
  // ICSE/CBSE Class 9-10 Science stream
  schoolSenior: ['Physics', 'Chemistry', 'Biology', 'Mathematics', 'Computer Applications', 'Computer Science', 'Economics', 'Accountancy', 'Political Science', 'History', 'Geography', 'English', 'Hindi', 'Business Studies'],
  // ISC / Class 11-12
  iscSenior: ['Physics', 'Chemistry', 'Biology', 'Mathematics', 'Computer Science', 'Economics', 'Accountancy', 'Political Science', 'History', 'Geography', 'English', 'Commerce', 'Psychology', 'Sociology'],
  // Civil Services
  civil: ['History', 'Geography', 'Indian Polity', 'Indian Economy', 'Environment & Ecology', 'Ethics & Integrity', 'Current Affairs', 'Science & Technology', 'Indian Society', 'International Relations', 'Disaster Management', 'Security Issues'],
  // Jharkhand-specific (adds Jharkhand GS)
  jharkhandCivil: ['Jharkhand General Studies', 'History', 'Geography', 'Indian Polity', 'Indian Economy', 'Environment & Ecology', 'Current Affairs', 'Jharkhand Tribal Culture', 'Jharkhand Economy', 'Jharkhand Geography'],
  // Bihar-specific
  biharCivil: ['Bihar General Studies', 'History', 'Geography', 'Indian Polity', 'Bihar Economy', 'Indian Economy', 'Environment & Ecology', 'Current Affairs', 'Bihar Culture & Heritage'],
  // SSC / Railway / Government exams
  aptitude: ['Quantitative Aptitude', 'Reasoning', 'English Language', 'General Awareness', 'Computer Knowledge'],
  // Banking-specific
  banking: ['Quantitative Aptitude', 'Reasoning', 'English Language', 'Banking Awareness', 'Computer Knowledge', 'Data Interpretation', 'Current Affairs'],
  // NDA
  nda: ['Mathematics', 'English', 'General Knowledge', 'Physics', 'Chemistry', 'History & Polity', 'Geography'],
  // CDS
  cds: ['English', 'General Knowledge', 'Elementary Mathematics'],
  // NEET
  neet: ['Physics', 'Chemistry', 'Botany', 'Zoology'],
  // JEE
  jee: ['Physics', 'Chemistry', 'Mathematics'],
  // CUET
  cuet: ['Physics', 'Chemistry', 'Biology', 'Mathematics', 'Accountancy', 'Business Studies', 'Economics', 'History', 'Political Science', 'Geography', 'Psychology', 'Sociology', 'English', 'General Test'],
  // CAT
  cat: ['Verbal Ability & Reading Comprehension', 'Data Interpretation & Logical Reasoning', 'Quantitative Ability'],
};

// ─────────────────────────────────────────────────────────────────────────────
// CHAPTERS per subject — comprehensive and board-authentic
// ─────────────────────────────────────────────────────────────────────────────
const chapters: Record<string, string[]> = {
  // Languages
  English: ['Grammar', 'Comprehension', 'Writing Skills', 'Poetry', 'Prose', 'Vocabulary', 'Unseen Passage', 'Letter Writing', 'Essay Writing'],
  Hindi: ['व्याकरण (Grammar)', 'गद्यांश (Prose)', 'पद्यांश (Poetry)', 'पत्र लेखन', 'निबंध', 'अपठित गद्यांश'],

  // Mathematics
  Mathematics: ['Number System', 'Algebra', 'Linear Equations', 'Quadratic Equations', 'Polynomials', 'Geometry', 'Trigonometry', 'Coordinate Geometry', 'Mensuration', 'Statistics', 'Probability', 'Arithmetic Progressions', 'Circles', 'Triangles', 'Surface Areas and Volumes'],

  // Science (Middle School)
  Science: ['Matter in Our Surroundings', 'Is Matter Around Us Pure', 'Atoms and Molecules', 'Structure of the Atom', 'Force and Motion', 'Gravitation', 'Work Energy Power', 'Sound', 'Natural Resources', 'Light - Reflection and Refraction', 'Electricity', 'Human Eye and Colourful World', 'Life Processes', 'Control and Coordination', 'Reproduction', 'Heredity and Evolution'],

  // Social Science
  'Social Science': ['French Revolution', 'Socialism in Europe', 'Nazism and the Rise of Hitler', 'Forest Society', 'Pastoralists in Modern World', 'Peasants and Farmers', 'Print Culture and the Modern World', 'Novel Society and History', 'The Rise of Nationalism', 'Nationalism in India', 'Making of Global World', 'Age of Industrialisation', 'India - Size and Location', 'Physical Features of India', 'Climate', 'Natural Vegetation and Wildlife', 'Population', 'Democratic Politics', 'Elections', 'Gender Religion Caste', 'Popular Struggles and Movements', 'Political Parties', 'Development', 'Sectors of Indian Economy', 'Money and Credit', 'Globalisation and the Indian Economy', 'Consumer Rights'],

  // Physics
  Physics: ['Physical World', 'Units and Measurements', 'Kinematics', 'Laws of Motion', 'Work Energy Power', 'System of Particles and Rotational Motion', 'Gravitation', 'Mechanical Properties of Solids', 'Mechanical Properties of Fluids', 'Thermal Properties of Matter', 'Thermodynamics', 'Kinetic Theory', 'Oscillations', 'Waves', 'Electric Charges and Fields', 'Electrostatic Potential and Capacitance', 'Current Electricity', 'Moving Charges and Magnetism', 'Magnetism and Matter', 'Electromagnetic Induction', 'Alternating Current', 'Electromagnetic Waves', 'Ray Optics', 'Wave Optics', 'Dual Nature of Radiation', 'Atoms', 'Nuclei', 'Semiconductor Electronics'],

  // Chemistry
  Chemistry: ['Some Basic Concepts of Chemistry', 'Structure of Atom', 'Classification of Elements and Periodicity', 'Chemical Bonding and Molecular Structure', 'States of Matter', 'Thermodynamics', 'Equilibrium', 'Redox Reactions', 'Hydrogen', 'The s-Block Elements', 'The p-Block Elements', 'Organic Chemistry - Basic Principles', 'Hydrocarbons', 'Haloalkanes and Haloarenes', 'Alcohols Phenols and Ethers', 'Aldehydes Ketones and Carboxylic Acids', 'Amines', 'Biomolecules', 'Polymers', 'Chemistry in Everyday Life', 'Solutions', 'Electrochemistry', 'Chemical Kinetics', 'Surface Chemistry', 'Coordination Compounds'],

  // Biology
  Biology: ['The Living World', 'Biological Classification', 'Plant Kingdom', 'Animal Kingdom', 'Morphology of Flowering Plants', 'Anatomy of Flowering Plants', 'Structural Organisation in Animals', 'Cell The Unit of Life', 'Biomolecules', 'Cell Cycle and Cell Division', 'Transport in Plants', 'Mineral Nutrition', 'Photosynthesis in Higher Plants', 'Respiration in Plants', 'Plant Growth and Development', 'Digestion and Absorption', 'Breathing and Exchange of Gases', 'Body Fluids and Circulation', 'Excretory Products and their Elimination', 'Locomotion and Movement', 'Neural Control and Coordination', 'Chemical Coordination and Integration', 'Reproduction in Organisms', 'Sexual Reproduction in Flowering Plants', 'Human Reproduction', 'Reproductive Health', 'Principles of Inheritance and Variation', 'Molecular Basis of Inheritance', 'Evolution', 'Human Health and Disease', 'Strategies for Enhancement in Food Production', 'Microbes in Human Welfare', 'Biotechnology Principles and Processes', 'Biotechnology and its Applications', 'Organisms and Populations', 'Ecosystem', 'Biodiversity and Conservation', 'Environmental Issues'],

  // Botany (NEET)
  Botany: ['Plant Kingdom', 'Morphology of Flowering Plants', 'Anatomy of Flowering Plants', 'Cell The Unit of Life', 'Cell Cycle and Cell Division', 'Biomolecules', 'Transport in Plants', 'Mineral Nutrition', 'Photosynthesis in Higher Plants', 'Respiration in Plants', 'Plant Growth and Development', 'Reproduction in Organisms', 'Sexual Reproduction in Flowering Plants', 'Principles of Inheritance and Variation', 'Molecular Basis of Inheritance', 'Evolution', 'Organisms and Populations', 'Ecosystem', 'Biodiversity and Conservation', 'Environmental Issues'],

  // Zoology (NEET)
  Zoology: ['Animal Kingdom', 'Structural Organisation in Animals', 'Digestion and Absorption', 'Breathing and Exchange of Gases', 'Body Fluids and Circulation', 'Excretory Products and their Elimination', 'Locomotion and Movement', 'Neural Control and Coordination', 'Chemical Coordination and Integration', 'Human Reproduction', 'Reproductive Health', 'Human Health and Disease', 'Strategies for Enhancement in Food Production', 'Microbes in Human Welfare', 'Biotechnology Principles and Processes', 'Biotechnology and its Applications'],

  // Computer Applications (ICSE/CBSE)
  'Computer Applications': ['Introduction to Java', 'Tokens in Java', 'Input in Java', 'Conditional Statements', 'Loops', 'Functions and Methods', 'Arrays', 'Strings', 'Classes and Objects', 'Constructors', 'Inheritance', 'Method Overloading', 'Recursion', 'File Handling', 'Algorithms and Sorting'],
  'Computer Science': ['Boolean Algebra', 'Logic Gates', 'Networking Concepts', 'OSI Model', 'Programming in Java', 'Object Oriented Programming', 'Data Structures - Arrays', 'Data Structures - Linked Lists', 'Data Structures - Stacks', 'Data Structures - Queues', 'Data Structures - Trees', 'Sorting Algorithms', 'Searching Algorithms', 'Database Concepts', 'SQL Basics'],

  // Economics & Commerce
  Economics: ['Introduction to Economics', 'Demand Analysis', 'Supply Analysis', 'Market Equilibrium', 'Production Function', 'Cost Analysis', 'Revenue and Profit', 'Forms of Market', 'National Income', 'Money and Banking', 'Government Budget', 'Balance of Payments', 'Economic Development', 'Indian Economy on the Eve of Independence', 'Economic Reforms in India', 'Agriculture in India', 'Industry in India', 'Infrastructure', 'Environment and Sustainable Development'],
  Accountancy: ['Introduction to Accounting', 'Journal Entries', 'Ledger', 'Trial Balance', 'Cash Book', 'Bank Reconciliation Statement', 'Rectification of Errors', 'Trading and Profit & Loss Account', 'Balance Sheet', 'Depreciation', 'Partnership Accounts', 'Partnership Reconstitution', 'Dissolution of Partnership', 'Company Accounts - Share Capital', 'Debentures', 'Financial Statements of Companies', 'Cash Flow Statement'],
  'Business Studies': ['Business Trade and Commerce', 'Forms of Business Organisation', 'Private Public and Global Enterprises', 'Business Services', 'Emerging Modes of Business', 'Social Responsibility of Business', 'Management Principles', 'Functions of Management', 'Organising', 'Staffing', 'Directing', 'Controlling', 'Financial Management', 'Financial Markets', 'Marketing', 'Consumer Protection', 'Entrepreneurship Development'],

  // History
  History: ['The Story of the First Cities', 'Political and Economic History', 'Social Histories', 'The History of Buddhism', 'Kingdoms Kings and Early Republic', 'New Questions New Ideas', 'Ashoka the Emperor', 'Vital Villages Thriving Towns', 'Traders Kings and Pilgrims', 'New Empires and Kingdoms', 'Buildings Paintings and Books', 'Medieval India - Delhi Sultanate', 'Mughal Empire', 'Rulers and Buildings', 'Town Traders Craftsmen', 'Tribals Nomads Settled Communities', 'Devotional Paths', 'Regional Cultures', 'Company Power', 'Ruling Countryside', 'Tribals Dikus and Adivasis', 'When People Rebel', 'Colonialism in the City', 'Rural Livelihoods', 'Women Caste Class', 'The Making of National Movement', 'India After Independence'],

  // Geography
  Geography: ['Physical Features of India', 'Climate', 'Natural Vegetation and Wildlife', 'Population', 'Land Resources', 'Agriculture', 'Water Resources', 'Mineral and Power Resources', 'Manufacturing Industries', 'Life Lines of National Economy', 'India and the World', 'Interior of Earth', 'Rocks', 'Landforms and their Evolution', 'Atmosphere', 'Distribution of Oceans and Continents', 'Weathering', 'Mass Movements', 'Fluvial Landforms', 'Glacial Landforms', 'Water in the Atmosphere', 'World Climate and Climate Change', 'Water Oceans', 'Movements of Ocean Water', 'Biodiversity and Conservation', 'Human Settlements'],

  // Political Science / Civics
  'Political Science': ['The Constitution', 'Electoral Politics', 'Working of Institutions', 'Democratic Rights', 'Power Sharing', 'Federalism', 'Democracy and Diversity', 'Gender Religion and Caste', 'Popular Struggles and Movements', 'Political Parties', 'Outcomes of Democracy', 'Challenges to Democracy'],
  'Indian Polity': ['The Constitution - Historical Underpinnings', 'Making of the Constitution', 'Preamble of the Constitution', 'Union and Its Territory', 'Citizenship', 'Fundamental Rights', 'Directive Principles', 'Fundamental Duties', 'Amendment of the Constitution', 'Parliament', 'President of India', 'Prime Minister and Council of Ministers', 'Supreme Court', 'High Courts', 'Federalism', 'Centre-State Relations', 'Emergency Provisions', 'Scheduled Areas', 'Constitutional Bodies', 'Non-Constitutional Bodies', 'Tribunals', 'Election Commission', 'Panchayati Raj', 'Urban Local Bodies'],

  // UPSC-specific subjects
  'Indian Economy': ['Overview of Indian Economy', 'National Income and GDP', 'Planning in India', 'Agriculture in India', 'Land Reforms', 'Green Revolution', 'Agricultural Marketing', 'Industrial Policy', 'Small Scale Industries', 'Disinvestment', 'Foreign Trade Policy', 'WTO and India', 'Banking System in India', 'RBI and Monetary Policy', 'Union Budget', 'Fiscal Policy', 'Taxation System', 'Poverty in India', 'Unemployment', 'Inequality', 'Human Development Index', 'Sustainable Development Goals'],
  'Environment & Ecology': ['Ecosystem and Biosphere', 'Biodiversity', 'Climate Change and Global Warming', 'International Environmental Conventions', 'Environmental Laws in India', 'National Parks and Wildlife Sanctuaries', 'Forest Conservation', 'Water Conservation', 'Pollution Types and Control', 'Renewable Energy', 'Carbon Credits', 'Ozone Layer Depletion', 'Environmental Impact Assessment', 'Biosphere Reserves'],
  'Current Affairs': ['National News', 'International Relations', 'Science and Technology', 'Sports and Awards', 'Economy and Finance', 'Environment', 'Defence and Security'],
  'Ethics & Integrity': ['Foundations of Ethics', 'Attitude and Values', 'Emotional Intelligence', 'Contributions of Moral Thinkers', 'Public Service Values', 'Probity in Governance', 'Citizens Charter', 'Case Studies in Ethics'],
  'Science & Technology': ['Space Technology', 'Defence Technology', 'Biotechnology', 'Nanotechnology', 'Information Technology', 'Nuclear Technology', 'Artificial Intelligence', 'Robotics', 'Cyber Security'],
  'International Relations': ['India and its Neighbours', 'India-US Relations', 'India-China Relations', 'India-Pakistan Relations', 'India-Russia Relations', 'South Asia', 'ASEAN', 'G20 and G7', 'United Nations', 'International Trade Agreements', 'Geopolitical Issues'],
  'Indian Society': ['Salient Features of Indian Society', 'Diversity of India', 'Role of Women', 'Population and Issues', 'Poverty and Development', 'Social Empowerment', 'Communalism Regionalism Secularism', 'Globalization and Impact'],
  'Security Issues': ['Internal Security Challenges', 'Naxalism', 'Terrorism', 'Cyber Security', 'Money Laundering', 'Coastal Security', 'Intelligence Services', 'Disaster Management'],

  // Jharkhand-specific
  'Jharkhand General Studies': ['History of Jharkhand', 'Jharkhand Freedom Movement', 'Jharkhand Tribal Heritage', 'Birsa Munda', 'Santhal Rebellion 1855', 'Jharkhand Formation 2000', 'Geography of Jharkhand', 'Jharkhand Mineral Resources', 'Jharkhand Economy', 'Jharkhand Rivers and Dams', 'Jharkhand National Parks', 'Jharkhand Art and Culture', 'Jharkhand Governance', 'PESA Act and Fifth Schedule', 'Jharkhand State Schemes'],
  'Jharkhand Tribal Culture': ['Tribal Communities of Jharkhand', 'Santhal Tribe', 'Mundari Tribe', 'Ho Tribe', 'Oraon Tribe', 'Tribal Languages', 'Tribal Art Forms', 'Tribal Festivals', 'Tribal Music and Dance', 'Tribal Religious Practices', 'Tribal Land Rights'],
  'Jharkhand Economy': ['Coal Mining in Jharkhand', 'Iron and Steel in Jharkhand', 'Agriculture in Jharkhand', 'Damodar Valley Corporation', 'JHARCRAFT', 'Tourism in Jharkhand', 'Industrial Policy', 'Jharkhand Budget'],
  'Jharkhand Geography': ['Chotanagpur Plateau', 'Rivers of Jharkhand', 'Betla National Park', 'Dalma Wildlife Sanctuary', 'Hundru and Dassam Falls', 'Climate of Jharkhand', 'Forest Resources', 'Mineral Distribution Map'],

  // Bihar-specific
  'Bihar General Studies': ['History of Bihar', 'Magadha Empire', 'Pataliputra', 'Nalanda University', 'Vikramshila University', 'Chandragupta Maurya', 'Ashoka', 'Bihar in Freedom Movement', 'Champaran Satyagraha 1917', 'JP Movement', 'Geography of Bihar', 'Bihar Economy', 'Bihar Governance', 'Bihar Culture and Heritage'],
  'Bihar Economy': ['Agriculture in Bihar', 'Industries of Bihar', 'Ganga Plains Economy', 'Bihar Budget', 'Social Welfare Schemes', 'BSEB and Power Sector', 'Bihar Tourism'],
  'Bihar Culture & Heritage': ['Chhath Puja', 'Madhubani Painting', 'Mithila Culture', 'Bodh Gaya', 'Vaishali Democracy', 'Patna Sahib', 'Bihar Cuisine and Festivals'],

  // SSC/Banking subjects
  'Quantitative Aptitude': ['Number System', 'HCF and LCM', 'Percentage', 'Profit Loss and Discount', 'Simple Interest', 'Compound Interest', 'Ratio and Proportion', 'Partnership', 'Average', 'Mixture and Alligation', 'Time and Work', 'Pipes and Cisterns', 'Time Speed and Distance', 'Boats and Streams', 'Trains', 'Mensuration - 2D', 'Mensuration - 3D', 'Algebra', 'Trigonometry', 'Data Interpretation - Tables', 'Data Interpretation - Bar Charts', 'Data Interpretation - Line Graphs', 'Data Interpretation - Pie Charts'],
  Reasoning: ['Number Series', 'Letter Series', 'Analogy', 'Classification (Odd One Out)', 'Coding and Decoding', 'Blood Relations', 'Direction and Distance', 'Ranking and Order', 'Syllogism', 'Statement and Conclusions', 'Logical Venn Diagrams', 'Seating Arrangement - Linear', 'Seating Arrangement - Circular', 'Puzzles - Box Based', 'Puzzles - Floor Based', 'Input Output', 'Data Sufficiency', 'Mirror and Water Image', 'Paper Folding and Cutting', 'Embedded Figures'],
  'English Language': ['Reading Comprehension', 'Cloze Test', 'Fill in the Blanks', 'Error Spotting', 'Sentence Improvement', 'Synonyms and Antonyms', 'Idioms and Phrases', 'One Word Substitution', 'Spelling Correction', 'Para Jumbles', 'Word Usage', 'Active Passive Voice', 'Direct Indirect Speech'],
  'General Awareness': ['Ancient Indian History', 'Medieval Indian History', 'Modern Indian History', 'Indian Geography', 'World Geography', 'Indian Polity and Constitution', 'Indian Economy', 'Science - Physics Basics', 'Science - Chemistry Basics', 'Science - Biology Basics', 'Static GK - Capitals and Currencies', 'Static GK - National Symbols', 'Static GK - Sports Records', 'Awards and Honours', 'Books and Authors', 'Current Affairs 2024-25'],
  'Banking Awareness': ['RBI and Monetary Policy', 'Types of Banks', 'Banking Terminology (NPA SLR CRR)', 'Basel Norms', 'Priority Sector Lending', 'Financial Inclusion Schemes', 'SARFAESI Act', 'Insolvency and Bankruptcy Code', 'Insurance in India', 'Capital Markets - SEBI', 'Mutual Funds', 'Forex and Exchange Rate', 'Digital Banking', 'Budget and Finance Basics', 'International Financial Institutions'],
  'Computer Knowledge': ['Computer Fundamentals and Generations', 'Input Output Devices', 'Memory and Storage', 'Operating Systems', 'MS Word', 'MS Excel', 'MS PowerPoint', 'Internet and Networking', 'Protocols (HTTP FTP SMTP)', 'Cyber Security Basics', 'Database Management Basics', 'Programming Concepts', 'Keyboard Shortcuts'],
  'Data Interpretation': ['Table Based DI', 'Bar Chart DI', 'Line Graph DI', 'Pie Chart DI', 'Mixed Chart DI', 'Caselet DI', 'Missing Data DI'],

  // Defence subjects
  'General Knowledge': ['Indian History', 'Indian Geography', 'Indian Polity', 'Indian Economy', 'Science and Technology', 'Defence and Security', 'Current Affairs'],

  // College / degree subjects
  Programming: ['Introduction to Programming', 'Variables and Data Types', 'Control Flow', 'Functions', 'Object Oriented Programming', 'Exception Handling', 'File I/O', 'Data Structures', 'Algorithms', 'APIs and Web Services'],
  'Data Structures': ['Introduction to Data Structures', 'Arrays and Strings', 'Linked Lists', 'Stacks', 'Queues', 'Trees - Binary Trees', 'Trees - BST', 'Heaps', 'Graphs', 'Hashing', 'Sorting Algorithms', 'Searching Algorithms'],
  DBMS: ['Introduction to DBMS', 'ER Model', 'Relational Model', 'SQL - DDL Commands', 'SQL - DML Commands', 'SQL - Joins and Subqueries', 'Normalization - 1NF 2NF 3NF', 'BCNF', 'Transactions and ACID', 'Concurrency Control', 'Indexing and Hashing', 'Query Processing and Optimization'],
  'Operating Systems': ['Introduction to OS', 'Processes and Threads', 'CPU Scheduling', 'Synchronization and Deadlock', 'Memory Management - Paging', 'Memory Management - Segmentation', 'Virtual Memory', 'File Systems', 'I/O Systems', 'Disk Scheduling'],

  // CAT subjects
  'Verbal Ability & Reading Comprehension': ['Reading Comprehension - Abstract Topics', 'Reading Comprehension - Social Science', 'Para Jumbles', 'Para Summary', 'Sentence Exclusion', 'Odd Sentence Out', 'Critical Reasoning', 'Vocabulary in Context'],
  'Data Interpretation & Logical Reasoning': ['Tables and Data Interpretation', 'Bar Charts', 'Line Graphs', 'Pie Charts', 'Caselets', 'Linear Arrangement', 'Circular Arrangement', 'Team Selection', 'Matrix Arrangement', 'Scheduling and Timetable', 'Games and Tournaments', 'Input-Output LR'],
  'Quantitative Ability': ['Number System and Factors', 'HCF LCM', 'Percentage', 'Profit Loss Discount', 'Simple Compound Interest', 'Ratio Proportion Variation', 'Time Speed Distance', 'Time and Work', 'Averages and Alligation', 'Geometry - Lines Triangles Circles', 'Mensuration', 'Coordinate Geometry', 'Permutation and Combination', 'Probability', 'Sets and Venn Diagrams', 'Sequences and Series', 'Quadratic Equations', 'Inequalities', 'Functions and Graphs'],

  // NDA subjects
  'Computer Basics': ['Hardware', 'Software', 'Operating Systems', 'MS Office', 'Internet Safety', 'Networking Basics'],
  'Environmental Science': ['Water and Air', 'Natural Resources', 'Food Chain', 'Pollution', 'Conservation', 'Climate'],
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

export function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export function getBoard(boardId: string): Board | undefined {
  return boards.find((board) => board.id === boardId);
}

export function getClasses(boardId: string): string[] {
  return classGroups[boardId] || seniorSchoolClasses;
}

export function getSubjects(boardId: string, className: string = ''): string[] {
  // ISC
  if (boardId === 'isc') return subjectGroups.iscSenior;

  // Civil Services
  if (boardId === 'upsc') return subjectGroups.civil;
  if (boardId === 'jpsc') return subjectGroups.jharkhandCivil;
  if (boardId === 'bpsc') return subjectGroups.biharCivil;

  // Government Exams
  if (boardId === 'ssc') return subjectGroups.aptitude;
  if (boardId === 'railway') return subjectGroups.aptitude;
  if (boardId === 'banking') return subjectGroups.banking;

  // Defence
  if (boardId === 'nda') return subjectGroups.nda;
  if (boardId === 'cds') return subjectGroups.cds;

  // Entrance Exams
  if (boardId === 'neet') return subjectGroups.neet;
  if (boardId === 'jee') return subjectGroups.jee;
  if (boardId === 'cuet') return subjectGroups.cuet;
  if (boardId === 'cat') return subjectGroups.cat;

  // State Boards — use state-specific subject lists when available
  if (boardId === 'jharkhand') {
    const classNum = Number(className.replace('Class ', ''));
    if (!isNaN(classNum) && classNum >= 11) return subjectGroups.schoolSenior;
    return subjectGroups.schoolMiddle;
  }

  // For all school boards (ICSE, CBSE, Bihar, UP, WB, MH, KA, TN, KL, state-boards)
  const classNum = Number(className.replace('Class ', ''));
  if (className === 'Nursery' || className === 'LKG' || className === 'UKG' || (!isNaN(classNum) && classNum <= 5)) {
    return subjectGroups.schoolJunior;
  }
  if (!isNaN(classNum) && classNum >= 11) return subjectGroups.schoolSenior;
  return subjectGroups.schoolMiddle;
}

export function getChapters(subjectName: string): string[] {
  return chapters[subjectName] || [
    'Introduction and Basic Concepts',
    'Core Principles',
    'Applications and Problems',
    'Important Formulas and Definitions',
    'Previous Year Questions Practice',
  ];
}

export function findBySlug(items: string[] | Board[], slug: string): any {
  return items.find((item) => slugify(typeof item === 'string' ? item : (item as Board).name) === slug);
}
