import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell.jsx";

const AdverbGame = lazy(() => import("./pages/AdverbGame.jsx"));
const DailyQuiz = lazy(() => import("./pages/DailyQuiz.jsx"));
const PlayMode = lazy(() => import("./pages/PlayMode.jsx"));
const SentenceBuilder = lazy(() => import("./pages/SentenceBuilder.jsx"));
const Settings = lazy(() => import("./pages/Settings.jsx"));
const SynonymSelection = lazy(() => import("./pages/SynonymSelection.jsx"));
const Translate = lazy(() => import("./pages/Translate.jsx"));

function RouteFallback() {
  return <main className="page narrow-page">Loading...</main>;
}

export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<AppShell />}>
          <Route index element={<PlayMode />} />
          <Route path="play" element={<Navigate to="/" replace />} />
          <Route path="adverbs" element={<AdverbGame />} />
          <Route path="synonyms" element={<SynonymSelection />} />
          <Route path="sentence-builder" element={<SentenceBuilder />} />
          <Route path="translate" element={<Translate />} />
          <Route path="quiz" element={<DailyQuiz />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
