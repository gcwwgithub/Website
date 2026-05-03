import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell.jsx";
import AddEditWord from "./pages/AddEditWord.jsx";
import DailyQuiz from "./pages/DailyQuiz.jsx";
import MainMenu from "./pages/MainMenu.jsx";
import PlayMode from "./pages/PlayMode.jsx";
import ProgressStats from "./pages/ProgressStats.jsx";
import Settings from "./pages/Settings.jsx";
import WordList from "./pages/WordList.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<AppShell />}>
        <Route index element={<MainMenu />} />
        <Route path="play" element={<PlayMode />} />
        <Route path="quiz" element={<DailyQuiz />} />
        <Route path="words" element={<WordList />} />
        <Route path="words/new" element={<AddEditWord />} />
        <Route path="words/:wordId/edit" element={<AddEditWord />} />
        <Route path="progress" element={<ProgressStats />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
