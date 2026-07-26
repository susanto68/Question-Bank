import crypto from 'crypto';

const requiredFields = ['board', 'className', 'subject', 'chapter'];
const types = new Set(['MCQ', 'Short Answer', 'Long Answer', 'True/False', 'Assertion Reason', 'Numerical']);
const difficulties = new Set(['Easy', 'Medium', 'Hard']);

function clean(value) {
  return String(value || '').trim();
}

export function normalizePayload(body) {
  const payload = {
    board: clean(body.board),
    className: clean(body.className),
    subject: clean(body.subject),
    chapter: clean(body.chapter),
  };

  const missing = requiredFields.filter((field) => !payload[field]);

  if (missing.length) {
    const error = new Error(`Missing required field(s): ${missing.join(', ')}`);
    error.status = 400;
    throw error;
  }

  return payload;
}

export function buildCacheKey(payload) {
  const raw = `${payload.board}|${payload.className}|${payload.subject}|${payload.chapter}`.toLowerCase();
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export function normalizeGeneratedQuestions(parsed, payload) {
  const questions = Array.isArray(parsed?.questions) ? parsed.questions : [];

  return {
    title: clean(parsed?.title) || `${payload.board} ${payload.className} ${payload.subject}: ${payload.chapter}`,
    ...payload,
    questions: questions.slice(0, 100).map((item, index) => {
      const type = types.has(item?.type) ? item.type : 'Short Answer';
      const difficulty = difficulties.has(item?.difficulty) ? item.difficulty : 'Medium';

      return {
        id: Number(item?.id) || index + 1,
        type,
        difficulty,
        question: clean(item?.question) || `Question ${index + 1} on ${payload.chapter}`,
        options: Array.isArray(item?.options) ? item.options.map(clean).filter(Boolean).slice(0, 6) : [],
        answer: clean(item?.answer) || 'Answer not provided.',
        explanation: clean(item?.explanation),
      };
    }),
    generatedAt: new Date().toISOString(),
  };
}
