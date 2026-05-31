import { NextResponse } from 'next/server';
import supabaseAdmin from '@/lib/supabase/admin';
import { generateQuestions, normalizePayload, buildCacheKey } from '@/services/ai';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = normalizePayload(body);
    const cacheKey = buildCacheKey(payload);
    const forceRegenerate = body.forceRegenerate === true;

    // 1. DATABASE-FIRST LOOKUP (if not forced to regenerate)
    if (!forceRegenerate) {
      const { data: dbQuestions, error: dbError } = await supabaseAdmin
        .from('question_bank')
        .select('*')
        .eq('board', payload.board)
        .eq('class_name', payload.className)
        .eq('subject', payload.subject)
        .eq('chapter', payload.chapter);

      if (!dbError && dbQuestions && dbQuestions.length >= 100) {
        // Sort questions logically
        const sortedQuestions = [...dbQuestions]
          .sort((a, b) => a.type.localeCompare(b.type) || a.question.localeCompare(b.question))
          .map((q, idx) => ({
            id: idx + 1,
            type: q.type,
            difficulty: q.difficulty,
            bloom_level: q.bloom_level || 'Understand',
            concept_tag: q.concept_tag || 'Core Concept',
            learning_outcome: q.learning_outcome || 'Understand chapter contents',
            estimated_time: q.estimated_time || 120,
            marks: q.marks || 2,
            source: q.source || 'cached',
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
    }

    // 2. AI SECOND (Cache Miss or Forced)
    const generated = await generateQuestions(payload);

    // 3. PERSIST GENERATED QUESTIONS TO DATABASE IF CACHEABLE
    if (generated.cacheable !== false && generated.questions.length > 0) {
      // Clear any existing questions for this chapter to ensure fresh generation
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
