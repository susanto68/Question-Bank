import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import SelectionGrid from '../components/SelectionGrid.jsx';
import StepHeader from '../components/StepHeader.jsx';
import { boards, findBySlug, getBoard, getChapters, getClasses, getSubjects, slugify } from '../data/catalog.js';

const stageCopy = {
  board: ['Choose Board', 'Choose a board or exam category to begin'],
  class: ['Choose Class', 'ICSE and CBSE include Nursery to Class 12'],
  subject: ['Choose Subject', 'Pick the subject area for question generation'],
  chapter: ['Choose Chapter', 'Questions generate instantly after this step'],
};

function compactItems(values, description) {
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

export default function SelectionPage({ stage }) {
  const navigate = useNavigate();
  const { boardId, classId, subjectId } = useParams();
  const board = getBoard(boardId);

  const className = useMemo(() => {
    if (!boardId || !classId) return '';
    return findBySlug(getClasses(boardId), classId) || '';
  }, [boardId, classId]);

  const subjectName = useMemo(() => {
    if (!boardId || !subjectId) return '';
    return findBySlug(getSubjects(boardId, className), subjectId) || '';
  }, [boardId, className, subjectId]);

  const items = useMemo(() => {
    if (stage === 'board') return boards;
    if (!board) return [];
    if (stage === 'class') return compactItems(getClasses(board.id), 'Select this level');
    if (stage === 'subject') return compactItems(getSubjects(board.id, className), 'Generate a full bank for this subject');
    return compactItems(getChapters(subjectName), 'Generate 100 structured questions');
  }, [board, className, stage, subjectName]);

  const [title, subtitle] = stageCopy[stage];
  const steps = ['Board', board?.name, className, subjectName].filter(Boolean);

  function onSelect(item) {
    const id = item.id || slugify(item.name);

    if (stage === 'board') navigate(`/board/${id}`);
    if (stage === 'class') navigate(`/board/${board.id}/class/${id}`);
    if (stage === 'subject') navigate(`/board/${board.id}/class/${classId}/subject/${id}`);
    if (stage === 'chapter') navigate(`/board/${board.id}/class/${classId}/subject/${subjectId}/chapter/${id}`);
  }

  if (stage !== 'board' && !board) {
    return <SelectionGrid items={boards} onSelect={(item) => navigate(`/board/${item.id}`)} />;
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <StepHeader title={title} subtitle={subtitle} steps={steps.length ? steps : ['Board']} />
      <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto">
        <SelectionGrid items={items} onSelect={onSelect} />
      </div>
    </div>
  );
}
