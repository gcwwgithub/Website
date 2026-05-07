import { Link } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { filterCsvRowsByBand, loadCsvWords, loadEnglishToChineseRows } from "../services/csvWords.js";
import {
  formatBandsParam,
  HSK_BANDS,
  readChineseToEnglishSettings,
  readEnglishToChineseSettings,
  saveChineseToEnglishSettings,
  saveEnglishToChineseSettings,
} from "../services/quizSettings.js";

export default function PlayMode() {
  const savedSettings = useMemo(() => readChineseToEnglishSettings(), []);
  const savedEnglishSettings = useMemo(() => readEnglishToChineseSettings(), []);
  const [selectedMode, setSelectedMode] = useState("");
  const [questionCount, setQuestionCount] = useState(savedSettings.questionCount);
  const [hskBands, setHskBands] = useState(savedSettings.hskBands);
  const [rangeStart, setRangeStart] = useState(savedSettings.rangeStart);
  const [rangeEnd, setRangeEnd] = useState(savedSettings.rangeEnd);
  const [orderMode, setOrderMode] = useState(savedSettings.orderMode);
  const [showPinyin, setShowPinyin] = useState(savedSettings.showPinyin);
  const [showChineseUsage, setShowChineseUsage] = useState(savedSettings.showChineseUsage);
  const [englishQuestionCount, setEnglishQuestionCount] = useState(savedEnglishSettings.questionCount);
  const [englishRangeStart, setEnglishRangeStart] = useState(savedEnglishSettings.rangeStart);
  const [englishRangeEnd, setEnglishRangeEnd] = useState(savedEnglishSettings.rangeEnd);
  const [showEnglishChineseSentence, setShowEnglishChineseSentence] = useState(savedEnglishSettings.showChineseSentence);
  const [englishRows, setEnglishRows] = useState([]);
  const [csvRows, setCsvRows] = useState([]);
  const [loadingCsv, setLoadingCsv] = useState(false);
  const [csvError, setCsvError] = useState("");
  const parsedQuestionCount = Number.parseInt(questionCount, 10);
  const safeQuestionCount = Math.max(1, Math.min(100, parsedQuestionCount || 20));
  const parsedEnglishQuestionCount = Number.parseInt(englishQuestionCount, 10);
  const safeEnglishQuestionCount = Math.max(1, Math.min(100, parsedEnglishQuestionCount || 20));
  const filteredRows = useMemo(() => filterCsvRowsByBand(csvRows, hskBands), [csvRows, hskBands]);
  const hskBandsKey = formatBandsParam(hskBands);
  const previousHskBandsKey = useRef(hskBandsKey);
  const englishRangeMax = Math.max(1, englishRows.length);
  const safeEnglishRangeStart = clampNumber(englishRangeStart, 1, englishRangeMax);
  const safeEnglishRangeEnd = clampNumber(englishRangeEnd || englishRangeMax, safeEnglishRangeStart, englishRangeMax);
  const rangeMax = Math.max(1, filteredRows.length);
  const safeRangeStart = clampNumber(rangeStart, 1, rangeMax);
  const safeRangeEnd = clampNumber(rangeEnd || rangeMax, safeRangeStart, rangeMax);
  const englishQuizOptions = `count=${safeEnglishQuestionCount}&start=${safeEnglishRangeStart}&end=${safeEnglishRangeEnd}&sentence=${
    showEnglishChineseSentence ? "1" : "0"
  }`;
  const quizOptions = `count=${safeQuestionCount}&band=${encodeURIComponent(
    hskBandsKey
  )}&start=${safeRangeStart}&end=${safeRangeEnd}&order=${orderMode}&pinyin=${showPinyin ? "1" : "0"}&usage=${
    showChineseUsage ? "1" : "0"
  }`;

  useEffect(() => {
    if (selectedMode !== "english-to-chinese" || englishRows.length) {
      return;
    }

    async function loadSetupData() {
      setLoadingCsv(true);
      setCsvError("");
      try {
        setEnglishRows(await loadEnglishToChineseRows());
      } catch (error) {
        setCsvError(error.message);
      } finally {
        setLoadingCsv(false);
      }
    }

    loadSetupData();
  }, [englishRows.length, selectedMode]);

  useEffect(() => {
    if (selectedMode !== "chinese-to-english" || csvRows.length) {
      return;
    }

    async function loadSetupData() {
      setLoadingCsv(true);
      setCsvError("");
      try {
        setCsvRows(await loadCsvWords());
      } catch (error) {
        setCsvError(error.message);
      } finally {
        setLoadingCsv(false);
      }
    }

    loadSetupData();
  }, [csvRows.length, selectedMode]);

  useEffect(() => {
    if (!englishRangeEnd && englishRangeMax > 1) {
      setEnglishRangeEnd(String(englishRangeMax));
    }
  }, [englishRangeEnd, englishRangeMax]);

  useEffect(() => {
    if (!rangeEnd && rangeMax > 1) {
      setRangeEnd(String(rangeMax));
    }
  }, [rangeEnd, rangeMax]);

  useEffect(() => {
    if (previousHskBandsKey.current === hskBandsKey) {
      return;
    }

    previousHskBandsKey.current = hskBandsKey;
    setRangeStart("1");
    setRangeEnd(String(rangeMax));
  }, [hskBandsKey, rangeMax]);

  useEffect(() => {
    saveChineseToEnglishSettings({
      questionCount,
      hskBands,
      rangeStart,
      rangeEnd,
      orderMode,
      showPinyin,
      showChineseUsage,
    });
  }, [hskBands, orderMode, questionCount, rangeEnd, rangeStart, showChineseUsage, showPinyin]);

  useEffect(() => {
    saveEnglishToChineseSettings({
      questionCount: englishQuestionCount,
      rangeStart: englishRangeStart,
      rangeEnd: englishRangeEnd,
      showChineseSentence: showEnglishChineseSentence,
    });
  }, [englishQuestionCount, englishRangeEnd, englishRangeStart, showEnglishChineseSentence]);

  function handleQuestionCountChange(event) {
    setQuestionCount(event.target.value.replace(/\D/g, ""));
  }

  function handleEnglishQuestionCountChange(event) {
    setEnglishQuestionCount(event.target.value.replace(/\D/g, ""));
  }

  function handleEnglishRangeStartChange(event) {
    setEnglishRangeStart(event.target.value.replace(/\D/g, ""));
  }

  function handleEnglishRangeEndChange(event) {
    setEnglishRangeEnd(event.target.value.replace(/\D/g, ""));
  }

  function handleRangeStartChange(event) {
    setRangeStart(event.target.value.replace(/\D/g, ""));
  }

  function handleRangeEndChange(event) {
    setRangeEnd(event.target.value.replace(/\D/g, ""));
  }

  function toggleHskBand(band) {
    setHskBands((currentBands) => {
      if (band === "all") {
        return ["all"];
      }

      const activeBands = currentBands.includes("all") ? [] : currentBands;
      const nextBands = activeBands.includes(band)
        ? activeBands.filter((currentBand) => currentBand !== band)
        : [...activeBands, band];

      return nextBands.length ? nextBands : ["all"];
    });
  }

  return (
    <main className="page home-page">
      <section className="hero-panel mode-panel">
        <p className="eyebrow">Choose mode</p>
        <h2>Play Chinese Quiz</h2>
        <div className="mode-grid">
          <button
            className={`mode-button ${selectedMode === "english-to-chinese" ? "selected" : ""}`}
            onClick={() => setSelectedMode("english-to-chinese")}
          >
            <span>English to Chinese</span>
            <small>See English, answer in Chinese.</small>
          </button>
          <button
            className={`mode-button ${selectedMode === "chinese-to-english" ? "selected" : ""}`}
            onClick={() => setSelectedMode("chinese-to-english")}
          >
            <span>Chinese to English</span>
            <small>See Chinese, answer in English or pinyin.</small>
          </button>
          <button
            className={`mode-button ${selectedMode === "adverb-game" ? "selected" : ""}`}
            onClick={() => setSelectedMode("adverb-game")}
          >
            <span>Adverb Game</span>
            <small>See an English sentence, choose the Mandarin adverb.</small>
          </button>
        </div>
        {selectedMode === "english-to-chinese" && (
          <div className="setup-options">
            <label className="question-count">
              Number of questions
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={englishQuestionCount}
                onChange={handleEnglishQuestionCountChange}
                placeholder="20"
              />
            </label>
            <RangeSelector
              max={englishRangeMax}
              start={safeEnglishRangeStart}
              end={safeEnglishRangeEnd}
              onStartChange={handleEnglishRangeStartChange}
              onEndChange={handleEnglishRangeEndChange}
            />
            <div className="setup-checks">
              <label>
                <input
                  type="checkbox"
                  checked={showEnglishChineseSentence}
                  onChange={(event) => setShowEnglishChineseSentence(event.target.checked)}
                />
                Show Chinese sentence
              </label>
            </div>
            <p className="muted">
              Available range: 1 to {englishRangeMax}
              {loadingCsv ? " loading..." : ""}
            </p>
            {csvError && <p className="error">{csvError}</p>}
            <Link className="play-button setup-start" to={`/quiz?mode=english-to-chinese&${englishQuizOptions}`}>
              Start
            </Link>
          </div>
        )}
        {selectedMode === "chinese-to-english" && (
          <div className="setup-options">
            <label className="question-count">
              Number of questions
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={questionCount}
                onChange={handleQuestionCountChange}
                placeholder="20"
              />
            </label>
            <fieldset className="band-options">
              <legend>HSK bands</legend>
              <label>
                <input
                  type="checkbox"
                  checked={hskBands.includes("all")}
                  onChange={() => toggleHskBand("all")}
                />
                All bands
              </label>
              {HSK_BANDS.map((band) => (
                <label key={band}>
                  <input
                    type="checkbox"
                    checked={hskBands.includes(band)}
                    onChange={() => toggleHskBand(band)}
                  />
                  {band.replace("Band", "Band ")}
                </label>
              ))}
            </fieldset>
            <div className="range-grid">
              <label>
                Question range start
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={rangeStart}
                  onChange={handleRangeStartChange}
                />
              </label>
              <label>
                Question range end
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={rangeEnd}
                  onChange={handleRangeEndChange}
                />
              </label>
            </div>
            <label className="question-count">
              Question order
              <select value={orderMode} onChange={(event) => setOrderMode(event.target.value)}>
                <option value="random">Random</option>
                <option value="weighted">Weighted by color</option>
              </select>
            </label>
            <div className="setup-checks">
              <label>
                <input
                  type="checkbox"
                  checked={showPinyin}
                  onChange={(event) => setShowPinyin(event.target.checked)}
                />
                Show pinyin
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={showChineseUsage}
                  onChange={(event) => setShowChineseUsage(event.target.checked)}
                />
                Show Chinese usage
              </label>
            </div>
            <p className="muted">
              Available range for this band: 1 to {rangeMax}
              {loadingCsv ? " loading..." : ""}
            </p>
            {csvError && <p className="error">{csvError}</p>}
            <Link className="play-button setup-start" to={`/quiz?mode=chinese-to-english&${quizOptions}`}>
              Start
            </Link>
          </div>
        )}
        {selectedMode === "adverb-game" && (
          <Link className="play-button setup-start" to="/adverbs">
            Start
          </Link>
        )}
      </section>
    </main>
  );
}

function RangeSelector({ max, start, end, onStartChange, onEndChange }) {
  return (
    <div className="range-selector">
      <div className="range-selector-header">
        <span>Question range</span>
        <strong>{start} - {end}</strong>
      </div>
      <div className="range-sliders">
        <input
          type="range"
          min="1"
          max={max}
          value={start}
          onChange={onStartChange}
          aria-label="Starting question"
        />
        <input
          type="range"
          min="1"
          max={max}
          value={end}
          onChange={onEndChange}
          aria-label="Ending question"
        />
      </div>
      <div className="range-grid">
        <label>
          Start
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={start}
            onChange={onStartChange}
          />
        </label>
        <label>
          End
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={end}
            onChange={onEndChange}
          />
        </label>
      </div>
    </div>
  );
}

function clampNumber(value, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!parsed) {
    return min;
  }
  return Math.max(min, Math.min(max, parsed));
}
