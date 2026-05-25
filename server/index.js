import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';

import { getCachedQuestions, saveQuestionsToCache } from './services/cacheService.js';
import { generateQuestions } from './services/geminiService.js';
import { buildCacheKey, normalizePayload } from './utils/questionPayload.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 8787;
const allowedOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || origin === allowedOrigin || process.env.NODE_ENV !== 'production') {
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
    model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
  });
});

app.post('/api/questions/generate', async (req, res, next) => {
  try {
    const payload = normalizePayload(req.body);
    const cacheKey = buildCacheKey(payload);
    const cached = await getCachedQuestions(cacheKey);

    if (cached) {
      res.json({ source: 'cache', cacheKey, ...cached });
      return;
    }

    const generated = await generateQuestions(payload);
    if (generated.cacheable !== false) {
      await saveQuestionsToCache(cacheKey, generated);
    }
    res.json({ source: generated.model === 'local-fallback' ? 'starter' : 'gemini', cacheKey, ...generated });
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

app.listen(port, () => {
  console.log(`AI Question Bank API running on http://localhost:${port}`);
});
