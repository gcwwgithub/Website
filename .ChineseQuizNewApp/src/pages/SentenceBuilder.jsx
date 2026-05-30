import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import GameMenu from "../components/GameMenu.jsx";
import ColorBadge from "../components/ColorBadge.jsx";
import LoadingScreen from "../components/LoadingScreen.jsx";
import TimerStatus from "../components/TimerStatus.jsx";
import { loadSentenceRows } from "../services/adverbCsv.js";
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
  isReviewAgainMode,
  normalizeOrderMode,
  saveColorProgress,
  updateColorValue,
} from "../utils/practiceProgress.js";

const SENTENCE_COLOR_PROGRESS_KEY = "chineseQuizNew.sentenceBuilderColorProgress.v1";

export default function SentenceBuilder() {
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useSupabaseAuth();
  const requestedCount = Math.max(1, Math.min(100, Number(searchParams.get("count")) || 20));
  const orderMode = normalizeOrderMode(searchParams.get("order"));
  const timerSeconds = Math.max(0, Math.min(600, Number(searchParams.get("timer")) || 0));
  const rangeStart = Math.max(1, Number(searchParams.get("start")) || 1);
  const rangeEnd = Math.max(rangeStart, Number(searchParams.get("end")) || Number.MAX_SAFE_INTEGER);
  const sessionRun = searchParams.get("run") || "";
  const reviewSetKey = searchParams.get("reviewSet") || "";
  const [sessionRows, setSessionRows] = useState([]);
  const [rows, setRows] = useState([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [availableTiles, setAvailableTiles] = useState([]);
  const [answerTiles, setAnswerTiles] = useState([]);
  const answerTilesRef = useRef([]);
  const [heldTile, setHeldTile] = useState(null);
  const pendingInsertRef = useRef({ index: -1, time: 0 });
  const [score, setScore] = useState({ correct: 0, wrong: 0 });
  const [result, setResult] = useState(null);
  const [submittedAnswer, setSubmittedAnswer] = useState("");
  const [wasAutoRevealed, setWasAutoRevealed] = useState(false);
  const [timerRemaining, setTimerRemaining] = useState(timerSeconds);
  const [mistakes, setMistakes] = useState([]);
  const [skippedRows, setSkippedRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const isComplete = sessionRows.length > 0 && questionIndex >= sessionRows.length;
  const canSubmitAnswer = Boolean(answerTiles.length) && availableTiles.length === 0;
  const isReviewAgain = isReviewAgainMode(orderMode);

  function saveSupabaseProgress(row, colorValue) {
    if (!user?.id || !row) {
      return;
    }

    saveRemoteColorProgress({
      userId: user.id,
      storageKey: SENTENCE_COLOR_PROGRESS_KEY,
      row,
      colorValue,
    }).catch((trackingError) => {
      console.warn("Could not save Supabase sentence-builder progress.", trackingError);
    });
  }

  useEffect(() => {
    if (authLoading) {
      setLoading(true);
      return;
    }

    async function loadGame() {
      setLoading(true);
      setError("");
      try {
        const baseRows = await loadSentenceRows();
        const loadedRows = user?.id
          ? applyRemoteColorProgress(
              baseRows,
              await fetchRemoteColorProgress({ userId: user.id, storageKey: SENTENCE_COLOR_PROGRESS_KEY })
            )
          : applySavedColorProgress(baseRows, SENTENCE_COLOR_PROGRESS_KEY);
        const rangedRows = applyRange(loadedRows, rangeStart, rangeEnd);
        const loadedSessionRows = buildPracticeSession(rangedRows, requestedCount, orderMode, reviewSetKey);
        setRows(loadedRows);
        setSessionRows(loadedSessionRows);
        setQuestionIndex(0);
        setScore({ correct: 0, wrong: 0 });
        setWasAutoRevealed(false);
        setTimerRemaining(timerSeconds);
        setMistakes([]);
        setSkippedRows([]);
        setQuestion(loadedSessionRows[0], setCurrentQuestion, setAvailableTiles, setAnswerTiles, setResult, setSubmittedAnswer);
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    }

    loadGame();
  }, [authLoading, orderMode, rangeEnd, rangeStart, requestedCount, reviewSetKey, sessionRun, timerSeconds, user?.id]);

  useEffect(() => {
    answerTilesRef.current = answerTiles;
  }, [answerTiles]);

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
          setSubmittedAnswer(answerTilesRef.current.map((tile) => tile.text).join(""));
          setResult("wrong");
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [currentQuestion, isComplete, isReviewAgain, loading, questionIndex, result, timerSeconds]);

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

  useEffect(() => {
    if (!heldTile) {
      return undefined;
    }

    function handlePointerMove(event) {
      const dropZone = getDropZone(event.clientX, event.clientY);

      if (dropZone === "answer") {
        const nextIndex = getAnswerInsertIndex(event.clientX, event.clientY);
        const now = window.performance.now();
        const pending = pendingInsertRef.current;

        if (pending.index !== nextIndex) {
          pendingInsertRef.current = { index: nextIndex, time: now, isCommitted: false };
        } else if (now - pending.time > 170) {
          placeTileInAnswer(heldTile.tile.id, nextIndex);
          pendingInsertRef.current = { index: nextIndex, time: now, isCommitted: true };
        }
      } else if (dropZone === "available") {
        pendingInsertRef.current = { index: -1, time: 0, isCommitted: false };
        moveTile(heldTile.tile.id, "available");
      }

      setHeldTile((current) =>
        current
          ? {
              ...current,
              x: event.clientX - current.offsetX,
              y: event.clientY - current.offsetY,
              pointerX: event.clientX,
              pointerY: event.clientY,
            }
          : current
      );
    }

    function handlePointerUp(event) {
      const dropZone = getDropZone(event.clientX, event.clientY);

      if (dropZone === "answer") {
        const pending = pendingInsertRef.current;
        if (!pending.isCommitted) {
          const releaseIndex =
            pending.index >= 0 ? pending.index : getAnswerInsertIndex(event.clientX, event.clientY, heldTile.tile.id);
          placeTileInAnswer(heldTile.tile.id, releaseIndex);
        }
      } else if (dropZone === "available") {
        moveTile(heldTile.tile.id, "available");
      }

      pendingInsertRef.current = { index: -1, time: 0, isCommitted: false };
      setHeldTile(null);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [heldTile, answerTiles, availableTiles, result]);

  function pickUpTile(event, tile, originZone) {
    if (result) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    event.preventDefault();
    pendingInsertRef.current = { index: -1, time: 0, isCommitted: false };
    setHeldTile({
      tile,
      originZone,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      pointerX: event.clientX,
      pointerY: event.clientY,
      x: rect.left,
      y: rect.top,
      width: rect.width,
    });
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
    const wasCorrect = isAcceptedSentenceAnswer(submittedAnswer, currentQuestion);
    setSubmittedAnswer(submittedAnswer);
    setResult(wasCorrect ? "correct" : "wrong");
  }

  function giveUpQuestion() {
    if (!currentQuestion || result) {
      return;
    }

    setSubmittedAnswer(answerTiles.map((tile) => tile.text).join(""));
    setResult("wrong");
  }

  function nextQuestion() {
    let nextSessionRows = sessionRows;

    if (currentQuestion && result) {
      const wasCorrect = result === "correct";
      const nextColor = updateColorValue(currentQuestion.Color, wasCorrect);
      if (!isReviewAgain) {
        saveColorProgress(currentQuestion, nextColor, SENTENCE_COLOR_PROGRESS_KEY);
        saveSupabaseProgress({ ...currentQuestion, Color: nextColor }, nextColor);
        setRows((current) => replaceRowColor(current, currentQuestion.__rowNumber, nextColor));
        nextSessionRows = replaceRowColor(sessionRows, currentQuestion.__rowNumber, nextColor);
        setSessionRows(nextSessionRows);
      }
      setScore((current) => ({
        correct: current.correct + (wasCorrect ? 1 : 0),
        wrong: current.wrong + (wasCorrect ? 0 : 1),
      }));

      if (!wasCorrect) {
        setMistakes((current) => [...current, { ...currentQuestion, Color: nextColor, submittedAnswer }]);
      }
    }

    advanceQuestion(nextSessionRows);
  }

  function advanceQuestion(nextSessionRows = sessionRows) {
    setWasAutoRevealed(false);
    setTimerRemaining(timerSeconds);
    const nextIndex = questionIndex + 1;
    setQuestionIndex(nextIndex);
    setQuestion(nextSessionRows[nextIndex], setCurrentQuestion, setAvailableTiles, setAnswerTiles, setResult, setSubmittedAnswer);
  }

  function skipQuestion() {
    if (currentQuestion) {
      setSkippedRows((current) => [...current, currentQuestion]);
    }
    advanceQuestion();
  }

  if (loading) {
    return <LoadingScreen label="Loading sentence builder" />;
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
            <Link className="play-button" to={`/sentence-builder?count=${requestedCount}&order=${orderMode}&timer=${timerSeconds}&run=${Date.now()}`}>
              Play again
            </Link>
            <Link
              className="secondary-button settings-link"
              to={buildReviewAgainParams("/sentence-builder", searchParams, sessionRows, { prefix: "sentence-review" })}
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
        <ColorBadge colorValue={currentQuestion.Color} />
        <TimerStatus
          isFlipped={Boolean(result)}
          timerSeconds={isReviewAgain ? 0 : timerSeconds}
          timerRemaining={timerRemaining}
          wasAutoFlipped={wasAutoRevealed}
        />
        <TileZone
          allowReorder
          emptyText="Drop Chinese phrase tiles here"
          heldTileId={heldTile?.tile.id || ""}
          onTilePointerDown={pickUpTile}
          zone="answer"
          tiles={answerTiles}
        />
        <TileZone
          emptyText="No tiles left"
          heldTileId={heldTile?.tile.id || ""}
          onTilePointerDown={pickUpTile}
          zone="available"
          tiles={availableTiles}
        />
        {heldTile && (
          <div
            className="sentence-tile floating-sentence-tile"
            style={{
              left: `${heldTile.x}px`,
              top: `${heldTile.y}px`,
              width: `${heldTile.width}px`,
            }}
          >
            {heldTile.tile.text}
          </div>
        )}
        {!result && (
          <div className="sentence-actions">
            <button disabled={!canSubmitAnswer} onClick={submitAnswer}>Submit Answer</button>
            <button className="secondary-action" onClick={() => {
              setAvailableTiles((current) => shuffleTiles([...current, ...answerTiles]));
              setAnswerTiles([]);
            }}>
              Clear
            </button>
            <button className="secondary-action" onClick={skipQuestion}>Skip</button>
            <button className="secondary-action" onClick={giveUpQuestion}>Give up</button>
          </div>
        )}
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
            {currentQuestion.alternateAnswers.length > 0 && (
              <div className="mandarin-answer alternate-answer-list">
                <span>Alternate answers</span>
                {currentQuestion.alternateAnswers.map((answer, index) => (
                  <p key={`${answer}-${index}`}>{answer}</p>
                ))}
              </div>
            )}
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

function TileZone({
  emptyText,
  heldTileId,
  onTilePointerDown,
  tiles,
  zone,
}) {
  return (
    <div className="tile-zone" data-zone={zone}>
      {tiles.length ? (
        tiles.map((tile) => (
          <button
            className={`sentence-tile ${heldTileId === tile.id ? "held-placeholder" : ""}`}
            data-tile-id={tile.id}
            key={tile.id}
            onPointerDown={(event) => onTilePointerDown(event, tile, zone)}
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

function setQuestion(sourceRow, setCurrentQuestion, setAvailableTiles, setAnswerTiles, setResult, setSubmittedAnswer) {
  if (!sourceRow) {
    setCurrentQuestion(null);
    setAvailableTiles([]);
    setAnswerTiles([]);
    setResult(null);
    setSubmittedAnswer("");
    return;
  }

  const tiles = sourceRow.parts.map((piece, index) => ({
    id: `${Date.now()}-${index}-${piece}`,
    text: piece,
  }));

  setCurrentQuestion({
    id: sourceRow.__rowNumber,
    __rowNumber: sourceRow.__rowNumber,
    Color: sourceRow.Color,
    alternateAnswers: sourceRow.alternateAnswers || [],
    sentence: sourceRow.parts.join(""),
  });
  setAvailableTiles(shuffleTiles(tiles));
  setAnswerTiles([]);
  setResult(null);
  setSubmittedAnswer("");
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

function getDropZone(x, y) {
  const element = document.elementFromPoint(x, y);
  return element?.closest(".tile-zone")?.dataset.zone || "";
}

function getAnswerInsertIndex(pointerX, pointerY, heldTileId = "") {
  const answerZone = document.querySelector('.tile-zone[data-zone="answer"]');
  if (!answerZone) {
    return 0;
  }

  const hoveredTile = document.elementFromPoint(pointerX, pointerY)?.closest(".sentence-tile");
  const layoutTiles = [...answerZone.querySelectorAll(".sentence-tile")]
    .filter((tile) => !tile.classList.contains("floating-sentence-tile"));
  const insertableTiles = layoutTiles.filter((tile) => !tile.classList.contains("held-placeholder"));
  const hoveredIndex = insertableTiles.indexOf(hoveredTile);

  if (hoveredIndex >= 0 && hoveredTile.dataset.tileId !== heldTileId) {
    const rect = hoveredTile.getBoundingClientRect();
    return getTileInsertIndex(pointerX, pointerY, rect, hoveredIndex);
  }

  return getRowAwareInsertIndex(pointerX, pointerY, layoutTiles);
}

function getTileInsertIndex(pointerX, pointerY, rect, tileIndex) {
  const upperThreshold = rect.top + rect.height * 0.35;
  const lowerThreshold = rect.bottom - rect.height * 0.35;

  if (pointerY < upperThreshold) {
    return tileIndex;
  }

  if (pointerY > lowerThreshold) {
    return tileIndex + 1;
  }

  return pointerX < rect.left + rect.width / 2 ? tileIndex : tileIndex + 1;
}

function getRowAwareInsertIndex(pointerX, pointerY, tiles) {
  const tilePositions = tiles.map((tile, layoutIndex) => {
    const rect = tile.getBoundingClientRect();
    return {
      insertIndex: getInsertableIndexBeforeTile(tiles, layoutIndex),
      isHeldPlaceholder: tile.classList.contains("held-placeholder"),
      layoutIndex,
      centerX: rect.left + rect.width / 2,
      centerY: rect.top + rect.height / 2,
      rect,
    };
  });

  if (!tilePositions.length) {
    return 0;
  }

  const rows = groupTilePositionsByRow(tilePositions);
  const targetRow = findTargetTileRow(pointerY, rows);

  if (!targetRow?.length) {
    return tilePositions.length;
  }

  for (const tile of targetRow) {
    if (tile.isHeldPlaceholder && pointerX < tile.centerX) {
      return tile.insertIndex;
    }

    if (tile.isHeldPlaceholder) {
      continue;
    }

    if (pointerX < tile.centerX) {
      return tile.insertIndex;
    }
  }

  return getInsertIndexAfterRow(targetRow);
}

function getInsertableIndexBeforeTile(tiles, layoutIndex) {
  return tiles
    .slice(0, layoutIndex)
    .filter((tile) => !tile.classList.contains("held-placeholder")).length;
}

function getInsertIndexAfterRow(row) {
  const lastInsertableTile = [...row].reverse().find((tile) => !tile.isHeldPlaceholder);
  if (lastInsertableTile) {
    return lastInsertableTile.insertIndex + 1;
  }

  return row[0]?.insertIndex || 0;
}

function groupTilePositionsByRow(tilePositions) {
  return tilePositions.reduce((rows, tile) => {
    const matchingRow = rows.find((row) => {
      const rowTop = Math.min(...row.map((rowTile) => rowTile.rect.top));
      const rowBottom = Math.max(...row.map((rowTile) => rowTile.rect.bottom));
      return tile.centerY >= rowTop && tile.centerY <= rowBottom;
    });

    if (matchingRow) {
      matchingRow.push(tile);
    } else {
      rows.push([tile]);
    }

    return rows;
  }, []);
}

function findTargetTileRow(pointerY, rows) {
  return rows.reduce((closestRow, row) => {
    const rowTop = Math.min(...row.map((tile) => tile.rect.top));
    const rowBottom = Math.max(...row.map((tile) => tile.rect.bottom));
    const rowCenterY = (rowTop + rowBottom) / 2;
    const distance = pointerY >= rowTop && pointerY <= rowBottom ? 0 : Math.abs(pointerY - rowCenterY);

    return !closestRow || distance < closestRow.distance ? { row, distance } : closestRow;
  }, null)?.row;
}

function replaceRowColor(rows, rowNumber, colorValue) {
  return rows.map((row) => (row.__rowNumber === rowNumber ? { ...row, Color: colorValue } : row));
}

function applyRange(rows, start, end) {
  return rows.slice(start - 1, end);
}

function isAcceptedSentenceAnswer(answer, question) {
  const normalizedAnswer = normalizeSentenceAnswer(answer);
  return [question.sentence, ...(question.alternateAnswers || [])]
    .map(normalizeSentenceAnswer)
    .includes(normalizedAnswer);
}

function normalizeSentenceAnswer(answer = "") {
  return answer.trim();
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
