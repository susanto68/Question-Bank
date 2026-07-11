import { NextResponse } from 'next/server';
import supabaseAdmin from '@/lib/supabase/admin';

const eventType = 'site_visit';

async function getVisitCount() {
  const { count, error } = await supabaseAdmin
    .from('analytics_events')
    .select('id', { count: 'exact', head: true })
    .eq('event_type', eventType);

  if (error) {
    throw error;
  }

  return count || 0;
}

export async function GET() {
  try {
    const count = await getVisitCount();
    return NextResponse.json({ ok: true, count });
  } catch (error) {
    console.error('Visitor count read failed:', error);
    return NextResponse.json({ ok: false, count: 0 }, { status: 200 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const forwardedFor = request.headers.get('x-forwarded-for') || '';
    const ipAddress = forwardedFor.split(',')[0]?.trim() || request.headers.get('x-real-ip') || '';
    const userAgent = request.headers.get('user-agent') || '';

    const { error } = await supabaseAdmin.from('analytics_events').insert({
      event_type: eventType,
      event_details: {
        path: typeof body.path === 'string' ? body.path.slice(0, 300) : '/',
        ip_address: ipAddress,
        user_agent: userAgent.slice(0, 500),
      },
    });

    if (error) {
      throw error;
    }

    const count = await getVisitCount();
    return NextResponse.json({ ok: true, count });
  } catch (error) {
    console.error('Visitor count update failed:', error);
    return NextResponse.json({ ok: false, count: 0 }, { status: 200 });
  }
}
