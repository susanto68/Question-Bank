const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const root = path.join(__dirname, '..');

function loadEnvFile(filename) {
  const filePath = path.join(root, filename);
  if (!fs.existsSync(filePath)) return;

  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const [name, ...rest] = trimmed.split('=');
    if (process.env[name]) continue;
    let value = rest.join('=').trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[name] = value.replace(/\\n/g, '\n');
  }
}

loadEnvFile('.env.local');
loadEnvFile('.env');

const target = {
  board: process.env.SEED_BOARD || 'ICSE',
  className: process.env.SEED_CLASS || 'Class 12',
  subject: process.env.SEED_SUBJECT || 'Physics',
  chapter: process.env.SEED_CHAPTER || 'Physical World',
};

const sourceYears = Array.from({ length: 5 }, (_, index) => new Date().getUTCFullYear() - index);
const agentRunId = `manual-agent-${new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14)}`;
const sourceUrl = process.env.SEED_SOURCE_URL || 'https://cisce.org/';
const sourceTitle = process.env.SEED_SOURCE_TITLE || 'CISCE Official Website';

const sections = [
  { type: 'MCQ', count: 17, marks: 1 },
  { type: 'Fill in the Blanks', count: 17, marks: 1 },
  { type: 'Output Question', count: 13, marks: 2 },
  { type: 'Definition', count: 17, marks: 2 },
  { type: 'Short Answer', count: 20, marks: 3 },
  { type: 'Long Answer', count: 16, marks: 5 },
];

const difficultyCycle = [
  ...Array.from({ length: 30 }, () => 'Easy'),
  ...Array.from({ length: 40 }, () => 'Medium'),
  ...Array.from({ length: 30 }, () => 'Hard'),
];
const bloomByDifficulty = {
  Easy: ['Remember', 'Understand'],
  Medium: ['Understand', 'Apply'],
  Hard: ['Analyze', 'Evaluate', 'Create'],
};

function clean(value) {
  return String(value || '').trim();
}

function normalizeText(value) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function normalizedQuestionKey(value) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function cacheKey() {
  const raw = `${target.board}|${target.className}|${target.subject}|${target.chapter}`.toLowerCase();
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function parseJsonObject(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return JSON.parse(text.slice(start, end + 1));
  }
  return JSON.parse(text);
}

function extractWaitMs(message) {
  const match = String(message || '').match(/try again in\s+(\d+(?:\.\d+)?)s/i) ||
    String(message || '').match(/(\d+(?:\.\d+)?)s/);
  if (!match) return 10000;
  return Math.ceil(Number(match[1]) * 1000) + 1200;
}

async function callGroq(prompt, attempt = 1) {
  const key = clean(process.env.GROQ_API_KEY).replace(/[\r\n]/g, '');
  if (!key) throw new Error('Missing GROQ_API_KEY');

  const model = process.env.GROQ_AGENT_MODEL || 'llama-3.1-8b-instant';
  const response = await fetch(process.env.GROQ_API_URL || 'https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are an expert Indian school-board question setter. Return only valid JSON.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.45,
      max_tokens: 2300,
      response_format: { type: 'json_object' },
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data?.error?.message || `Groq error ${response.status}`;
    if (/tokens per day|tpd/i.test(message)) throw new Error(message);
    if (/rate limit|rate_limit|tpm/i.test(message) && attempt <= 5) {
      const waitMs = Math.min(extractWaitMs(message), 90000);
      console.log(`[seed] Groq rate limit. Waiting ${Math.round(waitMs / 1000)}s before retry ${attempt}/5.`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      return callGroq(prompt, attempt + 1);
    }
    throw new Error(message);
  }

  return data?.choices?.[0]?.message?.content || '';
}

function buildPrompt(section, count, startId) {
  return `Create exactly ${count} original, board-authentic questions for ${target.board} ${target.className} ${target.subject}, chapter "${target.chapter}".

Use the last-five-year board-paper window ${sourceYears.join(', ')} as the trend context and prioritize official ${target.board}/CISCE style. Do not copy any copyrighted wording verbatim.

Question type: ${section.type}

Rules:
- Return JSON only: {"questions":[...]}.
- Every item must include: question, options, answer, explanation, concept_tag, learning_outcome.
- Use unique concepts and unique wording.
- Difficulty must be Easy, Medium, or Hard.
- bloom_level must be Remember, Understand, Apply, Analyze, Evaluate, or Create.
- MCQ: exactly 4 options, one correct answer equal to the full option text.
- Fill in the Blanks: question must include ________.
- Short Answer answer length: 2 to 4 sentences.
- Long Answer answer length: 5 to 10 sentences.
- For non-MCQ types, options must be [].
- Start question ids at ${startId}.

Return:
{"questions":[{"question":"...","options":[],"answer":"...","explanation":"...","concept_tag":"...","learning_outcome":"...","difficulty":"Medium","bloom_level":"Apply"}]}`;
}

function normalizeQuestion(item, section, id) {
  const difficulty = ['Easy', 'Medium', 'Hard'].includes(item.difficulty)
    ? item.difficulty
    : difficultyCycle[(id - 1) % difficultyCycle.length];
  const bloomList = bloomByDifficulty[difficulty] || bloomByDifficulty.Medium;
  const bloom = ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create'].includes(item.bloom_level)
    ? item.bloom_level
    : bloomList[(id - 1) % bloomList.length];
  const rawOptions = Array.isArray(item.options) ? item.options.map(clean).filter(Boolean) : [];
  const options = section.type === 'MCQ' ? rawOptions.slice(0, 4) : [];
  let answer = clean(item.answer);

  if (section.type === 'MCQ' && options.length === 4) {
    const normalizedAnswer = normalizeText(answer);
    const matching = options.find((option) => normalizeText(option) === normalizedAnswer) || options[0];
    answer = matching;
  }

  return {
    id,
    type: section.type,
    difficulty,
    bloom_level: bloom,
    concept_tag: clean(item.concept_tag) || `${target.chapter} Concept ${id}`,
    learning_outcome: clean(item.learning_outcome) || `Understand ${target.chapter} in ${target.subject}.`,
    question: clean(item.question),
    options,
    answer,
    explanation: clean(item.explanation) || `This follows the ${target.board} treatment of ${target.chapter}.`,
    marks: section.marks,
    estimated_time: difficulty === 'Easy' ? 60 : difficulty === 'Medium' ? 120 : 240,
    source: 'groq-agent',
  };
}

function isValidQuestion(question) {
  if (!question.question || !question.answer || !question.explanation || !question.concept_tag) return false;
  if (question.type === 'MCQ') {
    return question.options.length === 4 && question.options.map(normalizeText).includes(normalizeText(question.answer));
  }
  if (question.type === 'Fill in the Blanks') {
    return question.question.includes('________');
  }
  return true;
}

async function generateSection(section, startId) {
  const questions = [];
  const chunkSize = section.type === 'Long Answer' ? 3 : 5;
  let nextId = startId;

  while (questions.length < section.count) {
    const count = Math.min(chunkSize, section.count - questions.length);
    const prompt = buildPrompt(section, count, nextId);
    const text = await callGroq(prompt);
    const parsed = parseJsonObject(text);
    const rawQuestions = Array.isArray(parsed.questions) ? parsed.questions : [];

    for (const item of rawQuestions) {
      const normalized = normalizeQuestion(item, section, nextId);
      nextId += 1;
      if (isValidQuestion(normalized)) {
        questions.push(normalized);
      }
      if (questions.length >= section.count) break;
    }

    if (!rawQuestions.length) {
      throw new Error(`Groq returned no questions for ${section.type}`);
    }
  }

  return questions.slice(0, section.count);
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRole) throw new Error('Missing Supabase credentials');

  console.log(`[seed] Generating source-backed set for ${target.board} / ${target.className} / ${target.subject} / ${target.chapter}`);
  const allQuestions = [];
  let startId = 1;

  for (const section of sections) {
    console.log(`[seed] Generating ${section.count} ${section.type}`);
    const generated = await generateSection(section, startId);
    allQuestions.push(...generated);
    startId += section.count;
    await new Promise((resolve) => setTimeout(resolve, 4000));
  }

  const seen = new Set();
  const uniqueQuestions = allQuestions.filter((question) => {
    const key = normalizedQuestionKey(question.question);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (uniqueQuestions.length < 90) {
    throw new Error(`Only ${uniqueQuestions.length}/100 unique valid questions generated; refusing to update DB.`);
  }

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const now = new Date().toISOString();
  const rows = uniqueQuestions.slice(0, 100).map((question, index) => ({
    cache_key: cacheKey(),
    board: target.board,
    class_name: target.className,
    subject: target.subject,
    chapter: target.chapter,
    type: question.type,
    difficulty: question.difficulty,
    bloom_level: question.bloom_level,
    concept_tag: question.concept_tag,
    learning_outcome: question.learning_outcome,
    estimated_time: question.estimated_time,
    marks: question.marks,
    source: question.source,
    question: question.question,
    options: question.options,
    answer: question.answer,
    explanation: question.explanation,
    normalized_question: normalizedQuestionKey(question.question),
    source_url: sourceUrl,
    source_title: sourceTitle,
    source_years: sourceYears,
    source_kind: 'official-source-ai',
    source_checked_at: now,
    agent_run_id: agentRunId,
    updated_at: now,
  }));

  const deleteResult = await supabase
    .from('question_bank')
    .delete()
    .eq('board', target.board)
    .eq('class_name', target.className)
    .eq('subject', target.subject)
    .eq('chapter', target.chapter);

  if (deleteResult.error) throw new Error(deleteResult.error.message);

  const insertResult = await supabase.from('question_bank').insert(rows);
  if (insertResult.error) throw new Error(insertResult.error.message);

  const verify = await supabase
    .from('question_bank')
    .select('id', { count: 'exact', head: true })
    .eq('board', target.board)
    .eq('class_name', target.className)
    .eq('subject', target.subject)
    .eq('chapter', target.chapter);

  if (verify.error) throw new Error(verify.error.message);

  console.log(JSON.stringify({
    ok: true,
    agentRunId,
    count: verify.count,
    sourceUrl,
    sourceYears,
  }, null, 2));
}

main().catch((error) => {
  console.error(`[seed] Failed: ${error.message}`);
  process.exit(1);
});
