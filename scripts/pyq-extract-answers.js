/**
 * Reads official CBSE marking schemes and pairs each MCQ answer with the
 * question it belongs to.
 *
 * Answers are taken verbatim from the board's own marking scheme -- nothing
 * here decides or infers a correct option. A question whose paper code and
 * number are not found in a marking scheme simply stays unanswered rather than
 * being given a guess.
 *
 * Papers and marking schemes are matched on the CBSE paper code (e.g. 31/4/1),
 * which appears in the marking scheme header and in the paper's filename.
 */
const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');

const root = path.join(__dirname, '..');

// A few board PDFs have damaged flate streams. pdf.js surfaces those as a
// rejection that escapes the await, which would abort the whole batch over one
// unreadable file. A bad marking scheme is a coverage gap, not a fatal error.
process.on('unhandledRejection', (reason) => {
  console.warn('skipped a document: ' + (reason && reason.message ? reason.message : reason));
});

// Filenames carry the code with underscores and sometimes a prefix, e.g.
// 1190_1_31_4_1_Science.pdf -> 31/4/1 and 55_3_1.pdf -> 55/3/1.
function paperCodeFromFileName(fileName) {
  const matches = [...fileName.matchAll(/(\d{2})_(\d{1,2})_(\d{1,2})(?!\d)/g)];
  if (!matches.length) return null;
  const m = matches[matches.length - 1];
  return m[1] + '/' + m[2] + '/' + m[3];
}

function normaliseCode(raw) {
  const m = raw.match(/(\d{2})\s*[\/\-]\s*(\d{1,2})\s*[\/\-]\s*(\d{1,2})/);
  return m ? m[1] + '/' + m[2] + '/' + m[3] : null;
}

/**
 * A marking scheme file may cover several sets. The active paper code changes
 * each time a "PAPER CODE: x/y/z" header appears, so answers are bucketed
 * under whichever code was most recently seen.
 */
function parseMarkingScheme(text) {
  const byCode = {};
  let current = null;

  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const header = line.match(/PAPER\s*CODE\s*:?\s*([0-9]{2}\s*[\/\-]\s*[0-9]{1,2}\s*[\/\-]\s*[0-9]{1,2})/i);
    if (header) {
      current = normaliseCode(header[1]);
      if (current && !byCode[current]) byCode[current] = {};
      continue;
    }
    if (!current) continue;

    // "7. (D) / Contraction of Left Ventricle. 1 1"
    // The option letter may sit on the next line when the row wraps.
    let m = line.match(/^\s*(\d{1,2})\.\s*\(([A-Da-d])\)/);
    if (!m) {
      const numOnly = line.match(/^\s*(\d{1,2})\.\s*$/);
      if (numOnly && i + 1 < lines.length) {
        const next = lines[i + 1].match(/^\s*\(([A-Da-d])\)/);
        if (next) m = [null, numOnly[1], next[1]];
      }
    }
    if (!m) continue;

    const number = m[1];
    const option = m[2].toUpperCase();
    if (byCode[current][number] === undefined) {
      byCode[current][number] = option;
    }
  }
  return byCode;
}

async function main() {
  const results = JSON.parse(fs.readFileSync(path.join(root, 'research/boards/batches/pyq-window_results.json'), 'utf8'));
  const msDocs = results.documents.filter((d) => d.status === 'downloaded' && d.type === 'marking_scheme');

  const answers = {};
  let filesRead = 0;
  for (const doc of msDocs) {
    const dir = path.join(root, doc.pdf_dir);
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir).filter((f) => /\.pdf$/i.test(f))) {
      // Hindi-medium marking schemes repeat the same answers; the English ones
      // are enough and parse cleanly.
      if (/HINDI/i.test(file)) continue;
      try {
        const data = await pdf(fs.readFileSync(path.join(dir, file)));
        const byCode = parseMarkingScheme(data.text);
        for (const [code, map] of Object.entries(byCode)) {
          answers[code] = answers[code] || { board: doc.board, class_name: doc.class, subject: doc.subject, year: doc.year, source_url: doc.url, source_pdf: (doc.pdf_dir + '/' + file).split(path.sep).join('/'), answers: {} };
          for (const [num, opt] of Object.entries(map)) {
            if (answers[code].answers[num] === undefined) answers[code].answers[num] = opt;
          }
        }
        filesRead++;
      } catch (e) {
        // A marking scheme that will not parse is a gap, not a reason to guess.
      }
    }
  }

  fs.writeFileSync(path.join(root, 'research/boards/batches/pyq-marking-answers.json'), JSON.stringify(answers, null, 2));

  const codes = Object.keys(answers);
  const total = codes.reduce((n, c) => n + Object.keys(answers[c].answers).length, 0);
  console.log('marking scheme files read: ' + filesRead);
  console.log('paper codes with answers  : ' + codes.length);
  console.log('answer entries            : ' + total);

  // Coverage against the extracted MCQs.
  const mcqPath = path.join(root, 'research/boards/batches/pyq-extracted-mcq.json');
  if (fs.existsSync(mcqPath)) {
    const mcqs = JSON.parse(fs.readFileSync(mcqPath, 'utf8'));
    let matched = 0;
    for (const q of mcqs) {
      const code = paperCodeFromFileName(q.paper_code);
      if (code && answers[code] && answers[code].answers[q.question_number]) matched++;
    }
    console.log('extracted MCQs with an official answer: ' + matched + '/' + mcqs.length);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
