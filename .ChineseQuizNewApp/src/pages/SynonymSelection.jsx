import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import GameMenu from "../components/GameMenu.jsx";
import ColorBadge from "../components/ColorBadge.jsx";
import TimerStatus from "../components/TimerStatus.jsx";
import { loadSynonymDetails, loadSynonymRows } from "../services/adverbCsv.js";
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

const SYNONYM_COLOR_PROGRESS_KEY = "chineseQuizNew.synonymColorProgress.v1";

export default function SynonymSelection() {
  const [searchParams] = useSearchParams();
  const { user } = useSupabaseAuth();
  const requestedCount = Math.max(1, Math.min(100, Number(searchParams.get("count")) || 20));
  const orderMode = normalizeOrderMode(searchParams.get("order"));
  const timerSeconds = Math.max(0, Math.min(600, Number(searchParams.get("timer")) || 0));
  const sessionRun = searchParams.get("run") || "";
  const reviewSetKey = searchParams.get("reviewSet") || "";
  const [rows, setRows] = useState([]);
  const [sessionRows, setSessionRows] = useState([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [currentRow, setCurrentRow] = useState(null);
  const [options, setOptions] = useState([]);
  const [score, setScore] = useState({ correct: 0, wrong: 0 });
  const [selected, setSelected] = useState("");
  const [wasAutoRevealed, setWasAutoRevealed] = useState(false);
  const [timerRemaining, setTimerRemaining] = useState(timerSeconds);
  const [synonymDetails, setSynonymDetails] = useState({});
  const [mistakes, setMistakes] = useState([]);
  const [skippedRows, setSkippedRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const isAnswered = Boolean(selected) || wasAutoRevealed;
  const isComplete = sessionRows.length > 0 && questionIndex >= sessionRows.length;
  const isReviewAgain = isReviewAgainMode(orderMode);

  function saveSupabaseProgress(row, colorValue) {
    if (!user?.id || !row) {
      return;
    }

    saveRemoteColorProgress({
      userId: user.id,
      storageKey: SYNONYM_COLOR_PROGRESS_KEY,
      row,
      colorValue,
    }).catch((trackingError) => {
      console.warn("Could not save Supabase synonym progress.", trackingError);
    });
  }

  useEffect(() => {
    async function loadGame() {
      try {
        const [synonymRows, loadedSynonymDetails] = await Promise.all([loadSynonymRows(), loadSynonymDetails()]);
        const loadedRows = user?.id
          ? applyRemoteColorProgress(
              synonymRows,
              await fetchRemoteColorProgress({ userId: user.id, storageKey: SYNONYM_COLOR_PROGRESS_KEY })
            )
          : applySavedColorProgress(synonymRows, SYNONYM_COLOR_PROGRESS_KEY);
        const loadedSessionRows = buildPracticeSession(loadedRows, requestedCount, orderMode, reviewSetKey);
        setRows(loadedRows);
        setSessionRows(loadedSessionRows);
        setSynonymDetails(loadedSynonymDetails);
        setQuestionIndex(0);
        setScore({ correct: 0, wrong: 0 });
        setSelected("");
        setWasAutoRevealed(false);
        setTimerRemaining(timerSeconds);
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
  }, [orderMode, requestedCount, reviewSetKey, sessionRun, timerSeconds, user?.id]);

  useEffect(() => {
    if (loading || isReviewAgain || timerSeconds <= 0 || isAnswered || !currentRow || isComplete) {
      setTimerRemaining(timerSeconds);
      return undefined;
    }

    setTimerRemaining(timerSeconds);
    const intervalId = window.setInterval(() => {
      setTimerRemaining((current) => {
        if (current <= 1) {
          window.clearInterval(intervalId);
          setWasAutoRevealed(true);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [currentRow, isAnswered, isComplete, isReviewAgain, loading, questionIndex, timerSeconds]);

  function answer(option) {
    if (!currentRow || isAnswered) {
      return;
    }

    setSelected(option);
  }

  function nextQuestion() {
    let nextRows = rows;
    let nextSessionRows = sessionRows;

    if (currentRow && isAnswered) {
      const wasCorrect = selected === currentRow["Chinese Word"];
      const nextColor = updateColorValue(currentRow.Color, wasCorrect);
      const answeredRow = { ...currentRow, Color: nextColor };
      if (!isReviewAgain) {
        saveColorProgress(currentRow, nextColor, SYNONYM_COLOR_PROGRESS_KEY);
        saveSupabaseProgress(answeredRow, nextColor);
        nextRows = replaceRowColor(rows, currentRow.__rowNumber, nextColor);
        nextSessionRows = replaceRowColor(sessionRows, currentRow.__rowNumber, nextColor);
        setRows(nextRows);
        setSessionRows(nextSessionRows);
      }
      setScore((current) => ({
        correct: current.correct + (wasCorrect ? 1 : 0),
        wrong: current.wrong + (wasCorrect ? 0 : 1),
      }));

      if (!wasCorrect) {
        setMistakes((current) => [...current, answeredRow]);
      }
    }

    advanceQuestion(nextSessionRows);
  }

  function advanceQuestion(nextSessionRows = sessionRows) {
    setSelected("");
    setWasAutoRevealed(false);
    setTimerRemaining(timerSeconds);
    const nextIndex = questionIndex + 1;
    setQuestionIndex(nextIndex);
    setQuestion(nextSessionRows[nextIndex], setCurrentRow, setOptions);
  }

  function skipQuestion() {
    if (currentRow) {
      setSkippedRows((current) => [...current, currentRow]);
    }
    advanceQuestion();
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
            <Link className="play-button" to={`/synonyms?count=${requestedCount}&order=${orderMode}&timer=${timerSeconds}&run=${Date.now()}`}>
              Play again
            </Link>
            <Link
              className="secondary-button settings-link"
              to={buildReviewAgainParams("/synonyms", searchParams, sessionRows, { prefix: "synonym-review" })}
            >
              Review again
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
        <ColorBadge colorValue={currentRow.Color} />
        <TimerStatus
          isFlipped={isAnswered}
          timerSeconds={isReviewAgain ? 0 : timerSeconds}
          timerRemaining={timerRemaining}
          wasAutoFlipped={wasAutoRevealed}
        />
        <div className="adverb-options">
          {options.map((optionWord) => {
            const optionDetail = findSynonymDetail(synonymDetails, optionWord);

            return (
              <button
                className={getOptionClass(optionWord, currentRow["Chinese Word"], selected, isAnswered)}
                aria-disabled={isAnswered}
                key={optionWord}
                onClick={() => answer(optionWord)}
                type="button"
              >
                <span className="adverb-option-word">{formatSynonymOption(optionWord)}</span>
                {isAnswered && <SynonymInfo detail={optionDetail} word={optionWord} />}
              </button>
            );
          })}
        </div>
        {isAnswered && (
          <div className={`adverb-feedback ${selected === currentRow["Chinese Word"] ? "correct" : "wrong"}`}>
            <strong>{selected === currentRow["Chinese Word"] ? "Correct" : "Wrong"}</strong>
            <div className="mandarin-answer">
              <span>Completed sentence</span>
              <div className="sentence-audio-row">
                <p>
                  <EmphasizedText
                    text={fillBlank(currentRow["Chinese Sentence"], currentRow["Chinese Word"])}
                    target={currentRow["Chinese Word"]}
                  />
                </p>
                <IconAudioButton
                  label="Read Chinese sentence"
                  onClick={() => speakText(fillBlank(currentRow["Chinese Sentence"], currentRow["Chinese Word"]), "zh-CN")}
                />
              </div>
            </div>
            <div className="sentence-actions two-actions">
              <button onClick={nextQuestion}>Next</button>
              <button className="secondary-action" onClick={skipQuestion}>Skip</button>
            </div>
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

  const correctWord = normalizeOptionWord(nextRow["Chinese Word"]);
  const distractors = ["Wrong Answer 1", "Wrong Answer 2", "Wrong Answer 3"]
    .map((key) => nextRow[key])
    .map(normalizeOptionWord)
    .filter((answer) => answer && answer !== correctWord);

  setCurrentRow(nextRow);
  setOptions(shuffleOptions([...new Set([correctWord, ...distractors])]));
}

function shuffleOptions(options) {
  const shuffledOptions = [...options];

  for (let index = shuffledOptions.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffledOptions[index], shuffledOptions[randomIndex]] = [shuffledOptions[randomIndex], shuffledOptions[index]];
  }

  return shuffledOptions;
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

function replaceRowColor(rows, rowNumber, colorValue) {
  return rows.map((row) => (row.__rowNumber === rowNumber ? { ...row, Color: colorValue } : row));
}

function EmphasizedText({ text, target }) {
  if (!target || !text.includes(target)) {
    return text;
  }

  const parts = text.split(target);
  return parts.map((part, index) => (
    <span key={`${part}-${index}`}>
      {part}
      {index < parts.length - 1 && <span className="sentence-emphasis">{target}</span>}
    </span>
  ));
}

function getOptionClass(option, correct, selected, isAnswered) {
  const classes = [];
  if (!isAnswered) {
    return classes.join(" ");
  }

  if (option === correct) {
    classes.push("correct-option");
  } else if (option === selected) {
    classes.push("wrong-option");
  }

  classes.push("revealed-option");
  return classes.join(" ");
}

function SynonymInfo({ detail, word }) {
  const pinyin = detail?.pinyin || "Pinyin not found";
  const meaning = detail?.meaning || "Meaning not found";
  const { definition, usage } = splitSynonymMeaning(meaning);

  return (
    <span className="synonym-info-wrap">
      <span className="synonym-info-button" aria-label={`Information for ${word}`} tabIndex={0}>
        i
      </span>
      <span className="synonym-tooltip" role="tooltip">
        <span>{word}</span>
        <strong>{pinyin}</strong>
        <span>{definition}</span>
        {usage && <span className="synonym-usage">{usage}</span>}
      </span>
    </span>
  );
}

function splitSynonymMeaning(meaning) {
  const usageStart = meaning.indexOf("(Usage:");
  if (usageStart < 0) {
    return { definition: meaning, usage: "" };
  }

  return {
    definition: meaning.slice(0, usageStart).trim(),
    usage: meaning.slice(usageStart).trim(),
  };
}

function findSynonymDetail(detailsByWord, word = "") {
  const normalizedWord = normalizeOptionWord(word);
  const exactDetail = detailsByWord[normalizedWord];
  if (exactDetail) {
    return exactDetail;
  }

  const alternatives = splitSynonymAlternatives(normalizedWord)
    .map((alternative) => ({
      word: alternative,
      detail: detailsByWord[alternative],
    }))
    .filter(({ detail }) => detail);

  if (!alternatives.length) {
    return undefined;
  }

  return {
    pinyin: alternatives.map(({ detail }) => detail.pinyin).filter(Boolean).join(" / "),
    meaning: alternatives
      .map(({ word: alternative, detail }) => `${alternative}: ${detail.meaning}`)
      .join(" | "),
  };
}

function normalizeOptionWord(word = "") {
  return String(word).trim();
}

function splitSynonymAlternatives(word = "") {
  return normalizeOptionWord(word)
    .split("/")
    .map((alternative) => alternative.trim())
    .filter(Boolean);
}

function formatSynonymOption(word = "") {
  const alternatives = splitSynonymAlternatives(word);
  if (alternatives.length <= 1) {
    return word;
  }

  return alternatives.map((alternative, index) => (
    <span className="synonym-alternative" key={`${alternative}-${index}`}>
      {alternative}
      {index < alternatives.length - 1 && <span className="synonym-slash">/</span>}
    </span>
  ));
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
