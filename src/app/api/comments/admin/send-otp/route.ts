import { NextResponse } from 'next/server';
import supabaseAdmin from '@/lib/supabase/admin';

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

    if (phone !== adminPhone) {
      return NextResponse.json({ error: 'Unauthorized. Admin only.' }, { status: 403 });
    }

    const fallbackCode = process.env.ADMIN_OTP_CODE;

    // Trigger Supabase Sign In with OTP
    const { error } = await supabaseAdmin.auth.signInWithOtp({
      phone: `+91${adminPhone}`,
    });

    if (error) {
      const errMsg = error.message.toLowerCase();
      if (errMsg.includes('unsupported phone provider') || errMsg.includes('sms')) {
        if (fallbackCode) {
          return NextResponse.json({ ok: true, sent: true, fallback: true });
        }
        return NextResponse.json({ error: 'Supabase phone OTP is not enabled. Configure ADMIN_OTP_CODE.' }, { status: 500 });
      }
      return NextResponse.json({ error: error.message }, { status: error.status || 500 });
    }

    return NextResponse.json({ ok: true, sent: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Unexpected server error' }, { status: 500 });
  }
}
