export const boards = [
  { id: 'icse', name: 'ICSE', short: 'IC', description: 'Council school curriculum', accent: 'from-cyan-300 to-blue-400' },
  { id: 'cbse', name: 'CBSE', short: 'CB', description: 'NCERT-aligned school board', accent: 'from-emerald-300 to-cyan-400' },
  { id: 'state-boards', name: 'State Boards', short: 'SB', description: 'Regional school boards', accent: 'from-amber-300 to-orange-400' },
  { id: 'college', name: 'College Students', short: 'CO', description: 'Degree and semester topics', accent: 'from-violet-300 to-fuchsia-400' },
  { id: 'upsc', name: 'UPSC', short: 'UP', description: 'Prelims and mains preparation', accent: 'from-rose-300 to-red-400' },
  { id: 'jpsc', name: 'JPSC', short: 'JP', description: 'Jharkhand state services', accent: 'from-lime-300 to-emerald-400' },
  { id: 'ssc', name: 'SSC', short: 'SS', description: 'Staff Selection exams', accent: 'from-sky-300 to-indigo-400' },
  { id: 'banking', name: 'Banking', short: 'BK', description: 'Bank PO, clerk, specialist exams', accent: 'from-teal-300 to-green-400' },
  { id: 'railway', name: 'Railway', short: 'RL', description: 'RRB and technical exams', accent: 'from-yellow-300 to-lime-400' },
  { id: 'neet', name: 'NEET', short: 'NE', description: 'Medical entrance preparation', accent: 'from-pink-300 to-rose-400' },
  { id: 'jee', name: 'JEE', short: 'JE', description: 'Engineering entrance preparation', accent: 'from-orange-300 to-red-400' },
];

const schoolClasses = ['Nursery', 'LKG', 'UKG', ...Array.from({ length: 12 }, (_, index) => `Class ${index + 1}`)];
const seniorSchoolClasses = Array.from({ length: 12 }, (_, index) => `Class ${index + 1}`);

const classGroups = {
  icse: schoolClasses,
  cbse: schoolClasses,
  'state-boards': seniorSchoolClasses,
  college: ['Foundation Year', 'Semester 1', 'Semester 2', 'Semester 3', 'Semester 4', 'Semester 5', 'Semester 6', 'Postgraduate'],
  upsc: ['Foundation', 'Prelims', 'Mains', 'Interview'],
  jpsc: ['Foundation', 'Prelims', 'Mains', 'Interview'],
  ssc: ['Foundation', 'Tier I', 'Tier II', 'Skill Test'],
  banking: ['Foundation', 'Prelims', 'Mains', 'Interview'],
  railway: ['Foundation', 'CBT 1', 'CBT 2', 'Technical'],
  neet: ['Class 11', 'Class 12', 'Dropper', 'Revision'],
  jee: ['Class 11', 'Class 12', 'Dropper', 'Advanced'],
};

const subjectGroups = {
  schoolJunior: ['English', 'Mathematics', 'Environmental Science', 'General Knowledge', 'Hindi', 'Computer Basics'],
  schoolMiddle: ['English', 'Mathematics', 'Science', 'Social Science', 'Hindi', 'Computer Applications'],
  schoolSenior: ['Physics', 'Chemistry', 'Biology', 'Mathematics', 'Computer Applications', 'Economics', 'Accountancy', 'Political Science'],
  college: ['Programming', 'Data Structures', 'DBMS', 'Operating Systems', 'Economics', 'Business Studies', 'Mathematics'],
  civil: ['History', 'Geography', 'Polity', 'Economy', 'Environment', 'Ethics', 'Current Affairs'],
  aptitude: ['Quantitative Aptitude', 'Reasoning', 'English Language', 'General Awareness', 'Computer Knowledge'],
  neet: ['Physics', 'Chemistry', 'Botany', 'Zoology'],
  jee: ['Physics', 'Chemistry', 'Mathematics'],
};

const chapters = {
  English: ['Grammar', 'Comprehension', 'Writing Skills', 'Poetry', 'Prose'],
  Mathematics: ['Number System', 'Algebra', 'Geometry', 'Trigonometry', 'Calculus', 'Probability', 'Statistics'],
  Science: ['Matter', 'Force and Motion', 'Light', 'Electricity', 'Life Processes', 'Environment'],
  'Social Science': ['History', 'Geography', 'Civics', 'Economics', 'Disaster Management'],
  Physics: ['Kinematics', 'Laws of Motion', 'Work Energy Power', 'Electrostatics', 'Current Electricity', 'Optics', 'Modern Physics'],
  Chemistry: ['Atomic Structure', 'Chemical Bonding', 'Thermodynamics', 'Equilibrium', 'Organic Chemistry', 'Coordination Compounds'],
  Biology: ['Cell Biology', 'Genetics', 'Human Physiology', 'Plant Physiology', 'Ecology', 'Evolution'],
  Botany: ['Plant Kingdom', 'Morphology', 'Photosynthesis', 'Genetics', 'Ecology'],
  Zoology: ['Animal Kingdom', 'Human Physiology', 'Reproduction', 'Evolution', 'Biotechnology'],
  'Computer Applications': ['Arrays', 'Strings', 'Classes and Objects', 'Inheritance', 'File Handling', 'Algorithms'],
  'Computer Basics': ['Input Output Devices', 'Paint Tools', 'Keyboard Skills', 'Internet Safety', 'Scratch Basics'],
  Programming: ['Arrays', 'Functions', 'Object Oriented Programming', 'Exception Handling', 'File I/O', 'APIs'],
  'Data Structures': ['Arrays', 'Linked Lists', 'Stacks and Queues', 'Trees', 'Graphs', 'Hashing'],
  DBMS: ['ER Model', 'SQL Queries', 'Normalization', 'Transactions', 'Indexing'],
  'Operating Systems': ['Processes', 'Threads', 'Scheduling', 'Memory Management', 'File Systems'],
  Economics: ['Demand and Supply', 'National Income', 'Inflation', 'Public Finance', 'Banking'],
  Accountancy: ['Journal Entries', 'Ledger', 'Trial Balance', 'Final Accounts', 'Partnership Accounts'],
  'Business Studies': ['Management Principles', 'Marketing', 'Finance', 'Human Resources', 'Entrepreneurship'],
  History: ['Ancient India', 'Medieval India', 'Modern India', 'World History', 'Freedom Movement'],
  Geography: ['Physical Geography', 'Indian Geography', 'World Geography', 'Map Work', 'Resources'],
  Polity: ['Constitution', 'Parliament', 'Judiciary', 'Federalism', 'Rights and Duties'],
  Economy: ['Budget', 'Planning', 'Banking', 'Agriculture', 'Industry'],
  Environment: ['Ecology', 'Biodiversity', 'Climate Change', 'Pollution', 'Conservation'],
  Ethics: ['Aptitude', 'Integrity', 'Case Studies', 'Emotional Intelligence', 'Public Service Values'],
  'Current Affairs': ['National News', 'International Relations', 'Science and Tech', 'Sports', 'Awards'],
  'Quantitative Aptitude': ['Percentage', 'Ratio', 'Time and Work', 'Profit and Loss', 'Data Interpretation'],
  Reasoning: ['Series', 'Coding Decoding', 'Syllogism', 'Puzzles', 'Seating Arrangement'],
  'English Language': ['Grammar', 'Vocabulary', 'Reading Comprehension', 'Cloze Test', 'Error Spotting'],
  'General Awareness': ['Static GK', 'Banking Awareness', 'Economy', 'Science', 'Current Affairs'],
  'Computer Knowledge': ['MS Office', 'Internet', 'Networking', 'Cyber Security', 'Database Basics'],
};

export function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export function getBoard(boardId) {
  return boards.find((board) => board.id === boardId);
}

export function getClasses(boardId) {
  return classGroups[boardId] || seniorSchoolClasses;
}

export function getSubjects(boardId, className = '') {
  if (boardId === 'college') return subjectGroups.college;
  if (boardId === 'upsc' || boardId === 'jpsc') return subjectGroups.civil;
  if (boardId === 'ssc' || boardId === 'banking' || boardId === 'railway') return subjectGroups.aptitude;
  if (boardId === 'neet') return subjectGroups.neet;
  if (boardId === 'jee') return subjectGroups.jee;

  const classNumber = Number(className.replace('Class ', ''));
  if (className === 'Nursery' || className === 'LKG' || className === 'UKG' || classNumber <= 5) return subjectGroups.schoolJunior;
  if (classNumber >= 11) return subjectGroups.schoolSenior;
  return subjectGroups.schoolMiddle;
}

export function getChapters(subjectName) {
  return chapters[subjectName] || ['Core Concepts', 'Important Definitions', 'Applications', 'Practice Set', 'Previous Year Questions'];
}

export function findBySlug(items, slug) {
  return items.find((item) => slugify(typeof item === 'string' ? item : item.name) === slug);
}
