/**
 * Builds the download batch of GENUINE board question papers for the rolling
 * five-year window. Every URL here was discovered from an official board index
 * (CBSE question-paper index, CISCE archive library) -- none are constructed.
 *
 * CBSE  : https://www.cbse.gov.in/cbsenew/question-paper.html
 * CISCE : https://cisce.org/archive-library/
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const WINDOW = [2022, 2023, 2024, 2025, 2026];

// Core subjects the app's catalog actually exposes.
const SUBJECT_PATTERNS = [
  [/^(scince|science)$/i, 'Science'],
  [/^mathematics_standard$|^math_s$|^mathematics$|^math$/i, 'Mathematics'],
  [/^social_science$/i, 'Social Science'],
  [/^english_?(l&l|language_?(and_)?literature|&_lit)$/i, 'English'],
  [/^english_core$/i, 'English'],
  [/^physics$/i, 'Physics'],
  [/^chemistry$/i, 'Chemistry'],
  [/^biology$/i, 'Biology'],
  [/^computer_science$/i, 'Computer Science'],
];

const CLASS_MAP = { X: 'Class 10', XII: 'Class 12' };

function subjectFor(rawName) {
  // 2025 files carry the CBSE subject code as a prefix, e.g. 086_Science.
  const name = decodeURIComponent(rawName).replace(/^\d{2,3}_/, '');
  for (const [re, subject] of SUBJECT_PATTERNS) {
    if (re.test(name)) return subject;
  }
  return null;
}

function buildCbse() {
  const listPath = path.join(root, 'tmp', 'cbse_all_links.txt');
  const urls = fs.readFileSync(listPath, 'utf8').split(/\r?\n/).filter(Boolean);
  const docs = [];
  for (const url of urls) {
    const m = url.match(/question-paper\/(\d{4})\/(X|XII)\/(.+)\.zip$/i);
    if (!m) continue;
    const [, year, roman, rawName] = m;
    if (!WINDOW.includes(Number(year))) continue;
    const subject = subjectFor(rawName);
    if (!subject) continue;
    docs.push({
      board: 'CBSE',
      class: CLASS_MAP[roman],
      subject,
      year: Number(year),
      type: 'question_paper',
      official_source: true,
      source_domain: 'cbse.gov.in',
      discovered_from: 'https://www.cbse.gov.in/cbsenew/question-paper.html',
      url,
    });
  }
  return docs;
}

// CISCE ships one archive per exam year covering every subject, so the subject
// is resolved after unzipping rather than from the URL.
// 2021 and 2022 are absent by fact: the 2021 ICSE exam was cancelled and 2022
// ran as a two-semester format. A gap is recorded, never back-filled.
const CISCE_ARCHIVES = [
  { board: 'ICSE', class: 'Class 10', year: 2023, url: 'https://cisce.org/wp-content/uploads/2025/08/ICSE-2023-QPs.zip' },
  { board: 'ICSE', class: 'Class 10', year: 2024, url: 'https://cisce.org/wp-content/uploads/2025/08/ICSE_2024_QP.zip' },
  { board: 'ICSE', class: 'Class 10', year: 2025, url: 'https://cisce.org/wp-content/uploads/2025/08/ICSE-MainExamination2025.zip' },
  { board: 'ICSE', class: 'Class 10', year: 2026, url: 'https://cisce.org/wp-content/uploads/2026/07/ICSE-2026-MAIN-1.zip' },
  { board: 'ISC', class: 'Class 12', year: 2023, url: 'https://cisce.org/wp-content/uploads/2025/08/ISC-2023-QPs.zip' },
  { board: 'ISC', class: 'Class 12', year: 2024, url: 'https://cisce.org/wp-content/uploads/2025/08/ISC-2024-QP.zip' },
  { board: 'ISC', class: 'Class 12', year: 2025, url: 'https://cisce.org/wp-content/uploads/2025/08/ISC-QP-2025.zip' },
  { board: 'ISC', class: 'Class 12', year: 2026, url: 'https://cisce.org/wp-content/uploads/2026/07/ISC-2026-Q.P.s.zip' },
];

function buildCisce() {
  return CISCE_ARCHIVES.map((a) => ({
    ...a,
    subject: null,
    type: 'question_paper',
    official_source: true,
    source_domain: 'cisce.org',
    discovered_from: 'https://cisce.org/archive-library/',
    // CISCE rejects requests without a browser UA and an on-site referer.
    referer: 'https://cisce.org/archive-library/',
    fetch_with: 'curl',
  }));
}


// Marking schemes carry the official answers. They are research-only as a
// source of questions, but they are the answer evidence a CBSE question needs
// to pass the answer gate. URLs come from the CBSE marking-scheme index.
const MS_SUBJECT_PATTERNS = [
  [/computer/i, 'Computer Science'],
  [/social/i, 'Social Science'],
  [/english/i, 'English'],
  [/physic/i, 'Physics'],
  [/chemis/i, 'Chemistry'],
  [/biolog/i, 'Biology'],
  [/math/i, 'Mathematics'],
  [/science/i, 'Science'],
];

function markingSchemeSubject(fileName) {
  const name = decodeURIComponent(fileName);
  for (const [re, subject] of MS_SUBJECT_PATTERNS) {
    if (re.test(name)) return subject;
  }
  return null;
}

function buildMarkingSchemes() {
  const indexPath = path.join(root, 'research/boards/batches/cbse-marking-scheme-index.txt');
  if (!fs.existsSync(indexPath)) return [];
  const urls = fs.readFileSync(indexPath, 'utf8').split(/\r?\n/).filter(Boolean);
  const docs = [];
  for (const url of urls) {
    const m = url.match(/[Mm]arking-[Ss]cheme\/(\d{4})\/(X|XII)\/(.+)\.(zip|pdf)$/);
    if (!m) continue;
    const [, year, roman, rawName] = m;
    const subject = markingSchemeSubject(rawName);
    if (!subject) continue;
    docs.push({
      board: 'CBSE',
      class: CLASS_MAP[roman],
      subject,
      year: Number(year),
      type: 'marking_scheme',
      official_source: true,
      source_domain: 'cbse.gov.in',
      discovered_from: 'https://www.cbse.gov.in/cbsenew/marking-scheme.html',
      url,
    });
  }
  return docs;
}

const documents = [...buildCbse(), ...buildCisce(), ...buildMarkingSchemes()];
const outPath = path.join(root, 'research', 'boards', 'batches', 'pyq-window.json');
fs.writeFileSync(outPath, JSON.stringify({
  generated_at: new Date().toISOString(),
  rolling_window: WINDOW,
  documents,
}, null, 2));

const byBoardYear = {};
for (const d of documents) {
  const k = `${d.board} ${d.class} ${d.year} ${d.type}`;
  byBoardYear[k] = (byBoardYear[k] || 0) + 1;
}
console.log(`Wrote ${documents.length} documents to ${path.relative(root, outPath)}\n`);
for (const [k, v] of Object.entries(byBoardYear).sort()) console.log(`  ${v}\t${k}`);
