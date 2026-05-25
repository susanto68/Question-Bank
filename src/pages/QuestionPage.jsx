import { useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';

import EmptyState from '../components/EmptyState.jsx';
import LoadingState from '../components/LoadingState.jsx';
import QuestionToolbar from '../components/QuestionToolbar.jsx';
import VirtualQuestionList from '../components/VirtualQuestionList.jsx';
import StepHeader from '../components/StepHeader.jsx';
import { findBySlug, getBoard, getChapters, getClasses, getSubjects } from '../data/catalog.js';
import { useQuestionStore } from '../store/questionStore.js';

export default function QuestionPage() {
  const { boardId, classId, subjectId, chapterId } = useParams();
  const board = getBoard(boardId);
  const className = board ? findBySlug(getClasses(board.id), classId) : '';
  const subject = board ? findBySlug(getSubjects(board.id, className), subjectId) : '';
  const chapter = subject ? findBySlug(getChapters(subject), chapterId) : '';
  const { activeKey, questionsByKey, loading, error, query, fetchQuestions } = useQuestionStore();
  const result = questionsByKey[activeKey];

  useEffect(() => {
    if (board && className && subject && chapter) {
      fetchQuestions({
        board: board.name,
        className,
        subject,
        chapter,
      });
    }
  }, [board, chapter, className, fetchQuestions, subject]);

  const filteredQuestions = useMemo(() => {
    const questions = result?.questions || [];
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return questions;
    }

    return questions.filter((question) => {
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

  if (!board || !className || !subject || !chapter) {
    return <EmptyState title="Selection not found" body="Use the sidebar to restart the board to chapter flow." />;
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <StepHeader
        title={chapter}
        subtitle={`${board.name} • ${className} • ${subject}`}
        steps={[board.name, className, subject, chapter, 'Generate Questions']}
      />

      {loading ? <LoadingState /> : null}

      {!loading && error ? (
        <EmptyState title="Generation needs attention" body={error} />
      ) : null}

      {!loading && !error && result ? (
        <>
          <QuestionToolbar result={result} total={filteredQuestions.length} />
          <div className="print-area min-h-0 flex-1">
            <VirtualQuestionList questions={filteredQuestions} />
          </div>
        </>
      ) : null}
    </div>
  );
}
