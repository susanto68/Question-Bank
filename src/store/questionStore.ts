import { create } from 'zustand';

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
  const hasStarterRows = Array.isArray(result?.questions) &&
    result.questions.some((question: any) => question?.source === 'local-fallback' || question?.source === 'starter');

  return result?.source !== 'starter' &&
    !hasStarterRows &&
    Array.isArray(result?.questions) &&
    result.questions.length >= 20;
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

    set({ activeKey: key, error: '', source: hasFinalResult ? existing.source || '' : '', loading: !hasFinalResult });

    if (hasFinalResult) {
      return existing;
    }

    try {
      const response = await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result?.error || `Failed to generate: ${response.statusText || response.status}`);
      }

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
      const message = error?.message || 'Could not fetch real board-specific questions.';
      set((state) => ({
        loading: false,
        error: message,
        source: '',
        questionsByKey: Object.fromEntries(
          Object.entries(state.questionsByKey).filter(([entryKey, value]: any) => (
            entryKey !== key || value?.source !== 'starter'
          )),
        ),
      }));
      return null;
    }
  },

  setQuery(query) {
    set({ query });
  },

  clearError() {
    set({ error: '' });
  },
}));
