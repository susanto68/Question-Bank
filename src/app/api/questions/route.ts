import { NextResponse } from 'next/server';
import { normalizePayload } from '@/services/ai';
import { ensureQuestionSet, getErrorMessage, getErrorStatus } from '@/services/questionBank';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = normalizePayload(body);

    const result = await ensureQuestionSet(payload, {
      forceRegenerate: body.forceRegenerate === true,
      agentRefresh: body.agentRefresh === true,
      allowStarterOnMiss: true,
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('API Error in /api/questions:', error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: getErrorStatus(error) }
    );
  }
}
