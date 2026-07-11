import { NextResponse } from 'next/server';
import supabaseAdmin from '@/lib/supabase/admin';

/**
 * POST /api/questions/purge
 * Deletes cached questions by board / class / subject / chapter scope.
 *
 * Body examples:
 *   { "board": "upsc" }               → clear all UPSC questions
 *   { "board": "cbse", "chapter": "Atoms" } → clear specific chapter
 *   {}                                 → NOT allowed (must supply at least board)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { board, className, subject, chapter } = body as Record<string, string | undefined>;

    if (!board && !className && !subject && !chapter) {
      return NextResponse.json(
        { error: 'At least one filter (board, className, subject, chapter) is required.' },
        { status: 400 }
      );
    }

    // Build a safe delete: Supabase requires at least one .eq filter
    // We use board as the primary filter and chain others optionally
    let builder = supabaseAdmin.from('question_bank').delete();

    if (board)     builder = (builder as any).eq('board', board);
    if (className) builder = (builder as any).eq('class_name', className);
    if (subject)   builder = (builder as any).eq('subject', subject);
    if (chapter)   builder = (builder as any).eq('chapter', chapter);

    if (!board && !className && !subject && !chapter) {
      return NextResponse.json({ error: 'Safety check: no filters provided.' }, { status: 400 });
    }

    const { error } = await builder;

    if (error) {
      console.error('[Purge] Supabase delete error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const scope = [
      board && `board=${board}`,
      className && `class=${className}`,
      subject && `subject=${subject}`,
      chapter && `chapter=${chapter}`,
    ].filter(Boolean).join(', ');

    console.log(`[Purge] Successfully cleared cached questions: ${scope}`);

    return NextResponse.json({ success: true, message: `Cleared cache for: ${scope}` });
  } catch (error: unknown) {
    console.error('[Purge] Unexpected error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unexpected error' },
      { status: 500 }
    );
  }
}
