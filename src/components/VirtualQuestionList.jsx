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
          itemSize={width < 640 ? 326 : 372}
          width={width}
          overscanCount={6}
        >
          {({ index, style }) => (
            <div style={style} className="px-2 py-1.5 sm:px-4 sm:py-2">
              <QuestionCard question={questions[index]} index={index} />
            </div>
          )}
        </List>
      )}
    </AutoSizer>
  );
}
