import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import GameMenu from "../components/GameMenu.jsx";
import ColorBadge from "../components/ColorBadge.jsx";
import LoadingScreen from "../components/LoadingScreen.jsx";
import TimerStatus from "../components/TimerStatus.jsx";
import { loadAdverbRows } from "../services/adverbCsv.js";
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
  shuffleRows,
  updateColorValue,
} from "../utils/practiceProgress.js";

const ADVERB_COLOR_PROGRESS_KEY = "chineseQuizNew.adverbColorProgress.v1";

export default function AdverbGame() {
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useSupabaseAuth();
  const requestedCount = Math.max(1, Math.min(100, Number(searchParams.get("count")) || 20));
  const orderMode = normalizeOrderMode(searchParams.get("order"));
  const timerSeconds = Math.max(0, Math.min(600, Number(searchParams.get("timer")) || 0));
  const rangeStart = Math.max(1, Number(searchParams.get("start")) || 1);
  const rangeEnd = Math.max(rangeStart, Number(searchParams.get("end")) || Number.MAX_SAFE_INTEGER);
  const sessionRun = searchParams.get("run") || "";
  const reviewSetKey = searchParams.get("reviewSet") || "";
  const initialShowChineseSentence = searchParams.get("sentence") === "1";
  const [rows, setRows] = useState([]);
  const [sessionRows, setSessionRows] = useState([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [currentRow, setCurrentRow] = useState(null);
  const [options, setOptions] = useState([]);
  const [score, setScore] = useState({ correct: 0, wrong: 0 });
  const [selected, setSelected] = useState("");
  const [wasAutoRevealed, setWasAutoRevealed] = useState(false);
  const [timerRemaining, setTimerRemaining] = useState(timerSeconds);
  const [showChineseSentence, setShowChineseSentence] = useState(initialShowChineseSentence);
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
      storageKey: ADVERB_COLOR_PROGRESS_KEY,
      row,
      colorValue,
    }).catch((trackingError) => {
      console.warn("Could not save Supabase adverb progress.", trackingError);
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
        const baseRows = await loadAdverbRows();
        const loadedRows = user?.id
          ? applyRemoteColorProgress(
              baseRows,
              await fetchRemoteColorProgress({ userId: user.id, storageKey: ADVERB_COLOR_PROGRESS_KEY })
            )
          : applySavedColorProgress(baseRows, ADVERB_COLOR_PROGRESS_KEY);
        const rangedRows = applyRange(loadedRows, rangeStart, rangeEnd);
        const loadedSessionRows = buildPracticeSession(rangedRows, requestedCount, orderMode, reviewSetKey);
        setRows(loadedRows);
        setSessionRows(loadedSessionRows);
        setQuestionIndex(0);
        setScore({ correct: 0, wrong: 0 });
        setSelected("");
        setWasAutoRevealed(false);
        setTimerRemaining(timerSeconds);
        setMistakes([]);
        setSkippedRows([]);
        setQuestion(loadedSessionRows[0], loadedRows, setCurrentRow, setOptions);
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    }

    loadGame();
  }, [authLoading, orderMode, rangeEnd, rangeStart, requestedCount, reviewSetKey, sessionRun, timerSeconds, user?.id]);

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
      const wasCorrect = selected === currentRow.item;
      const nextColor = updateColorValue(currentRow.Color, wasCorrect);
      const answeredRow = { ...currentRow, Color: nextColor };
      if (!isReviewAgain) {
        saveColorProgress(currentRow, nextColor, ADVERB_COLOR_PROGRESS_KEY);
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

    advanceQuestion(nextRows, nextSessionRows);
  }

  function advanceQuestion(nextRows = rows, nextSessionRows = sessionRows) {
    setSelected("");
    setWasAutoRevealed(false);
    setTimerRemaining(timerSeconds);
    const nextIndex = questionIndex + 1;
    setQuestionIndex(nextIndex);
    setQuestion(nextSessionRows[nextIndex], nextRows, setCurrentRow, setOptions);
  }

  function skipQuestion() {
    if (currentRow) {
      setSkippedRows((current) => [...current, currentRow]);
    }
    advanceQuestion();
  }

  if (loading) {
    return <LoadingScreen label="Loading adverb game" />;
  }

  if (error) {
    return (
      <main className="page narrow-page">
        <section className="panel empty-state">
          <h2>Could not load adverb game</h2>
          <p className="error">{error}</p>
        </section>
      </main>
    );
  }

  if (isComplete) {
    return (
      <main className="page narrow-page">
        <GameMenu>
          <AdverbMenuOptions
            showChineseSentence={showChineseSentence}
            onShowChineseSentenceChange={setShowChineseSentence}
          />
        </GameMenu>
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
                  <strong>{mistake.item}</strong>
                  <span>{mistake.meaning}</span>
                  <span>{mistake.englishPrompt}</span>
                  <span>{mistake.chinesePrompt}</span>
                </article>
              ))}
            </section>
          )}
          {skippedRows.length > 0 && (
            <section className="wrong-list skipped-list">
              <h3>Skipped items</h3>
              {skippedRows.map((row, index) => (
                <article className="wrong-row" key={`${row.__rowNumber}-skipped-${index}`}>
                  <strong>{row.item}</strong>
                  <span>{row.meaning}</span>
                  <span>{row.englishPrompt}</span>
                  <span>{row.chinesePrompt}</span>
                </article>
              ))}
            </section>
          )}
          <div className="result-actions">
            <Link
              className="play-button"
              to={`/adverbs?count=${requestedCount}&order=${orderMode}&sentence=${
                showChineseSentence ? "1" : "0"
              }&timer=${timerSeconds}&run=${Date.now()}`}
            >
              Play again
            </Link>
            <Link
              className="secondary-button settings-link"
              to={buildReviewAgainParams("/adverbs", searchParams, sessionRows, { prefix: "adverb-review" })}
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

  if (!currentRow) {
    return (
      <main className="page narrow-page">
        <section className="panel empty-state">
          <h2>No adverb questions found</h2>
          <p>Add adverb rows to the grammar CSV to play this mode.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="page narrow-page">
      <GameMenu>
        <AdverbMenuOptions
          showChineseSentence={showChineseSentence}
          onShowChineseSentenceChange={setShowChineseSentence}
        />
      </GameMenu>
      <section className="quiz-card adverb-card">
        <div className="dictionary-card-top game-card-top">
          <p className="eyebrow">{questionIndex + 1} / {sessionRows.length}</p>
          <p className="question-id">{getQuestionId(currentRow)}</p>
          <p className="eyebrow game-name">Adverb Game</p>
        </div>
        <h2 className={getPromptSizeClass(currentRow.prompt)}>
          <span className="adverb-prompt-text">
            {currentRow.promptMode === "english" ? (
              <EmphasizedText text={currentRow.prompt} target={currentRow.highlight} />
            ) : (
              currentRow.prompt
            )}
          </span>
        </h2>
        {showChineseSentence && currentRow.promptMode === "english" && (
          <div className="adverb-translation-hint">
            <span>Chinese sentence</span>
            <p>
              <EmphasizedText text={blankChineseWord(currentRow.chinesePrompt, currentRow.item)} target="____" />
            </p>
          </div>
        )}
        <ColorBadge colorValue={currentRow.Color} />
        <TimerStatus
          isFlipped={isAnswered}
          timerSeconds={isReviewAgain ? 0 : timerSeconds}
          timerRemaining={timerRemaining}
          wasAutoFlipped={wasAutoRevealed}
        />
        <div className="adverb-options">
          {options.map((option) => {
            const optionDetail = findAdverbDetail(rows, option);

            return (
              <button
                className={getOptionClass(option, currentRow.item, selected, isAnswered)}
                aria-disabled={isAnswered}
                key={option}
                onClick={() => answer(option)}
                type="button"
              >
                <span>{option}</span>
                {isAnswered && <AdverbInfo detail={optionDetail} word={option} />}
              </button>
            );
          })}
        </div>
        {isAnswered && (
          <div className={`adverb-feedback ${selected === currentRow.item ? "correct" : "wrong"}`}>
            <strong>{selected === currentRow.item ? "Correct" : "Wrong"}</strong>
            <div className="answer-sentences">
              <div className="mandarin-answer">
                <span>English sentence</span>
                <p>
                  <EmphasizedText text={currentRow.englishPrompt} target={currentRow.highlight} />
                </p>
              </div>
              <div className="mandarin-answer">
                <span>Chinese sentence</span>
                <div className="sentence-audio-row">
                  <p>
                    <EmphasizedText text={currentRow.chinesePrompt} target={currentRow.item} />
                  </p>
                  <IconAudioButton
                    label="Read Chinese sentence"
                    onClick={() => speakText(currentRow.chinesePrompt, "zh-CN")}
                  />
                </div>
              </div>
            </div>
            {currentRow.category && <p>Category: {currentRow.category.replaceAll("_", " ")}</p>}
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

function setQuestion(sourceRow, allRows, setCurrentRow, setOptions) {
  if (!sourceRow || !allRows.length) {
    setCurrentRow(null);
    setOptions([]);
    return;
  }

  const example = pickExampleSentence(sourceRow);
  const promptMode = Math.random() < 0.5 ? "english" : "chinese";
  const item = getItem(sourceRow);
  const nextRow = {
    ...sourceRow,
    item,
    meaning: getMeaning(sourceRow),
    prompt: promptMode === "english" ? example.englishPrompt : blankChineseWord(example.chinesePrompt, item),
    promptMode,
    englishPrompt: example.englishPrompt,
    chinesePrompt: example.chinesePrompt,
    highlight: example.highlight,
    sentenceNumber: example.sentenceNumber,
    category: sourceRow.category || "",
  };
  const usedMeanings = new Set([normalizeMeaning(nextRow.meaning)]);
  const uniqueMeaningDistractors = shuffleRows(allRows)
    .filter((row) => getItem(row) && getItem(row) !== nextRow.item)
    .filter((row) => {
      const meaning = normalizeMeaning(getMeaning(row));
      if (meaning && usedMeanings.has(meaning)) {
        return false;
      }
      if (meaning) {
        usedMeanings.add(meaning);
      }
      return true;
    })
    .slice(0, 3);
  const fallbackDistractors = shuffleRows(allRows)
    .filter((row) => getItem(row) && getItem(row) !== nextRow.item)
    .filter((row) => !uniqueMeaningDistractors.some((distractor) => getItem(distractor) === getItem(row)))
    .slice(0, Math.max(0, 3 - uniqueMeaningDistractors.length));
  const distractors = [...uniqueMeaningDistractors, ...fallbackDistractors]
    .sort(() => Math.random() - 0.5)
    .slice(0, 3)
    .map((row) => getItem(row));

  setCurrentRow(nextRow);
  setOptions([nextRow.item, ...distractors].sort(() => Math.random() - 0.5));
}

function getPromptSizeClass(text = "") {
  if (text.length > 150) {
    return "tiny-prompt";
  }
  if (text.length > 100) {
    return "very-long-prompt";
  }
  if (text.length > 70) {
    return "long-prompt";
  }
  return "";
}

function pickExampleSentence(row) {
  const examples = [
    {
      sentenceNumber: 1,
      englishPrompt: row._EN1 || row["example sentence 1"],
      chinesePrompt: row._CN1 || row["chinese sentence 1"],
      targetEnglish: row["_EN1 Target"],
    },
    {
      sentenceNumber: 2,
      englishPrompt: row._EN2 || row["example sentence 2"],
      chinesePrompt: row._CN2 || row["chinese sentence 2"],
      targetEnglish: row["_EN2 Target"] || row["_EN2 Targe"],
    },
    {
      sentenceNumber: 3,
      englishPrompt: row._EN3 || row["example sentence 3"],
      chinesePrompt: row._CN3 || row["chinese sentence 3"],
      targetEnglish: row["_EN3 Target"],
    },
    {
      sentenceNumber: 4,
      englishPrompt: row._EN4 || row["example sentence 4"],
      chinesePrompt: row._CN4 || row["chinese sentence 4"],
      targetEnglish: row["_EN4 Target"],
    },
  ]
    .filter((example) => example.englishPrompt && example.chinesePrompt)
    .map((example) => ({
      ...example,
      highlight: example.targetEnglish || inferHighlight(getItem(row), example.englishPrompt),
    }));

  return examples[Math.floor(Math.random() * examples.length)] || {
    sentenceNumber: 1,
    englishPrompt: row._EN1 || row["example sentence 1"],
    chinesePrompt: row._CN1 || row["chinese sentence 1"],
    highlight: "",
  };
}

function getQuestionId(row) {
  const rowNumber = row.__rowNumber || "?";
  return row.sentenceNumber ? `${rowNumber}_${row.sentenceNumber}` : rowNumber;
}

function getItem(row) {
  return row._Chinese || row.item || "";
}

function getMeaning(row) {
  return row.English || row._English || row.english || row.Englsh || "";
}

function getPinyin(row) {
  return row._Pinyin || row.pinyin || row.Pinyin || row.PINYIN || "";
}

function normalizeMeaning(meaning) {
  return meaning.toLowerCase().replace(/\s+/g, " ").trim();
}

function blankChineseWord(sentence = "", item = "") {
  if (!sentence || !item) {
    return sentence;
  }

  return sentence.includes(item) ? sentence.replace(item, "____") : sentence;
}

function replaceRowColor(rows, rowNumber, colorValue) {
  return rows.map((row) => (row.__rowNumber === rowNumber ? { ...row, Color: colorValue } : row));
}

function applyRange(rows, start, end) {
  return rows.slice(start - 1, end);
}

function EmphasizedText({ text, target }) {
  if (!target || !text.toLowerCase().includes(target.toLowerCase())) {
    return text;
  }

  const startIndex = text.toLowerCase().indexOf(target.toLowerCase());
  const endIndex = startIndex + target.length;

  return (
    <>
      {text.slice(0, startIndex)}
      <span className="sentence-emphasis">{text.slice(startIndex, endIndex)}</span>
      {text.slice(endIndex)}
    </>
  );
}

function inferHighlight(item, sentence) {
  const highlightByItem = {
    才: ["Only after", "until", "Only when"],
    不由得: ["could not help"],
    说不定: ["Maybe", "Perhaps"],
    有点: ["a little", "a bit"],
    也只是: ["only"],
    那就是: ["problem is that", "suggestion is that", "reason is that"],
    突然出现了: ["suddenly appeared"],
    似乎: ["seems"],
    好像: ["looks as if", "seems like", "looks like"],
    看起来: ["looks"],
    试图: ["tried", "attempted"],
    想要: ["want", "wants"],
    总之: ["In short", "All in all", "In conclusion"],
    果然: ["As expected", "Sure enough"],
    只好: ["no choice but", "had to"],
    只能: ["can only"],
    一定: ["definitely", "must", "certain"],
    由于: ["Due to", "Because of"],
    因为: ["Because"],
    首先: ["First", "First of all"],
    最重要的是: ["Most importantly", "most important"],
    是否: ["whether"],
    大约: ["about"],
    尽情地: ["as much as they liked", "freely"],
    已经: ["already"],
    正在: ["currently", "now"],
    刚刚: ["just"],
    马上: ["right away", "soon", "immediately"],
    立刻: ["immediately"],
    曾经: ["once"],
    暂时: ["temporarily", "for now"],
    最近: ["Recently", "lately"],
    终于: ["finally"],
    一直: ["always", "kept", "have been"],
    经常: ["often"],
    常常: ["frequently", "often"],
    偶尔: ["occasionally", "sometimes"],
    很少: ["rarely", "seldom"],
    从不: ["never"],
    往往: ["often"],
    再三: ["repeatedly", "again and again"],
    大概: ["probably"],
    可能: ["may", "might"],
    也许: ["Maybe", "Perhaps"],
    未必: ["not necessarily", "may not"],
    居然: ["actually", "unexpectedly"],
    偏偏: ["Of all", "just had to"],
    幸好: ["Fortunately", "Luckily"],
    差点: ["almost", "nearly"],
    完全: ["completely"],
    相当: ["quite", "rather"],
    十分: ["very", "extremely"],
    极其: ["extremely"],
    格外: ["especially", "particularly"],
    颇: ["rather", "quite"],
    略微: ["slightly", "a little"],
    因此: ["therefore", "so"],
    所以: ["so"],
    于是: ["so"],
    因而: ["therefore", "as a result"],
    然而: ["however"],
    不过: ["but"],
    而且: ["also", "and"],
    再说: ["Besides", "Moreover"],
    同时: ["At the same time", "at the same time"],
  };

  const candidates = highlightByItem[item] || [];
  return candidates.find((candidate) => sentence.toLowerCase().includes(candidate.toLowerCase())) || "";
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

function findAdverbDetail(rows, word) {
  const row = rows.find((candidate) => getItem(candidate) === word);
  return {
    meaning: row ? getMeaning(row) : "",
    pinyin: row ? getPinyin(row) : "",
  };
}

function AdverbInfo({ detail, word }) {
  const pinyin = detail?.pinyin || "Pinyin not found";
  const meaning = detail?.meaning || "Meaning not found";

  return (
    <span className="synonym-info-wrap">
      <span className="synonym-info-button" aria-label={`Information for ${word}`} tabIndex={0}>
        i
      </span>
      <span className="synonym-tooltip" role="tooltip">
        <span>{word}</span>
        <strong>{pinyin}</strong>
        <span>{meaning}</span>
      </span>
    </span>
  );
}

function AdverbMenuOptions({ showChineseSentence, onShowChineseSentenceChange }) {
  return (
    <label>
      <input
        type="checkbox"
        checked={showChineseSentence}
        onChange={(event) => onShowChineseSentenceChange(event.target.checked)}
      />
      Show Chinese sentence
    </label>
  );
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
