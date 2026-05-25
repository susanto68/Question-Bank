import { create } from 'zustand';

import { generateQuestions } from '../services/api.js';
import { buildClientFallbackResult } from '../utils/fallbackQuestions.js';

export const useQuestionStore = create((set, get) => ({
  activeKey: '',
  questionsByKey: {},
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
