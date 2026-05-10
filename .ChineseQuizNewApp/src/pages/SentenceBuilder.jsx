import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import GameMenu from "../components/GameMenu.jsx";
import { loadSentenceRows } from "../services/adverbCsv.js";

export default function SentenceBuilder() {
  const [searchParams] = useSearchParams();
  const requestedCount = Math.max(1, Math.min(100, Number(searchParams.get("count")) || 20));
  const sessionRun = searchParams.get("run") || "";
  const [sessionRows, setSessionRows] = useState([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [availableTiles, setAvailableTiles] = useState([]);
  const [answerTiles, setAnswerTiles] = useState([]);
  const [draggedTileId, setDraggedTileId] = useState("");
  const [score, setScore] = useState({ correct: 0, wrong: 0 });
  const [result, setResult] = useState(null);
  const [mistakes, setMistakes] = useState([]);
  const [skippedRows, setSkippedRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const isComplete = sessionRows.length > 0 && questionIndex >= sessionRows.length;
  const canSubmitAnswer = Boolean(answerTiles.length) && availableTiles.length === 0;

  useEffect(() => {
    async function loadGame() {
      try {
        const loadedRows = await loadSentenceRows();
        const loadedSessionRows = buildSessionRows(loadedRows, requestedCount);
        setSessionRows(loadedSessionRows);
        setQuestionIndex(0);
        setScore({ correct: 0, wrong: 0 });
        setMistakes([]);
        setSkippedRows([]);
        setQuestion(loadedSessionRows[0], setCurrentQuestion, setAvailableTiles, setAnswerTiles, setResult);
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    }

    loadGame();
  }, [requestedCount, sessionRun]);

  function moveTile(tileId, targetZone) {
    if (result) {
      return;
    }

    const tile = getTileById(tileId, availableTiles, answerTiles);
    if (!tile) {
      return;
    }

    setAvailableTiles((current) =>
      targetZone === "available" ? addUniqueTile(current, tile) : current.filter((item) => item.id !== tileId)
    );
    setAnswerTiles((current) =>
      targetZone === "answer" ? addUniqueTile(current, tile) : current.filter((item) => item.id !== tileId)
    );
  }

  function handleDrop(targetZone) {
    moveTile(draggedTileId, targetZone);
    setDraggedTileId("");
  }

  function placeTileInAnswer(tileId, targetIndex = answerTiles.length) {
    if (result || !tileId) {
      return;
    }

    const tile = getTileById(tileId, availableTiles, answerTiles);
    if (!tile) {
      return;
    }

    setAvailableTiles((current) => current.filter((item) => item.id !== tileId));
    setAnswerTiles((current) => {
      const withoutTile = current.filter((item) => item.id !== tileId);
      const safeIndex = Math.max(0, Math.min(targetIndex, withoutTile.length));
      return [
        ...withoutTile.slice(0, safeIndex),
        tile,
        ...withoutTile.slice(safeIndex),
      ];
    });
  }

  function submitAnswer() {
    if (!currentQuestion || !answerTiles.length || result) {
      return;
    }

    const submittedAnswer = answerTiles.map((tile) => tile.text).join("");
    const wasCorrect = submittedAnswer === currentQuestion.sentence;
    setResult(wasCorrect ? "correct" : "wrong");
    setScore((current) => ({
      correct: current.correct + (wasCorrect ? 1 : 0),
      wrong: current.wrong + (wasCorrect ? 0 : 1),
    }));

    if (!wasCorrect) {
      setMistakes((current) => [...current, { ...currentQuestion, submittedAnswer }]);
    }
  }

  function nextQuestion() {
    const nextIndex = questionIndex + 1;
    setQuestionIndex(nextIndex);
    setQuestion(sessionRows[nextIndex], setCurrentQuestion, setAvailableTiles, setAnswerTiles, setResult);
  }

  function skipQuestion() {
    if (currentQuestion) {
      setSkippedRows((current) => [...current, currentQuestion]);
    }
    nextQuestion();
  }

  if (loading) {
    return <main className="page narrow-page">Loading sentence builder...</main>;
  }

  if (error) {
    return (
      <main className="page narrow-page">
        <section className="panel empty-state">
          <h2>Could not load sentence builder</h2>
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
                <article className="wrong-row" key={`${mistake.id}-${index}`}>
                  <strong>{mistake.sentence}</strong>
                  <span>Your answer: {mistake.submittedAnswer || "None"}</span>
                </article>
              ))}
            </section>
          )}
          {skippedRows.length > 0 && (
            <section className="wrong-list skipped-list">
              <h3>Skipped items</h3>
              {skippedRows.map((row, index) => (
                <article className="wrong-row" key={`${row.id}-skipped-${index}`}>
                  <strong>{row.sentence}</strong>
                </article>
              ))}
            </section>
          )}
          <div className="result-actions">
            <Link className="play-button" to={`/sentence-builder?count=${requestedCount}&run=${Date.now()}`}>
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
          <h2>No sentence builder questions found</h2>
          <p>Add sentence rows with at least two non-empty columns to SENTENCE.csv to play this mode.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="page narrow-page">
      <GameMenu />
      <section className="quiz-card sentence-card">
        <div className="dictionary-card-top game-card-top">
          <p className="eyebrow">{questionIndex + 1} / {sessionRows.length}</p>
          <p className="question-id">{currentQuestion.id || "?"}</p>
          <p className="eyebrow game-name">Sentence Builder</p>
        </div>
        <TileZone
          allowReorder
          draggedTileId={draggedTileId}
          emptyText="Drop Chinese phrase tiles here"
          onDrop={() => handleDrop("answer")}
          onReorder={placeTileInAnswer}
          tiles={answerTiles}
          onDragStart={setDraggedTileId}
          onTileClick={(tileId) => moveTile(tileId, "available")}
        />
        <TileZone
          draggedTileId={draggedTileId}
          emptyText="No tiles left"
          onDrop={() => handleDrop("available")}
          tiles={availableTiles}
          onDragStart={setDraggedTileId}
          onTileClick={(tileId) => moveTile(tileId, "answer")}
        />
        <div className="sentence-actions">
          <button disabled={!canSubmitAnswer || Boolean(result)} onClick={submitAnswer}>Submit Answer</button>
          <button className="secondary-action" disabled={Boolean(result)} onClick={() => {
            setAvailableTiles((current) => shuffleTiles([...current, ...answerTiles]));
            setAnswerTiles([]);
          }}>
            Clear
          </button>
          <button className="secondary-action" disabled={Boolean(result)} onClick={skipQuestion}>Skip</button>
        </div>
        {result && (
          <div className={`adverb-feedback ${result}`}>
            <strong>{result === "correct" ? "Correct" : "Wrong"}</strong>
            <div className="mandarin-answer">
              <span>Correct sentence</span>
              <div className="sentence-audio-row">
                <p>{currentQuestion.sentence}</p>
                <IconAudioButton
                  label="Read Chinese sentence"
                  onClick={() => speakText(currentQuestion.sentence, "zh-CN")}
                />
              </div>
            </div>
            <button onClick={nextQuestion}>Next</button>
          </div>
        )}
      </section>
    </main>
  );
}

function TileZone({ allowReorder = false, draggedTileId, emptyText, onDrop, onReorder, tiles, onDragStart, onTileClick }) {
  return (
    <div
      className="tile-zone"
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
    >
      {tiles.length ? (
        tiles.map((tile, index) => (
          <button
            className="sentence-tile"
            draggable
            key={tile.id}
            onClick={() => onTileClick(tile.id)}
            onDragStart={() => onDragStart(tile.id)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              if (!allowReorder) {
                return;
              }
              event.stopPropagation();
              onReorder(draggedTileId, index);
            }}
            type="button"
          >
            {tile.text}
          </button>
        ))
      ) : (
        <span>{emptyText}</span>
      )}
    </div>
  );
}

function setQuestion(sourceRow, setCurrentQuestion, setAvailableTiles, setAnswerTiles, setResult) {
  if (!sourceRow) {
    setCurrentQuestion(null);
    setAvailableTiles([]);
    setAnswerTiles([]);
    setResult(null);
    return;
  }

  const tiles = sourceRow.parts.map((piece, index) => ({
    id: `${Date.now()}-${index}-${piece}`,
    text: piece,
  }));

  setCurrentQuestion({
    id: sourceRow.__rowNumber,
    sentence: sourceRow.parts.join(""),
  });
  setAvailableTiles(shuffleTiles(tiles));
  setAnswerTiles([]);
  setResult(null);
}

function buildSessionRows(rows, count) {
  return [...rows].sort(() => Math.random() - 0.5).slice(0, Math.min(count, rows.length));
}

function addUniqueTile(tiles, tile) {
  return tiles.some((currentTile) => currentTile.id === tile.id) ? tiles : [...tiles, tile];
}

function shuffleTiles(tiles) {
  return tiles.sort(() => Math.random() - 0.5);
}

function getTileById(tileId, availableTiles, answerTiles) {
  return availableTiles.find((tile) => tile.id === tileId) || answerTiles.find((tile) => tile.id === tileId);
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
