/**
 * Extracts verbatim multiple-choice questions from the downloaded board papers.
 *
 * Scope is deliberately narrow: MCQs only. An MCQ is self-contained, carries
 * its own options, and can be checked against a marking scheme. Long-answer and
 * figure-dependent questions are left for a later pass rather than being
 * half-extracted.
 *
 * This stage never writes an answer and never rewrites a stem. It records what
 * is printed, plus enough provenance (paper file, question number, marks) for
 * review. Promotion to the student-visible bank is a separate, gated step.
 *
 * Two numbering schemes are in play:
 *   CBSE  "3.  <stem>"    with options (A) (B) (C) (D)
 *   ICSE  "(iii) <stem>"  with options (a) (b) (c) (d)
 */
const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');

const root = path.join(__dirname, '..');

// CISCE ships one archive per exam year covering every subject, so the subject
// is not known from the download and has to come from the paper's own filename.
// These are CISCE's own subject codes, e.g. ICSE_2024_521_SCI1 is Physics.
const CISCE_SUBJECT_PATTERNS = [
  [/SCI1|PHYSICS/i, 'Physics'],
  [/SCI2|CHEMISTRY/i, 'Chemistry'],
  [/SCI3|BIOLOGY/i, 'Biology'],
  [/\bMAT\b|MATHEMATICS/i, 'Mathematics'],
  [/ENG1|ENG2|ENGLISH/i, 'English'],
  [/HCG1|HCG2|HISTORY|CIVICS|GEOGRAPHY/i, 'Social Science'],
  [/COMPUTER/i, 'Computer Science'],
];

function resolveSubject(row) {
  if (row.subject) return row.subject;
  for (const [re, subject] of CISCE_SUBJECT_PATTERNS) {
    if (re.test(row.file)) return subject;
  }
  return null;
}

const SCHEMES = [
  { name: 'upper', keys: ['A', 'B', 'C', 'D'], res: [/\(A\)\s/, /\(B\)\s/, /\(C\)\s/, /\(D\)\s/] },
  { name: 'lower', keys: ['a', 'b', 'c', 'd'], res: [/\(a\)\s/, /\(b\)\s/, /\(c\)\s/, /\(d\)\s/] },
];

// CBSE papers print the Hindi version of every question first. Devanagari is
// glyph-encoded in these PDFs and extracts as near-empty punctuation, so a
// block is kept only when it is genuinely Latin text.
function latinRatio(s) {
  const letters = (s.match(/[A-Za-z]/g) || []).length;
  const meaningful = (s.match(/\S/g) || []).length;
  return meaningful === 0 ? 0 : letters / meaningful;
}

function cleanPageFurniture(text) {
  return text
    .replace(/^\s*\S*\s*Page\s+\d+\s+of\s+\d+\s*(P\.T\.O\.)?\s*$/gim, '')
    .replace(/^\s*T\d{2}\s+\d{3}\s+\d+\s*(Turn Over)?\s*$/gim, '')
    .replace(/^\s*\{\s*\}\s*$/gm, '')
    .replace(/\u00a0/g, ' ');
}

// The last option runs to the end of the block, so it picks up whatever the
// page prints next: the running paper code, a page footer, the long digit runs
// these PDFs use as separators, or the start of the Hindi column. Everything
// from the first such marker onwards is furniture, not part of the option.
const OPTION_TAIL_MARKERS = [
  // The running paper code is wrapped in whatever glyph that paper's footer
  // uses -- plain spaces, ~55/3/1~, ^56/1/1^ -- so any non-alphanumeric
  // delimiter counts.
  /[^A-Za-z0-9]\d{2}\/\d{1,2}\/\d{1,2}/,
  /Page\s+\d+\s+of\s+\d+/i,
  /P\.T\.O\./i,
  /Turn Over/i,
  /\d{8,}/,
  /_{3,}/,
  /\{\s*\}/,
  /\[\s*\]/,
  /SECTION\s*[-–—]/i,
  // Some CBSE sets print the footer as "57/4/1 # 20| P a g e", letter-spaced.
  /#\s*\d+\s*\|/,
  /P\s*a\s*g\s*e/i,
];

// A board MCQ option is a short phrase. Anything much longer means the split
// ran past the end of the question and swallowed whatever came next, so the
// whole question is discarded rather than published with a wrong option.
const MAX_OPTION_LENGTH = 180;

function trimOption(value) {
  let cut = value.length;
  for (const marker of OPTION_TAIL_MARKERS) {
    const m = value.match(marker);
    if (m && m.index < cut) cut = m.index;
  }
  return value.slice(0, cut).replace(/\s+/g, ' ').trim();
}

function splitOptions(body) {
  for (const scheme of SCHEMES) {
    const pos = scheme.res.map((re) => body.search(re));
    if (pos.some((p) => p < 0)) continue;
    if (!(pos[0] < pos[1] && pos[1] < pos[2] && pos[2] < pos[3])) continue;

    const options = {};
    for (let i = 0; i < 4; i++) {
      const start = pos[i] + 4;
      const end = i < 3 ? pos[i + 1] : body.length;
      options[scheme.keys[i]] = trimOption(body.slice(start, end));
    }
    if (Object.values(options).some((v) => !v || v.length > MAX_OPTION_LENGTH)) continue;
    return { optionsStart: pos[0], options, scheme: scheme.name };
  }
  return null;
}

function buildQuestion(number, body) {
  if (latinRatio(body) < 0.55) return null;

  const split = splitOptions(body);
  if (!split) return null;

  let stem = body.slice(0, split.optionsStart);
  stem = stem.replace(/Options\s*:\s*$/i, '');

  // Marks are printed flush right and land at the end of the stem, either as a
  // bare number (CBSE) or bracketed (ICSE).
  let marks = null;
  const bracketed = stem.match(/\[(\d{1,2})\]\s*$/);
  if (bracketed) {
    marks = Number(bracketed[1]);
    stem = stem.slice(0, bracketed.index);
  } else {
    const bare = stem.match(/\s(\d{1,2})\s*$/);
    if (bare) {
      marks = Number(bare[1]);
      stem = stem.slice(0, bare.index);
    }
  }
  // The same furniture can appear mid-stem when a question spans a page break.
  // Here it is removed in place rather than truncating, because real question
  // text continues after the break.
  stem = stem
    .replace(/\s\d{2}\/\d{1,2}\/\d{1,2}(?=\s|$)/g, ' ')
    .replace(/Page\s+\d+\s+of\s+\d+/gi, ' ')
    .replace(/P\.T\.O\./gi, ' ')
    .replace(/Turn Over/gi, ' ')
    .replace(/\d{8,}/g, ' ')
    .replace(/_{3,}/g, ' ')
    .replace(/\{\s*\}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (stem.length < 25) return null;
  if (latinRatio(stem) < 0.6) return null;

  return { question_number: number, verbatim_question: stem, options: split.options, option_scheme: split.scheme, marks };
}

function extractFromText(text) {
  const cleaned = cleanPageFurniture(text);
  const found = [];
  const seen = new Set();

  // Both boundary styles are tried; a paper may mix them across sections.
  const boundaries = [/^[ \t]*(\d{1,2})\.[ \t]+/m, /^[ \t]*\(([ivxIVX]{1,6})\)[ \t]+/m];
  for (const boundary of boundaries) {
    const parts = cleaned.split(new RegExp(boundary.source, 'gm'));
    for (let i = 1; i < parts.length; i += 2) {
      const q = buildQuestion(parts[i], parts[i + 1] || '');
      if (!q) continue;
      const key = q.verbatim_question.slice(0, 80).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      found.push(q);
    }
  }
  return found;
}

async function main() {
  const survey = JSON.parse(fs.readFileSync(path.join(root, 'research/boards/batches/pyq-survey.json'), 'utf8'));
  const filterArg = process.argv.find((a) => a.startsWith('--filter='));
  const filter = filterArg ? new RegExp(filterArg.split('=')[1], 'i') : null;

  let targets = survey.filter((r) => r.text_ok);
  if (filter) targets = targets.filter((r) => filter.test(r.board + ' ' + r.class + ' ' + r.year + ' ' + r.subject + ' ' + r.file));

  const rows = [];
  let emptyPapers = 0;
  let unknownSubject = 0;
  for (const r of targets) {
    const subject = resolveSubject(r);
    if (!subject) { unknownSubject++; continue; }
    try {
      const data = await pdf(fs.readFileSync(path.join(root, r.dir, r.file)));
      const qs = extractFromText(data.text);
      if (!qs.length) emptyPapers++;
      for (const q of qs) {
        rows.push({
          board: r.board,
          class_name: r.class,
          subject,
          source_year: r.year,
          source_pdf: (r.dir + '/' + r.file).split(path.sep).join('/'),
          paper_code: r.file.replace(/\.pdf$/i, ''),
          extraction_method: 'PDF_TEXT',
          extraction_confidence: 1,
          needs_human_review: true,
          ...q,
        });
      }
    } catch (e) {
      emptyPapers++;
    }
  }

  fs.writeFileSync(path.join(root, 'research/boards/batches/pyq-extracted-mcq.json'), JSON.stringify(rows, null, 2));

  const agg = {};
  for (const r of rows) {
    const k = r.board + ' ' + r.class_name + ' ' + r.source_year;
    agg[k] = (agg[k] || 0) + 1;
  }
  console.log('Extracted MCQs by board/class/year:');
  for (const [k, v] of Object.entries(agg).sort()) console.log('  ' + String(v).padStart(5) + '  ' + k);
  console.log('\ntotal MCQs: ' + rows.length + ' from ' + targets.length + ' papers ('
    + emptyPapers + ' yielded none, ' + unknownSubject + ' skipped for unmapped subject)');
}

main().catch((e) => { console.error(e); process.exit(1); });
