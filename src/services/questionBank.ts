import supabaseAdmin from '@/lib/supabase/admin';
import {
  Question,
  QuestionPayload,
  buildCacheKey,
  buildLocalFallback,
  generateQuestions,
  getActiveBoardTypes,
  getActiveTotalCount,
  normalizedQuestionKey,
  validateQuestionSet,
} from '@/services/ai';

export type QuestionBankSourceMetadata = {
  sourceUrl?: string;
  sourceTitle?: string;
  sourceYears?: number[];
  sourceKind?: string;
  sourceCheckedAt?: string;
  agentRunId?: string;
};

export type EnsureQuestionSetOptions = {
  forceRegenerate?: boolean;
  agentRefresh?: boolean;
  allowStarterOnMiss?: boolean;
  saveStarterFallback?: boolean;
  sourceMetadata?: QuestionBankSourceMetadata;
};

export type QuestionBankRow = {
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
  source_url?: string | null;
  source_title?: string | null;
  source_years?: number[] | null;
  source_kind?: string | null;
  source_checked_at?: string | null;
  agent_run_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected server error';
}

export function getErrorStatus(error: unknown): number {
  return typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof (error as { status?: unknown }).status === 'number'
    ? (error as { status: number }).status
    : 500;
}

export function mapDbQuestion(q: QuestionBankRow, index: number): Question {
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
    source_url: q.source_url || undefined,
    source_title: q.source_title || undefined,
    source_years: Array.isArray(q.source_years) ? q.source_years : undefined,
    source_kind: q.source_kind || undefined,
    source_checked_at: q.source_checked_at || undefined,
    agent_run_id: q.agent_run_id || undefined,
  };
}

export function sortQuestions(questions: Question[]): Question[] {
  return [...questions]
    .sort((a, b) => a.type.localeCompare(b.type) || a.question.localeCompare(b.question))
    .map((q, index) => ({ ...q, id: index + 1 }));
}

function isMissingColumnError(error: { code?: string; message?: string; details?: string } | null): boolean {
  const text = `${error?.code || ''} ${error?.message || ''} ${error?.details || ''}`.toLowerCase();
  return text.includes('pgrst204') ||
    text.includes('could not find') ||
    text.includes('column') && text.includes('does not exist');
}

function buildResponse(payload: QuestionPayload, cacheKey: string, questions: Question[], generatedAt?: string | null) {
  return {
    source: 'supabase',
    cacheKey,
    title: `${payload.board} ${payload.className} ${payload.subject}: ${payload.chapter}`,
    board: payload.board,
    className: payload.className,
    subject: payload.subject,
    chapter: payload.chapter,
    questions,
    generatedAt: generatedAt || new Date().toISOString(),
  };
}

async function getStoredRows(payload: QuestionPayload) {
  return supabaseAdmin
    .from('question_bank')
    .select('*')
    .eq('board', payload.board)
    .eq('class_name', payload.className)
    .eq('subject', payload.subject)
    .eq('chapter', payload.chapter);
}

async function insertQuestionRows(rowsToInsert: Record<string, unknown>[], metadata?: QuestionBankSourceMetadata) {
  const sourceCheckedAt = metadata?.sourceCheckedAt || new Date().toISOString();
  const enrichedRows = rowsToInsert.map((row) => ({
    ...row,
    source_url: metadata?.sourceUrl || null,
    source_title: metadata?.sourceTitle || null,
    source_years: metadata?.sourceYears?.length ? metadata.sourceYears : null,
    source_kind: metadata?.sourceKind || null,
    source_checked_at: sourceCheckedAt,
    agent_run_id: metadata?.agentRunId || null,
    updated_at: new Date().toISOString(),
  }));

  const { error: enrichedError } = await supabaseAdmin
    .from('question_bank')
    .insert(enrichedRows);

  if (!enrichedError) {
    return;
  }

  if (!isMissingColumnError(enrichedError)) {
    throw new Error(`Failed to store generated questions to Supabase: ${enrichedError.message}`);
  }

  console.warn('[Supabase] Source metadata columns are not available yet; retrying insert with base question columns only.');
  const { error: baseError } = await supabaseAdmin
    .from('question_bank')
    .insert(rowsToInsert);

  if (baseError) {
    throw new Error(`Failed to store generated questions to Supabase: ${baseError.message}`);
  }
}

export async function ensureQuestionSet(payload: QuestionPayload, options: EnsureQuestionSetOptions = {}) {
  const cacheKey = buildCacheKey(payload);
  const forceRegenerate = options.forceRegenerate === true;
  const isAgentRefresh = options.agentRefresh === true;
  const allowStarterOnMiss = options.allowStarterOnMiss !== false;
  const boardTotalCount = getActiveTotalCount(payload.board);

  if (!forceRegenerate) {
    const { data: dbQuestions, error: dbError } = await getStoredRows(payload);

    if (dbError) {
      console.error('Supabase question lookup failed:', dbError);
    }

    if (!dbError && dbQuestions?.length) {
      if (dbQuestions.length >= boardTotalCount) {
        const sortedQuestions = sortQuestions((dbQuestions as QuestionBankRow[]).map(mapDbQuestion));
        console.log(`[Cache] HIT: Serving ${sortedQuestions.length} cached questions for ${cacheKey}`);
        return buildResponse(payload, cacheKey, sortedQuestions, dbQuestions[0]?.created_at);
      }

      const validDbQuestions = validateQuestionSet((dbQuestions as QuestionBankRow[]).map(mapDbQuestion), payload);
      const boardSectionTypes = getActiveBoardTypes(payload.board);
      const cachedTypes = new Set((dbQuestions as QuestionBankRow[]).map(q => q.type || ''));
      const hasCorrectBoardTypes = [...cachedTypes].some(t => boardSectionTypes.has(t));

      if (!hasCorrectBoardTypes && dbQuestions.length > 0) {
        console.warn(`[Cache] STALE CACHE detected for ${cacheKey}: cached types [${[...cachedTypes].join(', ')}] do not match board types [${[...boardSectionTypes].join(', ')}]. Purging AI-generated rows (official/source-backed questions are preserved).`);
        await supabaseAdmin.from('question_bank').delete()
          .eq('board', payload.board)
          .eq('class_name', payload.className)
          .eq('subject', payload.subject)
          .eq('chapter', payload.chapter)
          .eq('official_source', false);
      } else if (validDbQuestions.length >= Math.ceil(boardTotalCount * 0.9)) {
        const sortedQuestions = sortQuestions(validDbQuestions);
        console.log(`[Cache] HIT: Serving ${sortedQuestions.length} cached questions for ${cacheKey}`);
        return buildResponse(payload, cacheKey, sortedQuestions, dbQuestions[0]?.created_at);
      } else {
        console.warn(`[Cache] PARTIAL: ${validDbQuestions.length}/${boardTotalCount} valid questions. Regenerating.`);
      }
    }
  }

  const generated = forceRegenerate || isAgentRefresh
    ? await generateQuestions(payload)
    : allowStarterOnMiss
      ? buildLocalFallback(payload, boardTotalCount, 1, 'Instant starter set created while the refresh agent prepares newer questions.')
      : await generateQuestions(payload);

  const finalQuestions = validateQuestionSet(generated.questions, payload);

  if (finalQuestions.length < Math.ceil(boardTotalCount * 0.9)) {
    throw new Error(`Generated question set failed validation: ${finalQuestions.length}/${boardTotalCount} valid questions (need at least 90%).`);
  }

  if (generated.model === 'local-fallback' && options.saveStarterFallback === false) {
    console.warn(`[Supabase] Agent skipped saving local fallback questions for ${payload.board} - ${payload.chapter}.`);
    return {
      source: 'starter',
      cacheKey,
      ...generated,
      cacheable: false,
      questions: finalQuestions,
    };
  }

  if (generated.cacheable !== false && finalQuestions.length > 0) {
    // Only clear previously-cached AI rows. Official/source-backed questions
    // (official_source = true) are never deleted here -- they are topped up
    // with freshly generated AI questions to reach boardTotalCount instead.
    const { error: deleteError } = await supabaseAdmin
      .from('question_bank')
      .delete()
      .eq('board', payload.board)
      .eq('class_name', payload.className)
      .eq('subject', payload.subject)
      .eq('chapter', payload.chapter)
      .eq('official_source', false);

    if (deleteError) {
      throw new Error(`Failed to clear incomplete question cache: ${deleteError.message}`);
    }

    const { count: officialCount, error: officialCountError } = await supabaseAdmin
      .from('question_bank')
      .select('id', { count: 'exact', head: true })
      .eq('board', payload.board)
      .eq('class_name', payload.className)
      .eq('subject', payload.subject)
      .eq('chapter', payload.chapter)
      .eq('official_source', true);

    if (officialCountError) {
      throw new Error(`Failed to count official questions: ${officialCountError.message}`);
    }

    const aiSlotsRemaining = Math.max(0, boardTotalCount - (officialCount || 0));
    const aiQuestionsToInsert = finalQuestions.slice(0, aiSlotsRemaining);

    const questionSource = options.sourceMetadata?.sourceKind || generated.provider || 'ai';
    const rowsToInsert = aiQuestionsToInsert.map((q) => ({
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
      source: q.source || questionSource,
      question: q.question,
      options: q.options,
      answer: q.answer,
      explanation: q.explanation || '',
      normalized_question: normalizedQuestionKey(q.question),
    }));

    if (rowsToInsert.length > 0) {
      await insertQuestionRows(rowsToInsert, options.sourceMetadata);
    }

    const { data: mergedRows, error: verifyError } = await getStoredRows(payload);

    if (verifyError) {
      throw new Error(`Failed to verify Supabase insert: ${verifyError.message}`);
    }

    const mergedQuestions = sortQuestions((mergedRows || []).map(mapDbQuestion));
    console.log(`[Supabase] Stored ${mergedQuestions.length}/${boardTotalCount} questions for ${payload.board} - ${payload.chapter} (${officialCount || 0} official, ${rowsToInsert.length} AI-generated)`);

    return buildResponse(payload, cacheKey, mergedQuestions, mergedRows?.[0]?.created_at);
  }

  return {
    source: generated.model === 'local-fallback' ? 'starter' : generated.provider || 'gemini',
    cacheKey,
    ...generated,
    questions: finalQuestions,
  };
}

export async function getQuestionSetStatus(payload: QuestionPayload) {
  const { data, error, count } = await supabaseAdmin
    .from('question_bank')
    .select('id,type,difficulty,source,source_url,source_title,source_years,source_kind,source_checked_at,agent_run_id,created_at,updated_at', {
      count: 'exact',
    })
    .eq('board', payload.board)
    .eq('class_name', payload.className)
    .eq('subject', payload.subject)
    .eq('chapter', payload.chapter);

  if (error) {
    throw new Error(`Failed to read question-bank status: ${error.message}`);
  }

  const rows = (data || []) as QuestionBankRow[];
  const byType = rows.reduce<Record<string, number>>((acc, row) => {
    const type = row.type || 'Unknown';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});
  const byDifficulty = rows.reduce<Record<string, number>>((acc, row) => {
    const difficulty = row.difficulty || 'Unknown';
    acc[difficulty] = (acc[difficulty] || 0) + 1;
    return acc;
  }, {});

  return {
    board: payload.board,
    className: payload.className,
    subject: payload.subject,
    chapter: payload.chapter,
    expected: getActiveTotalCount(payload.board),
    count: count || 0,
    ready: (count || 0) >= getActiveTotalCount(payload.board),
    byType,
    byDifficulty,
    newestCreatedAt: rows.map(row => row.created_at).filter(Boolean).sort().at(-1) || null,
    newestUpdatedAt: rows.map(row => row.updated_at || row.created_at).filter(Boolean).sort().at(-1) || null,
    source: rows.find(row => row.source_kind)?.source_kind || rows.find(row => row.source)?.source || null,
    sourceUrl: rows.find(row => row.source_url)?.source_url || null,
    sourceTitle: rows.find(row => row.source_title)?.source_title || null,
    sourceYears: rows.find(row => row.source_years)?.source_years || null,
    agentRunId: rows.find(row => row.agent_run_id)?.agent_run_id || null,
  };
}
