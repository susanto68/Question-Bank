import { GoogleGenerativeAI } from '@google/generative-ai';
import { jsonrepair } from 'jsonrepair';

import { normalizeGeneratedQuestions } from '../utils/questionPayload.js';

const fallbackTypes = ['MCQ', 'Short Answer', 'Long Answer', 'True/False', 'Assertion Reason', 'Numerical'];
const fallbackDifficulties = ['Easy', 'Medium', 'Hard'];

function requireApiKey() {
  if (!process.env.GEMINI_API_KEY) {
    return false;
  }

  return true;
}

function getBatchSize() {
  const value = Number(process.env.GEMINI_BATCH_SIZE || 20);
  return Number.isFinite(value) ? Math.min(Math.max(value, 5), 25) : 20;
}

function getBatchConcurrency() {
  const value = Number(process.env.GEMINI_BATCH_CONCURRENCY || 2);
  return Number.isFinite(value) ? Math.min(Math.max(value, 1), 4) : 2;
}

function getBatchTimeoutMs() {
  const value = Number(process.env.GEMINI_BATCH_TIMEOUT_MS || 35000);
  return Number.isFinite(value) ? Math.min(Math.max(value, 10000), 90000) : 35000;
}

function getGroqModel() {
  return process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
}

function getGroqTimeoutMs() {
  const value = Number(process.env.GROQ_TIMEOUT_MS || 60000);
  return Number.isFinite(value) ? Math.min(Math.max(value, 15000), 120000) : 60000;
}

function buildPrompt(payload, count = 100, startId = 1) {
  const endId = startId + count - 1;

  return `
Generate exactly ${count} ${payload.board} ${payload.className} ${payload.subject} questions on ${payload.chapter}.

Requirements:
- Question IDs must start at ${startId} and end at ${endId}.
- Keep the whole response concise enough for a fast API response.
- Difficulty distribution should be balanced across Easy, Medium, and Hard.
- Question type mix: MCQ, Short Answer, Long Answer, True/False, Assertion Reason, Numerical.
- Include formulas in LaTeX where useful, code blocks for programming topics, and markdown tables when tabular context helps.
- Escape every JSON string correctly. In LaTeX, use double backslashes such as "\\Omega", "\\frac{V}{R}", and "\\times".
- Return only valid JSON. Do not wrap it in markdown fences.

JSON schema:
{
  "title": "string",
  "board": "${payload.board}",
  "className": "${payload.className}",
  "subject": "${payload.subject}",
  "chapter": "${payload.chapter}",
  "questions": [
    {
      "id": 1,
      "type": "MCQ | Short Answer | Long Answer | True/False | Assertion Reason | Numerical",
      "difficulty": "Easy | Medium | Hard",
      "question": "string with markdown/math/code/table support",
      "options": ["A", "B", "C", "D"],
      "answer": "string",
      "explanation": "brief string"
    }
  ]
}
`;
}

function buildGroqUnavailableFallback(payload, count = 100, startId = 1, reason = 'Gemini and Groq were unavailable, so these starter questions were generated locally.') {
  return {
    ...buildLocalFallback(payload, count, startId, reason),
    model: 'local-fallback',
  };
}

function getModelNames() {
  const configured = process.env.GEMINI_FALLBACK_MODELS || process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const names = configured
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);

  return [...new Set(names)];
}

function shouldTryNextModel(error) {
  const message = `${error?.message || ''} ${error?.status || ''}`.toLowerCase();
  return message.includes('404') || message.includes('not found') || message.includes('not supported');
}

function stripJsonFence(text) {
  return text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
}

function parseJson(text) {
  const cleanText = stripJsonFence(text);

  try {
    return JSON.parse(cleanText);
  } catch (_error) {
    try {
      return JSON.parse(jsonrepair(cleanText));
    } catch {
      // Continue to object-slice recovery below.
    }

    const start = cleanText.indexOf('{');
    const end = cleanText.lastIndexOf('}');

    if (start >= 0 && end > start) {
      const sliced = cleanText.slice(start, end + 1);

      try {
        return JSON.parse(sliced);
      } catch {
        return JSON.parse(jsonrepair(sliced));
      }
    }

    throw _error;
  }
}

function buildLocalFallback(payload, count = 100, startId = 1, reason = 'Gemini was unavailable, so these starter questions were generated locally.') {
  const questions = Array.from({ length: count }, (_, index) => {
    const number = startId + index;
    const type = fallbackTypes[index % fallbackTypes.length];
    const difficulty = fallbackDifficulties[index % fallbackDifficulties.length];
    const base = `${payload.chapter} in ${payload.subject}`;

    const templates = {
      MCQ: {
        question: `Which option best represents an important concept from **${base}**?`,
        options: ['Definition and core idea', 'Unrelated fact', 'Only memorized formula', 'None of the above'],
        answer: 'Definition and core idea',
      },
      'Short Answer': {
        question: `Write a short note on one key idea from **${base}**.`,
        options: [],
        answer: `A key idea in ${payload.chapter} should be stated with its definition, use, and one example.`,
      },
      'Long Answer': {
        question: `Explain **${base}** with principles, examples, and common mistakes.`,
        options: [],
        answer: `A complete answer should introduce the concept, explain the method or principle, include an example, and mention a common error to avoid.`,
      },
      'True/False': {
        question: `True or False: Understanding the basic definitions in **${payload.chapter}** is necessary before solving application-based questions.`,
        options: ['True', 'False'],
        answer: 'True',
      },
      'Assertion Reason': {
        question: `Assertion: Conceptual clarity in **${payload.chapter}** improves problem solving.\n\nReason: It helps identify the correct formula, rule, or explanation before attempting the answer.`,
        options: ['Both A and R are true, and R explains A', 'Both A and R are true, but R does not explain A', 'A is true but R is false', 'A is false but R is true'],
        answer: 'Both A and R are true, and R explains A',
      },
      Numerical: {
        question: `Solve a basic numerical from **${base}** using the appropriate formula. Show each step clearly.`,
        options: [],
        answer: `Identify the known values, choose the formula, substitute carefully, and write the final answer with units where applicable.`,
      },
    };

    return {
      id: number,
      type,
      difficulty,
      question: templates[type].question,
      options: templates[type].options,
      answer: templates[type].answer,
      explanation: reason,
    };
  });

  return {
    title: `${payload.board} ${payload.className} ${payload.subject}: ${payload.chapter}`,
    ...payload,
    questions,
    generatedAt: new Date().toISOString(),
    cacheable: false,
    resilient: true,
  };
}

function chunkBatches(total, size) {
  const batches = [];

  for (let start = 1; start <= total; start += size) {
    batches.push({
      startId: start,
      count: Math.min(size, total - start + 1),
    });
  }

  return batches;
}

async function runWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runNext() {
    const index = nextIndex;
    nextIndex += 1;

    if (index >= items.length) {
      return;
    }

    results[index] = await worker(items[index], index);
    await runNext();
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runNext));
  return results;
}

async function generateBatch(genAI, modelName, payload, batch) {
  const timeoutMs = getBatchTimeoutMs();
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.55,
    },
  });

  const result = await Promise.race([
    model.generateContent(buildPrompt(payload, batch.count, batch.startId)),
    new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Gemini batch timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    }),
  ]);
  const text = result.response.text();
  const parsed = parseJson(text);
  return normalizeGeneratedQuestions(parsed, payload).questions;
}

async function fetchGroqJson(payload, count = 100, startId = 1, jsonMode = true) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getGroqTimeoutMs());
  const body = {
    model: getGroqModel(),
    messages: [
      {
        role: 'system',
        content: 'You generate exam question banks. Return only strict JSON that matches the requested schema.',
      },
      {
        role: 'user',
        content: buildPrompt(payload, count, startId),
      },
    ],
    temperature: 0.45,
  };

  if (jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  try {
    const response = await fetch(process.env.GROQ_API_URL || 'https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message = data?.error?.message || data?.message || `Groq request failed with status ${response.status}`;
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }

    return data?.choices?.[0]?.message?.content || '';
  } finally {
    clearTimeout(timeout);
  }
}

async function generateWithGroq(payload, count = 100, startId = 1) {
  if (!process.env.GROQ_API_KEY) {
    return null;
  }

  let text;

  try {
    text = await fetchGroqJson(payload, count, startId, true);
  } catch (error) {
    const message = `${error?.message || ''} ${error?.status || ''}`.toLowerCase();

    if (!message.includes('response_format') && !message.includes('json')) {
      throw error;
    }

    text = await fetchGroqJson(payload, count, startId, false);
  }

  const parsed = parseJson(text);
  let normalized = normalizeGeneratedQuestions(parsed, payload);
  let questions = normalized.questions.slice(0, count).map((question, index) => ({
    ...question,
    id: startId + index,
  }));

  if (questions.length < count) {
    const fallback = buildLocalFallback(
      payload,
      count - questions.length,
      startId + questions.length,
      'Groq returned fewer questions, so the remaining questions were filled locally.',
    );
    questions = [...questions, ...fallback.questions];
  }

  normalized = {
    title: `${payload.board} ${payload.className} ${payload.subject}: ${payload.chapter}`,
    ...payload,
    questions,
    generatedAt: new Date().toISOString(),
    cacheable: true,
    resilient: false,
    provider: 'groq',
    model: getGroqModel(),
  };

  return normalized;
}

export async function generateQuestions(payload) {
  if (!requireApiKey()) {
    return (
      (await generateWithGroq(payload, 100, 1).catch(() => null)) ||
      buildGroqUnavailableFallback(payload, 100, 1, 'Gemini API key is not configured and Groq was unavailable, so starter questions are shown locally.')
    );
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const modelNames = getModelNames();
  const batches = chunkBatches(100, getBatchSize());
  const concurrency = getBatchConcurrency();
  let lastError;

  for (const modelName of modelNames) {
    try {
      const batchErrors = [];
      const batchQuestions = await runWithConcurrency(batches, concurrency, async (batch) => {
        try {
          return await generateBatch(genAI, modelName, payload, batch);
        } catch (error) {
          batchErrors.push(error);
          return [];
        }
      });

      if (batchErrors.length === batches.length && batchErrors.every(shouldTryNextModel)) {
        lastError = batchErrors[0];
        continue;
      }

      let questions = batchQuestions.flat().slice(0, 100).map((question, index) => ({
        ...question,
        id: index + 1,
      }));
      let usedLocalFallback = false;

      if (questions.length < 100) {
        const geminiQuestionCount = questions.length;
        const groqFallback = await generateWithGroq(payload, 100 - questions.length, questions.length + 1).catch(() => null);

        if (groqFallback?.questions?.length) {
          if (geminiQuestionCount === 0 && groqFallback.questions.length >= 100) {
            return groqFallback;
          }

          questions = [...questions, ...groqFallback.questions].slice(0, 100);
        } else {
          usedLocalFallback = true;
          const fallback = buildLocalFallback(
            payload,
            100 - questions.length,
            questions.length + 1,
            questions.length
              ? 'Some Gemini and Groq batches were unavailable, so the remaining questions were filled locally.'
              : 'Gemini and Groq were unavailable, so starter questions are shown locally.',
          );
          questions = [...questions, ...fallback.questions];
        }
      }

      const normalized = {
        title: `${payload.board} ${payload.className} ${payload.subject}: ${payload.chapter}`,
        ...payload,
        questions,
        generatedAt: new Date().toISOString(),
        cacheable: !usedLocalFallback,
        resilient: batchErrors.length > 0,
        provider: 'gemini',
      };

      return {
        ...normalized,
        model: modelName,
      };
    } catch (error) {
      lastError = error;

      if (!shouldTryNextModel(error)) {
        return (
          (await generateWithGroq(payload, 100, 1).catch(() => null)) ||
          buildGroqUnavailableFallback(payload, 100, 1, 'Gemini had a temporary issue and Groq was unavailable, so starter questions are shown locally.')
        );
      }
    }
  }

  return (
    (await generateWithGroq(payload, 100, 1).catch(() => null)) ||
    buildGroqUnavailableFallback(payload, 100, 1, lastError ? 'Gemini model fallback failed and Groq was unavailable, so starter questions are shown locally.' : undefined)
  );
}
