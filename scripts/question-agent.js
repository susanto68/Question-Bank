const fs = require('fs');
const path = require('path');

const API_URL = process.env.QUESTION_AGENT_API_URL || 'http://localhost:3001/api/agent/refresh';
const QUEUE_FILE = process.env.QUESTION_AGENT_QUEUE || path.join(__dirname, 'question-agent-queue.json');
const DEFAULT_INTERVAL_MINUTES = Number(process.env.QUESTION_AGENT_INTERVAL_MINUTES || 60);
const BATCH_LIMIT = Number(process.env.QUESTION_AGENT_BATCH_LIMIT || 2);
const ENABLE_WEB_SEARCH = process.env.QUESTION_AGENT_ENABLE_WEB_SEARCH !== '0';
const FORCE_REFRESH = process.env.QUESTION_AGENT_FORCE_REFRESH !== '0';
const AGENT_SECRET = process.env.QUESTION_AGENT_SECRET || process.env.CRON_SECRET || '';

const lastRunByKey = new Map();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readQueue() {
  if (!fs.existsSync(QUEUE_FILE)) {
    return [];
  }

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

async function callRefreshAgent(payload) {
  const headers = { 'Content-Type': 'application/json' };
  if (AGENT_SECRET) {
    headers.Authorization = `Bearer ${AGENT_SECRET}`;
  }

  const response = await fetch(API_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(result.error || `API returned ${response.status}`);
  }

  return result;
}

async function refreshItem(item) {
  const key = queueKey(item);
  console.log(`[agent] Refreshing ${key}`);
  const startedAt = Date.now();
  const result = await callRefreshAgent({
    board: item.board,
    className: item.className,
    subject: item.subject,
    chapter: item.chapter,
    limit: 1,
    forceRegenerate: FORCE_REFRESH || item.forceRegenerate === true,
    enableWebSearch: ENABLE_WEB_SEARCH,
  });

  lastRunByKey.set(key, Date.now());
  const stored = result?.results?.[0]?.stored ?? 'unknown';
  console.log(`[agent] Stored/verified ${stored} questions for ${key} in ${Math.round((Date.now() - startedAt) / 1000)}s`);
}

async function refreshRotatingBatch() {
  console.log(`[agent] Refreshing rotating catalog batch of ${BATCH_LIMIT}`);
  const result = await callRefreshAgent({
    limit: BATCH_LIMIT,
    forceRegenerate: FORCE_REFRESH,
    enableWebSearch: ENABLE_WEB_SEARCH,
  });
  console.log(`[agent] Batch run ${result.agentRunId}: ${result.totalTargets} target(s) processed`);
}

async function runOnce() {
  const queue = readQueue();

  if (!queue.length) {
    await refreshRotatingBatch();
    return;
  }

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
  console.log('[agent] Question refresh agent started');
  console.log(`[agent] API: ${API_URL}`);
  console.log(`[agent] Queue: ${QUEUE_FILE}`);
  console.log(`[agent] Web source discovery: ${ENABLE_WEB_SEARCH ? 'on' : 'off'}`);
  console.log(`[agent] Force refresh: ${FORCE_REFRESH ? 'on' : 'off'}`);

  while (true) {
    await runOnce();
    await sleep(Math.max(1, DEFAULT_INTERVAL_MINUTES) * 60 * 1000);
  }
}

main().catch((error) => {
  console.error(`[agent] Fatal: ${error.stack || error.message}`);
  process.exit(1);
});
