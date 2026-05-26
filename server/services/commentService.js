import { createClient } from '@supabase/supabase-js';

const commentsTable = process.env.SUPABASE_COMMENTS_TABLE || 'comments';
const adminPhone = normalizePhone(process.env.ADMIN_PHONE || '9835379900');

let supabaseAdmin;

function makeError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function getSupabaseUrl() {
  return process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
}

function getSupabaseAdmin() {
  if (supabaseAdmin) {
    return supabaseAdmin;
  }

  const url = getSupabaseUrl();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw makeError('Supabase is not configured on the server.', 500);
  }

  supabaseAdmin = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return supabaseAdmin;
}

export function isSupabaseConfigured() {
  return Boolean(getSupabaseUrl() && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');

  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }

  return digits;
}

function cleanText(value, limit) {
  return String(value || '').trim().slice(0, limit);
}

function normalizeCommentPayload(body) {
  const payload = {
    name: cleanText(body.name, 80),
    phone: normalizePhone(body.phone),
    board: cleanText(body.board, 60),
    comment: cleanText(body.comment, 1500),
    page_path: cleanText(body.pagePath || body.page_path, 300),
  };

  if (!payload.name) throw makeError('Name is required.');
  if (!/^\d{10}$/.test(payload.phone)) throw makeError('Enter a valid 10 digit phone number.');
  if (!payload.board) throw makeError('Board is required.');
  if (!payload.comment) throw makeError('Comment is required.');

  return payload;
}

export async function createComment(body) {
  const payload = normalizeCommentPayload(body);
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from(commentsTable).insert(payload).select('*').single();

  if (error) {
    throw makeError(error.message, 500);
  }

  return data;
}

export async function verifyAdminToken(token) {
  if (!token) {
    throw makeError('Admin OTP login is required.', 401);
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) {
    throw makeError('Admin OTP login is invalid or expired.', 401);
  }

  const userPhone = normalizePhone(data.user.phone || data.user.user_metadata?.phone);

  if (userPhone !== adminPhone) {
    throw makeError('it for Admin only', 403);
  }

  return data.user;
}

export async function getAdminComments() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from(commentsTable).select('*').order('created_at', { ascending: false }).limit(200);

  if (error) {
    throw makeError(error.message, 500);
  }

  return data || [];
}
