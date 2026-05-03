import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { loadCsvWords } from "../services/csvWords.js";
import { getUserProgress, getWords, recordDailyAttempt, updateWordProgress } from "../services/words.js";
import { DEFAULT_USER_ID } from "../constants.js";
import { buildDailyQueue, getTodayKey, weightColor } from "../utils/quiz.js";

export default function DailyQuiz() {
  const [searchParams] = useSearchParams();
  const mode = searchParams.get("mode") === "english-to-chinese" ? "english-to-chinese" : "chinese-to-english";
  const requestedCount = Math.max(1, Math.min(100, Number(searchParams.get("count")) || 20));
  const [queue, setQueue] = useState([]);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [message, setMessage] = useState("");
  const [csvRows, setCsvRows] = useState([]);
  const [csvIndex, setCsvIndex] = useState(0);
  const [csvResults, setCsvResults] = useState({ correct: 0, wrong: 0 });
  const [wrongCsvRows, setWrongCsvRows] = useState([]);
  const [isCsvFlipped, setIsCsvFlipped] = useState(false);
  const [showFrontPinyin, setShowFrontPinyin] = useState(true);
  const [showFrontUsage, setShowFrontUsage] = useState(true);
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
        if (mode === "chinese-to-english") {
          const loadedCsvRows = await loadCsvWords();
          setCsvRows(buildRandomCsvSession(loadedCsvRows, requestedCount));
          setCsvIndex(0);
          setCsvResults({ correct: 0, wrong: 0 });
          setWrongCsvRows([]);
          setIsCsvFlipped(false);
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
  }, [mode, requestedCount]);

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

  if (mode === "chinese-to-english") {
    const csvRow = csvRows[csvIndex];
    const isCsvComplete = csvRows.length > 0 && csvIndex >= csvRows.length;

    function answerCsvQuestion(wasCorrect) {
      setCsvResults((current) => ({
        correct: current.correct + (wasCorrect ? 1 : 0),
        wrong: current.wrong + (wasCorrect ? 0 : 1),
      }));
      if (!wasCorrect && csvRow) {
        setWrongCsvRows((current) => [...current, csvRow]);
      }
      setIsCsvFlipped(false);
      setCsvIndex((current) => current + 1);
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
            <Link className="play-button" to="/play">Play again</Link>
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
          ☰
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
          </div>
        </aside>
        <div className="quiz-main">
          <section className="quiz-card csv-quiz-card">
            <p className="eyebrow">{csvRows.length ? `${csvIndex + 1} / ${csvRows.length}` : "CSV preview"}</p>
            <h2>{csvRow?.["Chinese Words"] || "No row loaded"}</h2>
            {csvRow ? (
              <div className="csv-preview">
                <div className="csv-fields">
                  {!isCsvFlipped ? (
                    <>
                      {showFrontPinyin && <p><strong>pinyin:</strong> {csvRow.pinyin}</p>}
                      {showFrontUsage && (
                        <p>
                          <strong>Chinese Usage in a Sentence:</strong> {csvRow["Chinese Usage in a Sentence"]}
                        </p>
                      )}
                    </>
                  ) : (
                    Object.entries(csvRow)
                      .filter(([column]) => column !== "Chinese Words")
                      .map(([column, value]) => (
                        <p key={column}>
                          <strong>{column}:</strong> {value || "None"}
                        </p>
                      ))
                  )}
                </div>
                {!isCsvFlipped ? (
                  <button onClick={() => setIsCsvFlipped(true)}>Flip</button>
                ) : (
                  <div className="answer-actions">
                    <button onClick={() => answerCsvQuestion(true)}>Correct</button>
                    <button className="wrong-button" onClick={() => answerCsvQuestion(false)}>Wrong</button>
                  </div>
                )}
              </div>
            ) : (
              <p>No words were found in the CSV.</p>
            )}
          </section>
          <Link className="back-link" to="/play">Change mode</Link>
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
      <Link className="back-link" to="/play">Change mode</Link>
    </main>
  );
}

function buildRandomCsvSession(rows, count) {
  const shuffledRows = [...rows];

  for (let index = shuffledRows.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffledRows[index], shuffledRows[randomIndex]] = [shuffledRows[randomIndex], shuffledRows[index]];
  }

  return shuffledRows.slice(0, Math.min(count, shuffledRows.length));
}
