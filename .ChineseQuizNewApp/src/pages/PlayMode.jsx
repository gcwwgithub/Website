import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { filterCsvRowsByBand, loadCsvWords } from "../services/csvWords.js";

export default function PlayMode() {
  const [selectedMode, setSelectedMode] = useState("");
  const [questionCount, setQuestionCount] = useState("20");
  const [hskBand, setHskBand] = useState("all");
  const [rangeStart, setRangeStart] = useState("1");
  const [rangeEnd, setRangeEnd] = useState("1");
  const [orderMode, setOrderMode] = useState("random");
  const [showPinyin, setShowPinyin] = useState(true);
  const [showChineseUsage, setShowChineseUsage] = useState(true);
  const [csvRows, setCsvRows] = useState([]);
  const [loadingCsv, setLoadingCsv] = useState(false);
  const [csvError, setCsvError] = useState("");
  const parsedQuestionCount = Number.parseInt(questionCount, 10);
  const safeQuestionCount = Math.max(1, Math.min(100, parsedQuestionCount || 20));
  const filteredRows = useMemo(() => filterCsvRowsByBand(csvRows, hskBand), [csvRows, hskBand]);
  const rangeMax = Math.max(1, filteredRows.length);
  const safeRangeStart = clampNumber(rangeStart, 1, rangeMax);
  const safeRangeEnd = clampNumber(rangeEnd, safeRangeStart, rangeMax);
  const quizOptions = `count=${safeQuestionCount}&band=${encodeURIComponent(
    hskBand
  )}&start=${safeRangeStart}&end=${safeRangeEnd}&order=${orderMode}&pinyin=${showPinyin ? "1" : "0"}&usage=${
    showChineseUsage ? "1" : "0"
  }`;

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
    setRangeStart("1");
    setRangeEnd(String(rangeMax));
  }, [rangeMax]);

  function handleQuestionCountChange(event) {
    setQuestionCount(event.target.value.replace(/\D/g, ""));
  }

  function handleRangeStartChange(event) {
    setRangeStart(event.target.value.replace(/\D/g, ""));
  }

  function handleRangeEndChange(event) {
    setRangeEnd(event.target.value.replace(/\D/g, ""));
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
          <Link className="play-button setup-start" to="/quiz?mode=english-to-chinese">
            Start
          </Link>
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
            <label className="question-count">
              HSK band
              <select value={hskBand} onChange={(event) => setHskBand(event.target.value)}>
                <option value="all">All bands</option>
                <option value="Band1">Band 1</option>
                <option value="Band2">Band 2</option>
                <option value="Band3">Band 3</option>
                <option value="Band4">Band 4</option>
                <option value="Band5">Band 5</option>
                <option value="Band6">Band 6</option>
                <option value="Band7">Band 7</option>
                <option value="Unknown">Unknown</option>
              </select>
            </label>
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

function clampNumber(value, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!parsed) {
    return min;
  }
  return Math.max(min, Math.min(max, parsed));
}
