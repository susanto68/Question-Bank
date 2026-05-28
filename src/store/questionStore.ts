import { create } from 'zustand';
import { Question } from '@/services/ai';
import { buildClientFallbackResult } from '@/data/fallbackQuestions';

export interface QuestionsState {
  activeKey: string;
  questionsByKey: Record<string, any>;
  loading: boolean;
  error: string;
  query: string;
  source: string;
  fetchQuestions: (payload: { board: string; className: string; subject: string; chapter: string }) => Promise<any>;
  setQuery: (query: string) => void;
  clearError: () => void;
}

const storageKey = 'ai-question-bank-cache-v1';
const maxCachedSets = 12;

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function isCacheableResult(result: any): boolean {
  return result?.source !== 'starter' && Array.isArray(result?.questions) && result.questions.length >= 20;
}

function loadQuestionCache(): Record<string, any> {
  if (!canUseStorage()) {
    return {};
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) || '{}');
    const entries = Object.entries(parsed?.items || {});
    const freshEntries = entries.filter(([, item]: any) => isCacheableResult(item?.result));
    return Object.fromEntries(freshEntries.map(([key, item]: any) => [key, item.result]));
  } catch {
    return {};
  }
}

function saveQuestionCache(key: string, result: any): void {
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
    const sorted = Object.entries(items)
      .sort((a: any, b: any) => b[1].savedAt - a[1].savedAt)
      .slice(0, maxCachedSets);
    window.localStorage.setItem(storageKey, JSON.stringify({ items: Object.fromEntries(sorted) }));
  } catch {
    // Local storage is a speed layer only; ignore quota/private-mode failures.
  }
}

export const useQuestionStore = create<QuestionsState>((set, get) => ({
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
    let starterTimer: any;

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

        const fallback = buildClientFallbackResult(payload, 'AI is still generating. Starter questions are shown first.');
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

      const response = await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Failed to generate: ${response.statusText}`);
      }

      const result = await response.json();
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
    } catch (error: any) {
      window.clearTimeout(starterTimer);
      const fallback = buildClientFallbackResult(payload, error.message || 'Could not fetch questions.');
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
