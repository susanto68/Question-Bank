import { createClient } from '@supabase/supabase-js';

const questionCacheTable = process.env.SUPABASE_QUESTION_CACHE_TABLE || 'question_cache';

let supabaseAdmin;

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
    return null;
  }

  supabaseAdmin = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return supabaseAdmin;
}

function isMissingTable(error) {
  return error?.message?.includes(`'public.${questionCacheTable}'`) || error?.message?.includes('schema cache');
}

export async function getSupabaseCachedQuestions(cacheKey) {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from(questionCacheTable)
    .select('title, board, class_name, subject, chapter, questions, model, generated_at')
    .eq('cache_key', cacheKey)
    .maybeSingle();

  if (error) {
    if (isMissingTable(error)) {
      return null;
    }

    throw error;
  }

  if (!Array.isArray(data?.questions) || data.questions.length === 0) {
    return null;
  }

  return {
    title: data.title,
    board: data.board,
    className: data.class_name,
    subject: data.subject,
    chapter: data.chapter,
    questions: data.questions,
    model: data.model,
    generatedAt: data.generated_at,
  };
}

export async function saveSupabaseQuestionCache(cacheKey, payload) {
  const supabase = getSupabaseAdmin();

  if (!supabase || !Array.isArray(payload?.questions) || payload.questions.length === 0) {
    return;
  }

  const row = {
    cache_key: cacheKey,
    board: payload.board,
    class_name: payload.className,
    subject: payload.subject,
    chapter: payload.chapter,
    title: payload.title,
    questions: payload.questions,
    model: payload.model || null,
    generated_at: payload.generatedAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from(questionCacheTable).upsert(row, { onConflict: 'cache_key' });

  if (error && !isMissingTable(error)) {
    throw error;
  }
}
