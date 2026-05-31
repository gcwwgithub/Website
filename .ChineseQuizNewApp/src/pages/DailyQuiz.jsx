import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import LoadingScreen from "../components/LoadingScreen.jsx";
import { filterCsvRowsBySelections, loadCsvWords, loadEnglishToChineseRows } from "../services/csvWords.js";
import {
  parseFilterValuesParam,
  readChineseToEnglishSettings,
  readEnglishToChineseSettings,
  saveChineseToEnglishSettings,
  saveEnglishToChineseSettings,
} from "../services/quizSettings.js";
import {
  applyRemoteColorProgress,
  fetchRemoteColorProgress,
  saveRemoteColorProgress,
  syncRemoteColorProgress,
} from "../services/colorProgressTracking.js";
import { getColorProgressId } from "../services/progressIdentity.js";
import { useSupabaseAuth } from "../services/supabaseAuth.js";

export default function DailyQuiz() {
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useSupabaseAuth();
  const savedSettings = useMemo(() => readChineseToEnglishSettings(), []);
  const savedEnglishSettings = useMemo(() => readEnglishToChineseSettings(), []);
  const mode = searchParams.get("mode") === "english-to-chinese" ? "english-to-chinese" : "chinese-to-english";
  const requestedCount = Math.max(1, Math.min(100, Number(searchParams.get("count")) || Number(savedSettings.questionCount) || 20));
  const activeSettings = mode === "english-to-chinese" ? savedEnglishSettings : savedSettings;
  const legacyFilterType = searchParams.get("filter") === "dao" ? "dao" : activeSettings.filterType;
  const legacyFilterValues = searchParams.get("values") || searchParams.get("band") || activeSettings.filterValues.join(",");
  const selectedHskValues = useMemo(
    () => parseFilterValuesParam(searchParams.get("hsk") || (legacyFilterType === "hsk" ? legacyFilterValues : activeSettings.hskValues.join(","))),
    [activeSettings.hskValues, legacyFilterType, legacyFilterValues, searchParams]
  );
  const selectedDaoValues = useMemo(
    () => parseFilterValuesParam(searchParams.get("dao") || (legacyFilterType === "dao" ? legacyFilterValues : activeSettings.daoValues.join(","))),
    [activeSettings.daoValues, legacyFilterType, legacyFilterValues, searchParams]
  );
  const includeFlagged =
    mode === "chinese-to-english"
      ? searchParams.has("flagged")
        ? searchParams.get("flagged") === "1"
        : activeSettings.includeFlagged === true
      : false;
  const rangeStart = Math.max(1, Number(searchParams.get("start")) || Number(activeSettings.rangeStart) || 1);
  const rangeEnd = Math.max(rangeStart, Number(searchParams.get("end")) || Number(activeSettings.rangeEnd) || Number.MAX_SAFE_INTEGER);
  const fallbackOrderMode = mode === "english-to-chinese" ? savedEnglishSettings.orderMode : savedSettings.orderMode;
  const orderMode = normalizeOrderMode(searchParams.has("order") ? searchParams.get("order") : fallbackOrderMode, mode);
  const fallbackTimerSeconds = mode === "english-to-chinese" ? savedEnglishSettings.timerSeconds : savedSettings.timerSeconds;
  const timerSeconds = Math.max(0, Math.min(600, Number(searchParams.get("timer")) || Number(fallbackTimerSeconds) || 0));
  const sessionRun = searchParams.get("run") || "";
  const reviewSetKey = searchParams.get("reviewSet") || "";
  const [csvRows, setCsvRows] = useState([]);
  const [csvIndex, setCsvIndex] = useState(0);
  const [csvResults, setCsvResults] = useState({ correct: 0, wrong: 0 });
  const [wrongCsvRows, setWrongCsvRows] = useState([]);
  const [skippedCsvRows, setSkippedCsvRows] = useState([]);
  const [csvHistory, setCsvHistory] = useState([]);
  const [isCsvFlipped, setIsCsvFlipped] = useState(false);
  const [wasAutoFlipped, setWasAutoFlipped] = useState(false);
  const [timerRemaining, setTimerRemaining] = useState(timerSeconds);
  const [showFrontPinyin, setShowFrontPinyin] = useState(savedSettings.showPinyin);
  const [showFrontUsage, setShowFrontUsage] = useState(savedSettings.showChineseUsage);
  const [showMeaningCount, setShowMeaningCount] = useState(
    searchParams.has("meaningCount") ? searchParams.get("meaningCount") !== "0" : savedSettings.showMeaningCount
  );
  const [showEnglishChineseSentence, setShowEnglishChineseSentence] = useState(
    searchParams.has("sentence") ? searchParams.get("sentence") !== "0" : savedEnglishSettings.showChineseSentence
  );
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const isDailyReview = orderMode === "daily-review";
  const isReviewMode = orderMode === "daily-review" || orderMode === "review-again";

  function trackColorProgress(row, storageKey, colorValue, loseStreak, options = {}) {
    if (!user?.id || !row) {
      return;
    }

    saveRemoteColorProgress({
      userId: user.id,
      row,
      storageKey,
      colorValue,
      loseStreak,
      isFlagged: options.isFlagged ?? row.__isFlagged,
    }).catch((trackingError) => {
      console.warn("Could not save Supabase color progress.", trackingError);
    });
  }

  function syncColorProgress(rows, storageKey, options = {}) {
    if (!user?.id || !rows?.length) {
      return;
    }

    syncRemoteColorProgress({
      userId: user.id,
      rows,
      storageKey,
      isNew: options.isNew,
    }).catch((trackingError) => {
      console.warn("Could not sync Supabase color progress.", trackingError);
    });
  }

  useEffect(() => {
    if (authLoading) {
      return;
    }

    async function loadQuiz() {
      setLoading(true);
      setError("");

      try {
        if (mode === "english-to-chinese") {
          const loadedRows = await loadEnglishToChineseRows();
          const loadedRowsWithProgress = user?.id
            ? applyRemoteColorProgress(
                loadedRows,
                await fetchRemoteColorProgress({ userId: user.id, storageKey: ENGLISH_COLOR_PROGRESS_KEY })
              )
            : applySavedColorProgress(loadedRows, ENGLISH_COLOR_PROGRESS_KEY);
          if (!user?.id) {
            pruneStaleColorProgress(loadedRows, ENGLISH_COLOR_PROGRESS_KEY);
          }
          const filteredRows = filterCsvRowsBySelections(loadedRowsWithProgress, {
            hskValues: selectedHskValues,
            daoValues: selectedDaoValues,
          });
          const rangedRows = applyRange(filteredRows, rangeStart, rangeEnd);
          setCsvRows(prepareEnglishToChineseSessionRows(buildCsvSession(rangedRows, requestedCount, orderMode, reviewSetKey)));
          setCsvIndex(0);
          setCsvResults({ correct: 0, wrong: 0 });
          setWrongCsvRows([]);
          setSkippedCsvRows([]);
          setCsvHistory([]);
          setIsCsvFlipped(false);
          setWasAutoFlipped(false);
          setTimerRemaining(timerSeconds);
          return;
        }

        if (mode === "chinese-to-english") {
          const loadedCsvRows = await loadCsvWords();
          const loadedRowsWithProgress = user?.id
            ? applyRemoteColorProgress(
                loadedCsvRows,
                await fetchRemoteColorProgress({ userId: user.id, storageKey: CSV_COLOR_PROGRESS_KEY })
              )
            : applySavedColorProgress(loadedCsvRows);
          if (!user?.id) {
            pruneStaleColorProgress(loadedCsvRows);
          }
          const filteredRows = filterCsvRowsBySelections(loadedRowsWithProgress, {
            hskValues: selectedHskValues,
            daoValues: selectedDaoValues,
            includeFlagged,
          });
          const rangedRows = applyRange(filteredRows, rangeStart, rangeEnd);
          setCsvRows(buildCsvSession(rangedRows, requestedCount, orderMode, reviewSetKey));
          setCsvIndex(0);
          setCsvResults({ correct: 0, wrong: 0 });
          setWrongCsvRows([]);
          setSkippedCsvRows([]);
          setCsvHistory([]);
          setIsCsvFlipped(false);
          setWasAutoFlipped(false);
          setTimerRemaining(timerSeconds);
          return;
        }

      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    }
    loadQuiz();
  }, [authLoading, includeFlagged, mode, orderMode, rangeEnd, rangeStart, requestedCount, reviewSetKey, selectedDaoValues, selectedHskValues, sessionRun, timerSeconds, user?.id]);

  useEffect(() => {
    if (loading || isReviewMode || timerSeconds <= 0 || isCsvFlipped || csvIndex >= csvRows.length) {
      setTimerRemaining(timerSeconds);
      return;
    }

    setTimerRemaining(timerSeconds);
    const intervalId = window.setInterval(() => {
      setTimerRemaining((current) => {
        if (current <= 1) {
          window.clearInterval(intervalId);
          setWasAutoFlipped(true);
          setIsCsvFlipped(true);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [csvIndex, csvRows.length, isCsvFlipped, isReviewMode, loading, timerSeconds]);

  useEffect(() => {
    if (mode !== "chinese-to-english" || orderMode === "review-again") {
      return;
    }

    saveChineseToEnglishSettings({
      questionCount: String(requestedCount),
      filterType: "hsk",
      filterValues: selectedHskValues,
      hskValues: selectedHskValues,
      daoValues: selectedDaoValues,
      includeFlagged,
      rangeStart: String(rangeStart),
      rangeEnd: Number.isFinite(rangeEnd) ? String(rangeEnd) : "",
      orderMode,
      timerSeconds: String(timerSeconds),
      showPinyin: showFrontPinyin,
      showChineseUsage: showFrontUsage,
      showMeaningCount,
    });
  }, [includeFlagged, mode, orderMode, rangeEnd, rangeStart, requestedCount, selectedDaoValues, selectedHskValues, showFrontPinyin, showFrontUsage, showMeaningCount, timerSeconds]);

  useEffect(() => {
    if (mode !== "english-to-chinese" || orderMode === "review-again") {
      return;
    }

    saveEnglishToChineseSettings({
      questionCount: String(requestedCount),
      rangeStart: String(rangeStart),
      rangeEnd: Number.isFinite(rangeEnd) ? String(rangeEnd) : "",
      filterType: "hsk",
      filterValues: selectedHskValues,
      hskValues: selectedHskValues,
      daoValues: selectedDaoValues,
      orderMode,
      timerSeconds: String(timerSeconds),
      showChineseSentence: showEnglishChineseSentence,
    });
  }, [mode, orderMode, rangeEnd, rangeStart, requestedCount, selectedDaoValues, selectedHskValues, showEnglishChineseSentence, timerSeconds]);

  if (loading) return <LoadingScreen label="Loading quiz" />;

  if (error) {
    return (
      <main className="page narrow-page">
        <section className="panel empty-state">
          <h2>Could not load quiz</h2>
          <p className="error">{error}</p>
        </section>
      </main>
    );
  }

  if (mode === "english-to-chinese") {
    const csvRow = csvRows[csvIndex];
    const isCsvComplete = csvRows.length > 0 && csvIndex >= csvRows.length;

    function answerEnglishQuestion(wasCorrect) {
      const shouldUpdateColor = !isReviewMode;
      const nextColor = shouldUpdateColor
        ? updateColorValue(csvRow?.Color, wasCorrect, { isSeenBefore: csvRow?.__hasSavedColorProgress })
        : csvRow?.Color;
      const answeredRow = csvRow && shouldUpdateColor ? { ...csvRow, Color: nextColor } : csvRow;
      if (answeredRow && shouldUpdateColor) {
        saveColorProgress(answeredRow, nextColor, ENGLISH_COLOR_PROGRESS_KEY);
        trackColorProgress(answeredRow, ENGLISH_COLOR_PROGRESS_KEY, nextColor);
      }

      setCsvHistory((current) => [
        ...current,
        {
          index: csvIndex,
          row: answeredRow,
          previousColor: shouldUpdateColor ? csvRow?.Color : undefined,
          type: wasCorrect ? "correct" : "wrong",
          wasFlipped: isCsvFlipped,
          wasAutoFlipped,
        },
      ]);
      setCsvRows((current) =>
        current.map((row, rowIndex) => (rowIndex === csvIndex ? answeredRow : row))
      );
      setCsvResults((current) => ({
        correct: current.correct + (wasCorrect ? 1 : 0),
        wrong: current.wrong + (wasCorrect ? 0 : 1),
      }));
      if (!wasCorrect && answeredRow) {
        setWrongCsvRows((current) => [...current, answeredRow]);
      }
      setIsCsvFlipped(false);
      setWasAutoFlipped(false);
      setCsvIndex((current) => current + 1);
    }

    function skipEnglishQuestion() {
      if (csvRow) {
        setCsvHistory((current) => [
          ...current,
          {
            index: csvIndex,
            row: csvRow,
            type: "skipped",
            wasFlipped: isCsvFlipped,
            wasAutoFlipped,
          },
        ]);
        setSkippedCsvRows((current) => [...current, csvRow]);
      }
      setIsCsvFlipped(false);
      setWasAutoFlipped(false);
      setCsvIndex((current) => current + 1);
    }

    function nextEnglishReviewCard() {
      if (isDailyReview && csvIndex >= csvRows.length - 1) {
        saveDailyReviewCompletion(csvRows, ENGLISH_COLOR_PROGRESS_KEY);
        syncColorProgress(
          csvRows.map((row) => ({ ...row, Color: getDailyReviewCompletionColor(row), __hasSavedColorProgress: true })),
          ENGLISH_COLOR_PROGRESS_KEY,
          { isNew: false }
        );
      }
      setIsCsvFlipped(false);
      setWasAutoFlipped(false);
      setCsvIndex((current) => current + 1);
    }

    function undoLastEnglishAction() {
      const lastAction = csvHistory[csvHistory.length - 1];
      if (!lastAction) {
        return;
      }

      setCsvHistory((current) => current.slice(0, -1));
      setCsvIndex(lastAction.index);
      setIsCsvFlipped(lastAction.wasFlipped);
      setWasAutoFlipped(lastAction.wasAutoFlipped || false);
      if (lastAction.previousColor !== undefined) {
        saveColorProgress(lastAction.row, lastAction.previousColor, ENGLISH_COLOR_PROGRESS_KEY);
        setCsvRows((current) =>
          current.map((row, rowIndex) =>
            rowIndex === lastAction.index ? { ...row, Color: lastAction.previousColor } : row
          )
        );
      }

      if (lastAction.type === "correct") {
        setCsvResults((current) => ({ ...current, correct: Math.max(0, current.correct - 1) }));
      } else if (lastAction.type === "wrong") {
        setCsvResults((current) => ({ ...current, wrong: Math.max(0, current.wrong - 1) }));
        setWrongCsvRows((current) => removeLastMatchingRow(current, lastAction.row));
      } else if (lastAction.type === "skipped") {
        setSkippedCsvRows((current) => removeLastMatchingRow(current, lastAction.row));
      }
    }

    if (isCsvComplete) {
      if (isReviewMode) {
        return (
          <main className="page narrow-page">
            <section className="quiz-card result-card">
              <p className="eyebrow">Daily Review complete</p>
              <h2>{csvRows.length} cards reviewed</h2>
              <ReviewedCardsList rows={csvRows} mode="english-to-chinese" />
              <div className="result-actions">
                <Link className="play-button" to={`/quiz?${buildReplayParams(searchParams, {
                  showChineseSentence: showEnglishChineseSentence,
                  order: "daily-review",
                })}`}>
                  Review new
                </Link>
                <Link className="secondary-button settings-link" to={`/quiz?${buildReviewAgainParams(searchParams, csvRows, {
                  showChineseSentence: showEnglishChineseSentence,
                })}`}>
                  Review again
                </Link>
                <Link className="secondary-button settings-link icon-only-button" to="/" aria-label="Go home">
                  <img src="data/home.svg" alt="" aria-hidden="true" />
                </Link>
              </div>
            </section>
          </main>
        );
      }

      return (
        <main className="page narrow-page">
          <section className="quiz-card result-card">
            <p className="eyebrow">Session complete</p>
            <h2>{csvResults.correct} / {csvRows.length}</h2>
            <div className="stats-grid">
              <section className="stat-card">
                <p>Correct</p>
                <strong>{csvResults.correct}</strong>
              </section>
              <section className="stat-card">
                <p>Wrong</p>
                <strong>{csvResults.wrong}</strong>
              </section>
              <section className="stat-card">
                <p>Skipped</p>
                <strong>{skippedCsvRows.length}</strong>
              </section>
            </div>
            {wrongCsvRows.length > 0 && (
              <section className="wrong-list">
                <h3>Words to review</h3>
                {wrongCsvRows.map((row, rowIndex) => (
                  <article className="wrong-row" key={`${row["Chinese Words"]}-${rowIndex}`}>
                    <strong>{getEnglishToChinesePromptText(row)}</strong>
                    <span>{row["Chinese Words"]}</span>
                    <span>{row.pinyin}</span>
                  </article>
                ))}
              </section>
            )}
            <div className="result-actions">
              <Link className="play-button" to={`/quiz?${buildReplayParams(searchParams, {
                showChineseSentence: showEnglishChineseSentence,
              })}`}>
                Play again
              </Link>
              <Link className="secondary-button settings-link" to={`/quiz?${buildReviewAgainParams(searchParams, csvRows, {
                showChineseSentence: showEnglishChineseSentence,
              })}`}>
                Review again
              </Link>
              <Link className="secondary-button settings-link icon-only-button" to="/" aria-label="Go home">
                <img src="data/home.svg" alt="" aria-hidden="true" />
              </Link>
            </div>
          </section>
        </main>
      );
    }

    return (
      <main className="page quiz-layout">
        <button
          className="drawer-toggle"
          onClick={() => setIsOptionsOpen(true)}
          aria-label="Open quiz options"
        >
          <img src="data/menu.svg" alt="" aria-hidden="true" />
        </button>
        <div
          className={`drawer-backdrop ${isOptionsOpen ? "open" : ""}`}
          onClick={() => setIsOptionsOpen(false)}
        />
        <aside className={`quiz-drawer ${isOptionsOpen ? "open" : ""}`}>
          <button
            className="drawer-close"
            onClick={() => setIsOptionsOpen(false)}
            aria-label="Close quiz options"
          >
            ×
          </button>
          <div className="drawer-content">
            <p className="eyebrow">Options</p>
            <Link className="drawer-link icon-drawer-link" to="/" aria-label="Quiz home">
              <img src="data/home.svg" alt="" aria-hidden="true" />
            </Link>
            <label>
              <input
                type="checkbox"
                checked={showEnglishChineseSentence}
                onChange={(event) => setShowEnglishChineseSentence(event.target.checked)}
              />
              Show Chinese sentence
            </label>
          </div>
        </aside>
        <div className="quiz-main">
          <section className="quiz-card csv-quiz-card">
            {csvRow ? (
              <div className="csv-preview">
                <EnglishToChineseFlashcard
                  row={csvRow}
                  isFlipped={isReviewMode || isCsvFlipped}
                  progressText={csvRows.length ? `${csvIndex + 1} / ${csvRows.length}` : "CSV preview"}
                  showChineseSentence={showEnglishChineseSentence}
                  timerSeconds={isReviewMode ? 0 : timerSeconds}
                  timerRemaining={timerRemaining}
                  wasAutoFlipped={wasAutoFlipped}
                  canUndo={!isReviewMode && csvHistory.length > 0}
                  onUndo={isReviewMode ? null : undoLastEnglishAction}
                />
                {isReviewMode ? (
                  <div className="card-actions single-action">
                    <button onClick={nextEnglishReviewCard}>Next</button>
                  </div>
                ) : !isCsvFlipped ? (
                  <div className="card-actions">
                    <button onClick={() => manuallyFlipCard(setIsCsvFlipped, setWasAutoFlipped)}>Flip</button>
                    <button className="secondary-action" onClick={skipEnglishQuestion}>Skip</button>
                  </div>
                ) : (
                  <div className="post-flip-actions">
                    <div className={`answer-actions ${wasAutoFlipped ? "auto-flipped" : ""}`}>
                      {!wasAutoFlipped && <button onClick={() => answerEnglishQuestion(true)}>Correct</button>}
                      <button className="wrong-button" onClick={() => answerEnglishQuestion(false)}>Wrong</button>
                    </div>
                    <button className="secondary-action" onClick={skipEnglishQuestion}>Skip</button>
                  </div>
                )}
              </div>
            ) : (
              <p>No words were found in EN.csv.</p>
            )}
          </section>
        </div>
      </main>
    );
  }

  if (mode === "chinese-to-english") {
    const csvRow = csvRows[csvIndex];
    const isCsvComplete = csvRows.length > 0 && csvIndex >= csvRows.length;

    function answerCsvQuestion(wasCorrect) {
      const shouldUpdateColor = !isReviewMode;
      const currentLoseStreak = getLoseStreakValue(csvRow);
      const nextLoseStreak = shouldUpdateColor ? getNextLoseStreak(currentLoseStreak, wasCorrect) : currentLoseStreak;
      const nextColor = shouldUpdateColor
        ? updateChineseToEnglishColorValue(csvRow?.Color, wasCorrect, currentLoseStreak)
        : csvRow?.Color;
      const answeredRow = csvRow && shouldUpdateColor
        ? { ...csvRow, Color: nextColor, "Lose Streak": String(nextLoseStreak) }
        : csvRow;
      if (answeredRow && shouldUpdateColor) {
        saveColorProgress(answeredRow, nextColor, CSV_COLOR_PROGRESS_KEY, {
          loseStreak: nextLoseStreak,
          isFlagged: answeredRow.__isFlagged,
        });
        trackColorProgress(answeredRow, CSV_COLOR_PROGRESS_KEY, nextColor, nextLoseStreak, {
          isFlagged: answeredRow.__isFlagged,
        });
      }

      setCsvHistory((current) => [
        ...current,
        {
          index: csvIndex,
          row: answeredRow,
          previousColor: shouldUpdateColor ? csvRow?.Color : undefined,
          previousLoseStreak: shouldUpdateColor ? csvRow?.["Lose Streak"] : undefined,
          type: wasCorrect ? "correct" : "wrong",
          wasFlipped: isCsvFlipped,
          wasAutoFlipped,
        },
      ]);
      setCsvRows((current) =>
        current.map((row, rowIndex) => (rowIndex === csvIndex ? answeredRow : row))
      );
      setCsvResults((current) => ({
        correct: current.correct + (wasCorrect ? 1 : 0),
        wrong: current.wrong + (wasCorrect ? 0 : 1),
      }));
      if (!wasCorrect && answeredRow) {
        setWrongCsvRows((current) => [...current, answeredRow]);
      }
      setIsCsvFlipped(false);
      setWasAutoFlipped(false);
      setCsvIndex((current) => current + 1);
    }

    function skipCsvQuestion() {
      if (csvRow) {
        setCsvHistory((current) => [
          ...current,
          {
            index: csvIndex,
            row: csvRow,
            type: "skipped",
            wasFlipped: isCsvFlipped,
            wasAutoFlipped,
          },
        ]);
        setSkippedCsvRows((current) => [...current, csvRow]);
      }
      setIsCsvFlipped(false);
      setWasAutoFlipped(false);
      setCsvIndex((current) => current + 1);
    }

    function nextCsvReviewCard() {
      if (isDailyReview && csvIndex >= csvRows.length - 1) {
        saveDailyReviewCompletion(csvRows);
        syncColorProgress(
          csvRows.map((row) => ({ ...row, Color: getDailyReviewCompletionColor(row), __hasSavedColorProgress: true })),
          CSV_COLOR_PROGRESS_KEY,
          { isNew: false }
        );
      }
      setIsCsvFlipped(false);
      setWasAutoFlipped(false);
      setCsvIndex((current) => current + 1);
    }

    function undoLastAction() {
      const lastAction = csvHistory[csvHistory.length - 1];
      if (!lastAction) {
        return;
      }

      setCsvHistory((current) => current.slice(0, -1));
      setCsvIndex(lastAction.index);
      setIsCsvFlipped(lastAction.wasFlipped);
      setWasAutoFlipped(lastAction.wasAutoFlipped || false);
      if (lastAction.previousColor !== undefined) {
        saveColorProgress(lastAction.row, lastAction.previousColor, CSV_COLOR_PROGRESS_KEY, {
          loseStreak: lastAction.previousLoseStreak,
        });
        setCsvRows((current) =>
          current.map((row, rowIndex) =>
            rowIndex === lastAction.index
              ? { ...row, Color: lastAction.previousColor, "Lose Streak": lastAction.previousLoseStreak ?? row["Lose Streak"] }
              : row
          )
        );
      }

      if (lastAction.type === "correct") {
        setCsvResults((current) => ({ ...current, correct: Math.max(0, current.correct - 1) }));
      } else if (lastAction.type === "wrong") {
        setCsvResults((current) => ({ ...current, wrong: Math.max(0, current.wrong - 1) }));
        setWrongCsvRows((current) => removeLastMatchingRow(current, lastAction.row));
      } else if (lastAction.type === "skipped") {
        setSkippedCsvRows((current) => removeLastMatchingRow(current, lastAction.row));
      }
    }

    function toggleCsvFlag() {
      if (!csvRow) {
        return;
      }

      const nextFlagged = !isFlaggedCard(csvRow);
      const nextRow = { ...csvRow, __isFlagged: nextFlagged };

      setCsvRows((current) =>
        current.map((row, rowIndex) => (rowIndex === csvIndex ? nextRow : row))
      );
      saveColorProgress(nextRow, nextRow.Color, CSV_COLOR_PROGRESS_KEY, {
        loseStreak: nextRow["Lose Streak"],
        isFlagged: nextFlagged,
      });
      trackColorProgress(nextRow, CSV_COLOR_PROGRESS_KEY, nextRow.Color, nextRow["Lose Streak"], {
        isFlagged: nextFlagged,
      });
    }

    if (isCsvComplete) {
      if (isReviewMode) {
        return (
          <main className="page narrow-page">
            <section className="quiz-card result-card">
              <p className="eyebrow">Daily Review complete</p>
              <h2>{csvRows.length} cards reviewed</h2>
              <ReviewedCardsList rows={csvRows} mode="chinese-to-english" />
              <div className="result-actions">
                <Link className="play-button" to={`/quiz?${buildReplayParams(searchParams, {
                  showPinyin: showFrontPinyin,
                  showChineseUsage: showFrontUsage,
                  showMeaningCount,
                  order: "daily-review",
                })}`}>
                  Review new
                </Link>
                <Link className="secondary-button settings-link" to={`/quiz?${buildReviewAgainParams(searchParams, csvRows, {
                  showPinyin: showFrontPinyin,
                  showChineseUsage: showFrontUsage,
                  showMeaningCount,
                })}`}>
                  Review again
                </Link>
                <Link className="secondary-button settings-link icon-only-button" to="/" aria-label="Go home">
                  <img src="data/home.svg" alt="" aria-hidden="true" />
                </Link>
              </div>
            </section>
          </main>
        );
      }

      return (
        <main className="page narrow-page">
          <section className="quiz-card result-card">
            <p className="eyebrow">Session complete</p>
            <h2>{csvResults.correct} / {csvRows.length}</h2>
            <div className="stats-grid">
              <section className="stat-card">
                <p>Correct</p>
                <strong>{csvResults.correct}</strong>
              </section>
              <section className="stat-card">
                <p>Wrong</p>
                <strong>{csvResults.wrong}</strong>
              </section>
              <section className="stat-card">
                <p>Skipped</p>
                <strong>{skippedCsvRows.length}</strong>
              </section>
            </div>
            {wrongCsvRows.length > 0 && (
              <section className="wrong-list">
                <h3>Words to review</h3>
                {wrongCsvRows.map((row, rowIndex) => (
                  <article className="wrong-row" key={`${row["Chinese Words"]}-${rowIndex}`}>
                    <strong>{row["Chinese Words"]}</strong>
                    <span>{row.pinyin}</span>
                    <span>{row["English Words"]}</span>
                  </article>
                ))}
              </section>
            )}
            {skippedCsvRows.length > 0 && (
              <section className="wrong-list skipped-list">
                <h3>Skipped cards</h3>
                {skippedCsvRows.map((row, rowIndex) => (
                  <article className="wrong-row" key={`${row["Chinese Words"]}-skipped-${rowIndex}`}>
                    <strong>{row["Chinese Words"]}</strong>
                    <span>{row.pinyin}</span>
                    <span>{row["English Words"]}</span>
                  </article>
                ))}
              </section>
            )}
            <div className="result-actions">
              <Link className="play-button" to={`/quiz?${buildReplayParams(searchParams, {
                showPinyin: showFrontPinyin,
                showChineseUsage: showFrontUsage,
                showMeaningCount,
              })}`}>
                Play again
              </Link>
              <Link className="secondary-button settings-link" to={`/quiz?${buildReviewAgainParams(searchParams, csvRows, {
                showPinyin: showFrontPinyin,
                showChineseUsage: showFrontUsage,
                showMeaningCount,
              })}`}>
                Review again
              </Link>
              <Link className="secondary-button settings-link icon-only-button" to="/" aria-label="Go home">
                <img src="data/home.svg" alt="" aria-hidden="true" />
              </Link>
            </div>
          </section>
        </main>
      );
    }

    return (
      <main className="page quiz-layout">
        <button
          className="drawer-toggle"
          onClick={() => setIsOptionsOpen(true)}
          aria-label="Open quiz options"
        >
          <img src="data/menu.svg" alt="" aria-hidden="true" />
        </button>
        <div
          className={`drawer-backdrop ${isOptionsOpen ? "open" : ""}`}
          onClick={() => setIsOptionsOpen(false)}
        />
        <aside className={`quiz-drawer ${isOptionsOpen ? "open" : ""}`}>
          <button
            className="drawer-close"
            onClick={() => setIsOptionsOpen(false)}
            aria-label="Close quiz options"
          >
            ×
          </button>
          <div className="drawer-content">
            <p className="eyebrow">Options</p>
            <Link className="drawer-link icon-drawer-link" to="/" aria-label="Quiz home">
              <img src="data/home.svg" alt="" aria-hidden="true" />
            </Link>
            <label>
              <input
                type="checkbox"
                checked={showFrontPinyin}
                onChange={(event) => setShowFrontPinyin(event.target.checked)}
              />
              Show pinyin
            </label>
            <label>
              <input
                type="checkbox"
                checked={showFrontUsage}
                onChange={(event) => setShowFrontUsage(event.target.checked)}
              />
              Show Chinese usage
            </label>
            <label>
              <input
                type="checkbox"
                checked={showMeaningCount}
                onChange={(event) => setShowMeaningCount(event.target.checked)}
              />
              Show meaning count
            </label>
          </div>
        </aside>
        <div className="quiz-main">
          <section className="quiz-card csv-quiz-card">
            {csvRow ? (
              <div className="csv-preview">
                <CsvFlashcard
                  row={csvRow}
                  isFlipped={isReviewMode || isCsvFlipped}
                  progressText={csvRows.length ? `${csvIndex + 1} / ${csvRows.length}` : "CSV preview"}
                  showFrontPinyin={showFrontPinyin}
                  showFrontUsage={showFrontUsage}
                  showMeaningCount={showMeaningCount}
                  timerSeconds={isReviewMode ? 0 : timerSeconds}
                  timerRemaining={timerRemaining}
                  wasAutoFlipped={wasAutoFlipped}
                  canUndo={!isReviewMode && csvHistory.length > 0}
                  onUndo={isReviewMode ? null : undoLastAction}
                  isFlagged={isFlaggedCard(csvRow)}
                  onToggleFlag={toggleCsvFlag}
                />
                {isReviewMode ? (
                  <div className="card-actions single-action">
                    <button onClick={nextCsvReviewCard}>Next</button>
                  </div>
                ) : !isCsvFlipped ? (
                  <div className="card-actions">
                    <button onClick={() => manuallyFlipCard(setIsCsvFlipped, setWasAutoFlipped)}>Flip</button>
                    <button className="secondary-action" onClick={skipCsvQuestion}>Skip</button>
                  </div>
                ) : (
                  <div className="post-flip-actions">
                    <div className={`answer-actions ${wasAutoFlipped ? "auto-flipped" : ""}`}>
                      {!wasAutoFlipped && <button onClick={() => answerCsvQuestion(true)}>Correct</button>}
                      <button className="wrong-button" onClick={() => answerCsvQuestion(false)}>Wrong</button>
                    </div>
                    <button className="secondary-action" onClick={skipCsvQuestion}>Skip</button>
                  </div>
                )}
              </div>
            ) : (
              <p>No words were found in the CSV.</p>
            )}
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <section className="panel empty-state">
        <h2>Choose a quiz mode</h2>
        <p>Start a CSV practice session from the play screen.</p>
        <Link className="button-link" to="/play">
          Back to Play
        </Link>
      </section>
    </main>
  );
}

function CsvFlashcard({
  row,
  isFlipped,
  progressText,
  showFrontPinyin,
  showFrontUsage,
  showMeaningCount,
  timerSeconds,
  timerRemaining,
  wasAutoFlipped,
  canUndo,
  onUndo,
  isFlagged,
  onToggleFlag,
}) {
  const rawSentence = row["Chinese Usage in a Sentence"];
  const sentence = isFlipped
    ? revealSentenceTarget(rawSentence, row["Chinese Words"])
    : hideSentenceTarget(rawSentence, row["Chinese Words"]);
  const shouldShowMeta = showFrontPinyin || isFlipped;
  const shouldShowUsage = showFrontUsage || isFlipped;
  const shouldShowDivider = shouldShowMeta && shouldShowUsage;
  const meaningCount = countMeaningForms(row["English Words"]);

  return (
    <article className="dictionary-card">
      <div className="dictionary-card-top">
        <p className="eyebrow">{progressText}</p>
        {isNewCard(row) && <span className="new-card-badge">NEW</span>}
        {onToggleFlag && (
          <button
            className={`flag-card-button ${isFlagged ? "active" : ""}`}
            onClick={onToggleFlag}
            type="button"
            aria-pressed={isFlagged}
          >
            {isFlagged ? "Flagged" : "Flag"}
          </button>
        )}
        <p className="question-id">{getDisplayCardId(row)}</p>
        {onUndo && (
          <button className="undo-button" onClick={onUndo} disabled={!canUndo} aria-label="Undo">
            <img src="data/undo.svg" alt="" aria-hidden="true" />
          </button>
        )}
      </div>
      <TimerStatus
        isFlipped={isFlipped}
        timerSeconds={timerSeconds}
        timerRemaining={timerRemaining}
        wasAutoFlipped={wasAutoFlipped}
      />

      <h2>{row["Chinese Words"]}</h2>
      {(row.Formal || (showMeaningCount && !isFlipped)) && (
        <div className="card-badge-row">
          {row.Formal && <p className="formal-note">{row.Formal}</p>}
          {showMeaningCount && !isFlipped && (
            <p className="meaning-count">
              {meaningCount} {meaningCount === 1 ? "meaning/form" : "meanings/forms"}
            </p>
          )}
        </div>
      )}
      <ColorBadge colorValue={row.Color} />

      <div className="dictionary-body-grid">
        <div className="dictionary-section-stack">
          {shouldShowMeta && (
            <div className="dictionary-section-row">
              <div className="dictionary-meta">
                {(showFrontPinyin || isFlipped) && <em>{row.pinyin}</em>}
                {isFlipped && <FormattedEnglishMeaning text={row["English Words"]} />}
              </div>
              <IconAudioButton label="Read Chinese word" onClick={() => speakText(row["Chinese Words"], "zh-CN")} />
            </div>
          )}

          {shouldShowDivider && <div className="dictionary-divider" />}

          {shouldShowUsage && (
            <div className="dictionary-section-row">
              <div className="dictionary-sentence">
                {(showFrontUsage || isFlipped) && <span className="field-label">Usage:</span>}
                {(showFrontUsage || isFlipped) && (
                  <p className="chinese-line">
                    {isFlipped ? highlightSentenceTarget(rawSentence, row["Chinese Words"]) : sentence}
                  </p>
                )}
                {isFlipped && <p className="sentence-translation">{row["English Usage in a sentence"]}</p>}
                {isFlipped && row.Notes && <NotesBlock notes={row.Notes} />}
              </div>
              <IconAudioButton label="Read sentence" onClick={() => speakText(sentence, "zh-CN")} />
            </div>
          )}
        </div>
      </div>

      {isFlipped && (
        <dl className="dictionary-details">
          <div>
            <dt>HSK</dt>
            <dd>{row["Band 0 HSK"] || "None"}</dd>
          </div>
          <div>
            <dt>Dao</dt>
            <dd>{row.Dao || "None"}</dd>
          </div>
        </dl>
      )}
    </article>
  );
}

function EnglishToChineseFlashcard({
  row,
  isFlipped,
  progressText,
  showChineseSentence,
  timerSeconds,
  timerRemaining,
  wasAutoFlipped,
  canUndo,
  onUndo,
}) {
  const promptRow = row.__selectedEnglishToChinesePrompt || {};
  const englishPrompt = promptRow["English Words"] || row["English Words"];
  const chineseSentence = getFirstValue(promptRow, [
    "Chinese Sentence",
    "Chinese sentence",
  ]) || getFirstValue(row, [
    "Chinese Sentence",
    "Chinese sentence",
    "Chinese Usage in a Sentence",
  ]);
  const sentencePinyin = getFirstValue(row, [
    "Chinese Sentence Pinyin",
    "Chinese sentence pinyin",
    "Sentence pinyin",
    "pinyin sentence",
  ]);
  const visibleSentence = isFlipped
    ? revealSentenceTarget(chineseSentence, row["Chinese Words"])
    : hideSentenceTarget(chineseSentence, row["Chinese Words"]);
  const hasSentence = Boolean(chineseSentence);

  return (
    <article className="dictionary-card english-card">
      <div className="dictionary-card-top">
        <p className="eyebrow">{progressText}</p>
        <p className="question-id">{row.__rowNumber || "?"}</p>
        {onUndo && (
          <button className="undo-button" onClick={onUndo} disabled={!canUndo} aria-label="Undo">
            <img src="data/undo.svg" alt="" aria-hidden="true" />
          </button>
        )}
      </div>
      <TimerStatus
        isFlipped={isFlipped}
        timerSeconds={timerSeconds}
        timerRemaining={timerRemaining}
        wasAutoFlipped={wasAutoFlipped}
      />

      <div className={`english-prompt ${getEnglishPromptSizeClass(englishPrompt)}`}>
        <span className="english-prompt-text">
          <FormattedEnglishMeaning text={englishPrompt} />
        </span>
      </div>
      {(promptRow.Formal || row.Formal) && (
        <div className="card-badge-row">
          <p className="formal-note">{promptRow.Formal || row.Formal}</p>
        </div>
      )}
      <ColorBadge colorValue={row.Color} />

      {isFlipped && (
        <div className="english-answer-block">
          <div className="dictionary-meta">
            <strong>{row["Chinese Words"]}</strong>
            <em>{row.pinyin}</em>
          </div>
          <IconAudioButton
            label="Read Chinese word"
            onClick={() => speakText(row["Chinese Words"], "zh-CN")}
          />
        </div>
      )}

      {showChineseSentence && hasSentence && (
        <div className="english-sentence-block">
          <div>
            <span className="field-label">Usage:</span>
            <p className="chinese-line">
              {isFlipped ? highlightSentenceTarget(chineseSentence, row["Chinese Words"]) : visibleSentence}
            </p>
            {sentencePinyin && <p className="pinyin-line">{sentencePinyin}</p>}
            {isFlipped && row.Notes && <NotesBlock notes={row.Notes} />}
          </div>
          <IconAudioButton
            label="Read Chinese sentence"
            onClick={() => speakText(visibleSentence, "zh-CN")}
          />
        </div>
      )}

      {isFlipped && (
        <dl className="dictionary-details english-details">
          <div>
            <dt>HSK</dt>
            <dd>{row["Band 0 HSK"] || "None"}</dd>
          </div>
          <div>
            <dt>Dao</dt>
            <dd>{row.Dao || "None"}</dd>
          </div>
        </dl>
      )}
    </article>
  );
}

function NotesBlock({ notes }) {
  return (
    <div className="csv-note-block">
      <span>Notes:</span>
      <p>{notes}</p>
    </div>
  );
}

function IconAudioButton({ label, onClick }) {
  return (
    <button className="icon-audio-button" type="button" aria-label={label} onClick={onClick}>
      <img src="data/volume.svg" alt="" aria-hidden="true" />
    </button>
  );
}

function TimerStatus({ isFlipped, timerSeconds, timerRemaining, wasAutoFlipped }) {
  if (timerSeconds <= 0 || (isFlipped && !wasAutoFlipped)) {
    return null;
  }

  return (
    <p className={`timer-status ${wasAutoFlipped ? "expired" : ""}`}>
      {wasAutoFlipped ? (
        "Auto flipped"
      ) : (
        <>
          Time remaining: <span className="timer-count">{timerRemaining}</span>
        </>
      )}
    </p>
  );
}

function getFirstValue(row, keys) {
  const key = keys.find((currentKey) => row[currentKey]);
  return key ? row[key] : "";
}

function getEnglishPromptSizeClass(text = "") {
  if (text.length > 110) {
    return "tiny";
  }
  if (text.length > 78) {
    return "very-long";
  }
  if (text.length > 48) {
    return "long";
  }
  return "";
}

function prepareEnglishToChineseSessionRows(rows) {
  return rows.map((row) => {
    const promptRows = Array.isArray(row.__englishToChinesePrompts) ? row.__englishToChinesePrompts : [];
    if (!promptRows.length) {
      return row;
    }

    return {
      ...row,
      __selectedEnglishToChinesePrompt: promptRows[Math.floor(Math.random() * promptRows.length)],
    };
  });
}

function getEnglishToChinesePromptText(row) {
  return row?.__selectedEnglishToChinesePrompt?.["English Words"] || row?.["English Words"] || "";
}

function FormattedEnglishMeaning({ text = "" }) {
  const lines = formatEnglishMeaningLines(text);

  if (lines.length <= 1) {
    return highlightBracketText(lines[0] || text);
  }

  return (
    <span className="formatted-english-meaning">
      {lines.map((line, index) => (
        <span key={`${line}-${index}`}>{highlightBracketText(line)}</span>
      ))}
    </span>
  );
}

function formatEnglishMeaningLines(text = "") {
  return text
    .replace(/\s+(?=(?:noun|verb|adjective|adverb|interjection|pronoun|preposition|conjunction|measure word|proper noun)\s*:)/gi, (match, offset, fullText) =>
      shouldKeepInlineWordFormLabel(fullText, offset, match) ? match : "\n"
    )
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function shouldKeepInlineWordFormLabel(text, offset, match) {
  return isSlashJoinedWordFormLabel(text, offset) || isCompoundVerbLabel(text, offset, match);
}

function isSlashJoinedWordFormLabel(text, offset) {
  const beforeLabel = text.slice(0, offset).trimEnd();
  return beforeLabel.endsWith("/");
}

function isCompoundVerbLabel(text, offset, match) {
  const labelText = text.slice(offset + match.length).toLowerCase();
  if (!labelText.startsWith("verb")) {
    return false;
  }

  const beforeLabel = text.slice(0, offset).trimEnd();
  return /\b(?:auxiliary|auxilary|modal|helping)$/.test(beforeLabel.toLowerCase());
}

function countMeaningForms(text = "") {
  const lines = formatEnglishMeaningLines(text);

  if (!lines.length) {
    return 1;
  }

  const count = lines.reduce((total, line) => total + countMeaningFormLine(line), 0);
  return Math.max(1, count);
}

function countMeaningFormLine(line) {
  if (/^pronounced as\b/i.test(line)) {
    return 0;
  }

  const colonIndex = line.indexOf(":");
  if (colonIndex === -1) {
    return 1;
  }

  const labelText = line.slice(0, colonIndex);
  const formCount = splitWordFormLabels(labelText).length;

  return Math.max(formCount, 1);
}

function splitWordFormLabels(text) {
  return text
    .split("/")
    .map((part) => part.trim())
    .filter(isWordFormLabel);
}

function isWordFormLabel(text) {
  return /^(?:noun|verb|auxiliary verb|auxilary verb|modal verb|helping verb|adjective|adverb|interjection|pronoun|preposition|conjunction|measure word|proper noun)$/i.test(text);
}

function highlightBracketText(text) {
  if (!text || !text.includes("[") || !text.includes("]")) {
    return text;
  }

  const parts = text.split(/(\[[^\]]+\])/g);
  return parts.map((part, index) => {
    const match = part.match(/^\[([^\]]+)\]$/);
    if (!match) {
      return <span key={`${part}-${index}`}>{part}</span>;
    }

    return (
      <mark className="target-word-highlight" key={`${part}-${index}`}>
        {match[1]}
      </mark>
    );
  });
}

function hideBracketText(text) {
  return text.replace(/\[[^\]]+\]/g, "____");
}

function revealBracketText(text) {
  return text.replace(/\[([^\]]+)\]/g, "$1");
}

function hideSentenceTarget(sentence, targetWord) {
  if (!sentence) {
    return "";
  }
  if (hasBracketTarget(sentence)) {
    return hideBracketText(sentence);
  }
  if (!targetWord) {
    return sentence;
  }

  return sentence.split(targetWord).join("____");
}

function revealSentenceTarget(sentence) {
  if (!sentence) {
    return "";
  }
  return hasBracketTarget(sentence) ? revealBracketText(sentence) : sentence;
}

function highlightSentenceTarget(sentence, targetWord) {
  if (!sentence) {
    return "";
  }
  if (hasBracketTarget(sentence)) {
    return highlightBracketText(sentence);
  }
  return highlightChineseWord(sentence, targetWord);
}

function hasBracketTarget(text) {
  return /\[[^\]]+\]/.test(text);
}

function ColorBadge({ colorValue }) {
  const rawLevel = Number.parseInt(colorValue, 10);
  const level = Math.max(1, Number.isNaN(rawLevel) ? 1 : rawLevel);
  const barLevel = Math.min(10, level);
  return (
    <div className="severity-meter" aria-label={`Severity ${level} out of 10`}>
      <div className="severity-track">
        <span style={{ width: `${barLevel * 10}%` }} />
      </div>
      <strong>{level}/10</strong>
    </div>
  );
}

function ReviewedCardsList({ rows, mode }) {
  if (!rows.length) {
    return null;
  }

  return (
    <section className="wrong-list reviewed-list">
      <h3>Reviewed cards</h3>
      {rows.map((row, rowIndex) => {
        const primaryText = mode === "english-to-chinese" ? getEnglishToChinesePromptText(row) : row["Chinese Words"];
        const secondaryText = mode === "english-to-chinese" ? row["Chinese Words"] : row["English Words"];

        return (
          <article className="wrong-row reviewed-row" key={`${getColorProgressId(row)}-${rowIndex}`}>
            <strong>{primaryText}</strong>
            <span>{secondaryText}</span>
            <span>{row.pinyin}</span>
          </article>
        );
      })}
    </section>
  );
}

function highlightChineseWord(sentence, targetWord) {
  if (!sentence || !targetWord || !sentence.includes(targetWord)) {
    return sentence;
  }

  const parts = sentence.split(targetWord);
  return parts.map((part, index) => (
    <span key={`${part}-${index}`}>
      {part}
      {index < parts.length - 1 && <mark className="target-word-highlight">{targetWord}</mark>}
    </span>
  ));
}

function speakText(text, language = "zh-CN") {
  if (!text || !window.speechSynthesis) {
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = language;
  window.speechSynthesis.speak(utterance);
}

function manuallyFlipCard(setIsCsvFlipped, setWasAutoFlipped) {
  setWasAutoFlipped(false);
  setIsCsvFlipped(true);
}

function buildCsvSession(rows, count, orderMode, reviewSetKey = "") {
  if (orderMode === "in-order") {
    return buildRequiredColorSession(
      sortRowsByCsvId(rows),
      count,
      (remainingRows, fillerCount) => remainingRows.slice(0, fillerCount),
      { preserveRowOrder: true, requiredPredicate: isHighColorCard }
    );
  }

  if (orderMode === "review-again") {
    return buildReviewAgainCsvSession(rows, reviewSetKey);
  }

  if (orderMode === "daily-review") {
    return buildRequiredColorSession(rows, count, buildDailyReviewCsvSession);
  }

  if (orderMode === "weighted") {
    return buildRequiredColorSession(rows, count, buildWeightedCsvSession);
  }

  return buildRequiredColorSession(rows, count, buildRandomCsvSession);
}

function applyRange(rows, start, end) {
  return rows.slice(start - 1, end);
}

function sortRowsByCsvId(rows) {
  return [...rows].sort(compareRowsByCsvId);
}

function compareRowsByCsvId(firstRow, secondRow) {
  const firstId = getSortableCsvId(firstRow);
  const secondId = getSortableCsvId(secondRow);

  if (firstId.number !== null && secondId.number !== null && firstId.number !== secondId.number) {
    return firstId.number - secondId.number;
  }

  return firstId.text.localeCompare(secondId.text, undefined, { numeric: true });
}

function getSortableCsvId(row) {
  const text = String(row?.ID || row?.id || row?.__rowNumber || "");
  const number = Number.parseFloat(text);
  return {
    text,
    number: Number.isNaN(number) ? null : number,
  };
}

function getDisplayCardId(row) {
  return row?.ID || row?.id || row?.__rowNumber || "?";
}

function buildRandomCsvSession(rows, count) {
  const shuffledRows = [...rows];

  for (let index = shuffledRows.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffledRows[index], shuffledRows[randomIndex]] = [shuffledRows[randomIndex], shuffledRows[index]];
  }

  return shuffledRows.slice(0, Math.min(count, shuffledRows.length));
}

function buildWeightedCsvSession(rows, count) {
  return takeWeightedRows(rows, count);
}

function buildRequiredColorSession(rows, count, buildFillerRows, options = {}) {
  const requiredPredicate = options.requiredPredicate || isAlwaysIncludedCard;
  const requiredRows = rows.filter(requiredPredicate);
  const requiredSet = new Set(requiredRows);
  const remainingRows = rows.filter((row) => !requiredSet.has(row));
  const targetCount = Math.max(Math.min(count, rows.length), requiredRows.length);
  const fillerRows = buildFillerRows(remainingRows, targetCount - requiredRows.length);
  const sessionRows = [...requiredRows, ...fillerRows];

  if (options.preserveRowOrder) {
    const sessionSet = new Set(sessionRows);
    return rows.filter((row) => sessionSet.has(row));
  }

  return shuffleRows(sessionRows);
}

function isAlwaysIncludedCard(row) {
  return isFlaggedCard(row) || isHighColorCard(row);
}

function isHighColorCard(row) {
  const parsedColor = Number.parseInt(row?.Color, 10);
  return !Number.isNaN(parsedColor) && parsedColor > 10;
}

function takeWeightedRows(rows, count) {
  const availableRows = [...rows];
  const selectedRows = [];
  const targetCount = Math.min(count, rows.length);

  while (selectedRows.length < targetCount && availableRows.length) {
    const totalWeight = availableRows.reduce((sum, row) => sum + getWeightedSelectionWeight(row), 0);
    let pick = Math.random() * totalWeight;
    let selectedIndex = 0;

    for (let index = 0; index < availableRows.length; index += 1) {
      pick -= getWeightedSelectionWeight(availableRows[index]);
      if (pick <= 0) {
        selectedIndex = index;
        break;
      }
    }

    const [selectedRow] = availableRows.splice(selectedIndex, 1);
    selectedRows.push(selectedRow);
  }

  return selectedRows;
}

function getWeightedSelectionWeight(row) {
  const colorWeight = getSelectionWeight(row.Color) * 1.25;
  const seenMultiplier = isNewCard(row) ? 0.5 : 1.5;

  return colorWeight * seenMultiplier;
}

function buildDailyReviewCsvSession(rows, count) {
  const targetCount = Math.min(count, rows.length);
  if (targetCount <= 0) {
    return [];
  }

  const buckets = {
    new: [],
    weak: [],
    normal: [],
    easy: [],
  };

  rows.forEach((row) => {
    buckets[getDailyReviewBucket(row)].push(row);
  });

  const selectedRows = [];
  const selectedSet = new Set();
  const newTarget = Math.floor(targetCount * 0.25);
  const weakTarget = Math.floor(targetCount * 0.4);
  const normalTarget = Math.floor(targetCount * 0.25);
  const easyTarget = targetCount - newTarget - weakTarget - normalTarget;

  takeUniqueRows(buildWeightedCsvSession(buckets.new, buckets.new.length), newTarget, selectedRows, selectedSet);
  takeUniqueRows(buildWeightedCsvSession(buckets.weak, buckets.weak.length), weakTarget, selectedRows, selectedSet);
  takeUniqueRows(buildWeightedCsvSession(buckets.normal, buckets.normal.length), normalTarget, selectedRows, selectedSet);
  takeUniqueRows(shuffleRows(buckets.easy), easyTarget, selectedRows, selectedSet);

  if (selectedRows.length < targetCount) {
    const fallbackRows = [
      ...buildWeightedCsvSession(buckets.weak, buckets.weak.length),
      ...buildWeightedCsvSession(buckets.normal, buckets.normal.length),
      ...shuffleRows(buckets.easy),
      ...buildWeightedCsvSession(buckets.new, buckets.new.length),
    ];
    takeUniqueRows(fallbackRows, targetCount - selectedRows.length, selectedRows, selectedSet);
  }

  return shuffleRows(selectedRows).slice(0, targetCount);
}

function buildReviewAgainCsvSession(rows, reviewSetKey) {
  const reviewIds = readDailyReviewSet(reviewSetKey);
  if (!reviewIds.length) {
    return [];
  }

  const rowsById = new Map(rows.map((row) => [getColorProgressId(row), row]));
  return reviewIds.map((progressId) => rowsById.get(progressId)).filter(Boolean);
}

function takeUniqueRows(rows, count, selectedRows, selectedSet) {
  const targetLength = selectedRows.length + Math.max(0, count);

  for (const row of rows) {
    if (selectedRows.length >= targetLength) {
      break;
    }
    if (selectedSet.has(row)) {
      continue;
    }
    selectedRows.push(row);
    selectedSet.add(row);
  }
}

function getDailyReviewBucket(row) {
  if (isNewCard(row)) {
    return "new";
  }

  const parsedColor = Number.parseInt(row.Color, 10);
  if (Number.isNaN(parsedColor)) {
    return "new";
  }

  if (parsedColor >= 7) {
    return "weak";
  }

  if (parsedColor >= 4) {
    return "normal";
  }

  return "easy";
}

function isNewCard(row) {
  return !row?.__hasSavedColorProgress || row.Color === "" || row.Color == null;
}

function isFlaggedCard(row) {
  return row?.__isFlagged === true;
}

function shuffleRows(rows) {
  const shuffledRows = [...rows];

  for (let index = shuffledRows.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffledRows[index], shuffledRows[randomIndex]] = [shuffledRows[randomIndex], shuffledRows[index]];
  }

  return shuffledRows;
}

function getSelectionWeight(colorValue) {
  const parsedColor = Number.parseInt(colorValue, 10);
  if (Number.isNaN(parsedColor)) {
    return 1;
  }

  const normalizedColor = Math.max(1, parsedColor);
  return normalizedColor ** 3;
}

function updateColorValue(colorValue, wasCorrect, options = {}) {
  const parsedColor = Number.parseInt(colorValue, 10);
  const currentColor = Number.isNaN(parsedColor) ? 1 : parsedColor;

  if (wasCorrect) {
    return String(Math.max(1, currentColor - 1));
  }

  if (options.isSeenBefore && currentColor < 5 && currentColor < 10) {
    return "10";
  }

  return String(currentColor < 5 ? 7 : currentColor + 2);
}

function updateChineseToEnglishColorValue(colorValue, wasCorrect, loseStreak = 0) {
  const parsedColor = Number.parseInt(colorValue, 10);
  const currentColor = Number.isNaN(parsedColor) ? 1 : parsedColor;

  if (wasCorrect) {
    return String(Math.max(1, currentColor - 1));
  }

  return String(currentColor + 2 + getLoseStreakValue({ "Lose Streak": loseStreak }));
}

function getNextLoseStreak(currentLoseStreak, wasCorrect) {
  return wasCorrect ? 0 : currentLoseStreak + 1;
}

function getLoseStreakValue(row) {
  const parsedLoseStreak = Number.parseInt(row?.["Lose Streak"], 10);
  return Number.isNaN(parsedLoseStreak) ? 0 : Math.max(0, parsedLoseStreak);
}

const CSV_COLOR_PROGRESS_KEY = "chineseQuizNew.csvColorProgress.v1";
const ENGLISH_COLOR_PROGRESS_KEY = "chineseQuizNew.englishToChineseColorProgress.v1";

function applySavedColorProgress(rows, storageKey = CSV_COLOR_PROGRESS_KEY) {
  const progress = readColorProgress(storageKey);

  return rows.map((row) => {
    const savedProgress = progress[getColorProgressId(row)];
    if (savedProgress === undefined) {
      return { ...row, __hasSavedColorProgress: false, __isFlagged: false };
    }

    if (typeof savedProgress === "object" && savedProgress !== null) {
      return {
        ...row,
        Color: String(savedProgress.colorValue ?? row.Color),
        "Lose Streak": String(savedProgress.loseStreak ?? row["Lose Streak"] ?? 0),
        __hasSavedColorProgress: true,
        __isFlagged: savedProgress.isFlagged === true,
      };
    }

    return { ...row, Color: String(savedProgress), __hasSavedColorProgress: true, __isFlagged: false };
  });
}

function readColorProgress(storageKey = CSV_COLOR_PROGRESS_KEY) {
  try {
    const savedProgress = window.localStorage.getItem(storageKey);
    return savedProgress ? JSON.parse(savedProgress) : {};
  } catch {
    return {};
  }
}

function pruneStaleColorProgress(rows, storageKey = CSV_COLOR_PROGRESS_KEY) {
  const validProgressIds = new Set(
    rows
      .map(getColorProgressId)
      .filter(Boolean)
  );
  const progress = readColorProgress(storageKey);
  const prunedProgress = {};
  let removedStaleProgress = false;

  Object.entries(progress).forEach(([progressId, colorValue]) => {
    if (validProgressIds.has(progressId)) {
      prunedProgress[progressId] = colorValue;
    } else {
      removedStaleProgress = true;
    }
  });

  if (!removedStaleProgress) {
    return;
  }

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(prunedProgress));
  } catch {
    // Stale progress cleanup should not block the quiz.
  }
}

function saveDailyReviewCompletion(rows, storageKey = CSV_COLOR_PROGRESS_KEY) {
  rows.forEach((row) => {
    saveColorProgress(row, getDailyReviewCompletionColor(row), storageKey);
  });
}

function getDailyReviewCompletionColor(row) {
  const colorValue = row?.Color;
  if (colorValue === "" || colorValue == null) {
    return "1";
  }

  return String(colorValue);
}

function saveColorProgress(row, colorValue, storageKey = CSV_COLOR_PROGRESS_KEY, options = {}) {
  const progressId = getColorProgressId(row);
  if (!progressId) {
    return;
  }

  const progress = readColorProgress(storageKey);
  if (storageKey === CSV_COLOR_PROGRESS_KEY) {
    progress[progressId] = {
      colorValue: colorValue == null ? "" : String(colorValue),
      loseStreak: String(options.loseStreak ?? row?.["Lose Streak"] ?? 0),
      isFlagged: Boolean(options.isFlagged ?? row?.__isFlagged),
    };
  } else {
    progress[progressId] = String(colorValue);
  }

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(progress));
  } catch {
    // If storage is unavailable or full, the quiz should still continue normally.
  }
}

function buildReplayParams(searchParams, options = {}) {
  const replayParams = new URLSearchParams(searchParams);
  if ("order" in options) {
    replayParams.set("order", options.order);
  }
  if ("showPinyin" in options) {
    replayParams.set("pinyin", options.showPinyin ? "1" : "0");
  }
  if ("showChineseUsage" in options) {
    replayParams.set("usage", options.showChineseUsage ? "1" : "0");
  }
  if ("showMeaningCount" in options) {
    replayParams.set("meaningCount", options.showMeaningCount ? "1" : "0");
  }
  if ("showChineseSentence" in options) {
    replayParams.set("sentence", options.showChineseSentence ? "1" : "0");
  }
  replayParams.set("run", String(Date.now()));
  return replayParams.toString();
}

function buildReviewAgainParams(searchParams, rows, options = {}) {
  const reviewSetKey = saveDailyReviewSet(rows);
  const replayParams = new URLSearchParams(buildReplayParams(searchParams, {
    ...options,
    order: "review-again",
  }));
  replayParams.set("reviewSet", reviewSetKey);
  return replayParams.toString();
}

function saveDailyReviewSet(rows) {
  const reviewSetKey = `daily-review-${Date.now()}`;
  const progressIds = rows.map(getColorProgressId).filter(Boolean);

  try {
    window.sessionStorage.setItem(reviewSetKey, JSON.stringify(progressIds));
  } catch {
    // Review-again is optional; if session storage fails, the route will show no replay rows.
  }

  return reviewSetKey;
}

function readDailyReviewSet(reviewSetKey) {
  if (!reviewSetKey) {
    return [];
  }

  try {
    const savedSet = window.sessionStorage.getItem(reviewSetKey);
    const parsedSet = savedSet ? JSON.parse(savedSet) : [];
    return Array.isArray(parsedSet) ? parsedSet : [];
  } catch {
    return [];
  }
}

function normalizeOrderMode(orderMode, mode = "chinese-to-english") {
  if (mode === "english-to-chinese" && orderMode === "daily-review") {
    return "random";
  }

  return ["random", "weighted", "in-order", "daily-review", "review-again"].includes(orderMode) ? orderMode : "random";
}

function removeLastMatchingRow(rows, rowToRemove) {
  const targetIndex = rows.map((row) => row.__rowNumber).lastIndexOf(rowToRemove.__rowNumber);
  if (targetIndex === -1) {
    return rows;
  }

  return rows.filter((_, index) => index !== targetIndex);
}
