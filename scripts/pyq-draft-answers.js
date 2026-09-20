/**
 * Drafts answers for genuine board MCQs that have no official answer key.
 *
 * WHY THIS EXISTS, AND ITS LIMIT
 * CBSE publishes a marking scheme for every board paper, so a CBSE answer is
 * copied from the board's own document. CISCE publishes no ICSE answer key at
 * all. The choice made for this release is to still show the genuine ICSE
 * question and mark its answer as a draft, rather than show a real question
 * with no answer or withhold ICSE entirely.
 *
 * Everything produced here is written as answer_status = 'unverified_draft'.
 * It is NOT board-issued and must be presented to students as such until a
 * reviewer confirms it. The question stem and options are never touched --
 * the model only picks among options that the board itself printed.
 *
 * Usage:
 *   node scripts/pyq-draft-answers.js --board=ICSE --limit=100
 *   node scripts/pyq-draft-answers.js --board=ICSE
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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

const API_KEY = process.env.GROQ_API_KEY;
if (!API_KEY) { console.error('GROQ_API_KEY is not set.'); process.exit(1); }

// Groq caps tokens per day per model, so one model alone cannot finish a run of
// this size. The list is tried in order and the run steps to the next model when
// the current one's daily allowance is spent. The largest model is first because
// an answer a student will act on deserves more capability than a chapter label
// does; the rest are fallbacks, not equals.
const MODELS = (process.env.GROQ_ANSWER_MODEL
  || 'openai/gpt-oss-120b,qwen/qwen3.8-27b,openai/gpt-oss-20b,groq/compound-mini')
  .split(',').map((m) => m.trim()).filter(Boolean);

let modelIndex = 0;
const exhausted = new Set();

class DailyLimitReached extends Error {}
const MAX_RETRIES = 5;
const INTER_CALL_DELAY_MS = Number(process.env.GROQ_BATCH_DELAY_MS || 1200);
const CACHE_PATH = path.join(root, 'research/boards/batches/pyq-draft-answers.json');

// Without a deadline a single stalled socket hangs the whole run silently,
// which is exactly what happened on the first long pass.
const REQUEST_TIMEOUT_MS = Number(process.env.GROQ_TIMEOUT_MS || 60000);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// The response body is read inside the same deadline as the request. Clearing
// the timer as soon as the headers arrive leaves the body read unbounded, and a
// stalled body is what silently hung the first long run.
async function postWithTimeout(body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + API_KEY },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    return { status: res.status, ok: res.ok, retryAfter: res.headers.get('retry-after'), text: await res.text() };
  } finally {
    clearTimeout(timer);
  }
}

const SYSTEM = [
  'You are answering a multiple-choice question taken verbatim from an official school board examination paper.',
  'Exactly one of the printed options is correct.',
  'Choose the correct option letter. Do not rewrite the question or invent new options.',
  'Also give a one-or-two sentence explanation a student could follow, and an honest confidence from 0 to 1.',
  'If the question depends on a figure or data you cannot see, set confidence below 0.4.',
  'Return ONLY JSON: {"answer":"A","explanation":"...","confidence":0.0}',
].join(' ');

function questionHash(q) {
  return crypto.createHash('sha256')
    .update((q.board + '|' + q.class_name + '|' + q.subject + '|' + q.verbatim_question).toLowerCase())
    .digest('hex');
}

function loadCache() {
  return fs.existsSync(CACHE_PATH) ? JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8')) : {};
}

function currentModel() {
  while (modelIndex < MODELS.length && exhausted.has(MODELS[modelIndex])) modelIndex++;
  if (modelIndex >= MODELS.length) {
    throw new DailyLimitReached('Every configured model has spent its Groq daily token allowance: '
      + MODELS.join(', ') + '. Re-run after the quota resets.');
  }
  return MODELS[modelIndex];
}

async function draftAnswer(q, keys) {
  const optionLines = keys.map((k, i) => '(' + 'ABCD'[i] + ') ' + q.options[k]).join('\n');
  const model = currentModel();
  const body = {
    model,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM },
      {
        role: 'user',
        content: q.board + ' ' + q.class_name + ' ' + q.subject + ' (' + q.source_year + ')\n\n'
          + q.verbatim_question + '\n\n' + optionLines,
      },
    ],
  };

  let res;
  for (let attempt = 0; ; attempt++) {
    res = await postWithTimeout(body);
    if (res.status !== 429 || attempt >= MAX_RETRIES) break;
    // A per-day token limit will not clear within any sensible backoff. Say so
    // instead of retrying for minutes and looking like a hang.
    // A per-day allowance will not clear within any backoff. Retire this model
    // for the rest of the run and retry the same question on the next one.
    if (/tokens per day|TPD/i.test(res.text)) {
      exhausted.add(model);
      console.log('\n' + model + ' has spent its daily token allowance; switching model.');
      return draftAnswer(q, keys);
    }
    const hinted = Number(res.retryAfter);
    const waitMs = Number.isFinite(hinted) && hinted > 0 ? hinted * 1000 : Math.min(60000, 2000 * Math.pow(2, attempt));
    await sleep(waitMs);
  }
  if (!res.ok) throw new Error('Groq returned ' + res.status);

  const data = JSON.parse(res.text);
  const text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (!text) throw new Error('empty response');

  const parsed = JSON.parse(text);
  const letter = String(parsed.answer || '').trim().toUpperCase().slice(0, 1);
  if (!['A', 'B', 'C', 'D'].includes(letter)) throw new Error('no usable option letter');

  return {
    answer_letter: letter,
    explanation: String(parsed.explanation || '').trim().slice(0, 600) || null,
    confidence: Number.isFinite(Number(parsed.confidence)) ? Number(parsed.confidence) : null,
    model,
    drafted_at: new Date().toISOString(),
  };
}

async function main() {
  const mcqs = JSON.parse(fs.readFileSync(path.join(root, 'research/boards/batches/pyq-extracted-mcq.json'), 'utf8'));
  const boardArg = process.argv.find((a) => a.startsWith('--board='));
  const boardFilter = boardArg ? boardArg.split('=')[1].toUpperCase() : null;
  const limitArg = process.argv.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? Number(limitArg.split('=')[1]) : Infinity;

  const cache = loadCache();
  const pending = mcqs.filter((q) => {
    if (boardFilter && q.board.toUpperCase() !== boardFilter) return false;
    return cache[questionHash(q)] === undefined;
  });

  console.log('questions needing a draft answer: ' + pending.length);

  let done = 0;
  let failed = 0;
  for (const q of pending) {
    if (done >= limit) break;
    const keys = Object.keys(q.options);
    try {
      cache[questionHash(q)] = await draftAnswer(q, keys);
      done++;
    } catch (e) {
      // Nothing is left to try, so stop rather than marking every remaining
      // question as failed.
      if (e instanceof DailyLimitReached) { console.log('\n' + e.message); break; }
      failed++;
      if (failed <= 3) console.log('\nfailed: ' + e.message);
    }
    if (done % 10 === 0 || done === 1) {
      fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
      process.stdout.write('\rdrafted ' + done + '/' + Math.min(limit, pending.length) + ', failed ' + failed + '   ');
    }
    await sleep(INTER_CALL_DELAY_MS);
  }

  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
  console.log('\ndone. drafted ' + done + ', failed ' + failed + ', cache entries ' + Object.keys(cache).length);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
