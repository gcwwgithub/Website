import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell.jsx";

const AddEditWord = lazy(() => import("./pages/AddEditWord.jsx"));
const AdverbGame = lazy(() => import("./pages/AdverbGame.jsx"));
const DailyQuiz = lazy(() => import("./pages/DailyQuiz.jsx"));
const MainMenu = lazy(() => import("./pages/MainMenu.jsx"));
const PlayMode = lazy(() => import("./pages/PlayMode.jsx"));
const ProgressStats = lazy(() => import("./pages/ProgressStats.jsx"));
const SentenceBuilder = lazy(() => import("./pages/SentenceBuilder.jsx"));
const Settings = lazy(() => import("./pages/Settings.jsx"));
const SynonymSelection = lazy(() => import("./pages/SynonymSelection.jsx"));
const Translate = lazy(() => import("./pages/Translate.jsx"));
const WordList = lazy(() => import("./pages/WordList.jsx"));

function RouteFallback() {
  return <main className="page narrow-page">Loading...</main>;
}

export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<AppShell />}>
          <Route index element={<MainMenu />} />
          <Route path="play" element={<PlayMode />} />
          <Route path="adverbs" element={<AdverbGame />} />
          <Route path="synonyms" element={<SynonymSelection />} />
          <Route path="sentence-builder" element={<SentenceBuilder />} />
          <Route path="translate" element={<Translate />} />
          <Route path="quiz" element={<DailyQuiz />} />
          <Route path="words" element={<WordList />} />
          <Route path="words/new" element={<AddEditWord />} />
          <Route path="words/:wordId/edit" element={<AddEditWord />} />
          <Route path="progress" element={<ProgressStats />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
