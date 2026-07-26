import { NextResponse } from 'next/server';
import supabaseAdmin from '@/lib/supabase/admin';
import {
  Question,
  buildLocalFallback,
  buildCacheKey,
  generateQuestions,
  normalizePayload,
  normalizedQuestionKey,
  validateQuestionSet,
  getActiveTotalCount,
  getActiveBoardTypes,
} from '@/services/ai';

type QuestionBankRow = {
  type?: string;
  difficulty?: string;
  bloom_level?: string | null;
  concept_tag?: string | null;
  learning_outcome?: string | null;
  estimated_time?: number | null;
  marks?: number | null;
  source?: string | null;
  question?: string;
  options?: unknown;
  answer?: string;
  explanation?: string | null;
  created_at?: string | null;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected server error';
}

function getErrorStatus(error: unknown): number {
  return typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof (error as { status?: unknown }).status === 'number'
    ? (error as { status: number }).status
    : 500;
}

function mapDbQuestion(q: QuestionBankRow, index: number): Question {
  return {
    id: index + 1,
    type: q.type || '',
    difficulty: q.difficulty || '',
    bloom_level: q.bloom_level || 'Understand',
    concept_tag: q.concept_tag || 'Core Concept',
    learning_outcome: q.learning_outcome || 'Understand chapter contents',
    estimated_time: q.estimated_time || 120,
    marks: q.marks || 2,
    source: q.source || 'cached',
    question: q.question || '',
    options: Array.isArray(q.options) ? q.options.map(String) : [],
    answer: q.answer || '',
    explanation: q.explanation || '',
  };
}

function sortQuestions(questions: Question[]): Question[] {
  return [...questions]
    .sort((a, b) => a.type.localeCompare(b.type) || a.question.localeCompare(b.question))
    .map((q, index) => ({ ...q, id: index + 1 }));
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = normalizePayload(body);
    const cacheKey = buildCacheKey(payload);
    const forceRegenerate = body.forceRegenerate === true;
    const isAgentRefresh = body.agentRefresh === true;

    // 1. DATABASE-FIRST LOOKUP (if not forced to regenerate)
    if (!forceRegenerate) {
      const { data: dbQuestions, error: dbError } = await supabaseAdmin
        .from('question_bank')
        .select('*')
        .eq('board', payload.board)
        .eq('class_name', payload.className)
        .eq('subject', payload.subject)
        .eq('chapter', payload.chapter);

      if (dbError) {
        console.error('Supabase question lookup failed:', dbError);
      }

      const boardTotalCount = getActiveTotalCount(payload.board);

      if (!dbError && dbQuestions?.length) {
        if (dbQuestions.length >= boardTotalCount) {
          const sortedQuestions = sortQuestions((dbQuestions as QuestionBankRow[]).map(mapDbQuestion));

          console.log(`[Cache] HIT: Serving ${sortedQuestions.length} cached questions for ${cacheKey}`);

          return NextResponse.json({
            source: 'supabase',
            cacheKey,
            title: `${payload.board} ${payload.className} ${payload.subject}: ${payload.chapter}`,
            board: payload.board,
            className: payload.className,
            subject: payload.subject,
            chapter: payload.chapter,
            questions: sortedQuestions,
            generatedAt: dbQuestions[0]?.created_at || new Date().toISOString(),
          });
        }

        const validDbQuestions = validateQuestionSet((dbQuestions as QuestionBankRow[]).map(mapDbQuestion), payload);
        const boardSectionTypes = getActiveBoardTypes(payload.board);

        // Detect stale cache: questions exist but are wrong type for this board
        // (e.g., old MCQ/Fill-in-Blanks saved when board was UPSC which needs 'UPSC MCQ')
        const cachedTypes = new Set((dbQuestions as QuestionBankRow[]).map(q => q.type || ''));
        const hasCorrectBoardTypes = [...cachedTypes].some(t => boardSectionTypes.has(t));

        if (!hasCorrectBoardTypes && dbQuestions.length > 0) {
          console.warn(`[Cache] STALE CACHE detected for ${cacheKey}: cached types [${[...cachedTypes].join(', ')}] don't match board types [${[...boardSectionTypes].join(', ')}]. Purging...`);
          await supabaseAdmin.from('question_bank').delete()
            .eq('board', payload.board)
            .eq('class_name', payload.className)
            .eq('subject', payload.subject)
            .eq('chapter', payload.chapter);
          // Fall through to AI generation
        } else if (validDbQuestions.length >= Math.ceil(boardTotalCount * 0.9)) {
          const sortedQuestions = sortQuestions(validDbQuestions);

          console.log(`[Cache] HIT: Serving ${sortedQuestions.length} cached questions for ${cacheKey}`);

          return NextResponse.json({
            source: 'supabase',
            cacheKey,
            title: `${payload.board} ${payload.className} ${payload.subject}: ${payload.chapter}`,
            board: payload.board,
            className: payload.className,
            subject: payload.subject,
            chapter: payload.chapter,
            questions: sortedQuestions,
            generatedAt: dbQuestions[0]?.created_at || new Date().toISOString(),
          });
        } else {
          console.warn(`[Cache] PARTIAL: ${validDbQuestions.length}/${boardTotalCount} valid questions. Regenerating.`);
        }
      }
    }

    // 2. AI SECOND (Cache Miss or Forced)
    const boardTotalForValidation = getActiveTotalCount(payload.board);
    const generated = forceRegenerate || isAgentRefresh
      ? await generateQuestions(payload)
      : buildLocalFallback(payload, boardTotalForValidation, 1, 'Instant starter set created while the refresh agent prepares newer questions.');
    const finalQuestions = validateQuestionSet(generated.questions, payload);

    if (finalQuestions.length < Math.ceil(boardTotalForValidation * 0.9)) {
      throw new Error(`Generated question set failed validation: ${finalQuestions.length}/${boardTotalForValidation} valid real questions (need at least 90%).`);
    }

    // 3. PERSIST GENERATED QUESTIONS TO DATABASE IF CACHEABLE
    if (generated.cacheable !== false && finalQuestions.length > 0) {
      // Clear any existing questions for this chapter to ensure fresh generation
      const { error: deleteError } = await supabaseAdmin
        .from('question_bank')
        .delete()
        .eq('board', payload.board)
        .eq('class_name', payload.className)
        .eq('subject', payload.subject)
        .eq('chapter', payload.chapter);

      if (deleteError) {
        throw new Error(`Failed to clear incomplete question cache: ${deleteError.message}`);
      }

      // Insert all generated questions
      const rowsToInsert = finalQuestions.map((q) => ({
        cache_key: cacheKey,
        board: generated.board,
        class_name: generated.className,
        subject: generated.subject,
        chapter: generated.chapter,
        type: q.type,
        difficulty: q.difficulty,
        bloom_level: q.bloom_level,
        concept_tag: q.concept_tag,
        learning_outcome: q.learning_outcome,
        estimated_time: q.estimated_time,
        marks: q.marks,
        source: q.source || generated.provider || 'ai',
        question: q.question,
        options: q.options,
        answer: q.answer,
        explanation: q.explanation || '',
        normalized_question: normalizedQuestionKey(q.question),
      }));

      const { error: insertError } = await supabaseAdmin
        .from('question_bank')
        .insert(rowsToInsert);

      if (insertError) {
        throw new Error(`Failed to store generated questions to Supabase: ${insertError.message}`);
      }

      const { count, error: verifyError } = await supabaseAdmin
        .from('question_bank')
        .select('id', { count: 'exact', head: true })
        .eq('board', payload.board)
        .eq('class_name', payload.className)
        .eq('subject', payload.subject)
        .eq('chapter', payload.chapter);

      if (verifyError) {
        throw new Error(`Failed to verify Supabase insert: ${verifyError.message}`);
      }

      console.log(`[Supabase] Stored ${count}/${finalQuestions.length} questions for ${payload.board} - ${payload.chapter}`);
    }

    return NextResponse.json({
      source: generated.model === 'local-fallback' ? 'starter' : generated.provider || 'gemini',
      cacheKey,
      ...generated,
      questions: finalQuestions,
    });
  } catch (error: unknown) {
    console.error('API Error in /api/questions:', error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: getErrorStatus(error) }
    );
  }
}
