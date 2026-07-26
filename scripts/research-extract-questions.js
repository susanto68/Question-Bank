const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const pdfParse = require('pdf-parse');
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

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const resultsArg = process.argv[2];
if (!resultsArg) {
  console.error('Usage: node scripts/research-extract-questions.js <path-to-batch_results.json> <run_id>');
  process.exit(1);
}
const runId = process.argv[3] || `cbse-${Date.now()}`;
const resultsPath = path.join(root, resultsArg);
const batch = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));

function normalizeText(s) {
  return s.toLowerCase().replace(/\s+/g, ' ').replace(/[^a-z0-9 ]/g, '').trim();
}
function exactHash(normalized) {
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

// Parses CBSE-style SQP/MS text into { qnum: { text, options, marks, kind } } blocks.
function parseNumberedBlocks(text) {
  let lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  const blocks = [];
  let current = null;
  let expected = 1;

  // General Instructions are usually a numbered list themselves (1., 2., 3. ...)
  // which collides with real question numbering. Skip past them by anchoring on
  // the first Section marker or "Q.No." header when present.
  const anchorIdx = lines.findIndex((l) => /^\(?section\s*[-–—]?\s*a\)?\b/i.test(l) || /^q\.?\s*no\.?/i.test(l));
  if (anchorIdx > 0) {
    lines = lines.slice(anchorIdx + 1);
  }

  const loneNumberRe = /^(\d{1,3})\.?$/;
  const inlineNumberRe = /^(\d{1,3})[.)]?\s+([A-Za-z(‘“"].*)$/;

  for (const line of lines) {
    let matchedBoundary = false;
    const loneMatch = line.match(loneNumberRe);
    const inlineMatch = line.match(inlineNumberRe);

    if (inlineMatch && Number(inlineMatch[1]) === expected) {
      if (current) blocks.push(current);
      current = { qnum: expected, lines: [inlineMatch[2]] };
      expected += 1;
      matchedBoundary = true;
    } else if (loneMatch && Number(loneMatch[1]) === expected) {
      if (current) blocks.push(current);
      current = { qnum: expected, lines: [] };
      expected += 1;
      matchedBoundary = true;
    }

    if (!matchedBoundary && current) {
      current.lines.push(line);
    }
  }
  if (current) blocks.push(current);
  return blocks;
}

function extractMarksAndOptions(block) {
  const lines = [...block.lines];
  let marks = null;
  // trailing bare-number line (small integer) = marks
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const m = lines[i].match(/^(\d{1,2})$/);
    if (m) {
      marks = Number(m[1]);
      lines.splice(i, 1);
      break;
    }
    if (lines[i].length > 0) break; // only trust the immediate trailing line
  }

  const options = [];
  const stemLines = [];
  const optionRe = /^([A-D])[.)]\s*(.*)$/;
  for (const line of lines) {
    const m = line.match(optionRe);
    if (m) {
      options.push(`${m[1]}. ${m[2]}`.trim());
    } else if (options.length === 0) {
      stemLines.push(line);
    } else {
      // continuation of last option (wrapped line)
      options[options.length - 1] += ` ${line}`;
    }
  }

  return {
    marks,
    options,
    stem: stemLines.join(' ').replace(/\s+/g, ' ').trim(),
  };
}

async function insertSourceDocument(doc) {
  const row = {
    title: `CBSE Class ${doc.class} ${doc.subject} ${doc.type === 'sample_paper' ? 'Sample Question Paper' : 'Marking Scheme'} 2025-26`,
    url: doc.url,
    source_domain: 'cbseacademic.nic.in',
    exam: 'CBSE',
    board: 'CBSE',
    class_or_phase: doc.class,
    subject: doc.subject,
    year: 2026,
    language: 'English',
    source_type: doc.type,
    official_source: true,
    downloaded_at: new Date().toISOString(),
    checksum: doc.checksum,
    extraction_status: 'extracted',
    agent_run_id: runId,
  };
  const { data, error } = await supabase
    .from('source_documents')
    .upsert(row, { onConflict: 'url' })
    .select('id')
    .single();
  if (error) throw new Error(`source_documents upsert failed for ${doc.url}: ${error.message}`);
  return data.id;
}

async function main() {
  const sqpDocs = batch.documents.filter((d) => d.type === 'sample_paper' && d.status === 'downloaded');
  const msDocs = batch.documents.filter((d) => d.type === 'marking_scheme' && d.status === 'downloaded');

  const summary = { documents_processed: 0, questions_extracted: 0, per_subject: [] };
  const rawRows = [];

  for (const sqp of sqpDocs) {
    const ms = msDocs.find((d) => d.class === sqp.class && d.subject === sqp.subject);
    const sqpBuf = fs.readFileSync(path.join(root, sqp.local_path));
    const sqpText = (await pdfParse(sqpBuf)).text;
    const sqpDocId = await insertSourceDocument(sqp);
    const sqpBlocks = parseNumberedBlocks(sqpText);

    let msBlocksByNum = {};
    let msDocId = null;
    if (ms) {
      const msBuf = fs.readFileSync(path.join(root, ms.local_path));
      const msText = (await pdfParse(msBuf)).text;
      msDocId = await insertSourceDocument(ms);
      const msBlocks = parseNumberedBlocks(msText);
      for (const b of msBlocks) msBlocksByNum[b.qnum] = extractMarksAndOptions(b);
    }

    let count = 0;
    for (const block of sqpBlocks) {
      const parsed = extractMarksAndOptions(block);
      if (!parsed.stem) continue;
      const msParsed = msBlocksByNum[block.qnum];
      const isMcq = parsed.options.length >= 2;
      let answer = null;
      let explanation = null;
      if (msParsed) {
        const combinedMs = [msParsed.stem, ...msParsed.options].filter(Boolean).join(' ');
        const letterMatch = combinedMs.match(/^([A-D])[.)]/);
        answer = letterMatch ? letterMatch[1] : (isMcq ? null : combinedMs.slice(0, 500));
        explanation = combinedMs;
      }

      const normalized = normalizeText(parsed.stem);
      if (!normalized) continue;

      rawRows.push({
        document_id: sqpDocId,
        board: 'CBSE',
        exam: 'CBSE',
        class_or_phase: sqp.class,
        subject: sqp.subject,
        chapter: null,
        topic: null,
        type: isMcq ? 'MCQ' : 'Short/Long Answer (unclassified)',
        difficulty: null,
        bloom_level: null,
        question: parsed.stem,
        options: isMcq ? parsed.options : [],
        answer,
        explanation,
        marks: parsed.marks,
        estimated_time: parsed.marks ? parsed.marks * 90 : null,
        source_url: sqp.url,
        source_title: `CBSE Class ${sqp.class} ${sqp.subject} Sample Question Paper 2025-26`,
        source_year: 2026,
        source_kind: 'sample_paper',
        official_source: true,
        normalized_question_text: normalized,
        exact_hash: exactHash(normalized),
        source_document_hash: sqp.checksum,
        review_status: isMcq && answer ? 'pending' : 'needs_review',
        agent_run_id: runId,
      });
      count += 1;
    }
    summary.documents_processed += ms ? 2 : 1;
    summary.questions_extracted += count;
    summary.per_subject.push({ class: sqp.class, subject: sqp.subject, questions_found: count, total_blocks: sqpBlocks.length });
    console.log(`${sqp.class} ${sqp.subject}: extracted ${count} question blocks (of ${sqpBlocks.length} numbered blocks detected)`);
  }

  // Dedup against existing raw_extracted_questions by exact_hash, then insert unique rows in chunks.
  let inserted = 0;
  let exactDup = 0;
  for (let i = 0; i < rawRows.length; i += 50) {
    const chunk = rawRows.slice(i, i + 50);
    const hashes = chunk.map((r) => r.exact_hash);
    const { data: existing, error: existErr } = await supabase
      .from('raw_extracted_questions')
      .select('exact_hash')
      .in('exact_hash', hashes);
    if (existErr) throw new Error(`dedup lookup failed: ${existErr.message}`);
    const existingSet = new Set((existing || []).map((r) => r.exact_hash));
    const toInsert = [];
    for (const row of chunk) {
      if (existingSet.has(row.exact_hash)) {
        exactDup += 1;
      } else {
        toInsert.push(row);
        existingSet.add(row.exact_hash); // guard against dupes within same batch
      }
    }
    if (toInsert.length) {
      const { error: insErr } = await supabase.from('raw_extracted_questions').insert(toInsert);
      if (insErr) throw new Error(`raw_extracted_questions insert failed: ${insErr.message}`);
      inserted += toInsert.length;
    }
  }

  const outSummary = {
    run_id: runId,
    ...summary,
    exact_duplicates_skipped: exactDup,
    raw_rows_inserted: inserted,
  };
  const outPath = path.join(path.dirname(resultsPath), `extraction_summary_${runId}.json`);
  fs.writeFileSync(outPath, JSON.stringify(outSummary, null, 2));
  console.log('\n' + JSON.stringify(outSummary, null, 2));
  console.log(`\nWrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
