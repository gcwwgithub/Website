import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import GameMenu from "../components/GameMenu.jsx";
import { loadSynonymRows } from "../services/adverbCsv.js";

export default function SynonymSelection() {
  const [searchParams] = useSearchParams();
  const requestedCount = Math.max(1, Math.min(100, Number(searchParams.get("count")) || 20));
  const sessionRun = searchParams.get("run") || "";
  const [rows, setRows] = useState([]);
  const [sessionRows, setSessionRows] = useState([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [currentRow, setCurrentRow] = useState(null);
  const [options, setOptions] = useState([]);
  const [score, setScore] = useState({ correct: 0, wrong: 0 });
  const [selected, setSelected] = useState("");
  const [mistakes, setMistakes] = useState([]);
  const [skippedRows, setSkippedRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const isAnswered = Boolean(selected);
  const isComplete = sessionRows.length > 0 && questionIndex >= sessionRows.length;

  useEffect(() => {
    async function loadGame() {
      try {
        const loadedRows = await loadSynonymRows();
        const loadedSessionRows = buildSessionRows(loadedRows, requestedCount);
        setRows(loadedRows);
        setSessionRows(loadedSessionRows);
        setQuestionIndex(0);
        setScore({ correct: 0, wrong: 0 });
        setSelected("");
        setMistakes([]);
        setSkippedRows([]);
        setQuestion(loadedSessionRows[0], setCurrentRow, setOptions);
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    }

    loadGame();
  }, [requestedCount, sessionRun]);

  function answer(option) {
    if (!currentRow || selected) {
      return;
    }

    const wasCorrect = option === currentRow["Chinese Word"];
    setSelected(option);
    setScore((current) => ({
      correct: current.correct + (wasCorrect ? 1 : 0),
      wrong: current.wrong + (wasCorrect ? 0 : 1),
    }));

    if (!wasCorrect) {
      setMistakes((current) => [...current, currentRow]);
    }
  }

  function nextQuestion() {
    setSelected("");
    const nextIndex = questionIndex + 1;
    setQuestionIndex(nextIndex);
    setQuestion(sessionRows[nextIndex], setCurrentRow, setOptions);
  }

  function skipQuestion() {
    if (currentRow) {
      setSkippedRows((current) => [...current, currentRow]);
    }
    nextQuestion();
  }

  if (loading) {
    return <main className="page narrow-page">Loading synonym selection...</main>;
  }

  if (error) {
    return (
      <main className="page narrow-page">
        <section className="panel empty-state">
          <h2>Could not load synonym selection</h2>
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
                  <strong>{mistake["Chinese Word"]}</strong>
                  <span>{fillBlank(mistake["Chinese Sentence"], mistake["Chinese Word"])}</span>
                  <span>{mistake["Chinese Sentence"]}</span>
                </article>
              ))}
            </section>
          )}
          {skippedRows.length > 0 && (
            <section className="wrong-list skipped-list">
              <h3>Skipped items</h3>
              {skippedRows.map((row, index) => (
                <article className="wrong-row" key={`${row.__rowNumber}-skipped-${index}`}>
                  <strong>{row["Chinese Word"]}</strong>
                  <span>{fillBlank(row["Chinese Sentence"], row["Chinese Word"])}</span>
                  <span>{row["Chinese Sentence"]}</span>
                </article>
              ))}
            </section>
          )}
          <div className="result-actions">
            <Link className="play-button" to={`/synonyms?count=${requestedCount}&run=${Date.now()}`}>
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

  if (!currentRow) {
    return (
      <main className="page narrow-page">
        <section className="panel empty-state">
          <h2>No synonym questions found</h2>
          <p>Add grammar rows to the grammar CSV to play this mode.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="page narrow-page">
      <GameMenu />
      <section className="quiz-card adverb-card">
        <div className="dictionary-card-top game-card-top">
          <p className="eyebrow">{questionIndex + 1} / {sessionRows.length}</p>
          <p className="question-id">{currentRow.__rowNumber || "?"}</p>
          <p className="eyebrow game-name">Chinese Synonym Selection</p>
        </div>
        <h2 className={getPromptSizeClass(currentRow["Chinese Sentence"])}>
          <span className="adverb-prompt-text">{currentRow["Chinese Sentence"]}</span>
        </h2>
        <div className="adverb-options">
          {options.map((option) => (
            <button
              className={getOptionClass(option, currentRow["Chinese Word"], selected)}
              disabled={isAnswered}
              key={option}
              onClick={() => answer(option)}
            >
              {option}
            </button>
          ))}
        </div>
        {isAnswered && (
          <div className={`adverb-feedback ${selected === currentRow["Chinese Word"] ? "correct" : "wrong"}`}>
            <strong>{selected === currentRow["Chinese Word"] ? "Correct" : "Wrong"}</strong>
            <p>Target word: {currentRow["Chinese Word"]}</p>
            <div className="mandarin-answer">
              <span>Completed sentence</span>
              <div className="sentence-audio-row">
                <p>{fillBlank(currentRow["Chinese Sentence"], currentRow["Chinese Word"])}</p>
                <IconAudioButton
                  label="Read Chinese sentence"
                  onClick={() => speakText(fillBlank(currentRow["Chinese Sentence"], currentRow["Chinese Word"]), "zh-CN")}
                />
              </div>
            </div>
            <button onClick={nextQuestion}>Next</button>
          </div>
        )}
        {!isAnswered && (
          <button className="secondary-action" onClick={skipQuestion}>Skip</button>
        )}
      </section>
    </main>
  );
}

function setQuestion(nextRow, setCurrentRow, setOptions) {
  if (!nextRow) {
    setCurrentRow(null);
    setOptions([]);
    return;
  }

  const distractors = ["Wrong Answer 1", "Wrong Answer 2", "Wrong Answer 3"]
    .map((key) => nextRow[key])
    .filter((answer) => answer && answer !== nextRow["Chinese Word"]);

  setCurrentRow(nextRow);
  setOptions([nextRow["Chinese Word"], ...distractors].sort(() => Math.random() - 0.5));
}

function buildSessionRows(rows, count) {
  return [...rows].sort(() => Math.random() - 0.5).slice(0, Math.min(count, rows.length));
}

function getPromptSizeClass(text = "") {
  if (text.length > 48) {
    return "tiny-prompt";
  }
  if (text.length > 34) {
    return "very-long-prompt";
  }
  if (text.length > 24) {
    return "long-prompt";
  }
  return "";
}

function fillBlank(sentence, answer) {
  return sentence.replace("____", answer);
}

function getOptionClass(option, correct, selected) {
  if (!selected) {
    return "";
  }

  if (option === correct) {
    return "correct-option";
  }

  if (option === selected) {
    return "wrong-option";
  }

  return "";
}

function IconAudioButton({ label, onClick }) {
  return (
    <button className="icon-audio-button" type="button" aria-label={label} onClick={onClick}>
      <span aria-hidden="true">Audio</span>
    </button>
  );
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
