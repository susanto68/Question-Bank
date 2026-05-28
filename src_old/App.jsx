import { Navigate, Route, Routes } from 'react-router-dom';

import AppShell from './components/AppShell.jsx';
import QuestionPage from './pages/QuestionPage.jsx';
import SelectionPage from './pages/SelectionPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<SelectionPage stage="board" />} />
        <Route path="board/:boardId" element={<SelectionPage stage="class" />} />
        <Route path="board/:boardId/class/:classId" element={<SelectionPage stage="subject" />} />
        <Route path="board/:boardId/class/:classId/subject/:subjectId" element={<SelectionPage stage="chapter" />} />
        <Route path="board/:boardId/class/:classId/subject/:subjectId/chapter/:chapterId" element={<QuestionPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
