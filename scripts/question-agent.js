const fs = require('fs');
const path = require('path');

const API_URL = process.env.QUESTION_AGENT_API_URL || 'http://localhost:3000/api/questions';
const QUEUE_FILE = process.env.QUESTION_AGENT_QUEUE || path.join(__dirname, 'question-agent-queue.json');
const DEFAULT_INTERVAL_MINUTES = Number(process.env.QUESTION_AGENT_INTERVAL_MINUTES || 60);
const ENABLE_WEB_SEARCH = process.env.QUESTION_AGENT_ENABLE_WEB_SEARCH === '1';
const FORCE_REFRESH = process.env.QUESTION_AGENT_FORCE_REFRESH === '1';

const lastRunByKey = new Map();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readQueue() {
  const raw = fs.readFileSync(QUEUE_FILE, 'utf8');
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error(`Queue file must contain an array: ${QUEUE_FILE}`);
  }

  return parsed.filter((item) => item.board && item.className && item.subject && item.chapter);
}

function queueKey(item) {
  return `${item.board}|${item.className}|${item.subject}|${item.chapter}`;
}

function shouldRun(item) {
  const key = queueKey(item);
  const refreshHours = Number(item.refreshHours || 24);
  const lastRun = lastRunByKey.get(key) || 0;
  return Date.now() - lastRun >= refreshHours * 60 * 60 * 1000;
}

function compactText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function flattenDuckDuckGoTopics(topics, output = []) {
  for (const topic of topics || []) {
    if (topic.Text) {
      output.push(topic.Text);
    }
    if (Array.isArray(topic.Topics)) {
      flattenDuckDuckGoTopics(topic.Topics, output);
    }
  }
  return output;
}

async function buildSourceBrief(item) {
  if (!ENABLE_WEB_SEARCH) {
    return '';
  }

  const query = `${item.board} ${item.className} ${item.subject} ${item.chapter} current year MCQ exam questions syllabus`;
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1`;

  try {
    const response = await fetch(url, { headers: { 'User-Agent': 'AI-Question-Bank-Agent/1.0' } });
    if (!response.ok) {
      throw new Error(`search status ${response.status}`);
    }

    const data = await response.json();
    const snippets = [
      data.AbstractText,
      ...flattenDuckDuckGoTopics(data.RelatedTopics),
    ]
      .map(compactText)
      .filter(Boolean)
      .slice(0, 8);

    return snippets.join('\n').slice(0, 3000);
  } catch (error) {
    console.warn(`[agent] Web freshness lookup skipped for ${queueKey(item)}: ${error.message}`);
    return '';
  }
}

async function refreshItem(item) {
  const key = queueKey(item);
  const sourceBrief = await buildSourceBrief(item);
  const payload = {
    board: item.board,
    className: item.className,
    subject: item.subject,
    chapter: item.chapter,
    agentRefresh: true,
    forceRegenerate: FORCE_REFRESH || item.forceRegenerate === true,
    sourceBrief,
  };

  console.log(`[agent] Refreshing ${key}`);
  const startedAt = Date.now();
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(result.error || `API returned ${response.status}`);
  }

  const count = Array.isArray(result.questions) ? result.questions.length : 0;
  lastRunByKey.set(key, Date.now());
  console.log(`[agent] Stored/verified ${count} questions for ${key} in ${Math.round((Date.now() - startedAt) / 1000)}s`);
}

async function runOnce() {
  const queue = readQueue();

  for (const item of queue) {
    if (!shouldRun(item)) {
      continue;
    }

    try {
      await refreshItem(item);
    } catch (error) {
      console.error(`[agent] Failed ${queueKey(item)}: ${error.message}`);
    }

    await sleep(2000);
  }
}

async function main() {
  console.log(`[agent] Question refresh agent started`);
  console.log(`[agent] API: ${API_URL}`);
  console.log(`[agent] Queue: ${QUEUE_FILE}`);
  console.log(`[agent] Web freshness lookup: ${ENABLE_WEB_SEARCH ? 'on' : 'off'}`);

  while (true) {
    await runOnce();
    await sleep(Math.max(1, DEFAULT_INTERVAL_MINUTES) * 60 * 1000);
  }
}

main().catch((error) => {
  console.error(`[agent] Fatal: ${error.stack || error.message}`);
  process.exit(1);
});
