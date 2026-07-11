/**
 * clean_and_regenerate.js  (v2 - uses direct REST API calls instead of Supabase JS client)
 * 
 * Step 1: Audit current question_bank via REST
 * Step 2: Wipe ALL stale questions via REST DELETE
 * Step 3: Trigger Llama 3.1 8B regeneration via local API
 * Step 4: Verify final state
 * 
 * Run: node scripts/clean_and_regenerate.js
 */

const path = require('path');
const fs = require('fs');

// Load .env.local manually
function loadEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) {
    // also try .env
    const envPath2 = path.join(process.cwd(), '.env');
    if (!fs.existsSync(envPath2)) {
      console.error('❌ No .env.local or .env found');
      process.exit(1);
    }
    return loadFile(envPath2);
  }
  loadFile(envPath);
  // Also load .env for GROQ key
  const envPath2 = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath2)) loadFile(envPath2);
}

function loadFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  raw.split('\n').forEach(line => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) return;
    const key = line.slice(0, eqIdx).trim();
    let value = line.slice(eqIdx + 1).trim().replace(/^"(.*)"$/, '$1');
    if (!process.env[key]) process.env[key] = value; // Don't overwrite existing
  });
}

loadEnvLocal();

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const LOCAL_API = 'http://localhost:3000/api/questions';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_URL:', SUPABASE_URL ? 'OK' : 'MISSING');
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_KEY ? 'OK' : 'MISSING');
  process.exit(1);
}

// Supabase REST helper (bypasses realtime WebSocket issue)
async function supabaseRest(method, table, params = {}, body = null) {
  let url = `${SUPABASE_URL}/rest/v1/${table}`;
  
  const queryParts = [];
  if (params.select) queryParts.push(`select=${params.select}`);
  if (params.filter) queryParts.push(params.filter);
  if (params.order) queryParts.push(`order=${params.order}`);
  if (queryParts.length) url += '?' + queryParts.join('&');

  const headers = {
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': method === 'GET' ? 'count=exact' : 'return=representation',
  };

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const resp = await fetch(url, opts);
  const text = await resp.text();
  let data = null;
  try { data = JSON.parse(text); } catch (_) { data = text; }
  
  const count = parseInt(resp.headers.get('content-range')?.split('/')[1] || '0', 10);
  return { data, count, status: resp.status, ok: resp.ok, error: resp.ok ? null : data };
}

// Chapters to regenerate
const CHAPTERS_TO_REGENERATE = [
  { board: 'CBSE', className: '11', subject: 'Physics', chapter: 'Kinematics' },
  { board: 'CBSE', className: '11', subject: 'Physics', chapter: 'Laws of Motion' },
  { board: 'CBSE', className: '11', subject: 'Physics', chapter: 'Work Energy and Power' },
  { board: 'ICSE', className: '10', subject: 'Physics', chapter: 'Kinematics' },
  { board: 'ISC',  className: '12', subject: 'Physics', chapter: 'Kinematics' },
];

async function auditCurrentData() {
  console.log('\n' + '='.repeat(62));
  console.log('📊 STEP 1: AUDITING CURRENT SUPABASE DATA');
  console.log('='.repeat(62));

  const { data: questions, count, ok, error } = await supabaseRest(
    'GET', 'question_bank',
    { select: 'id,board,class_name,subject,chapter,type,difficulty,source,question' }
  );

  if (!ok) {
    console.error('❌ Fetch error:', error);
    return;
  }

  const allQ = Array.isArray(questions) ? questions : [];
  console.log(`\n📦 Total questions found: ${allQ.length}`);

  // Group by chapter
  const grouped = {};
  for (const q of allQ) {
    const key = `${q.board} | Class ${q.class_name} | ${q.subject} | ${q.chapter}`;
    if (!grouped[key]) grouped[key] = { count: 0, types: new Set(), samples: [] };
    grouped[key].count++;
    grouped[key].types.add(q.type);
    if (grouped[key].samples.length < 2) grouped[key].samples.push((q.question || '').slice(0, 90));
  }

  for (const [key, info] of Object.entries(grouped)) {
    console.log(`\n  ▸ ${key} — ${info.count} questions`);
    for (const s of info.samples) console.log(`      "${s}..."`);
  }

  // Poor quality detection
  const poorPatterns = [
    'core concept', 'core topic', 'primary characteristic',
    'what standard scientific term', 'concept-aligned solution',
    'key operational principle', 'principal governing', 'defines the structural',
  ];
  const poorQ = allQ.filter(q =>
    poorPatterns.some(p => (q.question || '').toLowerCase().includes(p))
  );
  console.log(`\n⚠️  Poor/generic questions: ${poorQ.length} out of ${allQ.length}`);
  poorQ.slice(0, 3).forEach(q => console.log(`   - "${(q.question || '').slice(0, 80)}"`));

  return allQ.length;
}

async function wipeAllQuestions() {
  console.log('\n' + '='.repeat(62));
  console.log('🗑️  STEP 2: WIPING ALL STALE QUESTIONS');
  console.log('='.repeat(62));

  // DELETE with a filter that matches all rows (created_at gte year 2000)
  const { ok, error, status } = await supabaseRest(
    'DELETE', 'question_bank',
    { filter: 'created_at=gte.2000-01-01T00:00:00Z' }
  );

  if (!ok) {
    console.error(`❌ Delete failed (status ${status}):`, JSON.stringify(error).slice(0, 300));
    return false;
  }

  // Verify empty
  const { data: remaining } = await supabaseRest('GET', 'question_bank', { select: 'id' });
  const remCount = Array.isArray(remaining) ? remaining.length : 0;

  if (remCount > 0) {
    console.error(`❌ Still ${remCount} rows remain after wipe`);
    return false;
  }

  console.log('✅ Database wiped clean. 0 questions remaining.');
  return true;
}

async function regenerateChapter(chapter, idx, total) {
  console.log(`\n[${idx + 1}/${total}] 🤖 ${chapter.board} Cls ${chapter.className} | ${chapter.subject} | ${chapter.chapter}`);
  console.log('       Sending to Llama 3.1 8B brain...');

  try {
    const response = await fetch(LOCAL_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...chapter, forceRegenerate: true }),
    });

    if (!response.ok) {
      const txt = await response.text();
      console.error(`       ❌ API ${response.status}: ${txt.slice(0, 200)}`);
      return { success: false, count: 0 };
    }

    const data = await response.json();
    const questions = data?.questions || [];
    const provider = data?.source || data?.provider || '?';
    const model = data?.model || '';

    if (!questions.length) {
      console.error('       ❌ Zero questions returned');
      return { success: false, count: 0 };
    }

    const easy = questions.filter(q => q.difficulty === 'Easy').length;
    const med  = questions.filter(q => q.difficulty === 'Medium').length;
    const hard = questions.filter(q => q.difficulty === 'Hard').length;
    const types = [...new Set(questions.map(q => q.type))];
    const latex = questions.filter(q => (q.question || '').includes('$')).length;

    console.log(`       ✅ ${questions.length} Qs via [${provider}${model ? ' · ' + model : ''}]`);
    console.log(`       📊 E:${easy} M:${med} H:${hard} | ${types.length} types | ${latex} LaTeX`);
    console.log(`       Q1: "${(questions[0]?.question || '').slice(0, 105)}"`);
    if (questions[49]) console.log(`       Q50: "${(questions[49]?.question || '').slice(0, 105)}"`);

    return { success: true, count: questions.length };
  } catch (err) {
    console.error(`       ❌ ${err.message}`);
    return { success: false, count: 0 };
  }
}

async function verifyFinalState() {
  console.log('\n' + '='.repeat(62));
  console.log('✅ STEP 4: FINAL VERIFICATION');
  console.log('='.repeat(62));

  const { data: finalQ } = await supabaseRest('GET', 'question_bank', {
    select: 'board,class_name,subject,chapter,type,difficulty,source,bloom_level,question'
  });

  const allFinal = Array.isArray(finalQ) ? finalQ : [];
  console.log(`\n📦 Total questions now in DB: ${allFinal.length}`);

  const grouped = {};
  for (const q of allFinal) {
    const key = `${q.board} | Class ${q.class_name} | ${q.subject} | ${q.chapter}`;
    if (!grouped[key]) grouped[key] = { count: 0, types: new Set(), blooms: new Set(), samples: [] };
    grouped[key].count++;
    grouped[key].types.add(q.type);
    grouped[key].blooms.add(q.bloom_level);
    if (grouped[key].samples.length < 2) grouped[key].samples.push((q.question || '').slice(0, 100));
  }

  for (const [key, info] of Object.entries(grouped)) {
    console.log(`\n  ✅ ${key}`);
    console.log(`     ${info.count} questions | Types: ${[...info.types].length} | Blooms: ${[...info.blooms].join(', ')}`);
    for (const s of info.samples) console.log(`     → "${s}"`);
  }
}

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║   AI QUESTION BANK — CLEAN & REGENERATE WITH LLAMA 3.1 8B  ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`🔗 ${SUPABASE_URL}`);
  console.log(`🤖 ${LOCAL_API}`);
  console.log(`📚 Chapters: ${CHAPTERS_TO_REGENERATE.length}`);

  await auditCurrentData();

  const wiped = await wipeAllQuestions();
  if (!wiped) {
    console.error('\n⛔ Wipe failed — aborting to prevent duplicates.');
    process.exit(1);
  }

  console.log('\n' + '='.repeat(62));
  console.log('🤖 STEP 3: REGENERATING ALL CHAPTERS WITH LLAMA 3.1 8B');
  console.log('='.repeat(62));

  let success = 0, totalQ = 0;
  for (let i = 0; i < CHAPTERS_TO_REGENERATE.length; i++) {
    const r = await regenerateChapter(CHAPTERS_TO_REGENERATE[i], i, CHAPTERS_TO_REGENERATE.length);
    if (r.success) { success++; totalQ += r.count; }
    if (i < CHAPTERS_TO_REGENERATE.length - 1) {
      process.stdout.write('       ⏳ Rate limit pause 4s...');
      await new Promise(r => setTimeout(r, 4000));
      console.log(' done.');
    }
  }

  console.log(`\n📊 Done: ${success}/${CHAPTERS_TO_REGENERATE.length} chapters | ${totalQ} total questions`);

  await verifyFinalState();

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║   🎉 PIPELINE COMPLETE — All old questions replaced!       ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  process.exit(0);
}

main().catch(err => {
  console.error('\n💥 Fatal:', err.message);
  process.exit(1);
});
