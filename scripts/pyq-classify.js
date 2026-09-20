/**
 * Assigns a syllabus chapter to extracted board questions that the keyword
 * classifier could not place.
 *
 * Classification is one of the model roles the publishing policy allows
 * (see src/services/pyqPolicy.ts): the model may tag and sort, but it never
 * writes, completes or answers a question. The question text handed to it is
 * verbatim board text and comes back unchanged -- only a label is returned.
 *
 * The model must pick from the chapter names this app actually offers, or say
 * NONE. An unplaceable question stays unplaced rather than being filed under a
 * guessed chapter, because a question filed in the wrong chapter is worse for a
 * student than one that is missing.
 *
 * Results are cached by question hash so a re-run never re-bills work already
 * done.
 *
 * Usage:
 *   node scripts/pyq-classify.js --limit=200
 *   node scripts/pyq-classify.js
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { CHAPTER_KEYWORDS, classifyChapter } = require('./lib/chapter-keywords');

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

// Matches pyqModelRoles.classification in src/services/pyqPolicy.ts. Note that
// GROQ_MODEL is deliberately NOT used as a fallback: it still points at
// llama-3.1-8b-instant, which Groq has decommissioned and now 404s.
const MODEL = process.env.GROQ_CLASSIFIER_MODEL || 'openai/gpt-oss-20b';
const BATCH_SIZE = 15;
const MAX_RETRIES = 5;
// A small gap between calls keeps a long run under the per-minute limit rather
// than relying on backoff to recover from it.
const INTER_BATCH_DELAY_MS = Number(process.env.GROQ_BATCH_DELAY_MS || 1200);

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
const CACHE_PATH = path.join(root, 'research/boards/batches/pyq-chapter-classification.json');

const SYSTEM = [
  'You label school examination questions with the chapter they belong to.',
  'You are given a numbered list of questions and a list of allowed chapter names.',
  'For each question, choose exactly one chapter name from the allowed list, or NONE if none of them fit.',
  'Copy the chapter name exactly as written in the allowed list. Do not invent a chapter.',
  'Never answer, rewrite, complete or comment on a question. Return labels only.',
  'Return ONLY JSON of the form {"labels":[{"n":1,"chapter":"..."},...]} with no commentary.',
].join(' ');

function questionHash(q) {
  return crypto.createHash('sha256')
    .update((q.board + '|' + q.class_name + '|' + q.subject + '|' + q.verbatim_question).toLowerCase())
    .digest('hex');
}

function loadCache() {
  if (!fs.existsSync(CACHE_PATH)) return {};
  return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
}

function saveCache(cache) {
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
}

async function classifyBatch(subject, allowed, batch) {
  const list = batch
    .map((q, i) => (i + 1) + '. ' + q.verbatim_question.replace(/\s+/g, ' ').slice(0, 400))
    .join('\n');

  const body = {
    model: MODEL,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM },
      {
        role: 'user',
        content: 'Subject: ' + subject + '\n\nAllowed chapters:\n'
          + allowed.map((c) => '- ' + c).join('\n')
          + '\n\nQuestions:\n' + list,
      },
    ],
  };

  // Groq enforces per-minute limits and answers 429 with a Retry-After hint.
  // Backing off keeps a long run moving instead of burning through the queue
  // marking every batch as failed.
  let res;
  for (let attempt = 0; ; attempt++) {
    res = await postWithTimeout(body);
    if (res.status !== 429 || attempt >= MAX_RETRIES) break;
    // A per-day token limit will not clear within any sensible backoff. Say so
    // instead of retrying for minutes and looking like a hang.
    if (/tokens per day|TPD/i.test(res.text)) {
      throw new Error('Groq daily token limit reached for ' + MODEL
        + '. Re-run tomorrow, or set GROQ_CLASSIFIER_MODEL to a model with its own quota.');
    }
    const hinted = Number(res.retryAfter);
    const waitMs = Number.isFinite(hinted) && hinted > 0
      ? hinted * 1000
      : Math.min(60000, 2000 * Math.pow(2, attempt));
    await sleep(waitMs);
  }
  if (!res.ok) throw new Error('Groq returned ' + res.status);

  const data = JSON.parse(res.text);
  const text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (!text) throw new Error('empty response');

  const parsed = JSON.parse(text);
  const labels = Array.isArray(parsed.labels) ? parsed.labels : [];
  const out = {};
  const allowedSet = new Set(allowed);
  for (const entry of labels) {
    const idx = Number(entry.n) - 1;
    if (!(idx >= 0 && idx < batch.length)) continue;
    const chapter = String(entry.chapter || '').trim();
    // A label outside the allowed list is discarded, not coerced.
    if (!allowedSet.has(chapter)) continue;
    out[idx] = chapter;
  }
  return out;
}

async function main() {
  const mcqs = JSON.parse(fs.readFileSync(path.join(root, 'research/boards/batches/pyq-extracted-mcq.json'), 'utf8'));
  const limitArg = process.argv.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? Number(limitArg.split('=')[1]) : Infinity;

  const cache = loadCache();

  // Only questions the deterministic classifier could not place are sent.
  const pending = [];
  for (const q of mcqs) {
    if (classifyChapter(q.subject, q.verbatim_question + ' ' + Object.values(q.options).join(' '))) continue;
    if (!CHAPTER_KEYWORDS[q.subject]) continue;
    const hash = questionHash(q);
    if (cache[hash] !== undefined) continue;
    pending.push({ ...q, hash });
  }

  console.log('unplaced questions needing a label: ' + pending.length);
  if (!pending.length) return;

  const bySubject = {};
  for (const q of pending) (bySubject[q.subject] = bySubject[q.subject] || []).push(q);

  let processed = 0;
  let labelled = 0;
  for (const [subject, questions] of Object.entries(bySubject)) {
    const allowed = Object.keys(CHAPTER_KEYWORDS[subject]);
    for (let i = 0; i < questions.length; i += BATCH_SIZE) {
      if (processed >= limit) break;
      const batch = questions.slice(i, i + BATCH_SIZE);
      try {
        const labels = await classifyBatch(subject, allowed, batch);
        batch.forEach((q, idx) => {
          // null records "asked, no chapter fits", so it is not retried forever.
          cache[q.hash] = labels[idx] || null;
          if (labels[idx]) labelled++;
        });
      } catch (e) {
        console.log('batch failed (' + subject + '): ' + e.message);
      }
      processed += batch.length;
      saveCache(cache);
      process.stdout.write('\r' + subject + ': ' + processed + ' processed, ' + labelled + ' labelled   ');
      await sleep(INTER_BATCH_DELAY_MS);
    }
  }
  console.log('\ndone. cache entries: ' + Object.keys(cache).length);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
