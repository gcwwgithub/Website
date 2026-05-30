import { lazy, Suspense, useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell.jsx";
import LoadingScreen from "./components/LoadingScreen.jsx";
import { preloadChineseQuizAssets } from "./services/preloadAssets.js";

const AdverbGame = lazy(() => import("./pages/AdverbGame.jsx"));
const DailyQuiz = lazy(() => import("./pages/DailyQuiz.jsx"));
const PlayMode = lazy(() => import("./pages/PlayMode.jsx"));
const SentenceBuilder = lazy(() => import("./pages/SentenceBuilder.jsx"));
const Settings = lazy(() => import("./pages/Settings.jsx"));
const SynonymSelection = lazy(() => import("./pages/SynonymSelection.jsx"));
const Translate = lazy(() => import("./pages/Translate.jsx"));

function RouteFallback() {
  return <LoadingScreen label="Loading page" />;
}

export default function App() {
  const [assetProgress, setAssetProgress] = useState(0);
  const [assetsReady, setAssetsReady] = useState(false);

  useEffect(() => {
    let isActive = true;

    preloadChineseQuizAssets((progress) => {
      if (isActive) {
        setAssetProgress(progress);
      }
    }).finally(() => {
      if (isActive) {
        setAssetsReady(true);
      }
    });

    return () => {
      isActive = false;
    };
  }, []);

  if (!assetsReady) {
    return <LoadingScreen label="Loading Chinese Quiz" progress={assetProgress} />;
  }

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
