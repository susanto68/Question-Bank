/**
 * Board Intelligence Engine
 *
 * Defines the ACTUAL exam pattern, question types, language style, and
 * prompt instructions for every supported board and competitive exam.
 *
 * This is the core of the board-specific question generation system.
 * Every board profile is researched based on actual exam patterns and PYQ trends.
 */

export type QuestionDifficulty = 'Easy' | 'Medium' | 'Hard';
export type BloomLevel = 'Remember' | 'Understand' | 'Apply' | 'Analyze' | 'Evaluate' | 'Create';

export interface BoardSectionSpec {
  key: string;
  type: string;
  name: string;
  count: number;
  marks: number; // marks per question
  difficultyProfile: QuestionDifficulty[];
  desc: string; // instruction for AI on how to write this type
}

export interface BoardProfile {
  id: string;
  fullName: string;
  examStyle: string;           // One-paragraph description of the real exam style
  languageStyle: string;       // How questions should be worded
  pyqTrends: string;           // Previous-year question trends
  markingScheme: string;       // Mark distribution note
  sections: BoardSectionSpec[];
  totalQuestions: number;
  specialInstructions: string; // Unique rules for this board only
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Generate difficulty profile for a section
// ─────────────────────────────────────────────────────────────────────────────
function diffProfile(
  count: number,
  easy: number,
  medium: number,
  _hard: number
): QuestionDifficulty[] {
  const profile: QuestionDifficulty[] = [];
  for (let i = 0; i < easy && profile.length < count; i++) profile.push('Easy');
  for (let i = 0; i < medium && profile.length < count; i++) profile.push('Medium');
  while (profile.length < count) profile.push('Hard');
  return profile;
}

const STANDARD_QUESTION_COUNT = 100;

function resizeDifficultyProfile(profile: QuestionDifficulty[], nextCount: number): QuestionDifficulty[] {
  if (profile.length === nextCount) {
    return profile;
  }

  const currentCount = Math.max(profile.length, 1);
  const easyCount = profile.filter((difficulty) => difficulty === 'Easy').length;
  const mediumCount = profile.filter((difficulty) => difficulty === 'Medium').length;
  const nextEasy = Math.round((easyCount / currentCount) * nextCount);
  const nextMedium = Math.round((mediumCount / currentCount) * nextCount);

  return diffProfile(nextCount, nextEasy, nextMedium, Math.max(nextCount - nextEasy - nextMedium, 0));
}

function scaleSectionsToCount(sections: BoardSectionSpec[], targetCount = STANDARD_QUESTION_COUNT): BoardSectionSpec[] {
  const currentCount = sections.reduce((sum, section) => sum + section.count, 0);

  if (!currentCount || currentCount === targetCount) {
    return sections;
  }

  const scaled = sections.map((section, index) => {
    const rawCount = (section.count / currentCount) * targetCount;
    return {
      index,
      fraction: rawCount - Math.floor(rawCount),
      count: Math.max(1, Math.floor(rawCount)),
    };
  });

  let remaining = targetCount - scaled.reduce((sum, section) => sum + section.count, 0);

  if (remaining > 0) {
    [...scaled]
      .sort((a, b) => b.fraction - a.fraction)
      .slice(0, remaining)
      .forEach((section) => {
        scaled[section.index].count += 1;
      });
  }

  while (remaining < 0) {
    const largest = [...scaled]
      .filter((section) => section.count > 1)
      .sort((a, b) => b.count - a.count)[0];

    if (!largest) {
      break;
    }

    scaled[largest.index].count -= 1;
    remaining += 1;
  }

  return sections.map((section, index) => {
    const count = scaled[index].count;
    return {
      ...section,
      count,
      difficultyProfile: resizeDifficultyProfile(section.difficultyProfile, count),
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// BOARD PROFILES
// ─────────────────────────────────────────────────────────────────────────────

const BOARD_PROFILES: Record<string, BoardProfile> = {

  // ───────────────────────── ICSE ─────────────────────────
  icse: {
    id: 'icse',
    fullName: 'Indian Certificate of Secondary Education (ICSE)',
    examStyle: `ICSE examinations are conducted by the Council for the Indian School Certificate Examinations (CISCE). 
Questions are formal, precise, and test deep conceptual understanding. For Computer Applications, questions focus on Java 
programming — output tracing, writing code, identifying errors, and short definitions. For Science subjects, questions 
include structured answers, diagrams, and definitions. ICSE language is formal British English with precise scientific terminology.`,
    languageStyle: `Formal British English. Use precise, unambiguous phrasing. 
Questions should use directive verbs like "State", "Define", "Explain", "Write a program", "Trace the output", "Distinguish between". 
Avoid casual phrasing. For Computer Applications use Java terminology exclusively.`,
    pyqTrends: `Computer Applications: Program output tracing (5-6 marks), write a method/class (10 marks), 
fill blanks with Java keywords, definitions of OOP concepts, error identification. 
Science: Diagram-based, difference/comparison tables, cause-effect questions. 
Mathematics: Step-by-step proofs, construction, application problems.`,
    markingScheme: `1-mark: Definition/one-word/fill blank. 2-marks: Short explanation or code snippet. 
4-marks: Short program or structured answer. 6-marks: Long program or essay answer.`,
    sections: [
      {
        key: 'Section A', type: 'MCQ', name: 'Multiple Choice Questions',
        count: 10, marks: 1,
        difficultyProfile: diffProfile(10, 4, 4, 2),
        desc: `Generate ICSE-style single-select MCQs. For Computer Applications: test Java syntax, OOP concepts, 
output prediction. For other subjects: test definitions, concepts, and applications. 
Provide exactly 4 options. No "All of the above" or "None of the above". 
Options must be plausible and domain-specific. Use formal ICSE language.`,
      },
      {
        key: 'Section B', type: 'Fill in the Blanks', name: 'Fill in the Blanks',
        count: 10, marks: 1,
        difficultyProfile: diffProfile(10, 4, 4, 2),
        desc: `Each statement must contain exactly one blank written as "________". 
Test specific Java keywords, class names, method names, or conceptual terms. 
The blank must be a precise technical term, not a vague phrase.`,
      },
      {
        key: 'Section C', type: 'Output Question', name: 'Output/Trace Questions',
        count: 8, marks: 2,
        difficultyProfile: diffProfile(8, 2, 4, 2),
        desc: `Write actual Java code snippets and ask students to predict the exact output. 
Each snippet should be 4–10 lines. Test: loops (for/while/do-while), conditional logic (if-else, switch), 
recursion, string operations, type casting. Output must be deterministic. 
Format: "What will be the output of the following Java code?" then provide the code block.
For non-CS subjects: trace a chemical reaction, biological process, or mathematical sequence step by step.`,
      },
      {
        key: 'Section D', type: 'Definition', name: 'Definitions and Concepts',
        count: 10, marks: 2,
        difficultyProfile: diffProfile(10, 3, 5, 2),
        desc: `Ask to "Define", "State", "Explain", or "Distinguish between" ICSE syllabus terms. 
Answers should be 2–4 sentences. For Computer Applications: define OOP terms like encapsulation, 
polymorphism, constructor, method overloading, etc. For other subjects: define chapter-specific terms 
with examples where relevant.`,
      },
      {
        key: 'Section E', type: 'Short Answer', name: 'Short Answer Questions',
        count: 12, marks: 3,
        difficultyProfile: diffProfile(12, 3, 5, 4),
        desc: `ICSE-style short answer questions. Answer length: 3–5 sentences or a small code block (6–8 lines). 
For Computer Applications: write a small method, explain a concept with an example, or identify and correct an error. 
For Science: structured answers with sub-parts. Use directive verbs: "Write a program segment", "Explain with an example".`,
      },
      {
        key: 'Section F', type: 'Long Answer', name: 'Long Answer Questions',
        count: 10, marks: 5,
        difficultyProfile: diffProfile(10, 2, 4, 4),
        desc: `ICSE long-answer questions. Answer must be 5–8 sentences or a complete Java program (10–20 lines). 
For Computer Applications: write a complete class or method with proper OOP principles. 
For Science: detailed explanations with diagrams described in text, experiments, comparisons. 
Answers must be structured and comprehensive as expected in actual ICSE board exams.`,
      },
    ],
    totalQuestions: 60,
    specialInstructions: `For Computer Applications (Java): ALWAYS include actual Java code in Output Questions 
and program-writing questions. Use proper Java syntax: public static void main, System.out.println, 
class definitions, constructors, method declarations. Never use pseudo-code for Java questions.
For ISC level (Classes 11-12): increase complexity with interfaces, abstract classes, exception handling, file I/O.`,
  },

  // ───────────────────────── ISC ─────────────────────────
  isc: {
    id: 'isc',
    fullName: 'Indian School Certificate (ISC) Class 11-12',
    examStyle: `ISC is the Class 11-12 level examination by CISCE. It is significantly more advanced than ICSE. 
Computer Science includes Java with advanced topics: abstract classes, interfaces, exception handling, file I/O, 
data structures (linked lists, stacks, queues, trees). Theory section covers networking, Boolean algebra, OS concepts. 
Science subjects cover advanced NCERT-plus content with analytical and application-level questions.`,
    languageStyle: `Advanced formal English. Questions use analytical language: "Analyze", "Justify", "Critically evaluate", 
"With the help of a program illustrate". For Computer Science: advanced Java OOP and data structure terminology.`,
    pyqTrends: `Computer Science: Boolean algebra (simplification, logic gates), networking (OSI model, protocols), 
OOP theory, Java programs involving user-defined data structures. 
Physics/Chemistry/Math: derivations, numerical problems, analytical reasoning.`,
    markingScheme: `1-mark: Fill blank or MCQ. 2-marks: Short definition or code snippet. 
4-marks: Short program or structured explanation. 6–10 marks: Complete program with class definition or detailed essay.`,
    sections: [
      {
        key: 'Section A', type: 'MCQ', name: 'Multiple Choice Questions',
        count: 10, marks: 1,
        difficultyProfile: diffProfile(10, 3, 4, 3),
        desc: `ISC-level MCQs testing advanced concepts: Boolean algebra, logic gates, Java advanced OOP, 
networking protocols, data structures. Options must be technically precise with subtle distinctions. 
No trivial questions.`,
      },
      {
        key: 'Section B', type: 'Fill in the Blanks', name: 'Fill in the Blanks',
        count: 8, marks: 1,
        difficultyProfile: diffProfile(8, 2, 4, 2),
        desc: `Fill blanks with precise ISC-level technical terms: Java keywords, Boolean expressions, 
network terms, OS terms. Each blank tests a specific technical concept.`,
      },
      {
        key: 'Section C', type: 'Output Question', name: 'Output/Trace Questions',
        count: 8, marks: 2,
        difficultyProfile: diffProfile(8, 2, 3, 3),
        desc: `Advanced Java code tracing. Include programs with: inheritance, method overriding, 
interface implementation, exception handling, recursion, string manipulation. 
Output must be exact and require careful tracing. Provide the complete code snippet.`,
      },
      {
        key: 'Section D', type: 'Theory Question', name: 'Theory Questions',
        count: 10, marks: 3,
        difficultyProfile: diffProfile(10, 2, 5, 3),
        desc: `ISC theory questions: Boolean algebra simplification, logic gate diagrams described in text, 
OSI model layers, data communication concepts, OOP principles with examples. 
Answers must be 3–5 sentences with technical depth expected at ISC level.`,
      },
      {
        key: 'Section E', type: 'Short Answer', name: 'Short Answer / Program Segment',
        count: 12, marks: 4,
        difficultyProfile: diffProfile(12, 2, 5, 5),
        desc: `ISC-style short programs or analytical answers. Write a Java method/class segment for: 
sorting algorithms, searching, string processing, user-defined data structures. 
Include proper Java syntax with constructors, member functions, access specifiers.`,
      },
      {
        key: 'Section F', type: 'Long Answer', name: 'Long Answer / Full Programs',
        count: 12, marks: 6,
        difficultyProfile: diffProfile(12, 1, 4, 7),
        desc: `Complete ISC-level programs: implement a linked list, stack, queue, binary tree using classes. 
Include class design, constructor, push/pop/insert/delete methods. 
For other subjects: detailed derivations, experiment descriptions, analytical essays. 
Answers: 6–10 sentences or 15–25 lines of Java code.`,
      },
    ],
    totalQuestions: 60,
    specialInstructions: `ISC Computer Science MUST include Boolean algebra questions with truth tables, 
Karnaugh maps (K-maps), and logic gate representations. 
Networking questions should reference the OSI model, TCP/IP, HTTP, DNS, routers, switches.
Java programs must use advanced OOP: abstract classes, interfaces, checked/unchecked exceptions.`,
  },

  // ───────────────────────── CBSE ─────────────────────────
  cbse: {
    id: 'cbse',
    fullName: 'Central Board of Secondary Education (CBSE)',
    examStyle: `CBSE follows NCERT textbooks and has adopted Competency-Based Education (CBE) since 2021. 
The exam heavily features MCQs (Section A), Assertion-Reason questions, Case Study/Passage-Based Questions (CBQ), 
and structured answer questions. Questions test real-life application of concepts rather than rote memory. 
CBSE language is based directly on NCERT textbook terminology and examples.`,
    languageStyle: `NCERT-aligned language. Use exactly the same terminology as NCERT textbooks. 
MCQs must be competency-based (application, not memory). Assertion-Reason uses standard CBSE format. 
Case Studies must describe a real-life scenario then ask 4–5 questions on it.`,
    pyqTrends: `Class 10 Science: Life Processes (diagrams, function-based MCQs), Chemical Reactions (equation balancing), 
Electricity (numerical, circuit-based). Class 10 Math: Real Numbers, Polynomials, Quadratic Equations (application problems). 
Class 12 Physics: Electrostatics (numericals), Wave Optics (derivations), Modern Physics (MCQs). 
Always include 1–2 assertion-reason questions per major topic.`,
    markingScheme: `1-mark: MCQ / Assertion-Reason / Very Short Answer. 
2-marks: Short Answer (SA-I). 3-marks: Short Answer (SA-II). 5-marks: Long Answer. Case Study: 4–5 marks per passage.`,
    sections: [
      {
        key: 'Section A', type: 'MCQ', name: 'Multiple Choice Questions (Competency-Based)',
        count: 18, marks: 1,
        difficultyProfile: diffProfile(18, 6, 8, 4),
        desc: `CBSE competency-based MCQs. Do NOT test pure recall. Test application, analysis, and real-life connection. 
Questions should describe a scenario or give data, then ask what concept applies or what the outcome is. 
Use NCERT language and examples. Exactly 4 options, one correct. No "all/none of the above".`,
      },
      {
        key: 'Section B', type: 'Assertion Reason', name: 'Assertion and Reason Questions',
        count: 10, marks: 1,
        difficultyProfile: diffProfile(10, 3, 5, 2),
        desc: `Standard CBSE Assertion-Reason format. Write as:
"Assertion (A): [statement]
Reason (R): [statement]"
Options must always be:
(a) Both A and R are true and R is the correct explanation of A.
(b) Both A and R are true but R is not the correct explanation of A.
(c) A is true but R is false.
(d) A is false but R is true.
Test conceptual understanding — avoid trivial assertions.`,
      },
      {
        key: 'Section C', type: 'Case Study', name: 'Case Study / Source-Based Questions',
        count: 6, marks: 4,
        difficultyProfile: diffProfile(6, 1, 3, 2),
        desc: `CBSE Case Study format. Each question provides a 4–6 line real-life passage or scenario, 
then asks 4 sub-questions (3 MCQ + 1 short answer OR 4 MCQs). 
The passage should relate to the chapter topic with a practical application. 
Format: "Read the following passage and answer the questions that follow: [passage]"
Then list 4 numbered sub-questions based only on the passage content.`,
      },
      {
        key: 'Section D', type: 'Very Short Answer', name: 'Very Short Answer (VSA)',
        count: 10, marks: 2,
        difficultyProfile: diffProfile(10, 3, 5, 2),
        desc: `CBSE VSA questions. Answer in 2–3 sentences or one formula/equation. 
Use NCERT chapter headings and terminology. 
Examples: "What is meant by...", "State the law of...", "Define...", "Name the process by which...".`,
      },
      {
        key: 'Section E', type: 'Short Answer', name: 'Short Answer Questions (SA)',
        count: 10, marks: 3,
        difficultyProfile: diffProfile(10, 2, 5, 3),
        desc: `CBSE Short Answer (3-mark) questions. Answer in 4–6 sentences. 
Include one diagram description where appropriate. Test application of NCERT concepts. 
Examples: "Explain the working of...", "Derive the expression for...", "Differentiate between... and...".`,
      },
      {
        key: 'Section F', type: 'Long Answer', name: 'Long Answer Questions (LA)',
        count: 6, marks: 5,
        difficultyProfile: diffProfile(6, 0, 2, 4),
        desc: `CBSE Long Answer (5-mark) questions. Answer in 6–10 sentences. 
Include step-by-step derivation/experiment/process description as expected in CBSE board exam. 
Often structured as: "With the help of a diagram, describe...", "Derive the expression for...", 
"A student performed an experiment... What observations did they make?".`,
      },
    ],
    totalQuestions: 60,
    specialInstructions: `ALL questions must align with NCERT textbook content for the specified class. 
For Science: refer to NCERT chapter terms, diagrams, and examples directly. 
For Math: include numerical problems with complete step-by-step solution in the answer. 
Never use content beyond the NCERT syllabus for that class level.`,
  },

  // ───────────────────────── STATE BOARDS (Generic) ─────────────────────────
  'state-boards': {
    id: 'state-boards',
    fullName: 'State Board Examinations',
    examStyle: `State board examinations follow their respective state textbooks. Questions are generally 
more straightforward than CBSE/ICSE but cover the full syllabus. The pattern typically includes 
1-mark (objective), 2-mark (short), 4-mark (medium), and 6-mark (long) questions. 
Language is simpler and directly from the state textbook.`,
    languageStyle: `Clear, direct, state-textbook language. Questions should be accessible but thorough. 
Use simple directive verbs: "Write", "Explain", "Describe", "Draw and label", "Give two examples of".`,
    pyqTrends: `Chapters with maximum weightage appear repeatedly: 
For Science — Chemical Reactions, Life Processes, Electricity, Carbon compounds. 
For Social Science — Political Science (democracy, elections), History (Independence movement). 
For Math — Triangles, Circles, Arithmetic Progressions.`,
    markingScheme: `1-mark: MCQ or fill blank. 2-marks: definition or short answer. 
4-marks: structured medium answer. 6-marks: detailed long answer with diagram.`,
    sections: [
      {
        key: 'Section A', type: 'MCQ', name: 'Objective Type Questions',
        count: 15, marks: 1,
        difficultyProfile: diffProfile(15, 6, 6, 3),
        desc: `State board MCQs. Test chapter definitions, facts, formulas, and basic applications. 
Exactly 4 options. No "all/none of the above". Questions should be accessible to average students 
but include 3 hard questions testing deeper understanding.`,
      },
      {
        key: 'Section B', type: 'Fill in the Blanks', name: 'Fill in the Blanks',
        count: 10, marks: 1,
        difficultyProfile: diffProfile(10, 4, 4, 2),
        desc: `State board fill-in-the-blank sentences. Each sentence has exactly one blank "________". 
Test key terms, formulas, laws, and definitions from the chapter. 
Blanks should be specific and have only one correct answer.`,
      },
      {
        key: 'Section C', type: 'Very Short Answer', name: 'Very Short Answer (1-2 marks)',
        count: 10, marks: 2,
        difficultyProfile: diffProfile(10, 4, 4, 2),
        desc: `State board very short answers. Answer in 1–2 sentences. 
Tests definitions, differences, advantages, disadvantages, examples. 
Questions: "What is...?", "Name the...", "Give one difference between...", "State the law of...".`,
      },
      {
        key: 'Section D', type: 'Short Answer', name: 'Short Answer Questions (2-4 marks)',
        count: 12, marks: 3,
        difficultyProfile: diffProfile(12, 3, 6, 3),
        desc: `State board short answer questions (3-4 marks). Answer in 3–5 sentences. 
Tests explanation of concepts, processes, and basic applications. 
Include examples and simple diagrams described in text where appropriate.`,
      },
      {
        key: 'Section E', type: 'Medium Answer', name: 'Medium Answer Questions (4-5 marks)',
        count: 8, marks: 4,
        difficultyProfile: diffProfile(8, 2, 4, 2),
        desc: `State board medium answer questions (4-5 marks). Answer in 5–7 sentences. 
Tests complete explanation of processes, experiments, chapter themes, and comparisons. 
Include diagram notes where relevant.`,
      },
      {
        key: 'Section F', type: 'Long Answer', name: 'Long Answer Questions (6 marks)',
        count: 5, marks: 6,
        difficultyProfile: diffProfile(5, 0, 2, 3),
        desc: `State board long answer questions (6 marks). Answer in 7–10 sentences. 
Tests complete explanation of major chapter concepts with examples, diagrams, and cause-effect analysis. 
These are the highest-marks questions and should test comprehensive chapter knowledge.`,
      },
    ],
    totalQuestions: 60,
    specialInstructions: `Questions must follow the state board syllabus which may differ from NCERT. 
State boards like UP Board, Bihar Board, and MP Board often have slightly older-style questions 
with more emphasis on rote definitions. West Bengal Board emphasizes grammar and comprehension for English. 
Jharkhand Board and Bihar Board questions often appear in both English and Hindi — generate English only.`,
  },

  // ─────────────────────── JHARKHAND BOARD ──────────────────────
  jharkhand: {
    id: 'jharkhand',
    fullName: 'Jharkhand Academic Council (JAC) Board',
    examStyle: `JAC Board examinations follow JAC-prescribed textbooks for Jharkhand state. 
The exam pattern includes objective questions (1 mark each), short answer (2 marks), medium answer (4 marks), 
and long answer (6 marks). Questions are directly based on JAC textbooks. Local Jharkhand history, 
geography, and current affairs are important for Social Science. 
Science and Math follow NCERT with state adaptations.`,
    languageStyle: `Simple, direct, accessible language. Questions must be answerable from JAC textbooks. 
Use standard Hindi-influenced English phrasing common in Jharkhand state board exams.`,
    pyqTrends: `JAC Board frequently tests: Jharkhand tribal culture and history (for Social Science), 
mineral resources of Jharkhand, local river systems. Math focuses on Algebra, Geometry, Statistics. 
Science follows NCERT pattern closely.`,
    markingScheme: `1-mark: MCQ/True-False/Fill blank. 2-marks: VSA. 4-marks: Short Answer. 6-marks: Long Answer.`,
    sections: [
      {
        key: 'Section A', type: 'MCQ', name: 'Objective Questions (MCQ)',
        count: 15, marks: 1,
        difficultyProfile: diffProfile(15, 7, 6, 2),
        desc: `JAC Board objective MCQs. Test factual knowledge from the chapter. 
Include questions about Jharkhand-specific content where relevant (geography, history, culture). 
4 options, one correct, straightforward language.`,
      },
      {
        key: 'Section B', type: 'True False', name: 'True / False Questions',
        count: 8, marks: 1,
        difficultyProfile: diffProfile(8, 3, 3, 2),
        desc: `True or False statements testing key facts from the chapter. 
Each statement must be unambiguously true or false. 
Include the correct answer (True/False) and a brief explanation.`,
      },
      {
        key: 'Section C', type: 'Fill in the Blanks', name: 'Fill in the Blanks',
        count: 8, marks: 1,
        difficultyProfile: diffProfile(8, 4, 3, 1),
        desc: `Fill in the blank sentences with one blank "________" each. 
Test specific chapter terms, dates, names, formulas.`,
      },
      {
        key: 'Section D', type: 'Very Short Answer', name: 'Very Short Answer',
        count: 10, marks: 2,
        difficultyProfile: diffProfile(10, 4, 4, 2),
        desc: `Answer in 1–2 sentences. Tests definitions and basic facts from JAC textbooks.`,
      },
      {
        key: 'Section E', type: 'Short Answer', name: 'Short Answer Questions',
        count: 10, marks: 4,
        difficultyProfile: diffProfile(10, 2, 5, 3),
        desc: `Answer in 4–6 sentences. Explain concepts, processes, and applications from the JAC syllabus.`,
      },
      {
        key: 'Section F', type: 'Long Answer', name: 'Long Answer Questions',
        count: 9, marks: 6,
        difficultyProfile: diffProfile(9, 1, 3, 5),
        desc: `Answer in 7–10 sentences. Detailed explanation of major chapter themes. 
For Jharkhand Social Science, include Jharkhand-specific examples.`,
      },
    ],
    totalQuestions: 60,
    specialInstructions: `For Social Science: always include at least 2 Jharkhand-specific questions 
(tribal culture, Jharkhand history, local geography, mineral wealth). 
JAC Board exams have questions in both English and Hindi — generate English only but use simple vocabulary.`,
  },

  // ─────────────────────── BIHAR BOARD ──────────────────────
  bihar: {
    id: 'bihar',
    fullName: 'Bihar School Examination Board (BSEB)',
    examStyle: `BSEB conducts Matric (Class 10) and Intermediate (Class 12) exams. 
The pattern includes 50% objective (MCQ, True/False, Fill blank) and 50% subjective (short, long answers). 
Since 2015, BSEB has moved towards objective-heavy patterns. Bihar Board exams test direct recall from 
BSEB-prescribed textbooks. Science and Math include numericals. 
Social Science emphasizes Bihar's history and geography.`,
    languageStyle: `Simple, direct Hindi-influenced English. Questions test recall and basic understanding. 
Avoid complex vocabulary. Use simple sentence structures.`,
    pyqTrends: `Bihar Board Class 10: Science — Chemical Reactions, Electricity, Human Eye. 
Social Science — French Revolution, Nationalism, Democracy. Math — Real Numbers, Polynomials, Statistics. 
Class 12: Physics — Ray Optics, Electrostatics. Chemistry — Electrochemistry, Surface Chemistry.`,
    markingScheme: `1-mark: Objective (MCQ/fill/true-false). 2-marks: VSA. 4-marks: Short. 6-marks: Long.`,
    sections: [
      {
        key: 'Section A', type: 'MCQ', name: 'Multiple Choice Questions',
        count: 20, marks: 1,
        difficultyProfile: diffProfile(20, 10, 7, 3),
        desc: `BSEB MCQs. Direct recall from textbook. Simple language. 4 options.
Test definitions, formulas, names, dates, processes. No tricky questions — straightforward recall.`,
      },
      {
        key: 'Section B', type: 'Fill in the Blanks', name: 'Fill in the Blanks',
        count: 10, marks: 1,
        difficultyProfile: diffProfile(10, 5, 4, 1),
        desc: `Fill blanks with key terms from the chapter. One blank per sentence "________". Simple vocabulary.`,
      },
      {
        key: 'Section C', type: 'Very Short Answer', name: 'Very Short Answer',
        count: 10, marks: 2,
        difficultyProfile: diffProfile(10, 5, 4, 1),
        desc: `Answer in 1–2 short sentences. Tests basic definitions, differences, examples from the chapter.`,
      },
      {
        key: 'Section D', type: 'Short Answer', name: 'Short Answer Questions',
        count: 10, marks: 4,
        difficultyProfile: diffProfile(10, 3, 5, 2),
        desc: `Answer in 4–6 sentences. Explain chapter concepts, causes, effects, and processes from BSEB syllabus.`,
      },
      {
        key: 'Section E', type: 'Long Answer', name: 'Long Answer Questions',
        count: 10, marks: 6,
        difficultyProfile: diffProfile(10, 1, 4, 5),
        desc: `Answer in 7–10 sentences. Detailed explanation of major chapter themes. 
Include Bihar-specific examples for Social Science. Include numericals with solutions for Math/Science.`,
      },
    ],
    totalQuestions: 60,
    specialInstructions: `For Social Science: include Bihar geography, history of Bihar's role in Independence movement, 
Nalanda, Pataliputra, and other Bihar-specific historical references. 
For Math and Science: include numerical problems with step-by-step solutions.`,
  },

  // ─────────────────────── UP BOARD ──────────────────────
  'up-board': {
    id: 'up-board',
    fullName: 'Uttar Pradesh Madhyamik Shiksha Parishad (UP Board)',
    examStyle: `UP Board is one of the largest examination boards in India. The exam follows UP Board textbooks 
(which are aligned with NCERT but have UP-specific content). The pattern has evolved to include 
both objective (30%) and subjective (70%) questions. Questions are straightforward with heavy emphasis 
on direct definitions, processes, and formulas from textbooks. UP Board exams carry historical Hindi-medium 
influence even in English-medium schools.`,
    languageStyle: `Simple, clear English. Avoid complex phrasing. Questions use basic directive verbs: 
"Write", "Describe", "Define", "State", "Explain". Students answer from direct textbook content.`,
    pyqTrends: `Science: Chemical reactions, Human systems, Light. Social Science: UP history, 
Indian Independence. Math: Triangles (proof-based), Circle theorems, Linear Equations. 
Hindi: Grammar (Sandhi, Samas), Comprehension. Sanskrit: Translation, Grammar.`,
    markingScheme: `1-mark: Objective. 2-marks: Short (definition/process). 5-marks: Essay/detailed answer.`,
    sections: [
      {
        key: 'Section A', type: 'MCQ', name: 'Objective Questions',
        count: 20, marks: 1,
        difficultyProfile: diffProfile(20, 10, 7, 3),
        desc: `UP Board objective MCQs. Simple recall from textbook. 4 options, one correct. 
Test chapter vocabulary, key terms, formulas, dates.`,
      },
      {
        key: 'Section B', type: 'Fill in the Blanks', name: 'Fill in the Blanks',
        count: 10, marks: 1,
        difficultyProfile: diffProfile(10, 5, 3, 2),
        desc: `One blank "________" per sentence. Test chapter-specific terms. Simple vocabulary.`,
      },
      {
        key: 'Section C', type: 'Short Answer', name: 'Short Answer Questions',
        count: 15, marks: 2,
        difficultyProfile: diffProfile(15, 5, 7, 3),
        desc: `Answer in 2–4 sentences. Tests definitions, differences, and brief explanations from the chapter.`,
      },
      {
        key: 'Section D', type: 'Long Answer', name: 'Long Answer Questions',
        count: 15, marks: 5,
        difficultyProfile: diffProfile(15, 2, 6, 7),
        desc: `Answer in 6–10 sentences. Detailed explanation including examples, diagrams (described), 
causes-effects. Test chapter's major themes as they appear in UP Board exams.`,
      },
    ],
    totalQuestions: 60,
    specialInstructions: `Include UP-specific content for Social Science: Ganga plains, 
Agra, Varanasi, Lucknow, UP's agricultural economy. 
For Math: include proof-based geometry questions (triangle similarity, circle theorems) 
as UP Board heavily tests these. Include "Prove that..." questions.`,
  },

  // ─────────────────────── WEST BENGAL BOARD ──────────────────────
  'wb-board': {
    id: 'wb-board',
    fullName: 'West Bengal Board of Secondary Education (WBBSE/WBCHSE)',
    examStyle: `West Bengal Board (Madhyamik for Class 10, HS for Class 11-12) has a distinctive pattern. 
Questions test both conceptual understanding and application. The exam includes MCQs, fill blanks, 
short answers, and long answers. Bengali literature and grammar are important for the Bengali medium, 
but English medium questions are in formal English. WB Board has strong emphasis on Mathematics proofs 
and Science experiments.`,
    languageStyle: `Formal, precise English. WB Board English questions use sophisticated vocabulary. 
Science and Math questions are analytical. Grammar questions test active/passive voice, narration, and synonyms.`,
    pyqTrends: `Madhyamik (Class 10): Life Science — Nervous system, Genetics. Physical Science — 
Electricity, Periodic table. Math — Quadratic equations, Trigonometry, Statistics. 
HS (Class 12): Physics — Electromagnetic induction. Chemistry — Coordination compounds.`,
    markingScheme: `1-mark: MCQ/fill/matching. 2-marks: VSA. 3-marks: Short Answer. 5-marks: Long Answer.`,
    sections: [
      {
        key: 'Section A', type: 'MCQ', name: 'Multiple Choice Questions',
        count: 15, marks: 1,
        difficultyProfile: diffProfile(15, 5, 7, 3),
        desc: `WB Board MCQs. Test conceptual understanding, not just recall. 4 options. 
Include application-based questions typical of Madhyamik and HS exams.`,
      },
      {
        key: 'Section B', type: 'Fill in the Blanks', name: 'Fill in the Blanks',
        count: 8, marks: 1,
        difficultyProfile: diffProfile(8, 3, 3, 2),
        desc: `One blank "________" per statement. Test chapter-specific scientific or mathematical terms.`,
      },
      {
        key: 'Section C', type: 'Match the Following', name: 'Match the Following',
        count: 5, marks: 1,
        difficultyProfile: diffProfile(5, 2, 2, 1),
        desc: `Match the Following format. Column A: 5 items. Column B: 5 matching items.
Format the question as:
"Match the items in Column A with Column B:
Column A: [1. ... 2. ... 3. ... 4. ... 5. ...]
Column B: [a. ... b. ... c. ... d. ... e. ...]"
Answer: complete matching with explanation.`,
      },
      {
        key: 'Section D', type: 'Very Short Answer', name: 'Very Short Answer',
        count: 10, marks: 2,
        difficultyProfile: diffProfile(10, 4, 4, 2),
        desc: `Answer in 1–2 sentences. WB Board VSA tests specific factual recall with slight conceptual depth.`,
      },
      {
        key: 'Section E', type: 'Short Answer', name: 'Short Answer Questions',
        count: 12, marks: 3,
        difficultyProfile: diffProfile(12, 3, 6, 3),
        desc: `Answer in 3–5 sentences. WB Board short answers require precise scientific/mathematical explanations.`,
      },
      {
        key: 'Section F', type: 'Long Answer', name: 'Long Answer Questions',
        count: 10, marks: 5,
        difficultyProfile: diffProfile(10, 1, 4, 5),
        desc: `Answer in 6–8 sentences. Detailed explanation as expected in WB Board Madhyamik/HS exams. 
Include experiment descriptions, diagram references, and comprehensive analysis.`,
      },
    ],
    totalQuestions: 60,
    specialInstructions: `WB Board places high importance on life science (genetics, evolution, environment) 
for Class 10. For Class 12, Physical Chemistry and Wave Physics are heavily tested. 
Include WB-specific geography: Sundarban, Himalayan foothills, Damodar Valley for Social Science.`,
  },

  // ─────────────────────── UPSC ──────────────────────
  upsc: {
    id: 'upsc',
    fullName: 'Union Public Service Commission (UPSC) Civil Services',
    examStyle: `UPSC Prelims consists entirely of MCQs (100 questions, 2 marks each, -0.66 for wrong). 
Questions are analytical, multi-concept, and current-affairs linked. UPSC never asks direct definitions — 
instead they ask about applications, implications, comparisons, and multi-statement analysis. 
The "which of the following statements is/are correct?" format is extremely common. 
UPSC Mains requires analytical essays and precise answer writing.`,
    languageStyle: `Official UPSC language. Formal, analytical. 
Common formats: "Consider the following statements about X: 1. ... 2. ... 3. ... Which of the above is/are correct?"
"With reference to X, which of the following is/are correct?"
"Arrange the following in chronological order: 1... 2... 3..."
"Consider the following pairs: ... Which of the above pairs is/are correctly matched?"`,
    pyqTrends: `Polity: Constitutional provisions, Fundamental Rights nuances, Parliament procedures, Judiciary. 
History: Freedom struggle leaders, events, dates (chronological ordering). 
Geography: Rivers, mountains, national parks, biodiversity hotspots. 
Economy: Budget terms, banking, inflation, fiscal policy. 
Environment: Climate treaties, endangered species, protected areas.`,
    markingScheme: `Prelims: 2 marks for correct, -0.66 for wrong. 
Mains: 10-mark (150 words), 15-mark (250 words) answers required.`,
    sections: [
      {
        key: 'Section A', type: 'UPSC MCQ', name: 'Statement-Based MCQs (UPSC Pattern)',
        count: 40, marks: 2,
        difficultyProfile: diffProfile(40, 8, 20, 12),
        desc: `Generate UPSC Prelims-style MCQs. MANDATORY formats:
TYPE 1 — Statement-based: "Consider the following statements: 1.[statement] 2.[statement] 3.[statement] 
Which of the statements given above is/are correct? (a) 1 only (b) 1 and 2 only (c) 2 and 3 only (d) 1, 2 and 3"
TYPE 2 — With reference to: "With reference to [topic], which of the following is/are correct? [4 options]"
TYPE 3 — Chronological: "Arrange the following events in chronological order: [list] — (a)1-2-3 (b)2-1-3 (c)3-1-2 (d)1-3-2"
TYPE 4 — Pair matching: "Consider the following pairs: [col A : col B] Which of the above pairs is/are correctly matched?"
Rotate between all 4 types. Make options with "only", "and", number combos like real UPSC.`,
      },
      {
        key: 'Section B', type: 'Multi-Concept MCQ', name: 'Multi-Concept Analytical MCQs',
        count: 25, marks: 2,
        difficultyProfile: diffProfile(25, 3, 12, 10),
        desc: `UPSC-style multi-concept MCQs linking two or more topics from the chapter. 
Example: "Which of the following is NOT a consequence of [process]?" or 
"[Scenario] — In light of this, which action would be most appropriate?" 
Include current-affairs-linked questions where chapter topics intersect with national/international events.`,
      },
      {
        key: 'Section C', type: 'Short Answer', name: 'UPSC Mains Short Answer (10 marks)',
        count: 20, marks: 10,
        difficultyProfile: diffProfile(20, 2, 10, 8),
        desc: `UPSC Mains-style analytical short answers (answer in 150 words = 6–8 sentences). 
Questions begin with: "Discuss", "Critically examine", "Comment on", "Analyze the role of", 
"Highlight the significance of", "Trace the evolution of". 
Answers must be analytical, multi-dimensional, with examples and balanced perspectives.`,
      },
      {
        key: 'Section D', type: 'Long Answer', name: 'UPSC Mains Long Answer (15 marks)',
        count: 15, marks: 15,
        difficultyProfile: diffProfile(15, 0, 5, 10),
        desc: `UPSC Mains 15-mark questions (answer in 250 words = 10 sentences). 
Questions: "Critically analyze...", "In the context of [recent event], discuss...", "Elucidate with examples". 
Answers must show: understanding + analysis + examples + balanced conclusion. 
NEVER ask for plain definitions or list-style answers.`,
      },
    ],
    totalQuestions: 100,
    specialInstructions: `UPSC questions must NEVER ask for direct definitions. 
All MCQs must test analytical understanding, not memory. 
Prelims MCQs must use the authentic UPSC format: statement-based, pair-matching, chronological ordering. 
Link questions to current affairs and governance where possible. 
For History: use actual historical figures, events, and dates. 
For Polity: cite actual Constitutional Articles and provisions.`,
  },

  // ─────────────────────── JPSC ──────────────────────
  jpsc: {
    id: 'jpsc',
    fullName: 'Jharkhand Public Service Commission (JPSC)',
    examStyle: `JPSC is the state civil services exam for Jharkhand. Similar to UPSC but with significant 
Jharkhand-specific content. Prelims has two papers: General Studies (100 MCQs) and Language (Hindi/English). 
Mains has 6 papers including Jharkhand-specific General Studies. 
Questions test: Jharkhand tribal culture, history, geography, economy, governance, and environment.`,
    languageStyle: `UPSC-influenced formal language but with Jharkhand-specific terminology. 
Use statement-based MCQ format similar to UPSC but include Jharkhand-specific topics.`,
    pyqTrends: `JPSC frequently tests: Jharkhand formation history (2000), tribal movements (Santhal Rebellion, 
Birsa Munda), Jharkhand mineral resources, Damodar Valley Corporation, Chief Ministers of Jharkhand, 
Jharkhand geography (rivers: Damodar, Subarnarekha; national parks: Betla). 
Also tests standard GS: Indian Polity, History, Geography, Economy.`,
    markingScheme: `Same as UPSC: 2 marks per correct MCQ, -0.66 for wrong. Mains: 10-15 marks per question.`,
    sections: [
      {
        key: 'Section A', type: 'UPSC MCQ', name: 'Statement-Based MCQs (JPSC Pattern)',
        count: 35, marks: 2,
        difficultyProfile: diffProfile(35, 8, 17, 10),
        desc: `JPSC MCQs in UPSC statement-based format. Mix Jharkhand-specific topics with general GS. 
For each Jharkhand topic, use the statement-based format: 
"Consider the following statements about [Jharkhand topic]: 1.[statement] 2.[statement] 
Which of the statements is/are correct?" 
Include pair-matching with Jharkhand facts.`,
      },
      {
        key: 'Section B', type: 'Multi-Concept MCQ', name: 'Jharkhand-Specific MCQs',
        count: 30, marks: 2,
        difficultyProfile: diffProfile(30, 5, 15, 10),
        desc: `MCQs specifically about Jharkhand: tribal communities (Santhal, Mundari, Ho, Oraon), 
Jharkhand's mineral wealth, Chotanagpur Plateau, JHARCRAFT, JIIDCO, DVC, 
Jharkhand governance, constitution of Jharkhand. 4 options, UPSC-style analytical.`,
      },
      {
        key: 'Section C', type: 'Short Answer', name: 'Mains Short Answer',
        count: 20, marks: 10,
        difficultyProfile: diffProfile(20, 3, 10, 7),
        desc: `JPSC Mains-style analytical short answers. For Jharkhand topics: "Discuss the role of [tribal leader] 
in the history of Jharkhand", "Explain the significance of [institution] for Jharkhand's economy". 
Answer in 150 words = 6–8 analytical sentences.`,
      },
      {
        key: 'Section D', type: 'Long Answer', name: 'Mains Long Answer',
        count: 15, marks: 15,
        difficultyProfile: diffProfile(15, 0, 5, 10),
        desc: `JPSC Mains 15-mark questions. "Critically examine the development of tribals in Jharkhand", 
"Analyze the mineral economy of Jharkhand and its impact on tribal communities". 
Answers must be Jharkhand-context-anchored with national perspective.`,
      },
    ],
    totalQuestions: 100,
    specialInstructions: `JPSC must include at minimum 30% Jharkhand-specific content: 
tribal history, Jharkhand geography, governance, economy, and culture. 
Mention specific: Birsa Munda, Sidhu-Kanhu, Phulo-Jhano, Tana Bhagat movement, Santhal Rebellion 1855. 
Key geography: Betla National Park, Palamu Tiger Reserve, Netarhat plateau, Hundru Falls, Dassam Falls. 
Always link tribal content to Constitutional provisions (Fifth Schedule, PESA Act).`,
  },

  // ─────────────────────── BPSC ──────────────────────
  bpsc: {
    id: 'bpsc',
    fullName: 'Bihar Public Service Commission (BPSC)',
    examStyle: `BPSC civil services exam with Bihar-specific GS content. Prelims: 150 MCQ questions. 
Mains: descriptive papers including Bihar-specific GS. Strong emphasis on Bihar history, 
Bihar economy, Pataliputra/Nalanda civilization, Champaran Satyagraha, Bihar's role in Independence movement.`,
    languageStyle: `UPSC-style formal language with Bihar-specific content. Statement-based MCQ format.`,
    pyqTrends: `BPSC frequently tests: Pataliputra/Maurya Empire, Champaran Satyagraha 1917, 
Bihar's jute and silk industry, Ganga plains geography, Bihar panchayati raj, Chief Ministers, 
Bihar's agriculture (rice, wheat, maize). Standard GS: Indian Polity, Economy, Science.`,
    markingScheme: `Prelims: 1 mark per question (no negative marking in BPSC unlike UPSC). 
Mains: 250-mark subjective papers.`,
    sections: [
      {
        key: 'Section A', type: 'UPSC MCQ', name: 'General Studies MCQs (BPSC Pattern)',
        count: 40, marks: 1,
        difficultyProfile: diffProfile(40, 10, 20, 10),
        desc: `BPSC MCQs. Mix Bihar-specific and general GS in UPSC statement-based format. 
Bihar-specific: "Which of the following is/are correctly matched with their location in Bihar?" 
General: standard history, polity, geography, economy MCQs. 4 options.`,
      },
      {
        key: 'Section B', type: 'Multi-Concept MCQ', name: 'Bihar-Specific MCQs',
        count: 35, marks: 1,
        difficultyProfile: diffProfile(35, 8, 17, 10),
        desc: `Bihar-specific MCQs: Patna Sahib, Bodhgaya, Rajgir, Nalanda, Vikramshila, 
Champaran Satyagraha, Jayaprakash Narayan, Karpoori Thakur, Bihar's rivers (Son, Gandak, Kosi), 
Bihar economy (agriculture, industries), Bihar governance. 4 options.`,
      },
      {
        key: 'Section C', type: 'Short Answer', name: 'Mains Short Answer',
        count: 15, marks: 10,
        difficultyProfile: diffProfile(15, 2, 8, 5),
        desc: `BPSC Mains analytical short answers (150 words). Bihar-specific or general GS analysis.`,
      },
      {
        key: 'Section D', type: 'Long Answer', name: 'Mains Long Answer',
        count: 10, marks: 15,
        difficultyProfile: diffProfile(10, 0, 4, 6),
        desc: `BPSC Mains 15-mark questions (250 words). Analytical essays on Bihar topics or general GS.`,
      },
    ],
    totalQuestions: 100,
    specialInstructions: `BPSC must include Bihar-specific content: Mauryan Empire, Gupta Period, 
Nalanda University, Champaran Satyagraha, Quit India movement in Bihar, JP movement. 
Bihar geography: Ganga, Gandak, Kosi rivers; Valmiki National Park; Rajgir hills.`,
  },

  // ─────────────────────── SSC ──────────────────────
  ssc: {
    id: 'ssc',
    fullName: 'Staff Selection Commission (SSC)',
    examStyle: `SSC CGL, CHSL, and other exams are speed-based MCQ tests. 
Four sections: Quantitative Aptitude (25 questions, 50 marks), General Intelligence & Reasoning (25 questions, 50 marks), 
General Awareness (25 questions, 50 marks), English Comprehension (25 questions, 50 marks). 
Questions are straightforward, designed for speed. No analytical depth like UPSC. 
Negative marking: -0.50 per wrong answer.`,
    languageStyle: `Direct, no-nonsense MCQ language. Questions are brief and precise. 
Quantitative questions give numbers and ask to calculate. Reasoning questions give series/pattern. 
English questions give a sentence and ask to spot error or fill blank.`,
    pyqTrends: `QA: Percentage, Profit/Loss, Time-Work, SI/CI, Mensuration, Number System. 
Reasoning: Number series, Letter series, Coding-Decoding, Blood Relations, Syllogism, Puzzles. 
English: Cloze Test, Error Spotting, Sentence Improvement, Synonyms/Antonyms, One-word substitution. 
GK: Static GK (capitals, currencies, national symbols), Current Affairs, Science GK.`,
    markingScheme: `2 marks per correct MCQ, -0.50 per wrong. Time: 60 minutes for 100 questions.`,
    sections: [
      {
        key: 'Section A', type: 'MCQ', name: 'Quantitative Aptitude',
        count: 25, marks: 2,
        difficultyProfile: diffProfile(25, 8, 12, 5),
        desc: `SSC-style Quantitative Aptitude MCQs. Give numerical data, ask to calculate. 
Topics: Percentage, Profit & Loss, Simple Interest, Compound Interest, Time & Work, 
Time & Distance, Ratio & Proportion, Mensuration (area/volume), Number System, Averages, 
Algebra (linear/quadratic), Trigonometry (basic). 
Questions must have numerical values and require calculation. 4 options with numerical answers.
Example: "A train travels 360 km in 4 hours. What is its speed in m/s?" or 
"If A can do work in 12 days and B in 15 days, in how many days can they finish together?"`,
      },
      {
        key: 'Section B', type: 'Reasoning', name: 'General Intelligence & Reasoning',
        count: 25, marks: 2,
        difficultyProfile: diffProfile(25, 8, 12, 5),
        desc: `SSC Reasoning MCQs. Topics: Number Series (find missing/wrong term), 
Letter/Alphabet Series, Coding-Decoding (letters/numbers), Analogy, Classification (odd-one-out), 
Blood Relations, Direction & Distance, Ranking/Arrangement, Syllogism, 
Logical Venn Diagrams, Mirror Image, Paper Folding, Embedded Figures. 
Give the pattern/series/code and ask students to identify the missing element or answer.
Example: "Find the missing number in the series: 2, 6, 12, 20, 30, ___" 
or "If BOOK is coded as DQQM, how is NOTES coded?"`,
      },
      {
        key: 'Section C', type: 'General Awareness', name: 'General Awareness',
        count: 25, marks: 2,
        difficultyProfile: diffProfile(25, 10, 10, 5),
        desc: `SSC General Awareness MCQs. Topics: Static GK (capitals, currencies, rivers, mountains, 
national parks, national symbols, first presidents/PMs), Indian History (events, leaders, dates), 
Indian Geography (rivers, peaks, national parks, states/capitals), Indian Polity (Constitution, Parliament), 
Indian Economy (budget, banking, schemes), Science & Technology (inventions, discoveries, scientific facts), 
Sports (records, championships), Current Affairs (major appointments, awards, summits). 
Questions are direct factual MCQs with 4 options.`,
      },
      {
        key: 'Section D', type: 'English Language', name: 'English Language & Comprehension',
        count: 25, marks: 2,
        difficultyProfile: diffProfile(25, 8, 12, 5),
        desc: `SSC English MCQs. Topics: 
Error Spotting (identify grammatical error in a sentence), 
Sentence Improvement (choose the correct version of a sentence), 
Fill in the Blanks (choose correct word to complete the sentence), 
Synonyms & Antonyms, Idioms & Phrases (meaning), 
One-Word Substitution, Spelling Correction, 
Reading Comprehension (short passage with 3-4 questions), 
Cloze Test (passage with blanks). 
Format each question as SSC English MCQs with exactly 4 options.`,
      },
    ],
    totalQuestions: 100,
    specialInstructions: `Every Quantitative Aptitude question MUST have actual numbers and require calculation. 
Every Reasoning question MUST give a series, code, or pattern to analyze. 
Never generate vague or definition-based questions for QA or Reasoning sections. 
English questions must have grammatically precise options where the correct answer matters significantly.`,
  },

  // ─────────────────────── BANKING ──────────────────────
  banking: {
    id: 'banking',
    fullName: 'Banking Examinations (IBPS PO/Clerk, SBI PO/Clerk, RBI)',
    examStyle: `Banking exams (IBPS PO, SBI PO, RBI Grade B) are speed-based competitive exams. 
Prelims: 100 questions in 60 minutes — 30 QA + 35 Reasoning + 30 English Language. 
Mains: 200 questions — QA (35), Reasoning+Computer (45), General/Economy/Banking Awareness (40), 
English Language (35), Data Analysis & Interpretation (35). 
Questions require calculation speed. Data Interpretation (tables, graphs, pie charts) is critical. 
Banking Awareness (RBI, monetary policy, banking terms) is exclusively tested in Banking exams.`,
    languageStyle: `Banking industry terminology. Questions about monetary policy use RBI/RBI governor language. 
Reasoning: complex seating arrangements, complex puzzles (box-based, floor-based). 
QA: data sufficiency, quantity comparison. English: RC passages about economic topics.`,
    pyqTrends: `QA: Data Interpretation (table/bar/line/pie chart), Quadratic Equations, Number Series, 
Approximation, Compound Interest, Partnership. 
Reasoning: Complex Seating Arrangement (circular/linear), Blood Relation-Puzzle combination, 
Coding-Decoding (new pattern). 
Banking Awareness: Repo Rate, CRR, SLR, Base Rate, SARFAESI Act, Insolvency Code, 
Prompt Corrective Action (PCA), DICGC, NBFC classifications.`,
    markingScheme: `1 mark per correct MCQ, -0.25 per wrong. DI questions are 5-mark sets (5 questions per DI set).`,
    sections: [
      {
        key: 'Section A', type: 'MCQ', name: 'Quantitative Aptitude (Banking)',
        count: 20, marks: 1,
        difficultyProfile: diffProfile(20, 5, 10, 5),
        desc: `Banking QA MCQs. MUST include:
1. Data Interpretation (give a table/bar chart data, ask 3-4 questions based on it): 
   Example: "The following table shows sales figures of 5 companies across 3 years. [table data] Q1: What is the total sales of Company A in all 3 years?"
2. Number Series (find missing/wrong term): Example: "12, 35, 81, 173, 357, ___"  
3. Quadratic Equations: "If x²-7x+12=0 and y²-5y+6=0, then:"  
4. Arithmetic (Partnership, Mixtures, Boats & Streams, Pipes & Cisterns)
5. Approximation (BODMAS-based calculation)
Rotate among these types. Every question must require calculation.`,
      },
      {
        key: 'Section B', type: 'Reasoning', name: 'Reasoning Ability (Banking)',
        count: 20, marks: 1,
        difficultyProfile: diffProfile(20, 4, 10, 6),
        desc: `Banking Reasoning — higher difficulty than SSC. MUST include:
1. Complex Seating Arrangement (circular with conditions): "8 people sit in a circle facing center. A sits 2nd right of B..." (3-4 questions per set)
2. Floor/Box Puzzles: "7 boxes are stacked. Box A is above Box B..." (3-4 questions)  
3. Coding-Decoding (new pattern with symbols): "In a certain code, 'sky is blue' = '@ # $'..."
4. Syllogism: "All pens are books. Some books are red. Conclusion: I. Some pens are red"
5. Blood Relation + Puzzle: "In a family of 6, A is the father of B who is the sister of C..."
Format each puzzle with proper conditions then ask 3-4 sub-questions.`,
      },
      {
        key: 'Section C', type: 'English Language', name: 'English Language (Banking)',
        count: 15, marks: 1,
        difficultyProfile: diffProfile(15, 5, 7, 3),
        desc: `Banking English. Include:
1. Reading Comprehension (banking/economy passage, 3-4 questions with vocabulary)
2. Error Detection (4-segment sentence, one has grammatical error)
3. Word Usage / Fill in Blanks (banking vocabulary)
4. Sentence Rearrangement (jumbled sentences, re-arrange in correct order)
5. Cloze Test passage with 3-4 blanks`,
      },
      {
        key: 'Section D', type: 'General Awareness', name: 'Banking & Economy Awareness',
        count: 25, marks: 1,
        difficultyProfile: diffProfile(25, 8, 12, 5),
        desc: `Banking Awareness MCQs — THIS IS UNIQUE TO BANKING EXAMS. Test:
1. RBI monetary policy: "The current Repo Rate set by RBI is ___", "What is the instrument used by RBI to inject liquidity?"
2. Banking terminology: NPA, SARFAESI, DICGC, Priority Sector Lending, CRR, SLR, Statutory Liquidity Ratio
3. Banking schemes: Jan Dhan Yojana, Mudra Loans, PMJDY, Kisan Credit Card
4. Financial institutions: SIDBI, NABARD, NHB, EXIM Bank, functions
5. Recent banking current affairs: mergers, new banks, RBI guidelines
6. Insurance: IRDAI, types of insurance, LIC
7. Capital markets: SEBI, BSE, NSE, IPO, derivatives
All questions must use authentic banking terminology as used in IBPS/SBI official papers.`,
      },
      {
        key: 'Section E', type: 'Computer Knowledge', name: 'Computer Knowledge',
        count: 10, marks: 1,
        difficultyProfile: diffProfile(10, 4, 4, 2),
        desc: `Computer Knowledge for banking exams. Topics: MS Office (Excel shortcuts, Word features), 
Internet & Networking (protocols, IP address, browser), Database basics, Operating Systems, 
Keyboard shortcuts, Computer generation, Input/Output devices, Storage devices. 
Questions test practical computer usage relevant to banking work.`,
      },
      {
        key: 'Section F', type: 'Data Interpretation', name: 'Data Analysis & Interpretation',
        count: 10, marks: 2,
        difficultyProfile: diffProfile(10, 2, 5, 3),
        desc: `Banking DI sets (2 DI sets of 5 questions each). 
MUST present actual data: "The following table shows the number of loans sanctioned by 5 banks in 4 quarters:
[Bank | Q1 | Q2 | Q3 | Q4]
[SBI  | 240 | 280 | 310 | 290]
..."
Then ask 5 calculation-based questions on this data: totals, percentages, ratios, averages, growth rates.`,
      },
    ],
    totalQuestions: 100,
    specialInstructions: `Banking QA MUST present actual numerical data in DI sets. 
Banking Awareness questions MUST use authentic RBI/banking terminology. 
Reasoning puzzles MUST have complete conditions (enough information to arrive at a unique solution). 
NEVER generate vague or generic banking questions. These must look exactly like IBPS/SBI official papers.`,
  },

  // ─────────────────────── RAILWAY ──────────────────────
  railway: {
    id: 'railway',
    fullName: 'Railway Recruitment Board (RRB) Examinations',
    examStyle: `RRB NTPC, RRB Group D, RRB JE exams. Pattern: CBT 1 (100 MCQs, 90 min) and CBT 2 (120 MCQs, 90 min). 
Sections: Mathematics (30), General Intelligence & Reasoning (30), General Awareness (40) for NTPC. 
Railway-specific GK (Indian Railways history, zones, stations, trains) is tested. 
JE exam includes technical subjects (Civil/Electrical/Mechanical/IT).`,
    languageStyle: `Simple, direct MCQ language. Indian Railways-specific terminology. 
Questions about Railway infrastructure: zones, divisions, railway stations, Vande Bharat, etc.`,
    pyqTrends: `Railway GK: Railway zones and headquarters, India's first train (1853, Bombay-Thane), 
Vande Bharat Express, high-speed rail projects, Railway Budget history, IR productions units. 
Math: Percentage, Time-Distance (train-related problems), Algebra, Geometry. 
Reasoning: Standard series, coding, blood relations.`,
    markingScheme: `1 mark per correct MCQ, -0.33 per wrong.`,
    sections: [
      {
        key: 'Section A', type: 'MCQ', name: 'Mathematics (Railway)',
        count: 25, marks: 1,
        difficultyProfile: diffProfile(25, 10, 10, 5),
        desc: `RRB Mathematics MCQs. INCLUDE railway-themed problems where possible: 
"A train of length 200m passes a platform of length 300m at 72 km/h. How long does the crossing take?"
Topics: Percentage, Ratio, Time & Work, Time-Speed-Distance (train problems), SI/CI, 
Profit & Loss, Mensuration, Algebra, Trigonometry (basic), Statistics. 
All questions must have numerical values.`,
      },
      {
        key: 'Section B', type: 'Reasoning', name: 'General Intelligence & Reasoning',
        count: 25, marks: 1,
        difficultyProfile: diffProfile(25, 10, 10, 5),
        desc: `RRB Reasoning MCQs. Topics: Number Series, Analogy, Classification, Coding-Decoding, 
Blood Relations, Direction Sense, Ranking, Syllogism, Venn Diagrams, 
Non-verbal (Mirror Image, Paper Cutting, Embedded Figures, Figure Matrix). Standard SSC-level complexity.`,
      },
      {
        key: 'Section C', type: 'General Awareness', name: 'General Awareness (Railway Focus)',
        count: 30, marks: 1,
        difficultyProfile: diffProfile(30, 12, 12, 6),
        desc: `RRB General Awareness with Railway-specific focus. Include:
1. Indian Railways: first railway, zones (16 zones and headquarters), record trains (fastest, longest), 
   Vande Bharat, Rajdhani, Shatabdi, Metro Rail, Dedicated Freight Corridor, RRTS, bullet train project
2. Science & Technology: physics, chemistry, biology basics relevant to railway operations
3. Indian History, Geography, Polity (standard GK)
4. Current Affairs: major appointments, national events, science discoveries
5. Sports: major championships, Indian achievements
Rotate among all these. At least 8 questions must be specifically about Indian Railways.`,
      },
      {
        key: 'Section D', type: 'Technical MCQ', name: 'Technical/Subject Knowledge (JE/ALP)',
        count: 20, marks: 1,
        difficultyProfile: diffProfile(20, 6, 9, 5),
        desc: `RRB JE/ALP technical MCQs based on the chapter subject. 
For Electrical: circuits, transformers, motors, signals, traction. 
For Mechanical: thermodynamics, machine design, manufacturing. 
For Civil: materials, structures, surveying. 
For IT/CS: programming, networks, databases, operating systems. 
Use technical terminology appropriate for diploma/ITI/engineering graduate level.`,
      },
    ],
    totalQuestions: 100,
    specialInstructions: `RRB exam must include Indian Railways-specific questions: 
Zone headquarters, world/India records for railways, specific trains (Vande Bharat, Rajdhani), 
Railway Budget merged with Union Budget (2017), IR production units. 
Math questions should use train-themed problems (crossing bridges, platforms, meeting points) 
as these are a staple of Railway exam QA sections.`,
  },

  // ─────────────────────── NEET ──────────────────────
  neet: {
    id: 'neet',
    fullName: 'National Eligibility cum Entrance Test (NEET-UG)',
    examStyle: `NEET-UG is the medical entrance exam. 200 MCQs total: Physics (50), Chemistry (50), 
Botany (50), Zoology (50). Questions are NCERT-aligned but with application/problem-solving orientation. 
Negative marking: +4 for correct, -1 for wrong. Questions test conceptual depth, not just recall. 
Multi-concept questions combining two NCERT topics are common.`,
    languageStyle: `Scientific, precise. NCERT textbook language. Questions use exact NCERT terminology. 
Options for biology questions are often very similar with subtle differences (one or two words different). 
Physics/Chemistry questions give numerical data.`,
    pyqTrends: `Physics: NLM, Laws of Motion, Work-Energy, Current Electricity, Semiconductor (diode, transistor). 
Chemistry: Equilibrium, Electrochemistry, Biomolecules, D-F block, Polymers. 
Botany: Cell Cycle, Photosynthesis, Plant Kingdom, Molecular Basis of Inheritance, Ecology. 
Zoology: Human Physiology (digestion, circulation, excretion, nervous), Genetics, Evolution, Biotechnology.`,
    markingScheme: `+4 per correct MCQ, -1 for wrong. Total marks: 720.`,
    sections: [
      {
        key: 'Section A', type: 'MCQ', name: 'Physics MCQs (NEET Pattern)',
        count: 25, marks: 4,
        difficultyProfile: diffProfile(25, 6, 12, 7),
        desc: `NEET Physics MCQs. NCERT Class 11-12 Physics syllabus. 
Must include numerical problems: "A body of mass 2 kg is moving with velocity 3 m/s. 
What is its kinetic energy?" Give options with calculated numerical values. 
Also include conceptual MCQs with subtle option differences. 
Topics rotate through: Kinematics, NLM, WEP, Gravitation, Rotational Motion, 
Thermodynamics, Electrostatics, Current Electricity, Magnetism, EMI, Optics, Modern Physics.`,
      },
      {
        key: 'Section B', type: 'MCQ', name: 'Chemistry MCQs (NEET Pattern)',
        count: 25, marks: 4,
        difficultyProfile: diffProfile(25, 6, 12, 7),
        desc: `NEET Chemistry MCQs. NCERT Class 11-12 Chemistry syllabus. 
Include: reaction identification ("Which of the following is a nucleophilic substitution reaction?"), 
numerical problems (mole concept, pH, Ksp, cell potential), 
structural questions (IUPAC naming, isomers), property questions. 
Topics: Physical (Thermodynamics, Equilibrium, Electrochemistry, Kinetics), 
Inorganic (P-block, D-F block, Coordination compounds), 
Organic (reaction mechanisms, named reactions, biomolecules, polymers).`,
      },
      {
        key: 'Section C', type: 'MCQ', name: 'Botany MCQs (NEET Pattern)',
        count: 25, marks: 4,
        difficultyProfile: diffProfile(25, 7, 12, 6),
        desc: `NEET Botany MCQs. NCERT Class 11-12 Biology (Botany portion). 
Questions test: precise identification ("Identify the correct statement about plastids:"), 
exceptions ("Which of the following does NOT have cell wall?"), 
process steps ("The enzyme responsible for CO₂ fixation in C4 plants is:"). 
Topics: Cell Biology, Biomolecules, Cell Division, Plant Kingdom, Morphology, 
Anatomy, Photosynthesis, Respiration, Plant Growth, Genetics, Evolution, Ecology.`,
      },
      {
        key: 'Section D', type: 'MCQ', name: 'Zoology MCQs (NEET Pattern)',
        count: 25, marks: 4,
        difficultyProfile: diffProfile(25, 7, 12, 6),
        desc: `NEET Zoology MCQs. NCERT Class 11-12 Biology (Zoology portion). 
Questions test: precise anatomical facts ("The wall of the human heart is composed of:"), 
process identification ("Which of the following correctly describes the role of Leydig cells?"), 
exception-based ("Which of the following is NOT a feature of Phylum Arthropoda?"). 
Topics: Animal Kingdom, Human Physiology (all systems), Reproduction, Genetics, 
Evolution, Biotechnology, Biodiversity.`,
      },
    ],
    totalQuestions: 100,
    specialInstructions: `NEET questions must be NCERT-aligned. Use exact NCERT terms and examples. 
Physics questions must have numerical data with calculated options. 
Biology questions must have 4 options that are all plausible — no obviously wrong options. 
Avoid questions that depend on information beyond NCERT. 
Include diagrams described in text where NEET typically tests diagram-based questions 
(e.g., "In the given diagram of a mitochondria, which part is labeled X?").`,
  },

  // ─────────────────────── JEE ──────────────────────
  jee: {
    id: 'jee',
    fullName: 'Joint Entrance Examination (JEE Main + Advanced)',
    examStyle: `JEE Main: 75 questions — Physics (25), Chemistry (25), Math (25). 
Each subject has 20 MCQs (+4/-1) and 5 numerical answer type (+4/0). 
JEE Advanced: Multi-correct MCQs, Integer type, Matrix-match, Paragraph-based. 
Questions are significantly harder than NEET — multi-step problems, multi-concept integration, 
and unique problem formulations. IIT JEE Advanced has questions that require creative thinking.`,
    languageStyle: `Precise, mathematical, analytical. Questions give complex problem setups. 
Options for MCQs have calculated numerical answers or algebraic expressions. 
Integer-type questions ask to fill a number (0-9) or calculate the integer answer.`,
    pyqTrends: `JEE Main Physics: Mechanics (high weightage), Current Electricity, SHM & Waves, Modern Physics. 
JEE Main Chemistry: Organic (naming, reactions), Electrochemistry, Chemical Bonding, p-Block, Coordination. 
JEE Main Math: Coordinate Geometry (circle, parabola), Matrices-Determinants, Differential Calculus, 
Integrals, Probability. JEE Advanced: Unique problems requiring multi-step reasoning.`,
    markingScheme: `JEE Main: +4/-1 for MCQ, +4/0 for Numerical. JEE Advanced: varies by question type.`,
    sections: [
      {
        key: 'Section A', type: 'MCQ', name: 'Physics MCQs (JEE Pattern)',
        count: 20, marks: 4,
        difficultyProfile: diffProfile(20, 4, 10, 6),
        desc: `JEE Physics MCQs. Multi-step problem solving required. Give numerical setups: 
"A block of mass 3 kg is placed on a rough surface (μ=0.3). A force F is applied at 37° above horizontal. 
If the block just starts to move, find F." Options: calculated values. 
Topics per NCERT+JEE syllabus: Mechanics, Thermodynamics, Electrostatics, Current, Magnetism, 
Electromagnetic Induction, Optics, Modern Physics. Questions must require actual calculation.`,
      },
      {
        key: 'Section B', type: 'Numerical Type', name: 'Physics Numerical Answer Type',
        count: 5, marks: 4,
        difficultyProfile: diffProfile(5, 1, 2, 2),
        desc: `JEE Numerical Type for Physics. No options given — answer is an integer or decimal. 
Format: "The value of [quantity] is ___." Give complex setups that require multi-step calculation. 
The answer should be a specific number (not a multiple of 10 trivially).`,
      },
      {
        key: 'Section C', type: 'MCQ', name: 'Chemistry MCQs (JEE Pattern)',
        count: 20, marks: 4,
        difficultyProfile: diffProfile(20, 4, 10, 6),
        desc: `JEE Chemistry MCQs. Mix Physical, Inorganic, and Organic. 
Physical: numerical problems (equilibrium constant, cell EMF, rate constant calculation). 
Organic: reaction product identification, named reactions, mechanism steps, IUPAC naming of complex molecules. 
Inorganic: transition metal properties, coordination compounds (CFSE, magnetic moment), p-block reaction products. 
Questions should have 4 plausible options where incorrect ones represent common errors.`,
      },
      {
        key: 'Section D', type: 'Numerical Type', name: 'Chemistry Numerical Answer Type',
        count: 5, marks: 4,
        difficultyProfile: diffProfile(5, 1, 2, 2),
        desc: `JEE Numerical Type for Chemistry. Integer/decimal answer, no options. 
Example: "How many geometrical isomers are possible for [compound]?" or 
"Calculate the pH of 0.01 M H₂SO₄ solution."`,
      },
      {
        key: 'Section E', type: 'MCQ', name: 'Mathematics MCQs (JEE Pattern)',
        count: 20, marks: 4,
        difficultyProfile: diffProfile(20, 3, 10, 7),
        desc: `JEE Math MCQs. Multi-step algebraic, geometric, and calculus problems. 
Topics: Algebra (complex numbers, quadratics, progressions, binomial theorem, P&C), 
Coordinate Geometry (circles, parabola, ellipse, hyperbola, straight lines), 
Calculus (limits, derivatives, integration, differential equations), 
Vectors & 3D, Matrices & Determinants, Probability & Statistics, Trigonometry. 
Questions should require 2-3 steps of mathematical reasoning.`,
      },
      {
        key: 'Section F', type: 'Numerical Type', name: 'Mathematics Numerical Answer Type',
        count: 5, marks: 4,
        difficultyProfile: diffProfile(5, 1, 2, 2),
        desc: `JEE Numerical Type for Math. Integer/decimal answer. 
Example: "The number of integral solutions of [inequality] is ___" or 
"If f(x) = [expression], the value of f'(2) is ___."`,
      },
      {
        key: 'Section G', type: 'Multi-Correct MCQ', name: 'Multi-Correct MCQs (JEE Advanced)',
        count: 10, marks: 4,
        difficultyProfile: diffProfile(10, 0, 4, 6),
        desc: `JEE Advanced multi-correct MCQs — ONE OR MORE options can be correct. 
Format: "Which of the following statement(s) is/are correct?"
Options: (A) [statement] (B) [statement] (C) [statement] (D) [statement]
Answer: specifies which options are correct (e.g., A and C) with full explanation.
These require deep conceptual understanding — common error: selecting all or only one when multiple are correct.`,
      },
      {
        key: 'Section H', type: 'Long Answer', name: 'Derivation/Proof Questions',
        count: 15, marks: 6,
        difficultyProfile: diffProfile(15, 1, 5, 9),
        desc: `JEE-style derivation and proof questions. 
Physics: Derive the expression for [quantity] starting from first principles. 
Chemistry: Provide the complete mechanism for [named reaction] showing all intermediates. 
Math: Prove that [mathematical statement] using [method]. 
Answers must be complete and show all steps as expected in JEE/board level.`,
      },
    ],
    totalQuestions: 100,
    specialInstructions: `JEE questions MUST be significantly harder than NEET or board level. 
Physics and Math MCQs must require calculation — no definition-testing questions. 
Numerical type questions must have a specific numerical answer that requires working. 
Multi-correct questions must have carefully crafted options where more than one is correct. 
Include JEE Advanced-specific question types: paragraph-based, matrix-match for harder sections.`,
  },

  // ─────────────────────── CAT ──────────────────────
  cat: {
    id: 'cat',
    fullName: 'Common Admission Test (CAT) — MBA Entrance',
    examStyle: `CAT has 3 sections: VARC (Verbal Ability & Reading Comprehension, 24 questions), 
DILR (Data Interpretation & Logical Reasoning, 20 questions), 
QA (Quantitative Ability, 22 questions). Total: 66 questions, 120 minutes. 
CAT questions are notoriously tricky with complex RC passages and multi-step QA problems. 
DILR has complex sets (LR puzzles and DI tables/graphs with 4-5 questions each).`,
    languageStyle: `Advanced English. RC passages are intellectually rich (philosophy, economy, science, arts). 
QA questions use elegant formulations. DILR has complex conditions requiring careful reading.`,
    pyqTrends: `VARC: RC on abstract topics (philosophy, arts, social issues), Para-jumbles, Para-summary, 
Sentence exclusion, Odd-one-out in paragraph context. 
QA: Arithmetic (60%), Number Theory, Algebra, Geometry, Modern Math. 
DILR: Complex arrangements (teams, tournaments), Grid/Table DI, Complex bar/line chart DI.`,
    markingScheme: `+3 for MCQ, -1 for wrong MCQ. TITA (Type in the Answer): +3, no negative.`,
    sections: [
      {
        key: 'Section A', type: 'Reading Comprehension', name: 'Verbal Ability & Reading Comprehension',
        count: 16, marks: 3,
        difficultyProfile: diffProfile(16, 3, 8, 5),
        desc: `CAT RC passages. Each "passage" is 400-600 words on an intellectual topic (NOT academic/textbook style). 
Topics: philosophy of language, history of science, economic systems, artistic movements, social phenomena. 
Ask 3-4 questions per passage: main idea, inference, author's tone, specific detail, title selection. 
Questions test ability to infer, not just recall the passage. Options are subtly different.`,
      },
      {
        key: 'Section B', type: 'Verbal Ability', name: 'Verbal Ability (Non-RC)',
        count: 8, marks: 3,
        difficultyProfile: diffProfile(8, 2, 4, 2),
        desc: `CAT Verbal Ability (non-RC). Include:
1. Para-jumbles (PQRS sentences — arrange in logical order)
2. Para-summary (give 4-5 sentence paragraph, choose best summary from options)  
3. Sentence Exclusion (given 5 sentences, find the one that does NOT fit the paragraph theme)
4. Odd sentence in a paragraph (which sentence does NOT belong?)
For jumbles: give 5 sentences labeled P, Q, R, S, T. Ask which sequence is correct.`,
      },
      {
        key: 'Section C', type: 'Data Interpretation', name: 'Data Interpretation & Logical Reasoning',
        count: 20, marks: 3,
        difficultyProfile: diffProfile(20, 3, 10, 7),
        desc: `CAT DILR. Present 4 sets of 5 questions each:
SET TYPE 1 — DI Table: "The following table shows data for 5 companies across 3 metrics. [table with actual numbers] 
Q1: Which company had highest growth? Q2: What is the ratio of [X] to [Y]?"
SET TYPE 2 — LR Arrangement: "8 teams play a round-robin tournament. Team A beats exactly 5 teams... [conditions]
Q1: How many matches did Team B win? Q2: Who finished 3rd?"
SETS MUST have enough data to solve ALL sub-questions uniquely. Verify mathematical consistency.`,
      },
      {
        key: 'Section D', type: 'Numerical Type', name: 'Quantitative Ability (CAT)',
        count: 22, marks: 3,
        difficultyProfile: diffProfile(22, 4, 10, 8),
        desc: `CAT QA questions. Multi-step arithmetic and algebra. 
Topics: Arithmetic (Percentage, SI/CI, Profit-Loss, Time-Work, Time-Speed, Mixture), 
Number Theory (HCF, LCM, divisibility, remainders), Algebra (quadratic, inequalities), 
Geometry (triangles, circles, mensuration, coordinate geometry), Modern Math (P&C, Probability, Sets). 
Questions should require 2-3 steps. Include some TITA (no-options) questions.`,
      },
    ],
    totalQuestions: 66,
    specialInstructions: `CAT RC passages must be on intellectual, non-academic topics — NOT textbook science or history. 
Think The Economist, New Yorker, philosophical essays. 
DILR sets MUST have mathematically consistent data that leads to unique answers. 
QA questions must be solved in <3 minutes — avoid overly computational problems. 
VARC non-RC questions test reasoning about language and logic.`,
  },

  // ─────────────────────── CUET ──────────────────────
  cuet: {
    id: 'cuet',
    fullName: 'Common University Entrance Test (CUET-UG)',
    examStyle: `CUET-UG replaced individual university entrance exams. 
Section IA/IB: Languages (13 questions, 45 min). 
Section II: Domain-specific subjects (45 questions, 60 min) — aligned with NCERT Class 12. 
Section III: General Test (75 questions, 60 min). 
Questions are NCERT Class 12-based but framed more analytically than board exams.`,
    languageStyle: `NCERT-aligned language. Questions test understanding of Class 12 concepts. 
More application-based than board exams but simpler than JEE/NEET.`,
    pyqTrends: `Domain subjects follow NCERT Class 12 syllabus closely. General Test: 
Quantitative Reasoning, Logical/Analytical Reasoning, General Knowledge/Current Affairs. 
Languages: Reading Comprehension, Literary Aptitude, Vocabulary, Grammar.`,
    markingScheme: `+5 for correct, -1 for wrong MCQ.`,
    sections: [
      {
        key: 'Section A', type: 'MCQ', name: 'Domain-Specific MCQs (NCERT Class 12)',
        count: 40, marks: 5,
        difficultyProfile: diffProfile(40, 12, 20, 8),
        desc: `CUET domain MCQs based on NCERT Class 12 for the selected subject. 
Questions are NCERT-aligned but more analytical than board exam questions. 
Topics must cover the full NCERT Class 12 syllabus for the subject. 
4 options, one correct. Include application-based scenarios.`,
      },
      {
        key: 'Section B', type: 'General Test MCQ', name: 'General Test (Quantitative & Reasoning)',
        count: 30, marks: 5,
        difficultyProfile: diffProfile(30, 10, 15, 5),
        desc: `CUET General Test MCQs. Include:
1. Quantitative Reasoning: arithmetic, algebra, basic statistics
2. Logical Reasoning: series, analogy, syllogism, coding
3. General Knowledge: national/international current affairs, science facts, geography, polity
4. Language: basic vocabulary, reading comprehension (short passage)
These are straightforward MCQs at 10+2 level.`,
      },
      {
        key: 'Section C', type: 'Reading Comprehension', name: 'Language & Reading Comprehension',
        count: 20, marks: 5,
        difficultyProfile: diffProfile(20, 7, 9, 4),
        desc: `CUET Language section. Give 2 passages (300-400 words each) on different topics. 
Ask 5-6 questions per passage: main idea, vocabulary meaning, inference, specific detail. 
Include 5-7 standalone English grammar/vocabulary questions: 
synonyms, antonyms, fill in the blank, correct sentence, jumbled paragraph.`,
      },
      {
        key: 'Section D', type: 'Short Answer', name: 'Application Questions',
        count: 10, marks: 4,
        difficultyProfile: diffProfile(10, 3, 5, 2),
        desc: `CUET application-based questions testing deeper understanding of the domain subject. 
These go slightly beyond pure MCQ — require short explanations or analysis.`,
      },
    ],
    totalQuestions: 100,
    specialInstructions: `CUET must be strictly aligned with NCERT Class 12 for the domain subject. 
General Test should test practical reasoning and awareness, not deep subject knowledge. 
Questions should be accessible to a student who studied NCERT thoroughly.`,
  },

  // ─────────────────────── NDA ──────────────────────
  nda: {
    id: 'nda',
    fullName: 'National Defence Academy (NDA) Entrance Exam',
    examStyle: `NDA exam has 2 papers: Mathematics (120 MCQs, 300 marks) and General Ability Test (150 MCQs, 600 marks). 
GAT includes: English (50 questions), General Knowledge — Physics, Chemistry, Biology, History, Geography, 
Current Affairs, Defence-specific GK. Questions test both academic knowledge and awareness of defence/military topics.`,
    languageStyle: `Formal, military-appropriate language. Questions about national security, armed forces, 
defence technology, and India's defence achievements should be included where relevant.`,
    pyqTrends: `Math: Algebra, Matrices, Trigonometry, Calculus, Statistics & Probability, Vectors. 
GK: Indian Constitution, Armed Forces structure, Indian military history, nuclear/space programs, 
NDA/IMA/INA history, Presidents of India, Defence Ministers. 
Science: Class 11-12 Physics, Chemistry, Biology basics.`,
    markingScheme: `Math: +2.5/-0.83. GAT: +4/-1.33.`,
    sections: [
      {
        key: 'Section A', type: 'MCQ', name: 'Mathematics (NDA Pattern)',
        count: 30, marks: 2,
        difficultyProfile: diffProfile(30, 8, 15, 7),
        desc: `NDA Mathematics MCQs. Topics: Sets & Relations, Complex Numbers, Quadratic Equations, 
Permutations & Combinations, Binomial Theorem, Matrices, Determinants, Trigonometry, 
Analytical Geometry (2D+3D), Differential Calculus, Integral Calculus, 
Differential Equations, Vectors, Statistics & Probability. 
Questions require calculation, 4 options with numerical/algebraic answers.`,
      },
      {
        key: 'Section B', type: 'English Language', name: 'English (NDA Pattern)',
        count: 15, marks: 4,
        difficultyProfile: diffProfile(15, 5, 7, 3),
        desc: `NDA English MCQs. Topics: Grammar (tense, articles, prepositions, modals), 
Vocabulary (synonyms, antonyms, idioms), Reading Comprehension (formal passages), 
Spotting Errors, Fill in the Blanks, Sentence Improvement. 
Questions test formal English usage appropriate for defence officers.`,
      },
      {
        key: 'Section C', type: 'General Awareness', name: 'General Knowledge (NDA Pattern)',
        count: 30, marks: 4,
        difficultyProfile: diffProfile(30, 10, 13, 7),
        desc: `NDA GK MCQs. Must include defence-specific content:
1. Indian Armed Forces: structure, ranks, commands, major exercises, recent acquisitions
2. Defence achievements: Agni/Prithvi/BrahMos missiles, fighter jets (Tejas, Rafale), submarines
3. Wars: Indo-Pakistan wars (1947, 1965, 1971), Kargil War (1999), important battles
4. National Security: RAW, IB, nuclear doctrine, NSG 
5. Standard GK: History, Geography, Polity, Economy, Current Affairs, Science
At least 10 questions must be defence/military specific.`,
      },
      {
        key: 'Section D', type: 'MCQ', name: 'Science (Physics, Chemistry, Biology)',
        count: 25, marks: 4,
        difficultyProfile: diffProfile(25, 9, 11, 5),
        desc: `NDA Science MCQs covering Physics, Chemistry, and Biology at Class 11-12 basic level. 
Physics: mechanics, heat, sound, light, electricity. 
Chemistry: atomic structure, chemical bonding, acids/bases, organic basics. 
Biology: cell biology, human systems, ecology, genetics basics. 
Questions test practical scientific knowledge, not just recall.`,
      },
    ],
    totalQuestions: 100,
    specialInstructions: `NDA MUST include defence-specific content in the GK section. 
Mention actual Indian military exercises (Tasman Saber, Yudh Abhyas, Shakti), 
specific missiles/weapons (Akash, Nag, BrahMos, Tejas LCA), 
and India's defence organizations (DRDO, OFB, Ordnance factories). 
Math questions should be at Class 12 standard — harder than SSC but easier than JEE.`,
  },

  // ─────────────────────── CDS ──────────────────────
  cds: {
    id: 'cds',
    fullName: 'Combined Defence Services (CDS) Examination',
    examStyle: `CDS exam by UPSC for IMA/INA/AFA entry. 3 papers: English (100Q, 2hrs), 
General Knowledge (100Q, 2hrs), Elementary Mathematics (100Q, 2hrs). 
For IMA/INA/AFA, all 3 papers. For OTA, only English+GK. 
CDS is more challenging than NDA in English and GK but Math is elementary (up to Class 10).`,
    languageStyle: `Advanced formal English. GK tests deeper analytical understanding than NDA. 
Defence-specific content is critical. Questions on international affairs and defence policy.`,
    pyqTrends: `English: RC on complex topics, grammar, vocabulary, ordering sentences. 
GK: Current Affairs (international + national), Defence technology, Indian polity, Economy, History. 
Math: Arithmetic, Algebra, Geometry, Trigonometry at Class 10 level.`,
    markingScheme: `+1/-0.33 per question.`,
    sections: [
      {
        key: 'Section A', type: 'English Language', name: 'English Comprehension (CDS)',
        count: 25, marks: 1,
        difficultyProfile: diffProfile(25, 5, 13, 7),
        desc: `CDS English MCQs. Higher difficulty than NDA. Include: 
Advanced Reading Comprehension (literary/historical passages), 
Precise writing (sentence ordering), Advanced vocabulary (contextual meaning), 
Spotting errors (complex grammar: reported speech, conditionals, subjunctive), 
Antonyms/Synonyms (advanced vocabulary), Idioms & Phrases.`,
      },
      {
        key: 'Section B', type: 'General Awareness', name: 'General Knowledge (CDS)',
        count: 40, marks: 1,
        difficultyProfile: diffProfile(40, 8, 20, 12),
        desc: `CDS GK — deeper than NDA. Include:
1. Defence & Strategic Affairs: India's defence policy, nuclear doctrine, major operations, alliances
2. International Affairs: G7, G20, ASEAN, UN bodies, international treaties, border disputes
3. Indian History: Ancient, Medieval, Modern — analytical questions
4. Geography: Economic geography, resource distribution, climate
5. Indian Polity: Constitutional amendments, landmark judgments, governance
6. Economy: Current economic indicators, policy frameworks
7. Science & Technology: Space, nuclear, IT developments
8. Current Affairs: last 12 months major events`,
      },
      {
        key: 'Section C', type: 'MCQ', name: 'Elementary Mathematics (CDS)',
        count: 25, marks: 1,
        difficultyProfile: diffProfile(25, 8, 12, 5),
        desc: `CDS Math at Class 10 level. Topics: Arithmetic (percentage, SI/CI, profit-loss, ratio, time-work, 
time-distance), Algebra (linear/quadratic equations, polynomials), Geometry (triangles, circles, polygons), 
Trigonometry (ratios, identities, heights & distances), Statistics (mean, median, mode). 
All questions require calculation with 4 numerical options.`,
      },
      {
        key: 'Section D', type: 'Short Answer', name: 'Analytical Questions (CDS Level)',
        count: 10, marks: 2,
        difficultyProfile: diffProfile(10, 1, 5, 4),
        desc: `CDS-level analytical questions requiring short written answers (3-5 sentences). 
Test strategic thinking: "Analyze the significance of India's nuclear doctrine", 
"Discuss the role of ASEAN in Indo-Pacific security architecture". 
Answers must be informed, analytical, and defence/policy oriented.`,
      },
    ],
    totalQuestions: 100,
    specialInstructions: `CDS must include international relations questions: India's neighbourhood policy, 
India's strategic alliances, UN peacekeeping missions of Indian Armed Forces, 
International military exercises involving India. 
English section must test advanced grammar that a prospective officer should know.`,
  },

  // ─────────────────────── MAHARASHTRA BOARD ──────────────────────
  'mh-board': {
    id: 'mh-board',
    fullName: 'Maharashtra State Board of Secondary & Higher Secondary Education (MSBSHSE)',
    examStyle: `Maharashtra Board (SSC Class 10, HSC Class 12) has a distinct pattern with the 
"Question Paper Pattern" officially published. SSC has: MCQ-type, Attempt any X of Y, 
and structured answer sections. The board uses a "written answer" culture where marks are awarded 
for specific key points. Maharashtra-specific content (geography, history) is tested in Social Sciences.`,
    languageStyle: `Standard English with Maharashtra state curriculum language. Questions are structured 
with sub-parts (a), (b), (c). Science questions include practical-oriented questions.`,
    pyqTrends: `SSC: Science — Life Processes, Refraction, Magnetic Effects. 
SSC Math — Algebra (linear equations in 2 variables), Geometry (proofs), Statistics. 
Social Science — Maharashtra geography, History of India with Maharashtra's role. 
HSC — Physics (semiconductors, alternating current), Chemistry (electrochemistry, polymers).`,
    markingScheme: `SSC: 1-mark (MCQ/VSA), 2-marks (SA), 3-marks (medium), 5-marks (long). 
HSC: 2-marks, 4-marks, 7-marks question types.`,
    sections: [
      {
        key: 'Section A', type: 'MCQ', name: 'MCQ (Maharashtra Board)',
        count: 15, marks: 1,
        difficultyProfile: diffProfile(15, 5, 7, 3),
        desc: `Maharashtra SSC/HSC MCQs. 4 options, one correct. Test chapter concepts in MSBSHSE style. 
Include questions about Maharashtra-specific content for Social Sciences.`,
      },
      {
        key: 'Section B', type: 'Fill in the Blanks', name: 'Fill in the Blanks',
        count: 8, marks: 1,
        difficultyProfile: diffProfile(8, 4, 3, 1),
        desc: `One blank "________" per sentence. Test chapter-specific terms from Maharashtra board textbooks.`,
      },
      {
        key: 'Section C', type: 'Very Short Answer', name: 'Very Short Answer (1-2 marks)',
        count: 10, marks: 2,
        difficultyProfile: diffProfile(10, 4, 4, 2),
        desc: `Answer in 1–2 sentences. Test definitions, differences, key concepts from MSBSHSE syllabus.`,
      },
      {
        key: 'Section D', type: 'Short Answer', name: 'Short Answer (3-4 marks)',
        count: 12, marks: 3,
        difficultyProfile: diffProfile(12, 3, 6, 3),
        desc: `Answer in 3-5 sentences. Explain processes, concepts, experiments. 
For Science: describe observation-inference structure. For Math: include worked examples.`,
      },
      {
        key: 'Section E', type: 'Long Answer', name: 'Long Answer (5-7 marks)',
        count: 15, marks: 5,
        difficultyProfile: diffProfile(15, 2, 7, 6),
        desc: `Answer in 6-10 sentences. Detailed explanation for Maharashtra board. 
Include: comparison tables, experimental observations, diagram references.`,
      },
    ],
    totalQuestions: 60,
    specialInstructions: `Maharashtra Board Social Science must include: 
Deccan Trap geography, Shivaji Maharaj and Maratha Empire, 
Maharashtra's contribution to the Independence movement (Bal Gangadhar Tilak, Gopal Krishna Gokhale), 
Western Ghats biodiversity, Maharashtra's industrial development (MIDC).`,
  },

  // ─────────────────────── KARNATAKA BOARD ──────────────────────
  'ka-board': {
    id: 'ka-board',
    fullName: 'Karnataka Secondary Education Examination Board (KSEEB)',
    examStyle: `KSEEB (SSLC Class 10, PUC Class 11-12). SSLC has MCQ, 1-mark, 2-mark, 3-mark, 4-mark questions. 
PUC (Pre-University Course) is rigorous, especially for Science — students preparing for NEET/JEE 
use Karnataka PUC as a strong foundation. Karnataka has state-specific history and culture content.`,
    languageStyle: `Standard English. Karnataka-specific content in Kannada-influenced English phrasing. 
PUC Science questions are at a high difficulty level, close to NEET/JEE.`,
    pyqTrends: `SSLC: Science — Chemical reactions, Electricity, Life Processes. 
Social Science — Karnataka geography (Western Ghats, Mysore kingdom), Freedom struggle in Karnataka. 
PUC Science: Physics (Optics, Electrostatics), Chemistry (Organic, Electrochemistry), 
Biology (Genetics, Human Physiology).`,
    markingScheme: `SSLC: 1-mark, 2-mark, 3-mark, 4-mark. PUC: 1-mark, 2-mark, 3-mark, 5-mark.`,
    sections: [
      {
        key: 'Section A', type: 'MCQ', name: 'MCQ (Karnataka Board)',
        count: 15, marks: 1,
        difficultyProfile: diffProfile(15, 5, 7, 3),
        desc: `KSEEB MCQs. 4 options. Include Karnataka-specific questions for Social Sciences.`,
      },
      {
        key: 'Section B', type: 'Fill in the Blanks', name: 'Fill in the Blanks',
        count: 8, marks: 1,
        difficultyProfile: diffProfile(8, 4, 3, 1),
        desc: `One blank "________" per sentence. Test KSEEB-specific terms.`,
      },
      {
        key: 'Section C', type: 'Very Short Answer', name: 'Very Short Answer (1-2 marks)',
        count: 10, marks: 2,
        difficultyProfile: diffProfile(10, 4, 4, 2),
        desc: `1-2 sentence answers. Definitions and basic facts from KSEEB syllabus.`,
      },
      {
        key: 'Section D', type: 'Short Answer', name: 'Short Answer (3 marks)',
        count: 12, marks: 3,
        difficultyProfile: diffProfile(12, 3, 6, 3),
        desc: `Answer in 3-5 sentences. KSEEB-style short answers.`,
      },
      {
        key: 'Section E', type: 'Long Answer', name: 'Long Answer (5 marks)',
        count: 15, marks: 5,
        difficultyProfile: diffProfile(15, 2, 7, 6),
        desc: `6-10 sentence detailed answers. PUC-level: derivations, diagrams, analysis.`,
      },
    ],
    totalQuestions: 60,
    specialInstructions: `Karnataka Board must include: Mysore Kingdom history, Kempegowda (Bengaluru founder), 
Haider Ali and Tipu Sultan, Western Ghats (Shola forests, biodiversity hotspots), 
Cauvery river dispute, Karnataka's contribution to literature (Kuvempu, Belagere Krishna Shastri).`,
  },

  // ─────────────────────── TAMIL NADU BOARD ──────────────────────
  'tn-board': {
    id: 'tn-board',
    fullName: 'Tamil Nadu State Board (TN SSLC & HSC)',
    examStyle: `Tamil Nadu Board has updated its curriculum (Samacheer Kalvi — uniform curriculum since 2010). 
SSLC (Class 10) and HSC (Class 11-12) follow Samacheer Kalvi textbooks. 
Questions test conceptual clarity and application. Tamil Nadu's textbooks are known for comprehensive 
content and often surpass NCERT in some topics. TN Board MCQs are competency-based.`,
    languageStyle: `Clear, precise English aligned with Samacheer Kalvi textbooks. 
Tamil Nadu-specific cultural and geographical content where relevant.`,
    pyqTrends: `SSLC Science: Chemical reactions, Optics, Human Systems. Math: Algebra, Geometry, Statistics. 
Social Science — Tamil civilization (Sangam literature, Chola/Pandya/Chera kingdoms), Tamil Nadu geography. 
HSC Physics: Electrostatics, Current Electricity, Semiconductor. Chemistry: Organic, Electrochemistry.`,
    markingScheme: `SSLC: 1-mark (MCQ/choose), 2-mark, 5-mark, 8-mark. HSC: 1-mark, 3-mark, 5-mark.`,
    sections: [
      {
        key: 'Section A', type: 'MCQ', name: 'MCQ (Tamil Nadu Board)',
        count: 15, marks: 1,
        difficultyProfile: diffProfile(15, 5, 7, 3),
        desc: `TN Board MCQs using Samacheer Kalvi language. 4 options. 
Include Tamil Nadu-specific content for Social Sciences: Sangam period, Tamil kingdoms, Tamil geography.`,
      },
      {
        key: 'Section B', type: 'Fill in the Blanks', name: 'Fill in the Blanks',
        count: 8, marks: 1,
        difficultyProfile: diffProfile(8, 4, 3, 1),
        desc: `One blank "________" per sentence from TN Board Samacheer Kalvi content.`,
      },
      {
        key: 'Section C', type: 'Very Short Answer', name: 'Very Short Answer (2 marks)',
        count: 10, marks: 2,
        difficultyProfile: diffProfile(10, 4, 4, 2),
        desc: `2-mark answers. 1-2 sentences. TN Board VSA style.`,
      },
      {
        key: 'Section D', type: 'Short Answer', name: 'Short Answer (5 marks)',
        count: 12, marks: 5,
        difficultyProfile: diffProfile(12, 3, 6, 3),
        desc: `5-mark TN Board answers. 5-7 sentences. Explain, describe, analyze chapter concepts.`,
      },
      {
        key: 'Section E', type: 'Long Answer', name: 'Long Answer (8 marks)',
        count: 15, marks: 8,
        difficultyProfile: diffProfile(15, 2, 7, 6),
        desc: `8-mark TN Board long answers. 8-10 sentences. Comprehensive explanations with diagrams described.`,
      },
    ],
    totalQuestions: 60,
    specialInstructions: `TN Board must include Tamil civilization content: 
Sangam literature (Tolkappiyam, Ettuthokai), Chola dynasty (Rajendra Chola, temple architecture), 
Pandya and Chera kingdoms, Tamil Nadu geography (Eastern Ghats, Palk Strait, Gulf of Mannar), 
Tamil freedom fighters (V.O. Chidambaram Pillai, Subramania Bharati). 
Use Samacheer Kalvi-specific terminology.`,
  },

  // ─────────────────────── KERALA BOARD ──────────────────────
  'kl-board': {
    id: 'kl-board',
    fullName: 'Kerala Board of Public Examinations (KBPE)',
    examStyle: `Kerala Board (SSLC Class 10, Plus Two Class 12) is activity-based and outcome-oriented. 
Questions emphasize application and higher-order thinking. Kerala Board is known for quality education 
and SSLC questions include "Activity" and "Project" type questions in addition to traditional MCQ and essay. 
Competency-based assessment is the norm.`,
    languageStyle: `Formal, clear English. Kerala Board questions often ask students to "Prepare a list", 
"Draw a flow chart", "Complete the table", "Identify the wrong statement". 
Application-oriented phrasing.`,
    pyqTrends: `SSLC Science: Atoms & Molecules, Optics, Human Disease. Math: Arithmetic Progressions, 
Coordinate Geometry, Statistics. Social Science — Kerala history, Western Ghats, backwaters. 
Plus Two: Physics, Chemistry, Biology at high level (NEET-preparatory for Biology).`,
    markingScheme: `SSLC: 1-mark, 2-mark, 4-mark, 6-mark. Plus Two: 1-mark, 2-mark, 3-mark, 4-mark, 6-mark.`,
    sections: [
      {
        key: 'Section A', type: 'MCQ', name: 'MCQ (Kerala Board)',
        count: 15, marks: 1,
        difficultyProfile: diffProfile(15, 4, 7, 4),
        desc: `Kerala Board MCQs. More analytical than other state boards. 
Include questions about Kerala-specific content (backwaters, Spice trade history, social reform movements).`,
      },
      {
        key: 'Section B', type: 'Fill in the Blanks', name: 'Fill in the Blanks',
        count: 8, marks: 1,
        difficultyProfile: diffProfile(8, 3, 4, 1),
        desc: `One blank "________" per sentence. Kerala Board-aligned content.`,
      },
      {
        key: 'Section C', type: 'Very Short Answer', name: 'Very Short Answer (2 marks)',
        count: 10, marks: 2,
        difficultyProfile: diffProfile(10, 3, 5, 2),
        desc: `2-mark Kerala Board answers. 1-3 sentences. Include "Identify", "Give an example", "State" questions.`,
      },
      {
        key: 'Section D', type: 'Short Answer', name: 'Short Answer (4 marks)',
        count: 12, marks: 4,
        difficultyProfile: diffProfile(12, 3, 6, 3),
        desc: `4-mark Kerala Board answers. 4-6 sentences. Application-based, not just recall. 
Include "Prepare a list of", "Draw a table showing", "Explain with diagram" type questions.`,
      },
      {
        key: 'Section E', type: 'Long Answer', name: 'Long Answer (6 marks)',
        count: 15, marks: 6,
        difficultyProfile: diffProfile(15, 1, 6, 8),
        desc: `6-mark Kerala Board answers. 7-9 sentences. Comprehensive analysis, projects, case studies. 
Kerala Board is known for "Activity-based" long answers — include these styles.`,
      },
    ],
    totalQuestions: 60,
    specialInstructions: `Kerala Board must include Kerala-specific content: 
Spice trade history (Portuguese/Dutch/British in Kerala), Kerala's backwaters and unique geography, 
Western Ghats Silent Valley, social reform movements (Sree Narayana Guru, SNDP Yogam), 
Kerala's high literacy rate context, Keralippuri (local governance) traditions.`,
  },

};

// ─────────────────────────────────────────────────────────────────────────────
// ALIAS MAP — maps board IDs from the catalog to profile keys
// ─────────────────────────────────────────────────────────────────────────────
const BOARD_ID_ALIASES: Record<string, string> = {
  // Direct matches
  icse: 'icse',
  isc: 'isc',
  cbse: 'cbse',
  'state-boards': 'state-boards',
  upsc: 'upsc',
  jpsc: 'jpsc',
  bpsc: 'bpsc',
  ssc: 'ssc',
  banking: 'banking',
  railway: 'railway',
  neet: 'neet',
  jee: 'jee',
  cat: 'cat',
  cuet: 'cuet',
  nda: 'nda',
  cds: 'cds',

  // State board variants
  'jharkhand-board': 'jharkhand',
  jharkhand: 'jharkhand',
  'bihar-board': 'bihar',
  bihar: 'bihar',
  'up-board': 'up-board',
  'wb-board': 'wb-board',
  'west-bengal-board': 'wb-board',
  'mh-board': 'mh-board',
  'maharashtra-board': 'mh-board',
  'ka-board': 'ka-board',
  'karnataka-board': 'ka-board',
  'tn-board': 'tn-board',
  'tamil-nadu-board': 'tn-board',
  'kl-board': 'kl-board',
  'kerala-board': 'kl-board',

  // Competitive exam variants
  'ibps': 'banking',
  'sbi-po': 'banking',
  'sbi-clerk': 'banking',
  'rrb': 'railway',
  'college': 'cbse',
};

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolves a board name/id from the catalog to a BoardProfile.
 * Performs case-insensitive, slug-tolerant matching.
 */
export function getBoardProfile(boardNameOrId: string): BoardProfile {
  const slug = boardNameOrId
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  const profileKey = BOARD_ID_ALIASES[slug];
  if (profileKey && BOARD_PROFILES[profileKey]) {
    return BOARD_PROFILES[profileKey];
  }

  // Fuzzy match on board name keywords
  if (slug.includes('icse')) return BOARD_PROFILES.icse;
  if (slug.includes('isc')) return BOARD_PROFILES.isc;
  if (slug.includes('cbse')) return BOARD_PROFILES.cbse;
  if (slug.includes('jharkhand')) return BOARD_PROFILES.jharkhand;
  if (slug.includes('bihar')) return BOARD_PROFILES.bihar;
  if (slug.includes('west-bengal') || slug.includes('wbbse') || slug.includes('wbchse')) return BOARD_PROFILES['wb-board'];
  if (slug.includes('maharashtra') || slug.includes('msbshse')) return BOARD_PROFILES['mh-board'];
  if (slug.includes('karnataka') || slug.includes('kseeb')) return BOARD_PROFILES['ka-board'];
  if (slug.includes('tamil') || slug.includes('samacheer')) return BOARD_PROFILES['tn-board'];
  if (slug.includes('kerala') || slug.includes('kbpe')) return BOARD_PROFILES['kl-board'];
  if (slug.includes('upsc')) return BOARD_PROFILES.upsc;
  if (slug.includes('jpsc')) return BOARD_PROFILES.jpsc;
  if (slug.includes('bpsc')) return BOARD_PROFILES.bpsc;
  if (slug.includes('ssc')) return BOARD_PROFILES.ssc;
  if (slug.includes('banking') || slug.includes('ibps') || slug.includes('sbi')) return BOARD_PROFILES.banking;
  if (slug.includes('railway') || slug.includes('rrb')) return BOARD_PROFILES.railway;
  if (slug.includes('neet')) return BOARD_PROFILES.neet;
  if (slug.includes('jee')) return BOARD_PROFILES.jee;
  if (slug.includes('cat')) return BOARD_PROFILES.cat;
  if (slug.includes('cuet')) return BOARD_PROFILES.cuet;
  if (slug.includes('nda')) return BOARD_PROFILES.nda;
  if (slug.includes('cds')) return BOARD_PROFILES.cds;
  if (slug.includes('state')) return BOARD_PROFILES['state-boards'];

  // Default fallback — use CBSE-style structure
  console.warn(`[BoardIntelligence] Unknown board "${boardNameOrId}" — using generic state board profile.`);
  return BOARD_PROFILES['state-boards'];
}

/**
 * Returns the effective sections for a given board, optionally filtered by subject.
 * This replaces the hardcoded SECTIONS array in ai.ts.
 */
export function getEffectiveSections(boardNameOrId: string, _subject?: string): BoardSectionSpec[] {
  return scaleSectionsToCount(getBoardProfile(boardNameOrId).sections);
}

/**
 * Returns the total question count for a board.
 */
export function getBoardTotalQuestions(boardNameOrId: string): number {
  return getEffectiveSections(boardNameOrId).reduce((sum, section) => sum + section.count, 0);
}

/**
 * Builds a comprehensive board-specific prompt header to inject before section prompts.
 * This is the core of the board intelligence — it tells the AI EXACTLY how to write questions.
 */
export function buildBoardContextPrompt(boardNameOrId: string, subject: string, chapter: string, className: string): string {
  const profile = getBoardProfile(boardNameOrId);
  const currentDate = new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'long',
    timeZone: 'Asia/Kolkata',
  }).format(new Date());

  return `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BOARD INTELLIGENCE CONTEXT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Board/Exam: ${profile.fullName}
Target: ${className} | Subject: ${subject} | Chapter: ${chapter}
Current date for up-to-date questions: ${currentDate}

EXAM STYLE:
${profile.examStyle}

LANGUAGE & TERMINOLOGY:
${profile.languageStyle}

PREVIOUS YEAR QUESTION TRENDS:
${profile.pyqTrends}

MARKING SCHEME:
${profile.markingScheme}

SPECIAL INSTRUCTIONS FOR THIS BOARD:
${profile.specialInstructions}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CRITICAL RULES — NEVER VIOLATE:
❌ Do NOT generate generic academic questions that could belong to any board.
❌ Do NOT copy templates — every question must be unique and board-authentic.
❌ Do NOT use placeholder language like "explain the concept of X in this chapter".
✅ Questions must feel like they came from an actual ${profile.fullName} examination paper.
✅ Use the exact language style, terminology, and question format of ${profile.fullName}.
✅ Follow the previous-year question trends for ${subject} - ${chapter}.
`;
}

export { BOARD_PROFILES };
