import AutoSizer from '../vendor/AutoSizer.jsx';
import QuestionCard from './QuestionCard.jsx';
import { FixedSizeList as List } from 'react-window';

export default function VirtualQuestionList({ questions }) {
  if (!questions.length) {
    return (
      <div className="grid h-full place-items-center p-8 text-center text-sm text-slate-400">
        No questions match the current search.
      </div>
    );
  }

  return (
    <AutoSizer>
      {({ height, width }) => (
        <List
          className="virtual-scroll"
          height={height}
          itemCount={questions.length}
          itemSize={390}
          width={width}
          overscanCount={4}
        >
          {({ index, style }) => (
            <div style={style} className="px-3 py-2 sm:px-4">
              <QuestionCard question={questions[index]} index={index} />
            </div>
          )}
        </List>
      )}
    </AutoSizer>
  );
}
