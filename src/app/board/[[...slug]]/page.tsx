'use client';

import { useEffect, useMemo, use } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import SelectionGrid from '@/components/SelectionGrid';
import StepHeader from '@/components/StepHeader';
import LoadingState from '@/components/LoadingState';
import EmptyState from '@/components/EmptyState';
import QuestionToolbar from '@/components/QuestionToolbar';
import QuestionList from '@/components/QuestionList';
import { useAuthStore } from '@/store/authStore';
import { useQuestionStore } from '@/store/questionStore';
import {
  boards,
  getBoard,
  getClasses,
  getSubjects,
  getChapters,
  findBySlug,
  slugify,
  Board,
} from '@/data/catalog';

interface PageProps {
  params: Promise<{
    slug?: string[];
  }>;
}

const stageCopy: Record<string, [string, string]> = {
  board: ['Choose Board', 'Choose a board or exam category to begin'],
  class: ['Choose Class', 'ICSE and CBSE include Nursery to Class 12'],
  subject: ['Choose Subject', 'Pick the subject area for question generation'],
  chapter: ['Choose Chapter', 'Questions generate instantly after this step'],
};

function compactItems(values: string[], description: string) {
  return values.map((name) => ({
    id: slugify(name),
    name,
    short: name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase(),
    description,
  }));
}

export default function BoardPage({ params }: PageProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const slug = resolvedParams.slug || [];

  const { user, loading: authLoading } = useAuthStore();
  const { activeKey, questionsByKey, loading: questionsLoading, error, query, fetchQuestions } = useQuestionStore();

  // Guest access is fully allowed for selections


  // Parse Slugs
  const boardId = slug.length >= 1 ? slug[0] : '';
  const classSlug = slug.length >= 3 && slug[1] === 'class' ? slug[2] : '';
  const subjectSlug = slug.length >= 5 && slug[3] === 'subject' ? slug[4] : '';
  const chapterSlug = slug.length >= 7 && slug[5] === 'chapter' ? slug[6] : '';

  const board = getBoard(boardId);

  const className = useMemo(() => {
    if (!boardId || !classSlug) return '';
    return findBySlug(getClasses(boardId), classSlug) || '';
  }, [boardId, classSlug]);

  const subjectName = useMemo(() => {
    if (!boardId || !subjectSlug) return '';
    return findBySlug(getSubjects(boardId, className), subjectSlug) || '';
  }, [boardId, className, subjectSlug]);

  const chapterName = useMemo(() => {
    if (!subjectName || !chapterSlug) return '';
    return findBySlug(getChapters(subjectName), chapterSlug) || '';
  }, [subjectName, chapterSlug]);

  // Determine stage
  const stage = useMemo(() => {
    if (!boardId) return 'board';
    if (!classSlug) return 'class';
    if (!subjectSlug) return 'subject';
    if (!chapterSlug) return 'chapter';
    return 'questions';
  }, [boardId, classSlug, subjectSlug, chapterSlug]);

  // Retrieve matching items
  const items = useMemo(() => {
    if (stage === 'board') return boards;
    if (!board) return [];
    if (stage === 'class') return compactItems(getClasses(board.id), 'Select this level');
    if (stage === 'subject') return compactItems(getSubjects(board.id, className), 'Generate a full bank for this subject');
    return compactItems(getChapters(subjectName), 'Generate 100 structured questions');
  }, [board, className, stage, subjectName]);

  // Steps breadcrumb
  const steps = useMemo(() => {
    return ['Board', board?.name, className, subjectName, chapterName].filter(Boolean) as string[];
  }, [board, className, subjectName, chapterName]);

  // Fetch questions if final stage
  const expectedKey = board && className && subjectName && chapterName 
    ? `${board.name}|${className}|${subjectName}|${chapterName}` 
    : '';

  useEffect(() => {
    if (stage === 'questions' && board && className && subjectName && chapterName) {
      fetchQuestions({
        board: board.name,
        className,
        subject: subjectName,
        chapter: chapterName,
      });
    }
  }, [stage, board, className, subjectName, chapterName, fetchQuestions]);

  const result = questionsByKey[activeKey] || questionsByKey[expectedKey];

  const filteredQuestions = useMemo(() => {
    const questions = result?.questions || [];
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return questions;
    }

    return questions.filter((question: any) => {
      const haystack = [
        question.type,
        question.difficulty,
        question.question,
        question.answer,
        question.explanation,
        ...(question.options || []),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [query, result]);

  // Handle click selects
  function onSelect(item: any) {
    const itemId = item.id || slugify(item.name);

    if (stage === 'board') {
      router.push(`/board/${itemId}`);
    } else if (stage === 'class') {
      router.push(`/board/${boardId}/class/${itemId}`);
    } else if (stage === 'subject') {
      router.push(`/board/${boardId}/class/${classSlug}/subject/${itemId}`);
    } else if (stage === 'chapter') {
      router.push(`/board/${boardId}/class/${classSlug}/subject/${subjectSlug}/chapter/${itemId}`);
    }
  }

  // Dynamic subtitles to display selected Board, Class, and Subject contexts clearly
  const dynamicSubtitle = useMemo(() => {
    if (stage === 'board') return 'Choose a board or exam category to begin';
    if (stage === 'class') return `Board: ${board?.name || ''}`;
    if (stage === 'subject') return `${board?.name || ''} • ${className}`;
    if (stage === 'chapter') return `${board?.name || ''} • ${className} • ${subjectName}`;
    return '';
  }, [stage, board, className, subjectName]);

  return (
    <AppShell>
      <div className="flex h-full flex-col overflow-hidden text-left bg-slate-950/40">
        {stage !== 'questions' ? (
          <>
            <StepHeader 
              title={stageCopy[stage][0]} 
              subtitle={dynamicSubtitle} 
              steps={steps.length ? steps : ['Board']} 
            />
            <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto">
              <SelectionGrid items={items} onSelect={onSelect} />
            </div>
          </>
        ) : (
          <>
            <StepHeader
              title={chapterName}
              subtitle={`${board?.name} • ${className} • ${subjectName}`}
              steps={steps}
            />

            {questionsLoading && !result ? <LoadingState label="AI Generator in progress..." /> : null}

            {!questionsLoading && error ? (
              <EmptyState title="Generation requires review" body={error} />
            ) : null}

            {!error && result ? (
              <>
                <QuestionToolbar result={result} total={filteredQuestions.length} />
                <div className="print-area min-h-0 flex-1 overflow-hidden">
                  <QuestionList questions={filteredQuestions} />
                </div>
              </>
            ) : null}
          </>
        )}
      </div>
    </AppShell>
  );
}
