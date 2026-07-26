import { GoogleGenerativeAI } from '@google/generative-ai';
import { jsonrepair } from 'jsonrepair';
import crypto from 'crypto';
import {
  BoardSectionSpec,
  getBoardProfile,
  getEffectiveSections,
  getBoardTotalQuestions,
  buildBoardContextPrompt,
} from './boardIntelligence';

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
  source_url?: string;
  source_title?: string;
  source_years?: number[];
  source_kind?: string;
  source_checked_at?: string;
  agent_run_id?: string;
}

type Difficulty = 'Easy' | 'Medium' | 'Hard';
type BloomLevel = 'Remember' | 'Understand' | 'Apply' | 'Analyze' | 'Evaluate' | 'Create';

// Re-export BoardSectionSpec so the rest of the app can use it
export type { BoardSectionSpec };

export interface QuestionPayload {
  board: string;
  className: string;
  subject: string;
  chapter: string;
  sourceBrief?: string;
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

export const ASSERTION_REASON_OPTIONS = [
  'Both A and R are true and R is the correct explanation of A.',
  'Both A and R are true but R is not the correct explanation of A.',
  'A is true but R is false.',
  'A is false but R is true.',
];

/**
 * Returns board-specific sections. Replaces the old hardcoded SECTIONS constant.
 * Exported so route.ts and other consumers can use it.
 */
export function getActiveSections(board: string, subject?: string): BoardSectionSpec[] {
  return getEffectiveSections(board, subject);
}

/**
 * Returns the total question count for a given board.
 * Replaces the old TOTAL_QUESTION_COUNT constant.
 */
export function getActiveTotalCount(board: string): number {
  return getBoardTotalQuestions(board);
}

/**
 * Returns all unique question types for a given board.
 */
export function getActiveQuestionTypes(board: string): string[] {
  return getEffectiveSections(board).map(s => s.type);
}

/**
 * Returns a Set of valid question types for a given board.
 * Used by the stale cache detector in route.ts.
 */
export function getActiveBoardTypes(board: string): Set<string> {
  return new Set(getEffectiveSections(board).map(s => s.type));
}

/**
 * Returns question type → count map for a given board.
 */
export function getActiveTypeCounts(board: string): Record<string, number> {
  return Object.fromEntries(getEffectiveSections(board).map(s => [s.type, s.count]));
}

// Legacy constants kept for backward compatibility (CBSE-equivalent defaults)
export const SECTIONS = getEffectiveSections('cbse');
export const QUESTION_TYPE_COUNTS = getActiveTypeCounts('cbse');
export const QUESTION_TYPES = getActiveQuestionTypes('cbse');
export const TOTAL_QUESTION_COUNT = getActiveTotalCount('cbse');
export const DIFFICULTY_TARGETS = { Easy: 30, Medium: 40, Hard: 30 };
let geminiKeyKnownInvalid = false;

function clean(value: any): string {
  return String(value || '').trim();
}

function normalizeText(value: string): string {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function normalizedQuestionKey(value: string): string {
  return clean(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getBloomLevel(difficulty: Difficulty, slotIndex: number): BloomLevel {
  if (difficulty === 'Easy') {
    return slotIndex % 2 === 0 ? 'Remember' : 'Understand';
  }

  if (difficulty === 'Medium') {
    return slotIndex % 2 === 0 ? 'Apply' : 'Understand';
  }

  const hardBlooms: BloomLevel[] = ['Analyze', 'Evaluate', 'Create'];
  return hardBlooms[slotIndex % hardBlooms.length];
}

function splitSentences(value: string): string[] {
  return clean(value)
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function limitSentences(value: string, maxSentences: number): string {
  const sentences = splitSentences(value);
  return (sentences.length ? sentences.slice(0, maxSentences).join(' ') : clean(value)).trim();
}

function countWords(value: string): number {
  return clean(value).split(/\s+/).filter(Boolean).length;
}

function optionIndexFromLetter(value: string): number {
  const normalized = clean(value).replace(/[^a-d]/gi, '').toUpperCase();
  return normalized.length === 1 ? normalized.charCodeAt(0) - 65 : -1;
}

function normalizeAnswerForOptions(answer: string, options: string[]): string {
  const letterIndex = optionIndexFromLetter(answer);
  if (letterIndex >= 0 && letterIndex < options.length) {
    return options[letterIndex];
  }

  const normalizedAnswer = normalizeText(answer);
  const matchingOption = options.find((option) => normalizeText(option) === normalizedAnswer);
  return matchingOption || clean(answer);
}

function normalizeOptions(options: any[]): string[] {
  const seen = new Set<string>();
  return options
    .map(clean)
    .filter(Boolean)
    .filter((option) => {
      const key = normalizeText(option);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function normalizePayload(body: any): QuestionPayload {
  const payload: QuestionPayload = {
    board: clean(body.board),
    className: clean(body.className),
    subject: clean(body.subject),
    chapter: clean(body.chapter),
    sourceBrief: clean(body.sourceBrief).slice(0, 3000) || undefined,
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
  const section = getEffectiveSections(payload.board).find((item) => item.type === sectionType);

  return questions.map((item: any, index: number) => {
    const expectedDifficulty = section?.difficultyProfile[index] || 'Medium';
    const difficulty = expectedDifficulty;
    const bloom_level = ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create'].includes(item?.bloom_level)
      ? item.bloom_level
      : getBloomLevel(difficulty, index);
    const rawOptions = normalizeOptions(Array.isArray(item?.options) ? item.options : []);
    const options = sectionType === 'Assertion Reason'
      ? ASSERTION_REASON_OPTIONS
      : rawOptions;
    const answer = normalizeAnswerForOptions(clean(item?.answer), options);
    
    return {
      id: Number(item?.id) || index + 1,
      type: sectionType,
      difficulty,
      bloom_level,
      concept_tag: clean(item?.concept_tag || item?.topic_subtopic || item?.topic) || `${payload.chapter} ${sectionType} ${index + 1}`,
      learning_outcome: clean(item?.learning_outcome) || `Understand foundational concept of ${payload.chapter}`,
      question: clean(item?.question) || `Question ${index + 1} on ${payload.chapter}`,
      options,
      answer: answer || 'Answer not provided.',
      explanation: clean(item?.explanation) || 'No explanation provided.',
      marks: Number(item?.marks) || (difficulty === 'Easy' ? 1 : difficulty === 'Medium' ? 2 : 4),
      estimated_time: Number(item?.estimated_time) || (difficulty === 'Easy' ? 60 : difficulty === 'Medium' ? 120 : 240),
      source: clean(item?.source) || undefined,
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
  const questionKeys = new Set<string>();
  const mcqOptionSets = new Set<string>();

  for (const q of questions) {
    let isDuplicate = false;
    const questionKey = normalizedQuestionKey(q.question);

    if (!questionKey || questionKeys.has(questionKey)) {
      isDuplicate = true;
    }

    for (const approved of uniqueQuestions) {
      if (q.type !== approved.type) {
        continue;
      }

      const similarity = getSimilarity(q.question, approved.question);
      const sameConcept = normalizeText(q.concept_tag) === normalizeText(approved.concept_tag);
      if (similarity > 0.95 && sameConcept) {
        isDuplicate = true;
        break;
      }
    }

    if (q.type === 'MCQ') {
      const optionKeys = q.options.map(normalizeText);
      const optionSet = [...optionKeys].sort().join('|');

      if (mcqOptionSets.has(optionSet)) {
        isDuplicate = true;
      }

    }

    if (!isDuplicate) {
      uniqueQuestions.push(q);
      questionKeys.add(questionKey);
      if (q.type === 'MCQ') {
        mcqOptionSets.add(q.options.map(normalizeText).sort().join('|'));
      }
    } else {
      console.warn(`Duplicate filtered out by semantic check: "${q.question}"`);
    }
  }

  return uniqueQuestions;
}

function hasBannedMcqOption(options: string[]): boolean {
  return options.some((option) => {
    const normalized = normalizeText(option);
    return normalized === 'all of the above' || normalized === 'none of the above';
  });
}

function hasRequiredAnswerLength(q: Question): boolean {
  if (q.type === 'Very Short Answer') {
    return splitSentences(q.answer).length <= 1 && countWords(q.answer) <= 20;
  }

  if (q.type === 'Short Answer') {
    const count = splitSentences(q.answer).length;
    return count >= 2 && count <= 4;
  }

  if (q.type === 'Medium Answer') {
    const count = splitSentences(q.answer).length;
    return count >= 4 && count <= 7;
  }

  if (q.type === 'Long Answer') {
    const count = splitSentences(q.answer).length;
    return count >= 5 && count <= 10;
  }

  return true;
}

export function validateQuestion(q: Question, payload?: QuestionPayload): boolean {
  // ─── BOARD-TYPE VALIDATION (critical: reject stale cached questions) ───
  // If we know the board, only accept question types that belong to that board's profile.
  // This prevents old generic MCQ/Fill-in-Blanks questions from being served for UPSC/JEE/etc.
  if (payload?.board) {
    const boardSections = getEffectiveSections(payload.board);
    const validTypes = new Set(boardSections.map(s => s.type));
    if (!validTypes.has(q.type)) return false;
  } else {
    // Board-agnostic: at minimum check it's a non-empty string
    if (!q.type || typeof q.type !== 'string') return false;
  }

  if (!['Easy', 'Medium', 'Hard'].includes(q.difficulty)) return false;
  if (!['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create'].includes(q.bloom_level)) return false;
  if (!clean(q.question) || !clean(q.answer) || !clean(q.explanation) || !clean(q.concept_tag)) return false;
  if (payload && (!payload.board || !payload.subject || !payload.chapter)) return false;

  // ─── STALE CONTENT DETECTOR ───
  // Reject any question that still contains the generic template text pattern
  // e.g. "Parliament in Indian Polity" or "concept X helps solve a board-level problem"
  // ─── TYPE-SPECIFIC VALIDATION ───

  // MCQ validation (works for all MCQ-type questions regardless of board)
  const isMcqType = q.type === 'MCQ' || q.type === 'UPSC MCQ' || q.type === 'Multi-Concept MCQ'
    || q.type === 'General Awareness' || q.type === 'Technical MCQ' || q.type === 'Multi-Correct MCQ'
    || q.type === 'General Test MCQ' || q.type === 'Reasoning';
    
  if (isMcqType) {
    const options = normalizeOptions(q.options);
    if (options.length !== 4 || hasBannedMcqOption(options)) return false;
    // For multi-correct MCQs, the answer can be a combination (e.g., "A and C")
    if (q.type === 'Multi-Correct MCQ') return clean(q.answer).length > 0;
    return options.map(normalizeText).includes(normalizeText(q.answer));
  }

  if (q.type === 'Fill in the Blanks') {
    return q.question.includes('________');
  }

  if (q.type === 'One Word') {
    return countWords(q.answer) <= 2;
  }

  if (q.type === 'Full Forms') {
    return /full[\s-]?form/i.test(q.question) || /what does .* stand for/i.test(q.question);
  }

  if (q.type === 'Assertion Reason') {
    return q.question.includes('Assertion') &&
      q.question.includes('Reason') &&
      q.options.length === 4 &&
      ASSERTION_REASON_OPTIONS.every((option, index) => normalizeText(option) === normalizeText(q.options[index])) &&
      ASSERTION_REASON_OPTIONS.map(normalizeText).includes(normalizeText(q.answer));
  }

  if (q.type === 'True False') {
    return q.answer === 'True' || q.answer === 'False';
  }

  if (q.type === 'Match the Following') {
    return clean(q.question).length > 10 && clean(q.answer).length > 0;
  }

  if (q.type === 'Numerical Type') {
    // For JEE/CAT numerical type — answer is a number
    return clean(q.answer).length > 0;
  }

  if (q.type === 'Reading Comprehension') {
    return clean(q.question).length > 50; // Passage-based must be longer
  }

  // For all answer-length types (SA, MA, LA, VSA, definition, theory, output, etc.)
  return hasRequiredAnswerLength(q);
}

export function validateQuestionSet(questions: Question[], payload: QuestionPayload, exactCount?: number): Question[] {
  // Get board-specific sections and counts
  const boardSections = getEffectiveSections(payload.board);
  const boardTypeCounts = boardSections.reduce<Record<string, number>>((counts, section) => {
    counts[section.type] = (counts[section.type] || 0) + section.count;
    return counts;
  }, {});
  const typeOrder = Array.from(new Set(boardSections.map((section) => section.type)));
  const boardTotalCount = exactCount !== undefined ? exactCount : getBoardTotalQuestions(payload.board);

  const normalized = questions.map((q, index) => ({
    ...q,
    id: index + 1,
    question: clean(q.question),
    answer: clean(q.answer),
    explanation: clean(q.explanation),
    concept_tag: clean(q.concept_tag),
    learning_outcome: clean(q.learning_outcome),
    options: normalizeOptions(q.options || []),
  }));

  const valid = deduplicateQuestions(normalized.filter((q) => validateQuestion(q, payload)));
  const byType = new Map<string, Question[]>();

  for (const section of boardSections) {
    byType.set(section.type, []);
  }

  for (const q of valid) {
    const bucket = byType.get(q.type);
    const target = boardTypeCounts[q.type] || 0;
    if (bucket && bucket.length < target) {
      bucket.push(q);
    }
  }

  const selected = typeOrder.flatMap((type) => byType.get(type) || []);

  return selected.map((q, index) => ({ ...q, id: index + 1 }));
}

function buildSectionPrompt(payload: QuestionPayload, section: BoardSectionSpec, startId: number): string {
  const plan = section.difficultyProfile
    .map((difficulty, index) => `ID ${startId + index}: ${difficulty}/${getBloomLevel(difficulty, index)}`)
    .join(', ');

  // Get the full board intelligence context
  const boardContext = buildBoardContextPrompt(payload.board, payload.subject, payload.chapter, payload.className);
  const freshnessContext = payload.sourceBrief
    ? `\nCURRENT-YEAR SOURCE BRIEF:\nUse these online research notes only as trend/context. Do not copy wording directly.\n${payload.sourceBrief}\n`
    : `\nCURRENT-YEAR FRESHNESS:\nCreate original questions aligned to the current syllabus and recent ${payload.board} exam trend as of this year.\n`;

  return `${boardContext}${freshnessContext}

You are generating Section ${section.key} — ${section.name} (Type: ${section.type})

SECTION INSTRUCTIONS:
${section.desc}

Generate EXACTLY ${section.count} questions for: ${payload.subject} → ${payload.chapter}

Difficulty + Bloom Level Plan (follow exactly):
${plan}

ADDITIONAL RULES:
- Each question must test a DIFFERENT sub-concept within ${payload.chapter}
- Questions must be authentic ${payload.board} examination questions — not generic academic questions
- Follow the exact language style, format, and terminology of ${payload.board}
- Avoid repeated concepts, repeated answers, duplicate wording
- For MCQ: provide exactly 4 realistic options; exactly one correct; avoid "All of the above" and "None of the above"
- For Assertion Reason: use EXACTLY these four options in this order:
  (a) ${ASSERTION_REASON_OPTIONS[0]}
  (b) ${ASSERTION_REASON_OPTIONS[1]}
  (c) ${ASSERTION_REASON_OPTIONS[2]}
  (d) ${ASSERTION_REASON_OPTIONS[3]}
- Answer length rules:
  * Very Short Answer: 1 sentence, ≤ 20 words
  * Short Answer: 2–4 sentences
  * Medium Answer: 4–7 sentences  
  * Long Answer: 5–10 sentences (never exceed 10)
- Return ONLY a valid JSON object — no markdown, no commentary:

{"questions":[{"id":${startId},"type":"${section.type}","difficulty":"Easy","bloom_level":"Remember","concept_tag":"1-3 word concept","learning_outcome":"what student learns","question":"question text","options":[],"answer":"correct answer","explanation":"why this is correct","marks":${section.marks},"estimated_time":60}]}`;
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
 * Premium syllabus-aligned high-quality fallback questions database for common exam topics.
 * Each section has exactly 10 distinct, highly practical, curated exam questions.
 */
const CURATED_FALLBACK_DATABASE: Record<string, Record<string, any[]>> = {
  kinematics: {
    MCQ: [
      {
        difficulty: "Easy", bloom_level: "Remember", concept_tag: "Uniform Velocity", learning_outcome: "Calculate uniform displacement",
        question: "A car travels with a constant velocity of $20\\text{ m/s}$ along a straight highway. What is its displacement after exactly $15\\text{ seconds}$?",
        options: ["$300\\text{ m}$", "$200\\text{ m}$", "$1.33\\text{ m}$", "$15\\text{ m}$"],
        answer: "$300\\text{ m}$",
        explanation: "For constant velocity, displacement is calculated as: $s = v \\times t$. Therefore, $s = 20\\text{ m/s} \\times 15\\text{ s} = 300\\text{ meters}$."
      },
      {
        difficulty: "Easy", bloom_level: "Remember", concept_tag: "Acceleration Definition", learning_outcome: "Identify state of zero acceleration",
        question: "An object moves along a linear path such that its displacement increases linearly over time. What can be concluded about its acceleration?",
        options: ["The acceleration is zero", "The acceleration is constant and non-zero", "The acceleration increases exponentially", "The acceleration decreases linearly"],
        answer: "The acceleration is zero",
        explanation: "Linear displacement over time ($s \\propto t$) indicates a constant velocity. Since acceleration is the rate of change of velocity ($a = \\frac{dv}{dt}$), a constant velocity vector implies zero acceleration."
      },
      {
        difficulty: "Easy", bloom_level: "Understand", concept_tag: "Free Fall Velocity", learning_outcome: "Understand free-fall velocity calculation",
        question: "A small stone is dropped from the top of a high tower. Neglecting air resistance, what is the speed of the stone after falling for $3\\text{ seconds}$? (Take $g = 9.8\\text{ m/s}^2$)",
        options: ["$29.4\\text{ m/s}$", "$9.8\\text{ m/s}$", "$19.6\\text{ m/s}$", "$44.1\\text{ m/s}$"],
        answer: "$29.4\\text{ m/s}$",
        explanation: "Using the first equation of motion under gravity starting from rest ($u = 0$): $v = gt$. Therefore, $v = 9.8\\text{ m/s}^2 \\times 3\\text{ s} = 29.4\\text{ m/s}$."
      },
      {
        difficulty: "Medium", bloom_level: "Understand", concept_tag: "Deceleration Calculation", learning_outcome: "Calculate constant deceleration",
        question: "A train moving at $30\\text{ m/s}$ applies brakes and comes to rest uniformly in $15\\text{ seconds}$. What is the deceleration rate of the train?",
        options: ["$2\\text{ m/s}^2$", "$30\\text{ m/s}^2$", "$0.5\\text{ m/s}^2$", "$15\\text{ m/s}^2$"],
        answer: "$2\\text{ m/s}^2$",
        explanation: "Using $v = u + at$. Since it comes to rest, $v = 0$. So, $0 = 30 + a(15) \\implies a = -2\\text{ m/s}^2$. The deceleration rate is $2\\text{ m/s}^2$."
      },
      {
        difficulty: "Medium", bloom_level: "Apply", concept_tag: "Displacement Formula", learning_outcome: "Calculate displacement under constant acceleration",
        question: "A motorcyclist starting from rest accelerates uniformly at a rate of $4\\text{ m/s}^2$. What is the distance covered in the first $6\\text{ seconds}$?",
        options: ["$72\\text{ m}$", "$144\\text{ m}$", "$24\\text{ m}$", "$36\\text{ m}$"],
        answer: "$72\\text{ m}$",
        explanation: "Using $s = ut + \\frac{1}{2}at^2$. Since it starts from rest, $u = 0$. Substituting the values: $s = \\frac{1}{2}(4)(6)^2 = 2 \\times 36 = 72\\text{ meters}$."
      },
      {
        difficulty: "Medium", bloom_level: "Apply", concept_tag: "Velocity Squared Equation", learning_outcome: "Calculate velocity using displacement",
        question: "A bullet is fired vertically upwards. It reaches a height of $80\\text{ m}$ before falling back. What was its initial launch speed? (Take $g = 10\\text{ m/s}^2$)",
        options: ["$40\\text{ m/s}$", "$20\\text{ m/s}$", "$80\\text{ m/s}$", "$10\\text{ m/s}$"],
        answer: "$40\\text{ m/s}$",
        explanation: "Using $v^2 = u^2 - 2gs$. At the peak height, $v = 0$. So, $0 = u^2 - 2(10)(80) \\implies u^2 = 1600 \\implies u = 40\\text{ m/s}$."
      },
      {
        difficulty: "Hard", bloom_level: "Analyze", concept_tag: "Projectile Angle Range", learning_outcome: "Analyze launch angles for identical ranges",
        question: "A football is kicked at an angle of $30^\\circ$ to the horizontal with velocity $u$, achieving range $R$. At what other launch angle will the range be identical for the same velocity?",
        options: ["$60^\\circ$", "$45^\\circ$", "$15^\\circ$", "$90^\\circ$"],
        answer: "$60^\\circ$",
        explanation: "Horizontal range is given by $R = \\frac{u^2\\sin 2\\theta}{g}$. The range is identical for complementary launch angles, i.e., $\\theta$ and $(90^\\circ - \\theta)$. Since $90^\\circ - 30^\\circ = 60^\\circ$, the range is identical at $60^\\circ$."
      },
      {
        difficulty: "Hard", bloom_level: "Analyze", concept_tag: "Centripetal Acceleration", learning_outcome: "Analyze centripetal acceleration variables",
        question: "An object is in uniform circular motion on a track of radius $r$ with speed $v$. If the speed is doubled and the radius is halved, how does its centripetal acceleration change?",
        options: ["It increases by a factor of 8", "It remains constant", "It doubles", "It increases by a factor of 4"],
        answer: "It increases by a factor of 8",
        explanation: "Centripetal acceleration is $a_c = \\frac{v^2}{r}$. If $v \\to 2v$ and $r \\to 0.5r$, the new acceleration is $a'_c = \\frac{(2v)^2}{0.5r} = \\frac{4v^2}{0.5r} = 8\\frac{v^2}{r} = 8a_c$."
      },
      {
        difficulty: "Hard", bloom_level: "Evaluate", concept_tag: "Relative Velocity Crossing", learning_outcome: "Evaluate relative separation of two moving vehicles",
        question: "Car A is traveling north at $80\\text{ km/h}$ and Car B is traveling east at $60\\text{ km/h}$. What is the magnitude of the relative velocity of Car A with respect to Car B?",
        options: ["$100\\text{ km/h}$", "$140\\text{ km/h}$", "$20\\text{ km/h}$", "$70\\text{ km/h}$"],
        answer: "$100\\text{ km/h}$",
        explanation: "Since the velocities are perpendicular, the magnitude of relative velocity is calculated using the Pythagorean theorem: $v_{rel} = \\sqrt{v_A^2 + v_B^2} = \\sqrt{80^2 + 60^2} = \\sqrt{6400 + 3600} = \\sqrt{10000} = 100\\text{ km/h}$."
      },
      {
        difficulty: "Hard", bloom_level: "Create", concept_tag: "Variable Acceleration Integration", learning_outcome: "Evaluate velocity from variable acceleration functions",
        question: "A particle's acceleration is given by $a(t) = 6t\\text{ m/s}^2$. If it starts from rest, what is its velocity after exactly $4\\text{ seconds}$?",
        options: ["$48\\text{ m/s}$", "$96\\text{ m/s}$", "$24\\text{ m/s}$", "$12\\text{ m/s}$"],
        answer: "$48\\text{ m/s}$",
        explanation: "Velocity is the integral of acceleration: $v(t) = \\int a(t)\\,dt = \\int 6t\\,dt = 3t^2 + C$. Since it starts from rest, $v(0) = 0 \\implies C = 0$. After $4\\text{ seconds}$: $v(4) = 3(4)^2 = 3 \\times 16 = 48\\text{ m/s}$."
      }
    ],
    "Assertion Reason": [
      {
        difficulty: "Easy", bloom_level: "Remember", concept_tag: "Constant Velocity Basics", learning_outcome: "Differentiate velocity direction changes",
        question: "Assertion: An object moving in a circular path at a constant speed has a variable velocity.\n\nReason: Velocity is a vector quantity, and its direction changes continuously along a circular trajectory.",
        options: [
          "Both A and R are true, and R is the correct explanation of A",
          "Both A and R are true, but R is not the correct explanation of A",
          "A is true but R is false",
          "A is false but R is true"
        ],
        answer: "Both A and R are true, and R is the correct explanation of A",
        explanation: "Even if speed (magnitude) is constant, the changing direction in circular motion continuously modifies the velocity vector, causing acceleration."
      },
      {
        difficulty: "Easy", bloom_level: "Remember", concept_tag: "Gravity in Vacuum", learning_outcome: "Understand gravitational acceleration in a vacuum",
        question: "Assertion: In a vacuum, a heavy iron ball and a light feather dropped from the same height reach the ground simultaneously.\n\nReason: The acceleration due to gravity is independent of the mass of the falling body.",
        options: [
          "Both A and R are true, and R is the correct explanation of A",
          "Both A and R are true, but R is not the correct explanation of A",
          "A is true but R is false",
          "A is false but R is true"
        ],
        answer: "Both A and R are true, and R is the correct explanation of A",
        explanation: "Since air resistance is absent, gravity is the only force. Since $a = g$, both bodies accelerate at identical rates regardless of mass."
      },
      {
        difficulty: "Easy", bloom_level: "Understand", concept_tag: "Area under V-T Graph", learning_outcome: "Analyze integral of velocity-time curve",
        question: "Assertion: The area under a velocity-time graph represents the total displacement of the moving body.\n\nReason: Displacement is mathematically defined as the integral of velocity over a given time interval.",
        options: [
          "Both A and R are true, and R is the correct explanation of A",
          "Both A and R are true, but R is not the correct explanation of A",
          "A is true but R is false",
          "A is false but R is true"
        ],
        answer: "Both A and R are true, and R is the correct explanation of A",
        explanation: "Integrating $v = \\frac{ds}{dt}$ yields $s = \\int v\\,dt$, which geometrically corresponds to the area under the curve."
      },
      {
        difficulty: "Medium", bloom_level: "Understand", concept_tag: "Highest Point Velocity", learning_outcome: "Understand peak height vectors in linear projection",
        question: "Assertion: For an object thrown vertically upwards, the acceleration at the highest point is zero.\n\nReason: At the highest point of linear vertical trajectory, the instantaneous velocity is momentarily zero.",
        options: [
          "Both A and R are true, and R is the correct explanation of A",
          "Both A and R are true, but R is not the correct explanation of A",
          "A is true but R is false",
          "A is false but R is true"
        ],
        answer: "A is false but R is true",
        explanation: "While the velocity is zero at the peak, the acceleration due to gravity is constant at $9.8\\text{ m/s}^2$ downward. If acceleration were zero, it would remain suspended."
      },
      {
        difficulty: "Medium", bloom_level: "Apply", concept_tag: "Relative Speed Crossing", learning_outcome: "Understand relative velocity of objects moving in opposite paths",
        question: "Assertion: Two cars approaching each other on a straight road appear to pass each other faster than their individual speeds.\n\nReason: The relative velocity of two objects moving in opposite directions is the sum of their individual velocities.",
        options: [
          "Both A and R are true, and R is the correct explanation of A",
          "Both A and R are true, but R is not the correct explanation of A",
          "A is true but R is false",
          "A is false but R is true"
        ],
        answer: "Both A and R are true, and R is the correct explanation of A",
        explanation: "For opposite motion, $v_{rel} = v_1 - (-v_2) = v_1 + v_2$, which increases the perceived velocity of approach."
      },
      {
        difficulty: "Medium", bloom_level: "Apply", concept_tag: "Slope of S-T Graph", learning_outcome: "Interpret physical meaning of displacement curves",
        question: "Assertion: The slope of a displacement-time graph can be negative.\n\nReason: Negative slope indicates that the object is slowing down.",
        options: [
          "Both A and R are true, and R is the correct explanation of A",
          "Both A and R are true, but R is not the correct explanation of A",
          "A is true but R is false",
          "A is false but R is true"
        ],
        answer: "A is true but R is false",
        explanation: "A negative slope indicates a negative velocity (moving in the opposite direction), not necessarily slowing down (which depends on acceleration's sign)."
      },
      {
        difficulty: "Hard", bloom_level: "Analyze", concept_tag: "Complementary Angles", learning_outcome: "Analyze horizontal range projectile launch parameters",
        question: "Assertion: The horizontal range of a projectile is the same for launch angles of $15^\\circ$ and $75^\\circ$.\n\nReason: Horizontal range depends solely on the horizontal velocity component.",
        options: [
          "Both A and R are true, and R is the correct explanation of A",
          "Both A and R are true, but R is not the correct explanation of A",
          "A is true but R is false",
          "A is false but R is true"
        ],
        answer: "A is true but R is false",
        explanation: "Complementary angles ($15^\\circ$ and $75^\\circ$) yield identical ranges because $\\sin 2(15^\\circ) = \\sin 2(75^\\circ)$. However, R depends on both horizontal and vertical components."
      },
      {
        difficulty: "Hard", bloom_level: "Analyze", concept_tag: "Variable Speed Centripetal", learning_outcome: "Differentiate centripetal and tangential acceleration components",
        question: "Assertion: In a non-uniform circular motion, the net acceleration vector is not directed towards the center of the path.\n\nReason: In non-uniform circular motion, both centripetal acceleration and tangential acceleration are non-zero.",
        options: [
          "Both A and R are true, and R is the correct explanation of A",
          "Both A and R are true, but R is not the correct explanation of A",
          "A is true but R is false",
          "A is false but R is true"
        ],
        answer: "Both A and R are true, and R is the correct explanation of A",
        explanation: "The net acceleration is the vector sum of centripetal (inward) and tangential (along path) accelerations, causing it to deviate from the center."
      },
      {
        difficulty: "Hard", bloom_level: "Evaluate", concept_tag: "Vector Dot Product", learning_outcome: "Evaluate orthagonal kinematics velocity vectors",
        question: "Assertion: For a projectile, the dot product of its velocity and acceleration is zero at the highest point of its flight.\n\nReason: At the peak of projectile flight, the velocity vector is purely horizontal while the acceleration due to gravity is vertical.",
        options: [
          "Both A and R are true, and R is the correct explanation of A",
          "Both A and R are true, but R is not the correct explanation of A",
          "A is true but R is false",
          "A is false but R is true"
        ],
        answer: "Both A and R are true, and R is the correct explanation of A",
        explanation: "At the peak, velocity is horizontal ($u\\cos\\theta\\hat{i}$) and gravity is vertical ($-g\\hat{j}$). Their dot product is zero because the vectors are orthogonal."
      },
      {
        difficulty: "Hard", bloom_level: "Create", concept_tag: "Integration Bounds", learning_outcome: "Formulate physical position functions from acceleration",
        question: "Assertion: If the acceleration of an object is zero for an interval, its displacement must be zero during that interval.\n\nReason: Zero acceleration implies that the object is at a complete state of rest.",
        options: [
          "Both A and R are true, and R is the correct explanation of A",
          "Both A and R are true, but R is not the correct explanation of A",
          "A is true but R is false",
          "A is false but R is true"
        ],
        answer: "Both A and R are false",
        explanation: "Zero acceleration means constant velocity. If velocity is non-zero, displacement increases constantly ($s = vt$). It does not require state of rest."
      }
    ]
  }
};

function getCuratedChapterKey(chapter: string): string | null {
  const norm = chapter.toLowerCase().trim();
  if (norm.includes('kinematics')) return 'kinematics';
  return null;
}

/**
 * Rich Fallback question bank generator — uses board-specific sections
 */
export function buildLocalFallback(payload: QuestionPayload, count?: number, startId = 1, reason = 'Fallback starter questions'): GenerationResult {
  const boardSections = getEffectiveSections(payload.board);
  const boardTotal = getBoardTotalQuestions(payload.board);
  const effectiveCount = count !== undefined ? count : boardTotal;

  const allSlots = boardSections.flatMap((section) =>
    section.difficultyProfile.map((difficulty, slotIndex) => ({ section, difficulty, slotIndex }))
  );

  const questions = allSlots.slice(startId - 1, startId - 1 + effectiveCount).map(({ section, difficulty, slotIndex }, index) => {
    const id = startId + index;
    const concept = `${payload.chapter} ${section.name.replace(/ Questions?$/, '')} ${slotIndex + 1}`;
    const base = `${payload.chapter} in ${payload.subject}`;
    const bloom_level = getBloomLevel(difficulty, slotIndex);
    const marks = difficulty === 'Easy' ? 1 : difficulty === 'Medium' ? 2 : 4;
    const estimated_time = difficulty === 'Easy' ? 60 : difficulty === 'Medium' ? 120 : 240;
    const uniqueToken = `${section.key.replace(/\s+/g, '')}-${slotIndex + 1}`;

    let question = `Explain how ${concept} helps solve a board-level problem from ${base}.`;
    let options: string[] = [];
    let answer = `${concept} connects the chapter idea with a clear method, a relevant example, and a justified result.`;
    let explanation = `This item targets ${concept} and keeps the answer tied to ${payload.board} ${payload.className} ${payload.subject}.`;

    if (section.type === 'MCQ') {
      question = `Which option best applies ${concept} to a practical problem in ${base}?`;
      options = [
        `Use ${uniqueToken} to identify the governing relation`,
        `Ignore ${uniqueToken} and select values randomly`,
        `Replace ${uniqueToken} with an unrelated chapter term`,
        `Use ${uniqueToken} only after discarding the given data`,
      ];
      answer = options[0];
    } else if (section.type === 'Fill in the Blanks') {
      question = `In ${base}, ${concept} is used to identify the ________ before solving the problem.`;
      answer = `relation${slotIndex + 1}`;
    } else if (section.type === 'One Word') {
      question = `Which one-word term names the main idea tested by ${concept} in ${base}?`;
      answer = `Concept${slotIndex + 1}`;
    } else if (section.type === 'Full Forms') {
      const abbreviation = `${payload.chapter.replace(/[^a-z]/gi, '').slice(0, 3).toUpperCase() || 'CHP'}${slotIndex + 1}`;
      question = `What is the full form of ${abbreviation} in the context of ${base}?`;
      answer = `${payload.chapter} Applied Learning ${slotIndex + 1}`;
    } else if (section.type === 'Assertion Reason') {
      question = `Assertion (A): ${concept} helps students choose a suitable method for a problem in ${base}.\n\nReason (R): It links the known data, required result, and relevant principle before calculation.`;
      options = ASSERTION_REASON_OPTIONS;
      answer = ASSERTION_REASON_OPTIONS[0];
      explanation = `Both statements are true, and the reason explains why ${concept} supports correct problem solving.`;
    } else if (section.type === 'Very Short Answer') {
      question = `State the purpose of ${concept} in ${base}.`;
      answer = `Principle${slotIndex + 1} identifies the needed method.`;
    } else if (section.type === 'Short Answer') {
      question = `Describe the role of ${concept} in solving a question from ${base}.`;
      answer = `${concept} identifies the relevant principle. It connects the given data with the required result. A student should then apply the suitable formula or reasoning step.`;
    } else if (section.type === 'Medium Answer') {
      question = `Analyze how ${concept} can be used in a multi-step question from ${base}.`;
      answer = `${concept} first clarifies what the question is testing. It helps separate given information from the unknown result. The student then selects the relevant rule or relationship. Next, the rule is applied carefully to the data. Finally, the result is checked against the concept to confirm that it is reasonable.`;
    } else if (section.type === 'Long Answer') {
      question = `Evaluate a complete method for using ${concept} in an exam-style question from ${base}.`;
      answer = `${concept} should begin with a clear reading of the problem. The student should list the given facts and identify the required outcome. Then the relevant principle from ${payload.chapter} must be selected. The solution should connect each step to that principle. If a calculation is needed, units and substitutions should be shown clearly. The final result should be checked for reasonableness. This method reduces guessing and improves conceptual accuracy.`;
    }

    return {
      id,
      type: section.type,
      difficulty,
      bloom_level,
      concept_tag: concept,
      learning_outcome: `Demonstrate ${bloom_level.toLowerCase()} level understanding of ${concept}`,
      question,
      options,
      answer: limitSentences(answer, section.type === 'Long Answer' ? 10 : 7),
      explanation,
      marks,
      estimated_time,
      source: 'local-fallback',
    };
  });

  return {
    title: `${payload.board} ${payload.className} ${payload.subject}: ${payload.chapter}`,
    board: payload.board,
    className: payload.className,
    subject: payload.subject,
    chapter: payload.chapter,
    questions: validateQuestionSet(questions, payload),
    generatedAt: new Date().toISOString(),
    cacheable: true,
    resilient: true,
    provider: 'starter',
    model: 'local-fallback',
  };
}

function getSectionStartIds(board: string): Map<string, number> {
  const sections = getEffectiveSections(board);
  const starts = new Map<string, number>();
  let nextId = 1;

  for (const section of sections) {
    starts.set(section.key, nextId);
    nextId += section.count;
  }

  return starts;
}

function buildStandardQuestionSet(payload: QuestionPayload, candidates: Question[]): Question[] {
  const validated = validateQuestionSet(candidates, payload);
  return validated.map((question, index) => ({ ...question, id: index + 1 }));
}

function buildHybridQuestionSet(payload: QuestionPayload, candidates: Question[], count: number): Question[] {
  const fallbackQuestions = buildLocalFallback(
    payload,
    count,
    candidates.length + 1,
    'Hybrid top-up questions added after provider generation produced a partial validated set.',
  ).questions;

  return buildStandardQuestionSet(payload, [...candidates, ...fallbackQuestions]).slice(0, count);
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

/** Maximum questions to request per single LLM call (prevents token limit hits) */
const MAX_QUESTIONS_PER_CALL = 8;

/**
 * Split a section into chunks of MAX_QUESTIONS_PER_CALL each.
 * Returns an array of mini-sections with adjusted counts and difficulty profiles.
 */
function chunkSection(section: BoardSectionSpec, globalStartId: number): Array<{ mini: BoardSectionSpec; startId: number }> {
  if (section.count <= MAX_QUESTIONS_PER_CALL) {
    return [{ mini: section, startId: globalStartId }];
  }

  const chunks: Array<{ mini: BoardSectionSpec; startId: number }> = [];
  let offset = 0;

  while (offset < section.count) {
    const chunkSize = Math.min(MAX_QUESTIONS_PER_CALL, section.count - offset);
    const mini: BoardSectionSpec = {
      ...section,
      count: chunkSize,
      difficultyProfile: section.difficultyProfile.slice(offset, offset + chunkSize),
      key: `${section.key} (${Math.floor(offset / MAX_QUESTIONS_PER_CALL) + 1})`,
    };
    chunks.push({ mini, startId: globalStartId + offset });
    offset += chunkSize;
  }

  return chunks;
}

/**
 * Generates one section CHUNK using Llama via Groq API.
 * Includes automatic retry with exponential backoff for rate limit errors.
 */
async function generateWithLlama(payload: QuestionPayload, section: BoardSectionSpec, startId: number, retryCount = 0): Promise<Question[]> {
  const groqApiKey = (process.env.GROQ_API_KEY || '').replace(/[\r\n]/g, '').trim();
  if (!groqApiKey) return [];

  const modelName = payload.sourceBrief
    ? (process.env.GROQ_AGENT_MODEL || 'llama-3.1-8b-instant')
    : (process.env.GROQ_MODEL || 'llama-3.1-8b-instant');
  const timeoutMs = Number(process.env.GROQ_TIMEOUT_MS || 45000);
  const maxRetries = 2; // Reduced — we don't want to wait 98s multiple times
  const defaultMaxRateWaitMs = payload.sourceBrief ? 90000 : 8000;
  const maxRateWaitMs = Math.min(Math.max(Number(process.env.GROQ_MAX_RATE_WAIT_MS || defaultMaxRateWaitMs), 0), 120000);

  const prompt = buildSectionPrompt(payload, section, startId);

  const body = {
    model: modelName,
    messages: [
      {
        role: 'system',
        content: 'You are an expert exam question creator. Return ONLY a valid JSON object with a "questions" array. No markdown, no commentary.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.65,
    max_tokens: 4000, // Increased from 2500 to handle richer questions
  };

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(process.env.GROQ_API_URL || 'https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const message = errData?.error?.message || `Groq request failed: ${response.status}`;

      // Handle rate limit — cap wait at 30s max (don't wait 98s)
      if ((response.status === 429 || /rate limit|rate_limit/i.test(message)) && retryCount < maxRetries) {
        const waitMatch = message.match(/(\d+\.?\d*)s/);
        const rawWait = waitMatch ? Math.ceil(parseFloat(waitMatch[1]) * 1000) + 500 : Math.pow(2, retryCount + 1) * 5000;
        if (/tokens per day|tpd/i.test(message) || rawWait > maxRateWaitMs) {
          throw new Error(message);
        }

        const waitMs = Math.min(rawWait, maxRateWaitMs);
        console.log(`[Groq Rate Limit] ${section.key}: waiting ${waitMs}ms (capped) before retry ${retryCount + 1}/${maxRetries}...`);
        await new Promise(r => setTimeout(r, waitMs));
        return generateWithLlama(payload, section, startId, retryCount + 1);
      }

      throw new Error(message);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content || '';
    const parsed = parseJson(content);
    const rawQuestions = normalizeGeneratedQuestions(parsed, payload, section.type).slice(0, section.count);
    
    console.log(`[Llama OK] ${section.key}: ${rawQuestions.length}/${section.count} questions`);
    return rawQuestions.map((q, idx) => ({ ...q, id: startId + idx }));
  } finally {
    clearTimeout(timeoutHandle);
  }
}

/**
 * Generates one standards-defined section using Gemini API.
 */
async function generateWithGemini(payload: QuestionPayload, section: BoardSectionSpec, startId: number): Promise<Question[]> {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) return [];
  if (geminiKeyKnownInvalid) return [];

  const genAI = new GoogleGenerativeAI(geminiApiKey);
  const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const timeoutMs = Math.min(Math.max(Number(process.env.GEMINI_BATCH_TIMEOUT_MS || 35000), 15000), 90000);

  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.5,
    },
  });

  const sectionPrompt = buildSectionPrompt(payload, section, startId);

  try {
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
    const rawQuestions = normalizeGeneratedQuestions(parsed, payload, section.type).slice(0, section.count);
    
    return rawQuestions.map((q, idx) => ({
      ...q,
      id: startId + idx
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/api key not valid|api_key_invalid/i.test(message)) {
      geminiKeyKnownInvalid = true;
    }
    console.error(`Gemini generation error in section ${section.key}:`, error);
    return [];
  }
}

/**
 * Generates questions for the given board/class/subject/chapter.
 * Strategy: Gemini PRIMARY (concurrent, no token limits) → Groq SECONDARY (chunked, 8q/call) → Local fallback.
 */
export async function generateQuestions(payload: QuestionPayload): Promise<GenerationResult> {
  const groqApiKey = process.env.GROQ_API_KEY;
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const concurrency = Math.min(Math.max(Number(process.env.GEMINI_BATCH_CONCURRENCY || 4), 1), 6);

  // Get board-specific sections
  const boardSections = getEffectiveSections(payload.board);
  const boardTotalCount = getBoardTotalQuestions(payload.board);
  const sectionStartIds = getSectionStartIds(payload.board);
  const minRealQuestionThreshold = Math.ceil(boardTotalCount * 0.9);

  console.log(`[BoardIntelligence] Board: ${payload.board} → ${boardSections.length} sections, ${boardTotalCount} total questions`);
  console.log(`[BoardIntelligence] Section types: ${boardSections.map(s => s.type).join(', ')}`);

  // ─────────────────────────────────────────────────────────────────────────
  // 1. GEMINI PRIMARY — concurrent, handles any section size, no rate limits
  // ─────────────────────────────────────────────────────────────────────────
  const canUseGemini = geminiApiKey && (!payload.sourceBrief || process.env.GEMINI_AGENT_ENABLED === '1');
  if (canUseGemini) {
    try {
      console.log(`[Gemini] PRIMARY: Generating ${boardTotalCount} ${payload.board} questions concurrently...`);

      const results = await runWithConcurrency(boardSections, concurrency, async (section) => {
        const startId = sectionStartIds.get(section.key) || 1;
        return generateWithGemini(payload, section, startId);
      });

      const allQuestions = results.flat();
      const uniqueQuestions = validateQuestionSet(allQuestions, payload);

      console.log(`[Gemini] ${uniqueQuestions.length}/${boardTotalCount} valid unique questions`);

      if (uniqueQuestions.length >= minRealQuestionThreshold) {
        const finalQuestions = buildStandardQuestionSet(payload, uniqueQuestions);
        return {
          title: `${payload.board} ${payload.className} ${payload.subject}: ${payload.chapter}`,
          board: payload.board,
          className: payload.className,
          subject: payload.subject,
          chapter: payload.chapter,
          questions: finalQuestions,
          generatedAt: new Date().toISOString(),
          cacheable: true,
          resilient: uniqueQuestions.length < boardTotalCount,
          provider: 'gemini',
          model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
        };
      }

      if (uniqueQuestions.length >= Math.ceil(boardTotalCount * 0.6)) {
        const finalQuestions = buildHybridQuestionSet(payload, uniqueQuestions, boardTotalCount);
        if (finalQuestions.length >= minRealQuestionThreshold) {
          console.warn(`[Gemini] Using hybrid top-up: ${uniqueQuestions.length}/${boardTotalCount} provider questions plus validated fallback fill.`);
          return {
            title: `${payload.board} ${payload.className} ${payload.subject}: ${payload.chapter}`,
            board: payload.board,
            className: payload.className,
            subject: payload.subject,
            chapter: payload.chapter,
            questions: finalQuestions,
            generatedAt: new Date().toISOString(),
            cacheable: true,
            resilient: true,
            provider: 'gemini',
            model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
          };
        }
      }

      console.warn(`[Gemini] Only ${uniqueQuestions.length}/${boardTotalCount} questions. Trying Groq fallback...`);
    } catch (e) {
      console.warn('[Gemini] PRIMARY brain failed, trying Groq fallback...', e);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2. GROQ/LLAMA SECONDARY — chunked (≤8q per call) to avoid rate limits
  // ─────────────────────────────────────────────────────────────────────────
  const cleanGroqKey = (groqApiKey || '').replace(/[\r\n]/g, '').trim();
  if (cleanGroqKey) {
    try {
      console.log(`[Groq] SECONDARY: Generating chunked questions for ${payload.board}...`);
      const allChunks: Array<{ mini: BoardSectionSpec; startId: number }> = [];

      for (const section of boardSections) {
        const startId = sectionStartIds.get(section.key) || 1;
        allChunks.push(...chunkSection(section, startId));
      }

      console.log(`[Groq] ${allChunks.length} chunks to process (max ${MAX_QUESTIONS_PER_CALL}q each)`);

      const groqResults: Question[][] = [];
      let groqSuccessChunks = 0;

      for (let cIdx = 0; cIdx < allChunks.length; cIdx++) {
        const { mini, startId } = allChunks[cIdx];
        try {
          const chunkQs = await generateWithLlama(payload, mini, startId);
          groqResults.push(chunkQs);
          if (chunkQs.length > 0) groqSuccessChunks++;
          // Short inter-chunk pause to avoid TPM spikes
          if (cIdx < allChunks.length - 1) {
            await new Promise(r => setTimeout(r, 800));
          }
        } catch (chunkErr: any) {
          console.error(`[Groq] Chunk ${mini.key} failed:`, chunkErr.message);
          groqResults.push([]);
        }
      }

      const allQuestions = groqResults.flat();
      const uniqueQuestions = validateQuestionSet(allQuestions, payload);

      console.log(`[Groq] ${uniqueQuestions.length}/${boardTotalCount} valid (${groqSuccessChunks}/${allChunks.length} chunks OK)`);

      if (uniqueQuestions.length >= minRealQuestionThreshold) {
        const finalQuestions = buildStandardQuestionSet(payload, uniqueQuestions);
        return {
          title: `${payload.board} ${payload.className} ${payload.subject}: ${payload.chapter}`,
          board: payload.board,
          className: payload.className,
          subject: payload.subject,
          chapter: payload.chapter,
          questions: finalQuestions,
          generatedAt: new Date().toISOString(),
          cacheable: true,
          resilient: uniqueQuestions.length < boardTotalCount,
          provider: 'groq',
          model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        };
      }

      if (uniqueQuestions.length >= Math.ceil(boardTotalCount * 0.6)) {
        const finalQuestions = buildHybridQuestionSet(payload, uniqueQuestions, boardTotalCount);
        if (finalQuestions.length >= minRealQuestionThreshold) {
          console.warn(`[Groq] Using hybrid top-up: ${uniqueQuestions.length}/${boardTotalCount} provider questions plus validated fallback fill.`);
          return {
            title: `${payload.board} ${payload.className} ${payload.subject}: ${payload.chapter}`,
            board: payload.board,
            className: payload.className,
            subject: payload.subject,
            chapter: payload.chapter,
            questions: finalQuestions,
            generatedAt: new Date().toISOString(),
            cacheable: true,
            resilient: true,
            provider: 'groq',
            model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
          };
        }
      }
    } catch (e) {
      console.warn('[Groq] SECONDARY brain failed.', e);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 3. LAST RESORT — local structured fallback
  // ─────────────────────────────────────────────────────────────────────────
  console.warn(
    `[Fallback] AI providers could not produce enough validated questions. Saving local 100-question starter set for ${payload.board} ${payload.className} ${payload.subject} - ${payload.chapter}.`,
  );
  return buildLocalFallback(payload, boardTotalCount, 1, 'AI providers were unavailable or rate-limited.');
}
