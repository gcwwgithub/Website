import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import ColorBadge from "../components/ColorBadge.jsx";
import GameMenu from "../components/GameMenu.jsx";
import TimerStatus from "../components/TimerStatus.jsx";
import { loadTranslateRows } from "../services/adverbCsv.js";
import { saveRemoteColorProgress, syncRemoteColorProgress } from "../services/colorProgressTracking.js";
import { useSupabaseAuth } from "../services/supabaseAuth.js";
import {
  applySavedColorProgress,
  buildPracticeSession,
  normalizeOrderMode,
  saveColorProgress,
  updateColorValue,
} from "../utils/practiceProgress.js";

const TRANSLATE_COLOR_PROGRESS_KEY = "chineseQuizNew.translateColorProgress.v1";

export default function Translate() {
  const [searchParams] = useSearchParams();
  const { user } = useSupabaseAuth();
  const requestedCount = Math.max(1, Math.min(100, Number(searchParams.get("count")) || 20));
  const orderMode = normalizeOrderMode(searchParams.get("order"));
  const timerSeconds = Math.max(0, Math.min(600, Number(searchParams.get("timer")) || 0));
  const sessionRun = searchParams.get("run") || "";
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const currentQuestion = sessionRows[questionIndex];
  const isComplete = sessionRows.length > 0 && questionIndex >= sessionRows.length;
  const canSubmit = Boolean(answer.trim()) && !result;

  function syncSupabaseProgress(nextRows) {
    if (!user?.id || !nextRows?.length) {
      return;
    }

    syncRemoteColorProgress({
      userId: user.id,
      storageKey: TRANSLATE_COLOR_PROGRESS_KEY,
      rows: nextRows,
    }).catch((trackingError) => {
      console.warn("Could not sync Supabase translate progress.", trackingError);
    });
  }

  function saveSupabaseProgress(row, colorValue) {
    if (!user?.id || !row) {
      return;
    }

    saveRemoteColorProgress({
      userId: user.id,
      storageKey: TRANSLATE_COLOR_PROGRESS_KEY,
      row,
      colorValue,
    }).catch((trackingError) => {
      console.warn("Could not save Supabase translate progress.", trackingError);
    });
  }

  useEffect(() => {
    async function loadSession() {
      setLoading(true);
      setError("");
      try {
        const loadedRows = applySavedColorProgress(await loadTranslateRows(), TRANSLATE_COLOR_PROGRESS_KEY);
        syncSupabaseProgress(loadedRows);
        const loadedSessionRows = buildPracticeSession(loadedRows, requestedCount, orderMode);
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
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    }

    loadSession();
  }, [orderMode, requestedCount, sessionRun, timerSeconds, user?.id]);

  useEffect(() => {
    answerRef.current = answer;
  }, [answer]);

  useEffect(() => {
    if (loading || timerSeconds <= 0 || result || !currentQuestion || isComplete) {
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
  }, [currentQuestion, isComplete, loading, questionIndex, result, timerSeconds]);

  function submitAnswer() {
    if (!canSubmit || !currentQuestion) {
      return;
    }

    const nextSubmittedAnswer = answer.trim();
    setSubmittedAnswer(nextSubmittedAnswer);
    setResult(isAcceptedTranslation(nextSubmittedAnswer, currentQuestion.acceptedAnswers) ? "correct" : "wrong");
  }

  function nextQuestion() {
    let nextSessionRows = sessionRows;

    if (currentQuestion && result) {
      const wasCorrect = result === "correct";
      const nextColor = updateColorValue(currentQuestion.Color, wasCorrect);
      saveColorProgress(currentQuestion, nextColor, TRANSLATE_COLOR_PROGRESS_KEY);
      saveSupabaseProgress({ ...currentQuestion, Color: nextColor }, nextColor);
      setRows((current) => replaceRowColor(current, currentQuestion.__rowNumber, nextColor));
      nextSessionRows = replaceRowColor(sessionRows, currentQuestion.__rowNumber, nextColor);
      setSessionRows(nextSessionRows);
      setScore((current) => ({
        correct: current.correct + (wasCorrect ? 1 : 0),
        wrong: current.wrong + (wasCorrect ? 0 : 1),
      }));

      if (!wasCorrect) {
        setMistakes((current) => [
          ...current,
          { ...currentQuestion, Color: nextColor, submittedAnswer },
        ]);
      }
    }

    advanceQuestion(nextSessionRows);
  }

  function skipQuestion() {
    if (currentQuestion) {
      setSkippedRows((current) => [...current, currentQuestion]);
    }
    advanceQuestion();
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
    return <main className="page narrow-page">Loading translate...</main>;
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
            <Link className="secondary-button settings-link" to="/">
              Go home
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
        <div className="dictionary-card-top game-card-top">
          <p className="eyebrow">{questionIndex + 1} / {sessionRows.length}</p>
          <p className="question-id">{currentQuestion.__rowNumber || "?"}</p>
          <p className="eyebrow game-name">Translate</p>
        </div>
        <ColorBadge colorValue={currentQuestion.Color} />
        <TimerStatus
          isFlipped={Boolean(result)}
          timerSeconds={timerSeconds}
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

function replaceRowColor(rows, rowNumber, colorValue) {
  return rows.map((row) => (row.__rowNumber === rowNumber ? { ...row, Color: colorValue } : row));
}
