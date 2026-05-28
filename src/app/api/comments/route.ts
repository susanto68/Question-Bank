import { NextResponse } from 'next/server';
import supabaseAdmin from '@/lib/supabase/admin';

const commentsTable = process.env.SUPABASE_COMMENTS_TABLE || 'comments';
const adminPhone = (process.env.ADMIN_PHONE || '9835379900').replace(/\D/g, '');

function normalizePhone(value: string) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  return digits;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = String(body.name || '').trim().slice(0, 80);
    const phone = normalizePhone(body.phone);
    const board = String(body.board || '').trim().slice(0, 6);
    const comment = String(body.comment || '').trim().slice(0, 1500);
    const pagePath = String(body.pagePath || body.page_path || '').trim().slice(0, 300);

    if (!name) return NextResponse.json({ error: 'Name is required.' }, { status: 400 });
    if (!/^\d{10}$/.test(phone)) return NextResponse.json({ error: 'Enter a valid 10-digit phone number.' }, { status: 400 });
    if (!board) return NextResponse.json({ error: 'Board is required.' }, { status: 400 });
    if (!comment) return NextResponse.json({ error: 'Comment is required.' }, { status: 400 });

    const payload = {
      name,
      phone,
      board,
      comment,
      page_path: pagePath,
    };

    const { data, error } = await supabaseAdmin.from(commentsTable).insert(payload).select('*').single();

    if (error) {
      console.error('Failed to create comment:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, comment: data }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Unexpected server error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');

    if (!token) {
      return NextResponse.json({ error: 'Admin token is required.' }, { status: 401 });
    }

    // Verify token with Supabase Auth
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) {
      return NextResponse.json({ error: 'Admin login is invalid or expired.' }, { status: 401 });
    }

    const verifiedPhone = normalizePhone(data.user.phone || data.user.user_metadata?.phone || '');
    if (verifiedPhone !== adminPhone) {
      return NextResponse.json({ error: 'Unauthorized. Admin only.' }, { status: 403 });
    }

    const { data: comments, error: fetchError } = await supabaseAdmin
      .from(commentsTable)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, comments: comments || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Unexpected server error' }, { status: 500 });
  }
}
