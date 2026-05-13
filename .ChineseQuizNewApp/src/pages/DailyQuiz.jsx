import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { filterCsvRows, loadCsvWords, loadEnglishToChineseRows } from "../services/csvWords.js";
import { getUserProgress, getWords, recordDailyAttempt, updateWordProgress } from "../services/words.js";
import { DEFAULT_USER_ID } from "../constants.js";
import { buildDailyQueue, getTodayKey, weightColor } from "../utils/quiz.js";
import {
  parseFilterValuesParam,
  readChineseToEnglishSettings,
  readEnglishToChineseSettings,
  saveChineseToEnglishSettings,
  saveEnglishToChineseSettings,
} from "../services/quizSettings.js";

export default function DailyQuiz() {
  const [searchParams] = useSearchParams();
  const savedSettings = useMemo(() => readChineseToEnglishSettings(), []);
  const savedEnglishSettings = useMemo(() => readEnglishToChineseSettings(), []);
  const mode = searchParams.get("mode") === "english-to-chinese" ? "english-to-chinese" : "chinese-to-english";
  const requestedCount = Math.max(1, Math.min(100, Number(searchParams.get("count")) || Number(savedSettings.questionCount) || 20));
  const activeSettings = mode === "english-to-chinese" ? savedEnglishSettings : savedSettings;
  const filterType = searchParams.get("filter") === "dao" ? "dao" : activeSettings.filterType;
  const selectedFilterValues = useMemo(
    () => parseFilterValuesParam(searchParams.get("values") || searchParams.get("band") || activeSettings.filterValues.join(",")),
    [activeSettings.filterValues, searchParams]
  );
  const rangeStart = Math.max(1, Number(searchParams.get("start")) || Number(activeSettings.rangeStart) || 1);
  const rangeEnd = Math.max(rangeStart, Number(searchParams.get("end")) || Number(activeSettings.rangeEnd) || Number.MAX_SAFE_INTEGER);
  const fallbackOrderMode = mode === "english-to-chinese" ? savedEnglishSettings.orderMode : savedSettings.orderMode;
  const orderMode = normalizeOrderMode(searchParams.has("order") ? searchParams.get("order") : fallbackOrderMode);
  const fallbackTimerSeconds = mode === "english-to-chinese" ? savedEnglishSettings.timerSeconds : savedSettings.timerSeconds;
  const timerSeconds = Math.max(0, Math.min(600, Number(searchParams.get("timer")) || Number(fallbackTimerSeconds) || 0));
  const sessionRun = searchParams.get("run") || "";
  const [queue, setQueue] = useState([]);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [message, setMessage] = useState("");
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
  const todayKey = useMemo(() => getTodayKey(), []);
  const currentWord = queue[index];
  const promptText = mode === "english-to-chinese" ? currentWord?.english : currentWord?.chinese;
  const answerLabel = mode === "english-to-chinese" ? "Chinese" : "English or pinyin";
  const modeTitle = mode === "english-to-chinese" ? "English to Chinese" : "Chinese to English";

  useEffect(() => {
    async function loadQuiz() {
      setLoading(true);
      setError("");

      try {
        if (mode === "english-to-chinese") {
          const loadedRows = await loadEnglishToChineseRows();
          const filteredRows = filterCsvRows(loadedRows, filterType, selectedFilterValues);
          const rangedRows = applyRange(filteredRows, rangeStart, rangeEnd);
          const rowsWithSavedProgress = applySavedColorProgress(rangedRows, ENGLISH_COLOR_PROGRESS_KEY);
          setCsvRows(buildCsvSession(rowsWithSavedProgress, requestedCount, orderMode));
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
          const filteredRows = filterCsvRows(loadedCsvRows, filterType, selectedFilterValues);
          const rangedRows = applyRange(filteredRows, rangeStart, rangeEnd);
          const rowsWithSavedProgress = applySavedColorProgress(rangedRows);
          setCsvRows(buildCsvSession(rowsWithSavedProgress, requestedCount, orderMode));
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

        const [words, progress] = await Promise.all([getWords(), getUserProgress(DEFAULT_USER_ID)]);
        setQueue(buildDailyQueue(words, progress, requestedCount));
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    }
    loadQuiz();
  }, [filterType, mode, orderMode, rangeEnd, rangeStart, requestedCount, selectedFilterValues, sessionRun, timerSeconds]);

  useEffect(() => {
    if (loading || timerSeconds <= 0 || isCsvFlipped || csvIndex >= csvRows.length) {
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
  }, [csvIndex, csvRows.length, isCsvFlipped, loading, timerSeconds]);

  useEffect(() => {
    if (mode !== "chinese-to-english") {
      return;
    }

    saveChineseToEnglishSettings({
      questionCount: String(requestedCount),
      filterType,
      filterValues: selectedFilterValues,
      rangeStart: String(rangeStart),
      rangeEnd: Number.isFinite(rangeEnd) ? String(rangeEnd) : "",
      orderMode,
      timerSeconds: String(timerSeconds),
      showPinyin: showFrontPinyin,
      showChineseUsage: showFrontUsage,
      showMeaningCount,
    });
  }, [filterType, mode, orderMode, rangeEnd, rangeStart, requestedCount, selectedFilterValues, showFrontPinyin, showFrontUsage, showMeaningCount, timerSeconds]);

  useEffect(() => {
    if (mode !== "english-to-chinese") {
      return;
    }

    saveEnglishToChineseSettings({
      questionCount: String(requestedCount),
      rangeStart: String(rangeStart),
      rangeEnd: Number.isFinite(rangeEnd) ? String(rangeEnd) : "",
      filterType,
      filterValues: selectedFilterValues,
      orderMode,
      timerSeconds: String(timerSeconds),
      showChineseSentence: showEnglishChineseSentence,
    });
  }, [filterType, mode, orderMode, rangeEnd, rangeStart, requestedCount, selectedFilterValues, showEnglishChineseSentence, timerSeconds]);

  async function submitAnswer(event) {
    event.preventDefault();
    if (!currentWord || !answer.trim()) return;

    const normalizedAnswer = answer.trim().toLowerCase();
    const correctAnswers = mode === "english-to-chinese"
      ? [currentWord.chinese]
      : [currentWord.english, currentWord.pinyin];
    const normalizedCorrectAnswers = correctAnswers
      .filter(Boolean)
      .map((value) => value.trim().toLowerCase());
    const wasCorrect = normalizedCorrectAnswers.includes(normalizedAnswer);

    const nextWeight = await updateWordProgress({ userId: DEFAULT_USER_ID, word: currentWord, wasCorrect });
    await recordDailyAttempt({ userId: DEFAULT_USER_ID, dateKey: todayKey, wordId: currentWord.id, wasCorrect });

    setQueue((current) =>
      current.map((word) => (word.id === currentWord.id ? { ...word, weight: nextWeight } : word))
    );
    setMessage(wasCorrect ? "Correct. Weight decreased." : "Not quite. Weight increased.");
    setRevealed(true);
  }

  function nextWord() {
    setAnswer("");
    setRevealed(false);
    setMessage("");
    setIndex((current) => current + 1);
  }

  if (loading) return <main className="page">Loading quiz...</main>;

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
      const nextColor = updateColorValue(csvRow?.Color, wasCorrect);
      const answeredRow = csvRow ? { ...csvRow, Color: nextColor } : csvRow;
      if (answeredRow) {
        saveColorProgress(answeredRow.__rowNumber, nextColor, ENGLISH_COLOR_PROGRESS_KEY);
      }

      setCsvHistory((current) => [
        ...current,
        {
          index: csvIndex,
          row: answeredRow,
          previousColor: csvRow?.Color,
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
        saveColorProgress(lastAction.row.__rowNumber, lastAction.previousColor, ENGLISH_COLOR_PROGRESS_KEY);
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
                    <strong>{row["English Words"]}</strong>
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
              <Link className="secondary-button settings-link" to="/">
                Go home
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
          Menu
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
            <Link className="drawer-link" to="/">
              Quiz Home
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
                  isFlipped={isCsvFlipped}
                  progressText={csvRows.length ? `${csvIndex + 1} / ${csvRows.length}` : "CSV preview"}
                  showChineseSentence={showEnglishChineseSentence}
                  timerSeconds={timerSeconds}
                  timerRemaining={timerRemaining}
                  wasAutoFlipped={wasAutoFlipped}
                  canUndo={csvHistory.length > 0}
                  onUndo={undoLastEnglishAction}
                />
                {!isCsvFlipped ? (
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
      const nextColor = updateColorValue(csvRow?.Color, wasCorrect);
      const answeredRow = csvRow ? { ...csvRow, Color: nextColor } : csvRow;
      if (answeredRow) {
        saveColorProgress(answeredRow.__rowNumber, nextColor);
      }

      setCsvHistory((current) => [
        ...current,
        {
          index: csvIndex,
          row: answeredRow,
          previousColor: csvRow?.Color,
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
        saveColorProgress(lastAction.row.__rowNumber, lastAction.previousColor);
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
              <Link className="secondary-button settings-link" to="/">
                Go home
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
          Menu
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
            <Link className="drawer-link" to="/">
              Quiz Home
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
                  isFlipped={isCsvFlipped}
                  progressText={csvRows.length ? `${csvIndex + 1} / ${csvRows.length}` : "CSV preview"}
                  showFrontPinyin={showFrontPinyin}
                  showFrontUsage={showFrontUsage}
                  showMeaningCount={showMeaningCount}
                  timerSeconds={timerSeconds}
                  timerRemaining={timerRemaining}
                  wasAutoFlipped={wasAutoFlipped}
                  canUndo={csvHistory.length > 0}
                  onUndo={undoLastAction}
                />
                {!isCsvFlipped ? (
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

  if (!queue.length) {
    return (
      <main className="page">
        <section className="panel empty-state">
          <h2>No words yet</h2>
          <p>Add a few words before starting your daily quiz.</p>
        </section>
      </main>
    );
  }

  if (!currentWord) {
    return (
      <main className="page">
        <section className="panel empty-state">
          <p className="eyebrow">Daily Quiz</p>
          <h2>Session complete</h2>
          <p>You reviewed {queue.length} words today.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="page narrow-page">
      <p className="eyebrow">{modeTitle} {index + 1} / {queue.length}</p>
      <section className="quiz-card">
        <span className={`weight-pill ${weightColor(currentWord.weight)}`}>Weight {currentWord.weight}</span>
        <h2>{promptText}</h2>
        <form onSubmit={submitAnswer}>
          <label>
            {answerLabel}
            <input
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              disabled={revealed}
              autoFocus
            />
          </label>
          {!revealed && <button>Check</button>}
        </form>
        {revealed && (
          <div className="answer-panel">
            <p>{message}</p>
            <p><strong>Chinese:</strong> {currentWord.chinese}</p>
            <p><strong>Pinyin:</strong> {currentWord.pinyin || "None"}</p>
            <p><strong>English:</strong> {currentWord.english}</p>
            {currentWord.example && <p>{currentWord.example}</p>}
            <button onClick={nextWord}>Next</button>
          </div>
        )}
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
        <p className="question-id">{row.__rowNumber || "?"}</p>
        <button className="undo-button" onClick={onUndo} disabled={!canUndo}>
          Undo
        </button>
      </div>
      <TimerStatus
        isFlipped={isFlipped}
        timerSeconds={timerSeconds}
        timerRemaining={timerRemaining}
        wasAutoFlipped={wasAutoFlipped}
      />

      <h2>{row["Chinese Words"]}</h2>
      <ColorBadge colorValue={row.Color} />
      {showMeaningCount && !isFlipped && (
        <p className="meaning-count">
          {meaningCount} {meaningCount === 1 ? "meaning/form" : "meanings/forms"}
        </p>
      )}

      <div className="dictionary-body-grid">
        <div>
          {shouldShowMeta && (
            <div className="dictionary-meta">
              {(showFrontPinyin || isFlipped) && <em>{row.pinyin}</em>}
              {isFlipped && <FormattedEnglishMeaning text={row["English Words"]} />}
            </div>
          )}

          {shouldShowDivider && <div className="dictionary-divider" />}

          {shouldShowUsage && (
            <div className="dictionary-sentence">
              {(showFrontUsage || isFlipped) && (
                <p className="chinese-line">
                  {isFlipped ? highlightSentenceTarget(rawSentence, row["Chinese Words"]) : sentence}
                </p>
              )}
              {isFlipped && <p>{row["English Usage in a sentence"]}</p>}
            </div>
          )}
        </div>
        <div className="audio-rail">
          {shouldShowMeta && (
            <IconAudioButton label="Read Chinese word" onClick={() => speakText(row["Chinese Words"], "zh-CN")} />
          )}
          {shouldShowUsage && (
            <IconAudioButton label="Read sentence" onClick={() => speakText(sentence, "zh-CN")} />
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
  const englishPrompt = row["English Words"];
  const chineseSentence = getFirstValue(row, [
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
        <button className="undo-button" onClick={onUndo} disabled={!canUndo}>
          Undo
        </button>
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
      <ColorBadge colorValue={row.Color} />

      {showChineseSentence && hasSentence && (
        <div className="english-sentence-block">
          <div>
            <p className="chinese-line">
              {isFlipped ? highlightSentenceTarget(chineseSentence, row["Chinese Words"]) : visibleSentence}
            </p>
            {sentencePinyin && <p className="pinyin-line">{sentencePinyin}</p>}
          </div>
          <IconAudioButton
            label="Read Chinese sentence"
            onClick={() => speakText(visibleSentence, "zh-CN")}
          />
        </div>
      )}

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

function IconAudioButton({ label, onClick }) {
  return (
    <button className="icon-audio-button" type="button" aria-label={label} onClick={onClick}>
      <span aria-hidden="true">Audio</span>
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
    .replace(/\s+(?=(?:noun|verb|adjective|adverb|interjection|pronoun|preposition|conjunction|measure word|proper noun)\s*:)/gi, "\n")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function countMeaningForms(text = "") {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

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
    return splitMeaningText(line).length;
  }

  const labelText = line.slice(0, colonIndex);
  const definitionText = line.slice(colonIndex + 1);
  const formCount = splitWordFormLabels(labelText).length;
  const meaningCount = splitMeaningText(definitionText).length;

  return Math.max(formCount, meaningCount, 1);
}

function splitWordFormLabels(text) {
  const knownFormPattern = /\b(?:noun|verb|adjective|adverb|interjection|pronoun|preposition|conjunction|measure word|proper noun)\b/i;
  if (!knownFormPattern.test(text)) {
    return [];
  }

  return text.split("/").map((part) => part.trim()).filter(Boolean);
}

function splitMeaningText(text) {
  const parts = text
    .split(/\s+(?:\/|;)\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.length ? parts : [text.trim()].filter(Boolean);
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

function buildCsvSession(rows, count, orderMode) {
  if (orderMode === "in-order") {
    return rows.slice(0, Math.min(count, rows.length));
  }

  if (orderMode === "weighted") {
    return buildWeightedCsvSession(rows, count);
  }

  return buildRandomCsvSession(rows, count);
}

function applyRange(rows, start, end) {
  return rows.slice(start - 1, end);
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
  const availableRows = [...rows];
  const selectedRows = [];
  const targetCount = Math.min(count, availableRows.length);

  while (selectedRows.length < targetCount && availableRows.length) {
    const totalWeight = availableRows.reduce((sum, row) => sum + getSelectionWeight(row.Color), 0);
    let pick = Math.random() * totalWeight;
    let selectedIndex = 0;

    for (let index = 0; index < availableRows.length; index += 1) {
      pick -= getSelectionWeight(availableRows[index].Color);
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

function getSelectionWeight(colorValue) {
  const parsedColor = Number.parseInt(colorValue, 10);
  if (Number.isNaN(parsedColor)) {
    return 1;
  }

  return Math.max(1, parsedColor);
}

function updateColorValue(colorValue, wasCorrect) {
  const parsedColor = Number.parseInt(colorValue, 10);
  const currentColor = Number.isNaN(parsedColor) ? 1 : parsedColor;

  if (wasCorrect) {
    return String(Math.max(1, currentColor - 1));
  }

  return String(currentColor < 5 ? 7 : currentColor + 2);
}

const CSV_COLOR_PROGRESS_KEY = "chineseQuizNew.csvColorProgress.v1";
const ENGLISH_COLOR_PROGRESS_KEY = "chineseQuizNew.englishToChineseColorProgress.v1";

function applySavedColorProgress(rows, storageKey = CSV_COLOR_PROGRESS_KEY) {
  const progress = readColorProgress(storageKey);

  return rows.map((row) => {
    const savedColor = progress[row.__rowNumber];
    if (savedColor === undefined) {
      return row;
    }

    return { ...row, Color: String(savedColor) };
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

function saveColorProgress(rowNumber, colorValue, storageKey = CSV_COLOR_PROGRESS_KEY) {
  if (!rowNumber) {
    return;
  }

  const progress = readColorProgress(storageKey);
  progress[rowNumber] = String(colorValue);

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(progress));
  } catch {
    // If storage is unavailable or full, the quiz should still continue normally.
  }
}

function buildReplayParams(searchParams, options = {}) {
  const replayParams = new URLSearchParams(searchParams);
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

function normalizeOrderMode(orderMode) {
  return ["random", "weighted", "in-order"].includes(orderMode) ? orderMode : "random";
}

function removeLastMatchingRow(rows, rowToRemove) {
  const targetIndex = rows.map((row) => row.__rowNumber).lastIndexOf(rowToRemove.__rowNumber);
  if (targetIndex === -1) {
    return rows;
  }

  return rows.filter((_, index) => index !== targetIndex);
}
