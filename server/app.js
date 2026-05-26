import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';

import { getCachedQuestions, saveQuestionsToCache } from './services/cacheService.js';
import { createComment, getAdminComments, isSupabaseConfigured, sendAdminOtp, verifyAdminOtp, verifyAdminToken } from './services/commentService.js';
import { generateQuestions } from './services/geminiService.js';
import { getSupabaseCachedQuestions, saveSupabaseQuestionCache } from './services/supabaseQuestionCache.js';
import { buildCacheKey, normalizePayload } from './utils/questionPayload.js';

dotenv.config();

export function createApp() {
  const app = express();
  const allowedOrigin = process.env.CLIENT_ORIGIN;

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || !allowedOrigin || origin === allowedOrigin || process.env.NODE_ENV !== 'production') {
          callback(null, true);
          return;
        }
        callback(new Error('Origin is not allowed by CORS'));
      },
    }),
  );
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      cache: process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_APPLICATION_CREDENTIALS ? 'configured' : 'not-configured',
      gemini: process.env.GEMINI_API_KEY ? 'configured' : 'not-configured',
      supabase: isSupabaseConfigured() ? 'configured' : 'not-configured',
      model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
    });
  });

  app.post('/api/questions/generate', async (req, res, next) => {
    try {
      const payload = normalizePayload(req.body);
      const cacheKey = buildCacheKey(payload);
      const supabaseCached = await getSupabaseCachedQuestions(cacheKey).catch(() => null);

      if (supabaseCached) {
        res.json({ source: 'supabase', cacheKey, ...supabaseCached });
        return;
      }

      const cached = await getCachedQuestions(cacheKey);

      if (cached) {
        await saveSupabaseQuestionCache(cacheKey, cached).catch(() => {});
        res.json({ source: 'cache', cacheKey, ...cached });
        return;
      }

      const generated = await generateQuestions(payload);
      if (generated.cacheable !== false) {
        await saveQuestionsToCache(cacheKey, generated);
        await saveSupabaseQuestionCache(cacheKey, generated).catch(() => {});
      }
      res.json({ source: generated.model === 'local-fallback' ? 'starter' : 'gemini', cacheKey, ...generated });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/comments', async (req, res, next) => {
    try {
      const comment = await createComment(req.body);
      res.status(201).json({ ok: true, comment });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/comments/admin/send-otp', async (req, res, next) => {
    try {
      const result = await sendAdminOtp(req.body.phone);
      res.json({ ok: true, ...result });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/comments/admin/verify-otp', async (req, res, next) => {
    try {
      await verifyAdminOtp(req.body.phone, req.body.otp);
      const comments = await getAdminComments();
      res.json({ ok: true, comments });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/comments/admin', async (req, res, next) => {
    try {
      const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
      await verifyAdminToken(token);
      const comments = await getAdminComments();
      res.json({ ok: true, comments });
    } catch (error) {
      next(error);
    }
  });

  app.use((error, _req, res, _next) => {
    const status = error.status || 500;
    res.status(status).json({
      error: error.message || 'Unexpected server error',
      details: process.env.NODE_ENV === 'production' ? undefined : error.stack,
    });
  });

  return app;
}

export default createApp();
