/**
 * Promotes extracted board-paper MCQs into the student-visible question bank.
 *
 * A row is written only when it is traceable to one official board paper: the
 * paper's own URL, its year inside the rolling five-year window, and
 * source_kind = question_paper. Nothing here writes a question stem.
 *
 * Answers carry their provenance in answer_status:
 *   official_marking_scheme - copied from the board's own marking scheme (CBSE)
 *   unverified_draft        - drafted by scripts/pyq-draft-answers.js because
 *                             CISCE publishes no ICSE answer key; the question
 *                             is genuine, the answer is not board-issued and
 *                             must be shown to students as unverified
 *
 * Usage:
 *   node scripts/pyq-promote.js --board=CBSE
 *   node scripts/pyq-promote.js --board=CBSE --apply
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { classifyChapter } = require('./lib/chapter-keywords');

const root = path.join(__dirname, '..');
for (const f of ['.env.local', '.env']) {
  const p = path.join(root, f);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const [n, ...r] = t.split('=');
    if (!n || process.env[n]) continue;
    let v = r.join('=').trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[n] = v;
  }
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const apply = process.argv.includes('--apply');
const boardArg = process.argv.find((a) => a.startsWith('--board='));
const boardFilter = boardArg ? boardArg.split('=')[1].toUpperCase() : null;

const UPPER = ['A', 'B', 'C', 'D'];
const OPTION_ORDER = { upper: UPPER, lower: ['a', 'b', 'c', 'd'] };

function paperCodeFromFileName(fileName) {
  const matches = [...fileName.matchAll(/(\d{2})_(\d{1,2})_(\d{1,2})(?!\d)/g)];
  if (!matches.length) return null;
  const m = matches[matches.length - 1];
  return m[1] + '/' + m[2] + '/' + m[3];
}

// Mirrors buildCacheKey in src/services/ai.ts so promoted rows key the same way
// the app does.
function cacheKey(board, className, subject, chapter) {
  const raw = (board + '|' + className + '|' + subject + '|' + chapter).toLowerCase();
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function exactHash(board, className, subject, question) {
  const raw = (board + '|' + className + '|' + subject + '|' + question)
    .toLowerCase().replace(/\s+/g, ' ').trim();
  return crypto.createHash('sha256').update(raw).digest('hex');
}

// Chapter labels produced by scripts/pyq-classify.js, keyed the same way.
function classificationHash(q) {
  return crypto.createHash('sha256')
    .update((q.board + '|' + q.class_name + '|' + q.subject + '|' + q.verbatim_question).toLowerCase())
    .digest('hex');
}

function normalizedQuestion(q) {
  return q.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

// Assertion-Reason questions are a distinct section type in this app and render
// differently, so they must not be filed as plain MCQs.
function questionType(stem) {
  return /assertion/i.test(stem) && /reason/i.test(stem) ? 'Assertion Reason' : 'MCQ';
}

function buildRows() {
  const mcqs = JSON.parse(fs.readFileSync(path.join(root, 'research/boards/batches/pyq-extracted-mcq.json'), 'utf8'));
  const answers = JSON.parse(fs.readFileSync(path.join(root, 'research/boards/batches/pyq-marking-answers.json'), 'utf8'));
  const results = JSON.parse(fs.readFileSync(path.join(root, 'research/boards/batches/pyq-window_results.json'), 'utf8'));

  const classificationPath = path.join(root, 'research/boards/batches/pyq-chapter-classification.json');
  const aiChapters = fs.existsSync(classificationPath)
    ? JSON.parse(fs.readFileSync(classificationPath, 'utf8'))
    : {};

  const draftPath = path.join(root, 'research/boards/batches/pyq-draft-answers.json');
  const draftAnswers = fs.existsSync(draftPath) ? JSON.parse(fs.readFileSync(draftPath, 'utf8')) : {};

  // Paper URL per unpacked directory, so every row can name its own document.
  // Archive folders gained QP_/MS_ prefixes after the first extraction run, so
  // both spellings are registered and an older extract still resolves.
  const urlByDir = {};
  for (const d of results.documents) {
    if (d.status !== 'downloaded' || !d.pdf_dir) continue;
    const dir = d.pdf_dir.split(path.sep).join('/');
    urlByDir[dir] = d.url;
    const parts = dir.split('/');
    parts[parts.length - 1] = parts[parts.length - 1].replace(/^(QP|MS)_/, '');
    urlByDir[parts.join('/')] = urlByDir[parts.join('/')] || d.url;
  }

  const rows = [];
  const skipped = { noChapter: 0, noAnswer: 0, duplicate: 0, noUrl: 0 };
  const seen = new Set();

  for (const q of mcqs) {
    if (boardFilter && q.board.toUpperCase() !== boardFilter) continue;

    const optionText = Object.values(q.options).join(' ');
    // Deterministic keywords first; the model label is only a fallback for
    // questions the keyword map could not place.
    const chapter = classifyChapter(q.subject, q.verbatim_question + ' ' + optionText)
      || aiChapters[classificationHash(q)]
      || null;
    if (!chapter) { skipped.noChapter++; continue; }

    const dir = q.source_pdf.split('/').slice(0, -1).join('/');
    const sourceUrl = urlByDir[dir];
    if (!sourceUrl) { skipped.noUrl++; continue; }

    const order = OPTION_ORDER[q.option_scheme] || UPPER;
    const options = order.map((k) => q.options[k]);

    const code = paperCodeFromFileName(q.paper_code);
    const letter = code && answers[code] ? answers[code].answers[q.question_number] : undefined;
    const officialIndex = letter ? UPPER.indexOf(String(letter).toUpperCase()) : -1;

    let answer = officialIndex >= 0 ? options[officialIndex] : null;
    let answerStatus = answer ? 'official_marking_scheme' : null;
    let explanation = null;

    // CISCE publishes no ICSE answer key, so a genuine ICSE question falls back
    // to a drafted answer that is labelled as unverified all the way through to
    // the student.
    if (!answer) {
      const draft = draftAnswers[classificationHash(q)];
      const draftIndex = draft ? UPPER.indexOf(String(draft.answer_letter).toUpperCase()) : -1;
      if (draftIndex >= 0) {
        answer = options[draftIndex];
        answerStatus = 'unverified_draft';
        explanation = draft.explanation;
      }
    }

    if (!answer) { skipped.noAnswer++; continue; }

    const hash = exactHash(q.board, q.class_name, q.subject, q.verbatim_question);
    if (seen.has(hash)) { skipped.duplicate++; continue; }
    seen.add(hash);

    rows.push({
      cache_key: cacheKey(q.board, q.class_name, q.subject, chapter),
      board: q.board,
      class_name: q.class_name,
      subject: q.subject,
      chapter,
      type: questionType(q.verbatim_question),
      difficulty: 'Medium',
      question: q.verbatim_question,
      options,
      answer,
      explanation,
      normalized_question: normalizedQuestion(q.verbatim_question),
      marks: q.marks || 1,
      source: 'board_paper',
      source_url: sourceUrl,
      source_title: q.board + ' ' + q.class_name + ' ' + q.subject + ' ' + q.source_year
        + ' (paper ' + (code || q.paper_code) + ')',
      source_years: [q.source_year],
      source_kind: 'question_paper',
      source_checked_at: new Date().toISOString(),
      exact_hash: hash,
      official_source: true,
      answer_status: answerStatus,
    });
  }

  return { rows, skipped };
}

async function main() {
  const { rows, skipped } = buildRows();

  const agg = {};
  for (const r of rows) {
    const k = r.board + ' ' + r.class_name + ' ' + r.subject + ' ' + r.source_years[0];
    agg[k] = (agg[k] || 0) + 1;
  }
  console.log('Ready to promote ' + rows.length + ' source-linked MCQs:');
  for (const [k, v] of Object.entries(agg).sort()) console.log('  ' + String(v).padStart(4) + '  ' + k);
  const statuses = {};
  for (const r of rows) statuses[r.answer_status] = (statuses[r.answer_status] || 0) + 1;
  console.log('\nanswer_status: ' + JSON.stringify(statuses));
  console.log('skipped: ' + JSON.stringify(skipped));

  if (!apply) {
    console.log('\nDry run. Re-run with --apply to write these rows.');
    return;
  }

  // Reconcile: a row published by an earlier, buggier extraction no longer
  // appears in this build and must be withdrawn, not left in front of students.
  if (process.argv.includes('--prune')) {
    const keep = new Set(rows.map((r) => r.exact_hash));
    const { data: existing, error: readError } = await supabase
      .from('question_bank')
      .select('id, exact_hash, board')
      .eq('source', 'board_paper');
    if (readError) throw new Error(readError.message);

    const stale = existing.filter((r) => {
      if (boardFilter && String(r.board).toUpperCase() !== boardFilter) return false;
      return !r.exact_hash || !keep.has(r.exact_hash);
    });
    if (stale.length) {
      const { error: deleteError } = await supabase
        .from('question_bank')
        .delete()
        .in('id', stale.map((r) => r.id));
      if (deleteError) throw new Error(deleteError.message);
    }
    console.log('pruned ' + stale.length + ' row(s) no longer produced by the extractor.');
  }

  let written = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    const { error } = await supabase
      .from('question_bank')
      // Not ignoreDuplicates: a re-run after an extractor fix must correct rows
      // already published, not silently leave the old text in place.
      .upsert(chunk, { onConflict: 'exact_hash', ignoreDuplicates: false });
    if (error) throw new Error(error.message);
    written += chunk.length;
    process.stdout.write('\rwritten ' + written + '/' + rows.length);
  }
  console.log('\nDone.');
}

main().catch((e) => { console.error(e.message); process.exit(1); });
