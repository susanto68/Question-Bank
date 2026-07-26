import { NextRequest, NextResponse } from 'next/server';
import { runQuestionRefreshAgents } from '@/services/questionAgents';
import { getErrorMessage, getErrorStatus } from '@/services/questionBank';

export const runtime = 'nodejs';
export const maxDuration = 300;

function isAuthorized(request: NextRequest): boolean {
  const configuredSecret = process.env.QUESTION_AGENT_SECRET || process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization') || '';

  if (configuredSecret) {
    return authHeader === `Bearer ${configuredSecret}`;
  }

  // Local/dev fallback plus Vercel cron bootstrap when CRON_SECRET is not configured yet.
  const userAgent = request.headers.get('user-agent') || '';
  return process.env.NODE_ENV !== 'production' || userAgent.toLowerCase().includes('vercel-cron');
}

function readBoolean(value: unknown, defaultValue: boolean): boolean {
  if (value === undefined || value === null || value === '') return defaultValue;
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes', 'y'].includes(String(value).toLowerCase());
}

function readNumber(value: unknown, defaultValue: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

async function readOptions(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const body = request.method === 'POST'
    ? await request.json().catch(() => ({}))
    : {};

  return {
    board: body.board ?? params.get('board') ?? undefined,
    className: body.className ?? params.get('className') ?? undefined,
    subject: body.subject ?? params.get('subject') ?? undefined,
    chapter: body.chapter ?? params.get('chapter') ?? undefined,
    limit: readNumber(body.limit ?? params.get('limit'), 2),
    offset: params.has('offset') || body.offset !== undefined
      ? readNumber(body.offset ?? params.get('offset'), 0)
      : undefined,
    forceRegenerate: readBoolean(body.forceRegenerate ?? params.get('forceRegenerate'), true),
    dryRun: readBoolean(body.dryRun ?? params.get('dryRun'), false),
    enableWebSearch: readBoolean(
      body.enableWebSearch ?? params.get('enableWebSearch'),
      process.env.QUESTION_AGENT_ENABLE_WEB_SEARCH !== '0'
    ),
  };
}

export async function GET(request: NextRequest) {
  return POST(request);
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized question refresh agent request.' }, { status: 401 });
  }

  try {
    const options = await readOptions(request);
    const result = await runQuestionRefreshAgents(options);
    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error: unknown) {
    console.error('API Error in /api/agent/refresh:', error);
    return NextResponse.json(
      { ok: false, error: getErrorMessage(error) },
      { status: getErrorStatus(error) }
    );
  }
}
