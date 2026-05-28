import { NextResponse } from 'next/server';
import supabaseAdmin from '@/lib/supabase/admin';
import { generateQuestions, normalizePayload, buildCacheKey, Question } from '@/services/ai';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = normalizePayload(body);
    const cacheKey = buildCacheKey(payload);

    // 1. DATABASE-FIRST LOOKUP
    const { data: dbQuestions, error: dbError } = await supabaseAdmin
      .from('question_bank')
      .select('*')
      .eq('board', payload.board)
      .eq('class_name', payload.className)
      .eq('subject', payload.subject)
      .eq('chapter', payload.chapter);

    if (!dbError && dbQuestions && dbQuestions.length >= 100) {
      // Sort questions by original id/index if stored
      const sortedQuestions = [...dbQuestions]
        .sort((a, b) => {
          // If we have an id tracking index or options length, order logically
          return a.question.localeCompare(b.question);
        })
        .map((q, idx) => ({
          id: idx + 1,
          type: q.type,
          difficulty: q.difficulty,
          question: q.question,
          options: q.options || [],
          answer: q.answer,
          explanation: q.explanation || '',
        }));

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

    // 2. AI SECOND (Cache Miss)
    const generated = await generateQuestions(payload);

    // 3. PERSIST GENERATED QUESTIONS TO DATABASE IF CACHEABLE
    if (generated.cacheable !== false && generated.questions.length > 0) {
      // Clear any partial existing questions for this chapter
      await supabaseAdmin
        .from('question_bank')
        .delete()
        .eq('board', payload.board)
        .eq('class_name', payload.className)
        .eq('subject', payload.subject)
        .eq('chapter', payload.chapter);

      // Insert all generated questions
      const rowsToInsert = generated.questions.map((q) => ({
        cache_key: cacheKey,
        board: generated.board,
        class_name: generated.className,
        subject: generated.subject,
        chapter: generated.chapter,
        type: q.type,
        difficulty: q.difficulty,
        question: q.question,
        options: q.options,
        answer: q.answer,
        explanation: q.explanation || '',
        normalized_question: q.question.toLowerCase().replace(/[^a-z0-9]/g, ''),
      }));

      const { error: insertError } = await supabaseAdmin
        .from('question_bank')
        .insert(rowsToInsert);

      if (insertError) {
        console.error('Failed to store generated questions to Supabase:', insertError);
      }
    }

    return NextResponse.json({
      source: generated.model === 'local-fallback' ? 'starter' : generated.provider || 'gemini',
      cacheKey,
      ...generated,
    });
  } catch (error: any) {
    console.error('API Error in /api/questions:', error);
    return NextResponse.json(
      { error: error.message || 'Unexpected server error' },
      { status: error.status || 500 }
    );
  }
}
