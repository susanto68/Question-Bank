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
    const phone = normalizePhone(body.phone);
    const otp = String(body.otp || '').trim().slice(0, 12);

    if (phone !== adminPhone) {
      return NextResponse.json({ error: 'Unauthorized. Admin only.' }, { status: 403 });
    }

    if (!otp) {
      return NextResponse.json({ error: 'OTP code is required.' }, { status: 400 });
    }

    const fallbackCode = process.env.ADMIN_OTP_CODE;

    if (fallbackCode) {
      if (otp !== fallbackCode) {
        return NextResponse.json({ error: 'Private admin OTP code is incorrect.' }, { status: 401 });
      }
      // If code is correct, load and return comments directly
      const { data: comments, error } = await supabaseAdmin
        .from(commentsTable)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ ok: true, comments: comments || [], sessionToken: 'fallback-admin-token' });
    }

    // Verify OTP using Supabase auth API
    const { data, error } = await supabaseAdmin.auth.verifyOtp({
      phone: `+91${adminPhone}`,
      token: otp,
      type: 'sms',
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: error.status || 401 });
    }

    const verifiedPhone = normalizePhone(data?.user?.phone || data?.user?.user_metadata?.phone || '');
    if (verifiedPhone !== adminPhone) {
      return NextResponse.json({ error: 'Unauthorized. Admin only.' }, { status: 403 });
    }

    // Load and return comments
    const { data: comments, error: fetchError } = await supabaseAdmin
      .from(commentsTable)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, comments: comments || [], sessionToken: data.session?.access_token });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Unexpected server error' }, { status: 500 });
  }
}
