import { GoogleGenerativeAI } from '@google/generative-ai';
import { jsonrepair } from 'jsonrepair';
import crypto from 'crypto';

export interface Question {
  id: number;
  type: string;
  difficulty: string;
  bloom_level: string;
  concept_tag: string;
  learning_outcome: string;
  question: string;
  options: string[];
  answer: string;
  explanation: string;
  marks: number;
  estimated_time: number; // in seconds
  source?: string;
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

export const SECTIONS = [
  { key: 'Section A', type: 'MCQ', name: 'Multiple Choice Questions', desc: '4 options, correct answer choice (A, B, C, or D), and detailed explanation.' },
  { key: 'Section B', type: 'Assertion Reason', name: 'Assertion Reason', desc: 'Assertion statement, Reason statement, standard 4 choices: A (Both true and R explains A), B (Both true but R does not explain A), C (A is true, R is false), D (A is false, R is true).' },
  { key: 'Section C', type: 'True/False', name: 'True False', desc: 'True or False statements with clear justification.' },
  { key: 'Section D', type: 'Fill in the Blanks', name: 'Fill in the Blanks', desc: 'Statements with a single blank space represented by "________" and the correct word.' },
  { key: 'Section E', type: 'One Word', name: 'One Word Answers', desc: 'Direct questions that can be answered in a single word.' },
  { key: 'Section F', type: 'Full Forms', name: 'Full Forms', desc: 'Acronyms or short terms requiring their complete technical full-form expansion.' },
  { key: 'Section G', type: 'Very Short Answer', name: 'Very Short Answers', desc: 'One-sentence simple definition or direct conceptual question.' },
  { key: 'Section H', type: 'Short Answer', name: 'Short Answers', desc: 'Concise paragraph (2-3 sentences) requiring core points, simple examples, or key equations.' },
  { key: 'Section I', type: 'Medium Answer', name: 'Medium Answers', desc: 'Comprehensive conceptual description (4-6 sentences) with examples, derivations, or step-by-step logic.' },
  { key: 'Section J', type: 'Long Answer', name: 'Long Answers', desc: 'Detailed, deep essay-type question requiring complete breakdown, comparison, list of principles, or detailed code block/diagram logic.' }
];

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

/**
 * Clean and normalize questions, validating data formatting
 */
export function normalizeGeneratedQuestions(parsed: any, payload: QuestionPayload, sectionType: string): Question[] {
  const questions = Array.isArray(parsed?.questions) ? parsed.questions : [];

  return questions.map((item: any, index: number) => {
    const difficulty = ['Easy', 'Medium', 'Hard'].includes(item?.difficulty) ? item.difficulty : 'Medium';
    const bloom_level = ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create'].includes(item?.bloom_level) ? item.bloom_level : 'Understand';
    
    return {
      id: Number(item?.id) || index + 1,
      type: sectionType,
      difficulty,
      bloom_level,
      concept_tag: clean(item?.concept_tag) || `${payload.chapter} Core Principle`,
      learning_outcome: clean(item?.learning_outcome) || `Understand foundational concept of ${payload.chapter}`,
      question: clean(item?.question) || `Question ${index + 1} on ${payload.chapter}`,
      options: Array.isArray(item?.options) ? item.options.map(clean).filter(Boolean) : [],
      answer: clean(item?.answer) || 'Answer not provided.',
      explanation: clean(item?.explanation) || 'No explanation provided.',
      marks: Number(item?.marks) || (difficulty === 'Easy' ? 1 : difficulty === 'Medium' ? 2 : 4),
      estimated_time: Number(item?.estimated_time) || (difficulty === 'Easy' ? 60 : difficulty === 'Medium' ? 120 : 240)
    };
  });
}

/**
 * Token-based Jaccard Similarity Algorithm (Strict 70% threshold filter)
 */
export function getSimilarity(q1: string, q2: string): number {
  const cleanTokens = (str: string) => {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(t => t.length > 2); // Exclude small words
  };
  const tokens1 = new Set(cleanTokens(q1));
  const tokens2 = new Set(cleanTokens(q2));
  
  if (tokens1.size === 0 || tokens2.size === 0) return 0;
  
  const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
  const union = new Set([...tokens1, ...tokens2]);
  
  return intersection.size / union.size;
}

/**
 * Deduplicate a batch of questions based on Jaccard similarity and duplicate concept tags
 */
export function deduplicateQuestions(questions: Question[]): Question[] {
  const uniqueQuestions: Question[] = [];
  const conceptTags = new Set<string>();

  for (const q of questions) {
    let isDuplicate = false;
    
    // 1. Check Jaccard similarity against all approved questions in the list
    for (const approved of uniqueQuestions) {
      const similarity = getSimilarity(q.question, approved.question);
      if (similarity > 0.70) {
        isDuplicate = true;
        break;
      }
    }

    // 2. Check for exact duplicate concept tags
    if (q.concept_tag) {
      const normalizedConcept = q.concept_tag.trim().toLowerCase();
      if (conceptTags.has(normalizedConcept)) {
        isDuplicate = true;
      }
    }

    if (!isDuplicate) {
      uniqueQuestions.push(q);
      if (q.concept_tag) {
        conceptTags.add(q.concept_tag.trim().toLowerCase());
      }
    } else {
      console.warn(`Duplicate filtered out by semantic check: "${q.question}"`);
    }
  }

  return uniqueQuestions;
}

function buildSectionPrompt(payload: QuestionPayload, section: typeof SECTIONS[0], startId: number): string {
  return `
Generate exactly 10 unique, high-quality, board-aligned exam questions for the selected:
Board: ${payload.board}
Class: ${payload.className}
Subject: ${payload.subject}
Chapter: ${payload.chapter}

These questions must belong strictly to: ${section.key} - ${section.name}.
Question Type Description: ${section.desc}

You MUST apply this exact Easy -> Medium -> Hard difficulty and Bloom's Taxonomy progression for these 10 questions:
- Question 1 (ID ${startId + 0}): Easy, Bloom's Level: 'Remember', Marks: 1, Est. Time: 60s
- Question 2 (ID ${startId + 1}): Easy, Bloom's Level: 'Remember', Marks: 1, Est. Time: 60s
- Question 3 (ID ${startId + 2}): Easy, Bloom's Level: 'Understand', Marks: 1, Est. Time: 60s
- Question 4 (ID ${startId + 3}): Medium, Bloom's Level: 'Understand', Marks: 2, Est. Time: 120s
- Question 5 (ID ${startId + 4}): Medium, Bloom's Level: 'Apply', Marks: 2, Est. Time: 120s
- Question 6 (ID ${startId + 5}): Medium, Bloom's Level: 'Apply', Marks: 2, Est. Time: 120s
- Question 7 (ID ${startId + 6}): Hard, Bloom's Level: 'Analyze', Marks: 3, Est. Time: 180s
- Question 8 (ID ${startId + 7}): Hard, Bloom's Level: 'Analyze', Marks: 3, Est. Time: 180s
- Question 9 (ID ${startId + 8}): Hard, Bloom's Level: 'Evaluate', Marks: 4, Est. Time: 240s
- Question 10 (ID ${startId + 9}): Hard, Bloom's Level: 'Create', Marks: 5, Est. Time: 300s

Quality Guidelines:
- Questions must be rich, academic, and match the official Board guidelines.
- Formulas must be beautifully formatted in LaTeX (e.g. use \\Omega, \\frac{V}{R}, \\times).
- Use double backslashes in JSON strings for LaTeX (e.g. "\\\\Omega", "\\\\frac{V}{R}").
- Return strictly valid JSON matching the schema below. Do not wrap it in markdown formatting fences.

JSON Schema:
{
  "questions": [
    {
      "id": number,
      "type": "${section.type}",
      "difficulty": "Easy | Medium | Hard",
      "bloom_level": "Remember | Understand | Apply | Analyze | Evaluate | Create",
      "concept_tag": "string concept tested (1-3 words)",
      "learning_outcome": "string learning objective outcome",
      "question": "string with LaTeX support",
      "options": ["A", "B", "C", "D"], -- Array of 4 items for MCQ or Assertion Reason, 2 items for True/False ("True", "False"), empty array [] for others
      "answer": "string correct answer value",
      "explanation": "string detailed explanation",
      "marks": number,
      "estimated_time": number
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

/**
 * Rich Fallback question bank generator supporting all 10 sections A to J programmatically
 */
export function buildLocalFallback(payload: QuestionPayload, count = 100, startId = 1, reason = 'Fallback starter questions'): GenerationResult {
  const questions = Array.from({ length: count }, (_, index) => {
    const totalIndex = startId + index - 1;
    const sectionIdx = Math.floor(totalIndex / 10) % SECTIONS.length;
    const section = SECTIONS[sectionIdx];
    const qInSecIdx = totalIndex % 10;
    
    // Difficulty and Bloom's mapping
    let difficulty = 'Medium';
    let bloom_level = 'Understand';
    let marks = 2;
    let estimated_time = 120;
    
    if (qInSecIdx <= 2) {
      difficulty = 'Easy';
      bloom_level = qInSecIdx === 2 ? 'Understand' : 'Remember';
      marks = 1;
      estimated_time = 60;
    } else if (qInSecIdx <= 5) {
      difficulty = 'Medium';
      bloom_level = qInSecIdx === 3 ? 'Understand' : 'Apply';
      marks = 2;
      estimated_time = 120;
    } else {
      difficulty = 'Hard';
      bloom_level = qInSecIdx <= 7 ? 'Analyze' : qInSecIdx === 8 ? 'Evaluate' : 'Create';
      marks = qInSecIdx === 8 ? 4 : qInSecIdx === 9 ? 5 : 3;
      estimated_time = qInSecIdx === 8 ? 240 : qInSecIdx === 9 ? 300 : 180;
    }

    const concept = `${payload.chapter} core topic ${qInSecIdx + 1}`;
    const base = `${payload.chapter} in ${payload.subject}`;

    let qText = `Solve basic questions about ${concept} for ${payload.board} ${payload.className}.`;
    let options: string[] = [];
    let answer = 'Concept-aligned solution.';
    let explanation = `This fallback question tests the understanding and application of ${concept} in ${base}.`;

    if (section.type === 'MCQ') {
      qText = `Which of the following is a primary characteristic of **${concept}** inside **${base}**?`;
      options = [`Foundational principle of ${concept}`, `Unrelated parameter of ${base}`, `Random historical fact`, `None of the above`].sort(() => Math.random() - 0.5);
      answer = `Foundational principle of ${concept}`;
    } else if (section.type === 'Assertion Reason') {
      qText = `Assertion: Mastery of ${concept} is vital for solving academic equations.\n\nReason: It establishes the structural relationships between related variables.`;
      options = [
        'Both A and R are true, and R is the correct explanation of A',
        'Both A and R are true, but R is not the correct explanation of A',
        'A is true but R is false',
        'A is false but R is true'
      ];
      answer = 'Both A and R are true, and R is the correct explanation of A';
    } else if (section.type === 'True/False') {
      qText = `True or False: The application of **${concept}** improves learning outcomes in **${base}**.`;
      options = ['True', 'False'];
      answer = 'True';
    } else if (section.type === 'Fill in the Blanks') {
      qText = `Inside ${payload.subject}, **${concept}** represents a ________ definition of this academic syllabus.`;
      options = [];
      answer = 'core';
    } else if (section.type === 'One Word') {
      qText = `What single term defines the structural core of **${concept}** in ${payload.subject}?`;
      options = [];
      answer = 'Principle';
    } else if (section.type === 'Full Forms') {
      qText = `What is the full conceptual expansion of the acronym: **${concept.slice(0, 3).toUpperCase()}** in the context of this study?`;
      options = [];
      answer = `${concept.charAt(0).toUpperCase()}${concept.slice(1)} Basic System`;
    }

    return {
      id: totalIndex + 1,
      type: section.type,
      difficulty,
      bloom_level,
      concept_tag: concept,
      learning_outcome: `Evaluate competency in ${concept}`,
      question: qText,
      options,
      answer,
      explanation,
      marks,
      estimated_time,
      source: 'local-fallback'
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
    provider: 'starter'
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

/**
 * Concurrently generates exactly 100 questions split into Section A to J (10 questions per section)
 */
export async function generateQuestions(payload: QuestionPayload): Promise<GenerationResult> {
  const geminiApiKey = process.env.GEMINI_API_KEY;

  if (geminiApiKey) {
    try {
      const genAI = new GoogleGenerativeAI(geminiApiKey);
      const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
      const concurrency = Math.min(Math.max(Number(process.env.GEMINI_BATCH_CONCURRENCY || 3), 1), 5);
      const timeoutMs = Math.min(Math.max(Number(process.env.GEMINI_BATCH_TIMEOUT_MS || 35000), 15000), 90000);

      // Concurrently run generation for all 10 Sections
      const results = await runWithConcurrency(SECTIONS, concurrency, async (section, sIdx) => {
        try {
          const model = genAI.getGenerativeModel({
            model: modelName,
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.5,
            },
          });

          const startId = sIdx * 10 + 1;
          const sectionPrompt = buildSectionPrompt(payload, section, startId);

          const result = await Promise.race([
            model.generateContent(sectionPrompt),
            new Promise<any>((_, reject) => {
              setTimeout(() => {
                reject(new Error(`Section ${section.key} generation timed out after ${timeoutMs}ms`));
              }, timeoutMs);
            }),
          ]);

          const text = result.response.text();
          const parsed = parseJson(text);
          const rawQuestions = normalizeGeneratedQuestions(parsed, payload, section.type);
          
          // Re-map IDs to ensure exact startId to startId + 9 range
          return rawQuestions.map((q, idx) => ({
            ...q,
            id: startId + idx
          }));
        } catch (error) {
          console.error(`Error generating section ${section.key}:`, error);
          // Return empty on failure so we can populate from fallback
          return [];
        }
      });

      // Flat map all generated questions
      let allQuestions = results.flat();

      // Deduplicate the combined set of questions
      const uniqueQuestions = deduplicateQuestions(allQuestions);

      // If duplicate checking removed items, or any batches failed, refill remaining slots with local fallbacks
      let finalQuestions: Question[] = [];
      
      // We will loop from 1 to 100 to ensure we have exactly 100 questions with continuous IDs
      for (let i = 1; i <= 100; i++) {
        const found = uniqueQuestions.find(q => q.id === i);
        if (found) {
          finalQuestions.push(found);
        } else {
          // Fetch single fallback item for this ID slot
          const fallbackSet = buildLocalFallback(payload, 1, i);
          finalQuestions.push(fallbackSet.questions[0]);
        }
      }

      return {
        title: `${payload.board} ${payload.className} ${payload.subject}: ${payload.chapter}`,
        board: payload.board,
        className: payload.className,
        subject: payload.subject,
        chapter: payload.chapter,
        questions: finalQuestions,
        generatedAt: new Date().toISOString(),
        cacheable: true,
        resilient: uniqueQuestions.length < 100,
        provider: 'gemini',
        model: modelName
      };

    } catch (e) {
      console.warn('Gemini batch engine failed, falling back to local generation...', e);
    }
  }

  // Last resort local fallback
  return buildLocalFallback(payload, 100, 1, 'AI Engine fallback models failed, showing local starter questions.');
}
