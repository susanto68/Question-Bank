import { GoogleGenerativeAI } from '@google/generative-ai';
import { jsonrepair } from 'jsonrepair';
import crypto from 'crypto';

export interface Question {
  id: number;
  type: string;
  difficulty: string;
  question: string;
  options: string[];
  answer: string;
  explanation: string;
}

export interface QuestionPayload {
  board: string;
  className: string;
  subject: string;
  chapter: string;
}

export interface GenerationResult {
  title: string;
  board: string;
  className: string;
  subject: string;
  chapter: string;
  questions: Question[];
  generatedAt: string;
  cacheable?: boolean;
  resilient?: boolean;
  provider?: 'gemini' | 'groq' | 'starter';
  model?: string;
}

const fallbackTypes = ['MCQ', 'Short Answer', 'Long Answer', 'True/False', 'Assertion Reason', 'Numerical'];
const fallbackDifficulties = ['Easy', 'Medium', 'Hard'];

function clean(value: any): string {
  return String(value || '').trim();
}

export function normalizePayload(body: any): QuestionPayload {
  const payload: QuestionPayload = {
    board: clean(body.board),
    className: clean(body.className),
    subject: clean(body.subject),
    chapter: clean(body.chapter),
  };

  const missing = [];
  if (!payload.board) missing.push('board');
  if (!payload.className) missing.push('className');
  if (!payload.subject) missing.push('subject');
  if (!payload.chapter) missing.push('chapter');

  if (missing.length) {
    throw new Error(`Missing required field(s): ${missing.join(', ')}`);
  }

  return payload;
}

export function buildCacheKey(payload: QuestionPayload): string {
  const raw = `${payload.board}|${payload.className}|${payload.subject}|${payload.chapter}`.toLowerCase();
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export function normalizeGeneratedQuestions(parsed: any, payload: QuestionPayload): GenerationResult {
  const questions = Array.isArray(parsed?.questions) ? parsed.questions : [];

  return {
    title: clean(parsed?.title) || `${payload.board} ${payload.className} ${payload.subject}: ${payload.chapter}`,
    board: payload.board,
    className: payload.className,
    subject: payload.subject,
    chapter: payload.chapter,
    questions: questions.slice(0, 100).map((item: any, index: number) => {
      const type = fallbackTypes.includes(item?.type) ? item.type : 'Short Answer';
      const difficulty = fallbackDifficulties.includes(item?.difficulty) ? item.difficulty : 'Medium';

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

function buildPrompt(payload: QuestionPayload, count = 100, startId = 1, context?: string): string {
  const endId = startId + count - 1;
  let contextSection = '';
  
  if (context) {
    contextSection = `
Reference Database Context:
The following are representative questions of the same board, class, and subject already saved in the database. Analyze their style, difficulty, explanations, and formatting, and generate new unique questions matching this quality:
${context}
`;
  }

  return `
Generate exactly ${count} ${payload.board} ${payload.className} ${payload.subject} questions on ${payload.chapter}.
${contextSection}

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

function stripJsonFence(text: string): string {
  return text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
}

function parseJson(text: string): any {
  const cleanText = stripJsonFence(text);

  try {
    return JSON.parse(cleanText);
  } catch (_error) {
    try {
      return JSON.parse(jsonrepair(cleanText));
    } catch {
      // Continue to object-slice recovery
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

export function buildLocalFallback(payload: QuestionPayload, count = 100, startId = 1, reason = 'AI was unavailable, so these starter questions were generated locally.'): GenerationResult {
  const questions = Array.from({ length: count }, (_, index) => {
    const number = startId + index;
    const type = fallbackTypes[index % fallbackTypes.length];
    const difficulty = fallbackDifficulties[index % fallbackDifficulties.length];
    const base = `${payload.chapter} in ${payload.subject}`;

    const templates: Record<string, { question: string; options: string[]; answer: string; explanation: string }> = {
      MCQ: {
        question: `Which option best represents an important concept from **${base}**?`,
        options: ['Definition and core idea', 'Unrelated fact', 'Only memorized formula', 'None of the above'],
        answer: 'Definition and core idea',
        explanation: 'This option represents the core definition and foundational concepts necessary for understanding the topic thoroughly.',
      },
      'Short Answer': {
        question: `Write a short note on one key idea from **${base}**.`,
        options: [],
        answer: `A key idea in ${payload.chapter} should be stated with its definition, use, and one example.`,
        explanation: 'A standard short answer introduces the key terms, states their primary functions, and provides a clear example.',
      },
      'Long Answer': {
        question: `Explain **${base}** with principles, examples, and common mistakes.`,
        options: [],
        answer: `A complete answer should introduce the concept, explain the method or principle, include an example, and mention a common error to avoid.`,
        explanation: 'Comprehensive answers should cover primary theories, clear derivations or diagrams, practical use cases, and common errors to avoid.',
      },
      'True/False': {
        question: `True or False: Understanding the basic definitions in **${payload.chapter}** is necessary before solving application-based questions.`,
        options: ['True', 'False'],
        answer: 'True',
        explanation: 'Establishing a strong foundation in basic definitions is essential before tackling advanced or application-level problems.',
      },
      'Assertion Reason': {
        question: `Assertion: Conceptual clarity in **${payload.chapter}** improves problem solving.\n\nReason: It helps identify the correct formula, rule, or explanation before attempting the answer.`,
        options: ['Both A and R are true, and R explains A', 'Both A and R are true, but R does not explain A', 'A is true but R is false', 'A is false but R is true'],
        answer: 'Both A and R are true, and R explains A',
        explanation: 'Both claims are correct because building deep conceptual clarity naturally enables identifying and applying the right principles.',
      },
      Numerical: {
        question: `Solve a basic numerical from **${base}** using the appropriate formula. Show each step clearly.`,
        options: [],
        answer: `Identify the known values, choose the formula, substitute carefully, and write the final answer with units where applicable.`,
        explanation: 'Solving numericals systematically step-by-step minimizes calculation mistakes and shows a clear logical progression of the method.',
      },
    };

    return {
      id: number,
      type,
      difficulty,
      question: templates[type].question,
      options: templates[type].options,
      answer: templates[type].answer,
      explanation: templates[type].explanation,
    };
  });

  return {
    title: `${payload.board} ${payload.className} ${payload.subject}: ${payload.chapter}`,
    board: payload.board,
    className: payload.className,
    subject: payload.subject,
    chapter: payload.chapter,
    questions,
    generatedAt: new Date().toISOString(),
    cacheable: false,
    resilient: true,
  };
}

async function fetchGroqJson(payload: QuestionPayload, count = 100, startId = 1, jsonMode = true, context?: string): Promise<string> {
  const timeoutMs = Number(process.env.GROQ_TIMEOUT_MS || 60000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const model = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
  
  const body: any = {
    model,
    messages: [
      {
        role: 'system',
        content: 'You generate exam question banks. Return only strict JSON that matches the requested schema.',
      },
      {
        role: 'user',
        content: buildPrompt(payload, count, startId, context),
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
      throw new Error(message);
    }

    return data?.choices?.[0]?.message?.content || '';
  } finally {
    clearTimeout(timeout);
  }
}

async function generateWithGroq(payload: QuestionPayload, count = 100, startId = 1): Promise<GenerationResult | null> {
  if (!process.env.GROQ_API_KEY) {
    return null;
  }

  // STEP 1: Generate Search Query Keywords
  let searchQuery = '';
  try {
    const searchPrompt = `Generate a concise search query (3-5 keywords) to find syllabus-aligned learning materials, core topics, and important exam questions for the following curriculum:
    Board: ${payload.board}
    Class: ${payload.className}
    Subject: ${payload.subject}
    Chapter: ${payload.chapter}
    
    Return only the search query keywords, nothing else.`;

    const searchBody = {
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: 'You generate search queries for curriculum topics. Return only the keywords.',
        },
        {
          role: 'user',
          content: searchPrompt,
        },
      ],
      temperature: 0.1,
    };

    const searchResponse = await fetch(process.env.GROQ_API_URL || 'https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(searchBody),
    });

    if (searchResponse.ok) {
      const searchData = await searchResponse.json().catch(() => ({}));
      searchQuery = (searchData?.choices?.[0]?.message?.content || '').trim();
      console.log('Search-First Query Generated:', searchQuery);
    }
  } catch (e) {
    console.warn('Search query generation failed, proceeding with direct search...', e);
  }

  // STEP 2: Retrieve Context from Database (ilike search or board/class/subject matches)
  let dbContext = '';
  try {
    const supabaseAdmin = (await import('@/lib/supabase/admin')).default;
    let query = supabaseAdmin
      .from('question_bank')
      .select('type, difficulty, question, options, answer, explanation')
      .eq('board', payload.board)
      .eq('class_name', payload.className)
      .eq('subject', payload.subject);

    // If keywords exist, try ilike search on question field, otherwise pull general reference questions
    if (searchQuery) {
      const firstKeyword = searchQuery.split(' ')[0] || '';
      if (firstKeyword.length > 2) {
        query = query.ilike('question', `%${firstKeyword}%`);
      }
    }

    const { data: dbQuestions } = await query.limit(5);

    if (dbQuestions && dbQuestions.length > 0) {
      dbContext = dbQuestions.map((q, idx) => 
        `Reference Question ${idx + 1}:
        Type: ${q.type}
        Difficulty: ${q.difficulty}
        Question: ${q.question}
        Options: ${JSON.stringify(q.options)}
        Answer: ${q.answer}
        Explanation: ${q.explanation}`
      ).join('\n\n');
      console.log(`Search-First Context Retrieved: Found ${dbQuestions.length} reference questions.`);
    } else {
      // General fallback lookup if ilike filter returned zero matches
      const { data: generalQuestions } = await supabaseAdmin
        .from('question_bank')
        .select('type, difficulty, question, options, answer, explanation')
        .eq('board', payload.board)
        .eq('class_name', payload.className)
        .eq('subject', payload.subject)
        .limit(3);

      if (generalQuestions && generalQuestions.length > 0) {
        dbContext = generalQuestions.map((q, idx) => 
          `Reference Question ${idx + 1}:
          Type: ${q.type}
          Difficulty: ${q.difficulty}
          Question: ${q.question}
          Options: ${JSON.stringify(q.options)}
          Answer: ${q.answer}
          Explanation: ${q.explanation}`
        ).join('\n\n');
        console.log(`Search-First Context Fallback: Found ${generalQuestions.length} reference questions.`);
      }
    }
  } catch (dbErr) {
    console.warn('Database reference context retrieval failed:', dbErr);
  }

  // STEP 3: Pipe context into final Llama 3.1 8B generation
  let text;
  try {
    text = await fetchGroqJson(payload, count, startId, true, dbContext);
  } catch (error: any) {
    const message = `${error?.message || ''}`.toLowerCase();
    if (!message.includes('response_format') && !message.includes('json')) {
      throw error;
    }
    text = await fetchGroqJson(payload, count, startId, false, dbContext);
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
      'Groq returned fewer questions, so the remaining questions were filled locally.'
    );
    questions = [...questions, ...fallback.questions];
  }

  return {
    ...normalized,
    questions,
    generatedAt: new Date().toISOString(),
    cacheable: true,
    resilient: false,
    provider: 'groq',
    model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
  };
}

async function runWithConcurrency<T, R>(items: T[], concurrency: number, worker: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
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

export async function generateQuestions(payload: QuestionPayload): Promise<GenerationResult> {
  // 1. Try Groq first as the primary front brain if configured
  if (process.env.GROQ_API_KEY) {
    try {
      const groqResult = await generateWithGroq(payload, 100, 1);
      if (groqResult && groqResult.questions.length >= 100) {
        return groqResult;
      }
    } catch (e) {
      console.warn('Primary Groq brain failed, trying fallback Gemini brain...', e);
    }
  }

  // 2. Try Gemini second if Groq fails or is not configured
  if (process.env.GEMINI_API_KEY) {
    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const modelsConfigured = process.env.GEMINI_FALLBACK_MODELS || process.env.GEMINI_MODEL || 'gemini-2.0-flash';
      const modelNames = [...new Set(modelsConfigured.split(',').map((name) => name.trim()).filter(Boolean))];

      const batchSize = Math.min(Math.max(Number(process.env.GEMINI_BATCH_SIZE || 20), 5), 25);
      const concurrency = Math.min(Math.max(Number(process.env.GEMINI_BATCH_CONCURRENCY || 2), 1), 4);
      const timeoutMs = Math.min(Math.max(Number(process.env.GEMINI_BATCH_TIMEOUT_MS || 35000), 10000), 90000);

      const batches = [];
      for (let start = 1; start <= 100; start += batchSize) {
        batches.push({
          startId: start,
          count: Math.min(batchSize, 100 - start + 1),
        });
      }

      for (const modelName of modelNames) {
        try {
          const batchErrors: any[] = [];
          const batchQuestions = await runWithConcurrency(batches, concurrency, async (batch) => {
            try {
              const model = genAI.getGenerativeModel({
                model: modelName,
                generationConfig: {
                  responseMimeType: 'application/json',
                  temperature: 0.55,
                },
              });

              const result = await Promise.race([
                model.generateContent(buildPrompt(payload, batch.count, batch.startId)),
                new Promise<any>((_, reject) => {
                  setTimeout(() => {
                    reject(new Error(`AI batch timed out after ${timeoutMs}ms`));
                  }, timeoutMs);
                }),
              ]);

              const text = result.response.text();
              const parsed = parseJson(text);
              return normalizeGeneratedQuestions(parsed, payload).questions;
            } catch (error) {
              batchErrors.push(error);
              return [];
            }
          });

          const totalFetched = batchQuestions.flat();
          let questions = totalFetched.slice(0, 100).map((question, index) => ({
            ...question,
            id: index + 1,
          }));

          let usedLocalFallback = false;
          if (questions.length < 100) {
            usedLocalFallback = true;
            const fallback = buildLocalFallback(
              payload,
              100 - questions.length,
              questions.length + 1,
              'Some AI batches were unavailable, so the remaining questions were filled locally.'
            );
            questions = [...questions, ...fallback.questions];
          }

          return {
            title: `${payload.board} ${payload.className} ${payload.subject}: ${payload.chapter}`,
            board: payload.board,
            className: payload.className,
            subject: payload.subject,
            chapter: payload.chapter,
            questions,
            generatedAt: new Date().toISOString(),
            cacheable: !usedLocalFallback,
            resilient: batchErrors.length > 0,
            provider: 'gemini',
            model: modelName,
          };
        } catch (error) {
          // Continue to next model in fallback loop
        }
      }
    } catch (e) {
      console.warn('Gemini fallback failed...', e);
    }
  }

  // 3. Last resort local fallback
  return buildLocalFallback(payload, 100, 1, 'AI Engine fallback models failed, showing local starter questions.');
}
