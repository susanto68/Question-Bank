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
- Questions must be rich, academic, and match the official Board guidelines. Focus on practical exam-style application and real calculations instead of generic memorization definitions.
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
 * Rich Fallback question bank generator supporting all 10 sections A to J programmatically
 */
export function buildLocalFallback(payload: QuestionPayload, count = 100, startId = 1, reason = 'Fallback starter questions'): GenerationResult {
  const curatedKey = getCuratedChapterKey(payload.chapter);

  const questions = Array.from({ length: count }, (_, index) => {
    const totalIndex = startId + index - 1;
    const sectionIdx = Math.floor(totalIndex / 10) % SECTIONS.length;
    const section = SECTIONS[sectionIdx];
    const qInSecIdx = totalIndex % 10;
    
    // Check if we have premium custom curated question for this specific section type and slot
    if (curatedKey && CURATED_FALLBACK_DATABASE[curatedKey]?.[section.type]?.[qInSecIdx]) {
      const q = CURATED_FALLBACK_DATABASE[curatedKey][section.type][qInSecIdx];
      return {
        id: totalIndex + 1,
        type: section.type,
        difficulty: q.difficulty,
        bloom_level: q.bloom_level,
        concept_tag: q.concept_tag,
        learning_outcome: q.learning_outcome,
        question: q.question,
        options: q.options || [],
        answer: q.answer,
        explanation: q.explanation,
        marks: q.difficulty === 'Easy' ? 1 : q.difficulty === 'Medium' ? 2 : 4,
        estimated_time: q.difficulty === 'Easy' ? 60 : q.difficulty === 'Medium' ? 120 : 240,
        source: 'local-fallback'
      };
    }

    // Default programmatic generation
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

    const concept = `${payload.chapter} Core Concept ${qInSecIdx + 1}`;
    const base = `${payload.chapter} in ${payload.subject}`;

    let qText = `Describe the standard mathematical and physical principles of **${concept}** within **${base}** for ${payload.board} curriculum.`;
    let options: string[] = [];
    let answer = 'Concept-aligned solution.';
    let explanation = `This question evaluates the student's mastery, mathematical analysis, and practical reasoning of ${concept} in ${base}.`;

    if (section.type === 'MCQ') {
      qText = `Which of the following describes a key operational principle of **${concept}** inside **${base}**?`;
      options = [`Primary foundation of ${concept}`, `Secondary variable of ${base}`, `Unrelated constant`, `None of the above`];
      answer = `Primary foundation of ${concept}`;
    } else if (section.type === 'Assertion Reason') {
      qText = `Assertion: Understanding ${concept} is necessary before attempting advanced numerical equations.\n\nReason: It establishes the structural, causal relationships between variables.`;
      options = [
        'Both A and R are true, and R is the correct explanation of A',
        'Both A and R are true, but R is not the correct explanation of A',
        'A is true but R is false',
        'A is false but R is true'
      ];
      answer = 'Both A and R are true, and R is the correct explanation of A';
    } else if (section.type === 'True/False') {
      qText = `True or False: The application of **${concept}** directly reduces structural calculation error in **${base}**.`;
      options = ['True', 'False'];
      answer = 'True';
    } else if (section.type === 'Fill in the Blanks') {
      qText = `Inside ${payload.subject}, **${concept}** is defined as the ________ parameter governing this equation.`;
      options = [];
      answer = "principal";
    } else if (section.type === 'One Word') {
      qText = `What standard scientific term defines the structural core of **${concept}** in ${payload.subject}?`;
      options = [];
      answer = "Core";
    } else if (section.type === 'Full Forms') {
      qText = `What is the expanded scientific full-form representation of the common abbreviation **${payload.chapter.slice(0,3).toUpperCase()}-M**?`;
      options = [];
      answer = `${payload.chapter} Model`;
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
