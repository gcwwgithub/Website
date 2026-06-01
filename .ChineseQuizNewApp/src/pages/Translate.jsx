import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import ColorBadge from "../components/ColorBadge.jsx";
import GameMenu from "../components/GameMenu.jsx";
import LoadingScreen from "../components/LoadingScreen.jsx";
import TimerStatus from "../components/TimerStatus.jsx";
import { loadTranslateRows } from "../services/adverbCsv.js";
import {
  applyRemoteColorProgress,
  fetchRemoteColorProgress,
  saveRemoteColorProgress,
} from "../services/colorProgressTracking.js";
import { useSupabaseAuth } from "../services/supabaseAuth.js";
import {
  applySavedColorProgress,
  buildReviewAgainParams,
  buildPracticeSession,
  getNextPracticeProgress,
  isReviewAgainMode,
  normalizeOrderMode,
  saveColorProgress,
} from "../utils/practiceProgress.js";

const TRANSLATE_COLOR_PROGRESS_KEY = "chineseQuizNew.translateColorProgress.v1";

export default function Translate() {
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useSupabaseAuth();
  const requestedCount = Math.max(1, Math.min(100, Number(searchParams.get("count")) || 20));
  const orderMode = normalizeOrderMode(searchParams.get("order"));
  const timerSeconds = Math.max(0, Math.min(600, Number(searchParams.get("timer")) || 0));
  const rangeStart = Math.max(1, Number(searchParams.get("start")) || 1);
  const rangeEnd = Math.max(rangeStart, Number(searchParams.get("end")) || Number.MAX_SAFE_INTEGER);
  const sessionRun = searchParams.get("run") || "";
  const reviewSetKey = searchParams.get("reviewSet") || "";
  const [rows, setRows] = useState([]);
  const [sessionRows, setSessionRows] = useState([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const answerRef = useRef("");
  const [result, setResult] = useState(null);
  const [submittedAnswer, setSubmittedAnswer] = useState("");
  const [wasAutoRevealed, setWasAutoRevealed] = useState(false);
  const [timerRemaining, setTimerRemaining] = useState(timerSeconds);
  const [score, setScore] = useState({ correct: 0, wrong: 0 });
  const [mistakes, setMistakes] = useState([]);
  const [skippedRows, setSkippedRows] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const currentQuestion = sessionRows[questionIndex];
  const isComplete = sessionRows.length > 0 && questionIndex >= sessionRows.length;
  const canSubmit = Boolean(answer.trim()) && !result;
  const isReviewAgain = isReviewAgainMode(orderMode);

  function saveSupabaseProgress(row, colorValue, loseStreak) {
    if (!user?.id || !row) {
      return;
    }

    saveRemoteColorProgress({
      userId: user.id,
      storageKey: TRANSLATE_COLOR_PROGRESS_KEY,
      row,
      colorValue,
      loseStreak,
    }).catch((trackingError) => {
      console.warn("Could not save Supabase translate progress.", trackingError);
    });
  }

  useEffect(() => {
    if (authLoading) {
      setLoading(true);
      return;
    }

    async function loadSession() {
      setLoading(true);
      setError("");
      try {
        const baseRows = await loadTranslateRows();
        const loadedRows = user?.id
          ? applyRemoteColorProgress(
              baseRows,
              await fetchRemoteColorProgress({ userId: user.id, storageKey: TRANSLATE_COLOR_PROGRESS_KEY })
            )
          : applySavedColorProgress(baseRows, TRANSLATE_COLOR_PROGRESS_KEY);
        const rangedRows = applyRange(loadedRows, rangeStart, rangeEnd);
        const loadedSessionRows = buildPracticeSession(rangedRows, requestedCount, orderMode, reviewSetKey);
        setRows(loadedRows);
        setSessionRows(loadedSessionRows);
        setQuestionIndex(0);
        setAnswer("");
        setSubmittedAnswer("");
        setResult(null);
        setWasAutoRevealed(false);
        setTimerRemaining(timerSeconds);
        setScore({ correct: 0, wrong: 0 });
        setMistakes([]);
        setSkippedRows([]);
        setHistory([]);
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    }

    loadSession();
  }, [authLoading, orderMode, rangeEnd, rangeStart, requestedCount, reviewSetKey, sessionRun, timerSeconds, user?.id]);

  useEffect(() => {
    answerRef.current = answer;
  }, [answer]);

  useEffect(() => {
    if (loading || isReviewAgain || timerSeconds <= 0 || result || !currentQuestion || isComplete) {
      setTimerRemaining(timerSeconds);
      return undefined;
    }

    setTimerRemaining(timerSeconds);
    const intervalId = window.setInterval(() => {
      setTimerRemaining((current) => {
        if (current <= 1) {
          window.clearInterval(intervalId);
          setWasAutoRevealed(true);
          setSubmittedAnswer(answerRef.current.trim());
          setResult("wrong");
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [currentQuestion, isComplete, isReviewAgain, loading, questionIndex, result, timerSeconds]);

  function submitAnswer() {
    if (!canSubmit || !currentQuestion) {
      return;
    }

    const nextSubmittedAnswer = answer.trim();
    setSubmittedAnswer(nextSubmittedAnswer);
    setResult(isAcceptedTranslation(nextSubmittedAnswer, currentQuestion.acceptedAnswers) ? "correct" : "wrong");
  }

  function giveUpQuestion() {
    if (!currentQuestion || result) {
      return;
    }

    setSubmittedAnswer(answer.trim());
    setResult("wrong");
  }

  function nextQuestion() {
    let nextSessionRows = sessionRows;

    if (currentQuestion && result) {
      const wasCorrect = result === "correct";
      const nextProgress = getNextPracticeProgress(currentQuestion.Color, wasCorrect, currentQuestion["Lose Streak"]);
      const nextColor = nextProgress.color;
      const nextLoseStreak = nextProgress.loseStreak;
      const answeredRow = { ...currentQuestion, Color: nextColor, "Lose Streak": String(nextLoseStreak) };
      setHistory((current) => [
        ...current,
        {
          index: questionIndex,
          row: currentQuestion,
          previousColor: currentQuestion.Color,
          previousLoseStreak: currentQuestion["Lose Streak"],
          type: wasCorrect ? "correct" : "wrong",
          answer,
          submittedAnswer,
          result,
          wasAutoRevealed,
        },
      ]);
      if (!isReviewAgain) {
        saveColorProgress(answeredRow, nextColor, TRANSLATE_COLOR_PROGRESS_KEY, { loseStreak: nextLoseStreak });
        saveSupabaseProgress(answeredRow, nextColor, nextLoseStreak);
        setRows((current) => replaceRowProgress(current, currentQuestion.__rowNumber, nextColor, nextLoseStreak));
        nextSessionRows = replaceRowProgress(sessionRows, currentQuestion.__rowNumber, nextColor, nextLoseStreak);
        setSessionRows(nextSessionRows);
      }
      setScore((current) => ({
        correct: current.correct + (wasCorrect ? 1 : 0),
        wrong: current.wrong + (wasCorrect ? 0 : 1),
      }));

      if (!wasCorrect) {
        setMistakes((current) => [
          ...current,
          { ...answeredRow, submittedAnswer },
        ]);
      }
    }

    advanceQuestion(nextSessionRows);
  }

  function skipQuestion() {
    if (currentQuestion) {
      setHistory((current) => [
        ...current,
        {
          index: questionIndex,
          row: currentQuestion,
          type: "skipped",
          answer,
          submittedAnswer,
          result,
          wasAutoRevealed,
        },
      ]);
      setSkippedRows((current) => [...current, currentQuestion]);
    }
    advanceQuestion();
  }

  function undoLastAction() {
    const lastAction = history[history.length - 1];
    if (!lastAction) {
      return;
    }

    setHistory((current) => current.slice(0, -1));
    setQuestionIndex(lastAction.index);
    setAnswer(lastAction.answer || "");
    setSubmittedAnswer(lastAction.submittedAnswer || "");
    setResult(lastAction.result || null);
    setWasAutoRevealed(lastAction.wasAutoRevealed || false);
    answerRef.current = lastAction.answer || "";

    if (lastAction.previousColor !== undefined && !isReviewAgain) {
      saveColorProgress(lastAction.row, lastAction.previousColor, TRANSLATE_COLOR_PROGRESS_KEY, {
        loseStreak: lastAction.previousLoseStreak,
      });
      setRows((current) =>
        current.map((row, rowIndex) =>
          rowIndex === lastAction.index
            ? { ...row, Color: lastAction.previousColor, "Lose Streak": lastAction.previousLoseStreak ?? row["Lose Streak"] }
            : row
        )
      );
      setSessionRows((current) =>
        current.map((row, rowIndex) =>
          rowIndex === lastAction.index
            ? { ...row, Color: lastAction.previousColor, "Lose Streak": lastAction.previousLoseStreak ?? row["Lose Streak"] }
            : row
        )
      );
    }

    if (lastAction.type === "correct") {
      setScore((current) => ({ ...current, correct: Math.max(0, current.correct - 1) }));
    } else if (lastAction.type === "wrong") {
      setScore((current) => ({ ...current, wrong: Math.max(0, current.wrong - 1) }));
      setMistakes((current) => removeLastMatchingRow(current, lastAction.row));
    } else if (lastAction.type === "skipped") {
      setSkippedRows((current) => removeLastMatchingRow(current, lastAction.row));
    }
  }

  function advanceQuestion(nextSessionRows = sessionRows) {
    setQuestionIndex((current) => current + 1);
    setAnswer("");
    setSubmittedAnswer("");
    setResult(null);
    setWasAutoRevealed(false);
    setTimerRemaining(timerSeconds);
    answerRef.current = "";
    if (!nextSessionRows[questionIndex + 1]) {
      return;
    }
  }

  if (loading) {
    return <LoadingScreen label="Loading translate" />;
  }

  if (error) {
    return (
      <main className="page narrow-page">
        <section className="panel empty-state">
          <h2>Could not load translate</h2>
          <p className="error">{error}</p>
        </section>
      </main>
    );
  }

  if (isComplete) {
    return (
      <main className="page narrow-page">
        <GameMenu />
        <section className="quiz-card result-card">
          <p className="eyebrow">Session complete</p>
          <h2>{score.correct} / {sessionRows.length}</h2>
          <div className="stats-grid">
            <section className="stat-card">
              <p>Correct</p>
              <strong>{score.correct}</strong>
            </section>
            <section className="stat-card">
              <p>Wrong</p>
              <strong>{score.wrong}</strong>
            </section>
            <section className="stat-card">
              <p>Skipped</p>
              <strong>{skippedRows.length}</strong>
            </section>
          </div>
          {mistakes.length > 0 && (
            <section className="wrong-list">
              <h3>Items to review</h3>
              {mistakes.map((mistake, index) => (
                <article className="wrong-row" key={`${mistake.__rowNumber}-${index}`}>
                  <strong>{mistake._English}</strong>
                  <span>Your answer: {mistake.submittedAnswer || "None"}</span>
                  <span>Accepted: {mistake.acceptedAnswers.join(" / ")}</span>
                </article>
              ))}
            </section>
          )}
          {skippedRows.length > 0 && (
            <section className="wrong-list skipped-list">
              <h3>Skipped items</h3>
              {skippedRows.map((row, index) => (
                <article className="wrong-row" key={`${row.__rowNumber}-skipped-${index}`}>
                  <strong>{row._English}</strong>
                  <span>Accepted: {row.acceptedAnswers.join(" / ")}</span>
                </article>
              ))}
            </section>
          )}
          <div className="result-actions">
            <Link className="play-button" to={`/translate?count=${requestedCount}&order=${orderMode}&timer=${timerSeconds}&run=${Date.now()}`}>
              Play again
            </Link>
            <Link
              className="secondary-button settings-link"
              to={buildReviewAgainParams("/translate", searchParams, sessionRows, { prefix: "translate-review" })}
            >
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

  if (!currentQuestion) {
    return (
      <main className="page narrow-page">
        <section className="panel empty-state">
          <h2>No translate questions found</h2>
          <p>Add rows with an English prompt and at least one possible translation to TRANSLATE.csv.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="page narrow-page">
      <GameMenu />
      <section className="quiz-card sentence-card translate-card">
        <div className="dictionary-card-top game-card-top translate-card-top">
          <p className="eyebrow">{questionIndex + 1} / {sessionRows.length}</p>
          <p className="question-id">{currentQuestion.__rowNumber || "?"}</p>
          <div className="translate-top-actions">
            <button className="undo-button" onClick={undoLastAction} disabled={!history.length} aria-label="Undo">
              <img src="data/undo.svg" alt="" aria-hidden="true" />
            </button>
          </div>
        </div>
        <ColorBadge colorValue={currentQuestion.Color} loseStreak={currentQuestion["Lose Streak"]} />
        <TimerStatus
          isFlipped={Boolean(result)}
          timerSeconds={isReviewAgain ? 0 : timerSeconds}
          timerRemaining={timerRemaining}
          wasAutoFlipped={wasAutoRevealed}
        />
        <div className="translate-prompt">
          <span>English sentence</span>
          <p>{currentQuestion._English}</p>
        </div>
        <label className="translate-answer">
          <span>Your Chinese sentence</span>
          <textarea
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            disabled={Boolean(result)}
            rows={4}
            placeholder="Type a possible Chinese translation"
          />
        </label>
        {!result && (
          <div className="sentence-actions">
            <button disabled={!canSubmit} onClick={submitAnswer}>Submit Answer</button>
            <button className="secondary-action" onClick={() => setAnswer("")}>Clear</button>
            <button className="secondary-action" onClick={skipQuestion}>Skip</button>
            <button className="secondary-action" onClick={giveUpQuestion}>Give up</button>
          </div>
        )}
        {result && (
          <div className={`adverb-feedback ${result}`}>
            <strong>{result === "correct" ? "Correct" : "Wrong"}</strong>
            <div className="mandarin-answer">
              <span>Your answer</span>
              <p>{submittedAnswer || "None"}</p>
            </div>
            <div className="mandarin-answer alternate-answer-list">
              <span>Accepted answers</span>
              {currentQuestion.acceptedAnswers.map((acceptedAnswer, index) => (
                <p key={`${acceptedAnswer}-${index}`}>{acceptedAnswer}</p>
              ))}
            </div>
            <div className="sentence-actions two-actions">
              <button onClick={nextQuestion}>Next</button>
              <button className="secondary-action" onClick={skipQuestion}>Skip</button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function isAcceptedTranslation(submittedAnswer, acceptedAnswers) {
  const normalizedSubmission = normalizeChineseAnswer(submittedAnswer);
  return acceptedAnswers.some((answer) => normalizeChineseAnswer(answer) === normalizedSubmission);
}

function normalizeChineseAnswer(value = "") {
  return value
    .normalize("NFKC")
    .replace(/[\s。！？!?，,、；;：「」『』“”"'（）()《》〈〉【】\[\].]/g, "")
    .toLowerCase();
}

function replaceRowProgress(rows, rowNumber, colorValue, loseStreak) {
  return rows.map((row) =>
    row.__rowNumber === rowNumber
      ? { ...row, Color: colorValue, "Lose Streak": String(loseStreak) }
      : row
  );
}

function applyRange(rows, start, end) {
  return rows.slice(start - 1, end);
}

function removeLastMatchingRow(rows, rowToRemove) {
  const targetIndex = rows.map((row) => row.__rowNumber).lastIndexOf(rowToRemove.__rowNumber);
  if (targetIndex === -1) {
    return rows;
  }

  return rows.filter((_, index) => index !== targetIndex);
}
