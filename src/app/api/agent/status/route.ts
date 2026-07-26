import { NextRequest, NextResponse } from 'next/server';
import { normalizePayload } from '@/services/ai';
import { getErrorMessage, getErrorStatus, getQuestionSetStatus } from '@/services/questionBank';

export const runtime = 'nodejs';

function isAuthorized(request: NextRequest): boolean {
  const configuredSecret = process.env.QUESTION_AGENT_SECRET || process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization') || '';

  if (configuredSecret) {
    return authHeader === `Bearer ${configuredSecret}`;
  }

  return process.env.NODE_ENV !== 'production';
}

async function readPayload(request: NextRequest) {
  if (request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    return normalizePayload(body);
  }

  return normalizePayload({
    board: request.nextUrl.searchParams.get('board'),
    className: request.nextUrl.searchParams.get('className'),
    subject: request.nextUrl.searchParams.get('subject'),
    chapter: request.nextUrl.searchParams.get('chapter'),
  });
}

export async function GET(request: NextRequest) {
  return POST(request);
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized question status request.' }, { status: 401 });
  }

  try {
    const payload = await readPayload(request);
    const status = await getQuestionSetStatus(payload);
    return NextResponse.json({ ok: true, status });
  } catch (error: unknown) {
    console.error('API Error in /api/agent/status:', error);
    return NextResponse.json(
      { ok: false, error: getErrorMessage(error) },
      { status: getErrorStatus(error) }
    );
  }
}
