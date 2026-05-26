import { create } from 'zustand';

import { generateQuestions } from '../services/api.js';
import { buildClientFallbackResult } from '../utils/fallbackQuestions.js';

const storageKey = 'ai-question-bank-cache-v1';
const maxCachedSets = 12;

function canUseStorage() {
  return typeof window !== 'undefined' && window.localStorage;
}

function isCacheableResult(result) {
  return result?.source !== 'starter' && Array.isArray(result?.questions) && result.questions.length >= 20;
}

function loadQuestionCache() {
  if (!canUseStorage()) {
    return {};
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) || '{}');
    const entries = Object.entries(parsed?.items || {});
    const freshEntries = entries.filter(([, item]) => isCacheableResult(item?.result));
    return Object.fromEntries(freshEntries.map(([key, item]) => [key, item.result]));
  } catch {
    return {};
  }
}

function saveQuestionCache(key, result) {
  if (!canUseStorage() || !isCacheableResult(result)) {
    return;
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) || '{}');
    const items = {
      ...(parsed.items || {}),
      [key]: {
        savedAt: Date.now(),
        result: {
          ...result,
          source: result.source === 'starter' ? 'starter' : result.source,
        },
      },
    };
    const sorted = Object.entries(items).sort((a, b) => b[1].savedAt - a[1].savedAt).slice(0, maxCachedSets);
    window.localStorage.setItem(storageKey, JSON.stringify({ items: Object.fromEntries(sorted) }));
  } catch {
    // Local storage is a speed layer only; ignore quota/private-mode failures.
  }
}

export const useQuestionStore = create((set, get) => ({
  activeKey: '',
  questionsByKey: loadQuestionCache(),
  loading: false,
  error: '',
  query: '',
  source: '',
  async fetchQuestions(payload) {
    const key = `${payload.board}|${payload.className}|${payload.subject}|${payload.chapter}`;
    const existing = get().questionsByKey[key];
    const hasFinalResult = existing && existing.source !== 'starter';
    let starterTimer;

    set({ activeKey: key, error: '', source: existing?.source || '', loading: !existing });

    if (hasFinalResult) {
      return existing;
    }

    try {
      starterTimer = window.setTimeout(() => {
        const state = get();

        if (state.activeKey !== key || state.questionsByKey[key]?.source !== undefined) {
          return;
        }

        const fallback = buildClientFallbackResult(payload, 'Gemini is still generating. Starter questions are shown first.');
        set((currentState) => ({
          loading: false,
          error: '',
          source: fallback.source,
          questionsByKey: {
            ...currentState.questionsByKey,
            [key]: fallback,
          },
        }));
      }, 18000);

      const result = await generateQuestions(payload);
      window.clearTimeout(starterTimer);
      saveQuestionCache(key, result);
      set((state) => ({
        loading: false,
        source: result.source,
        questionsByKey: {
          ...state.questionsByKey,
          [key]: result,
        },
      }));
      return result;
    } catch (error) {
      window.clearTimeout(starterTimer);
      const fallback = buildClientFallbackResult(payload, error.response?.data?.error || error.message);
      set((state) => ({
        loading: false,
        error: '',
        source: fallback.source,
        questionsByKey: {
          ...state.questionsByKey,
          [key]: fallback,
        },
      }));
      return fallback;
    }
  },
  setQuery(query) {
    set({ query });
  },
  clearError() {
    set({ error: '' });
  },
}));
