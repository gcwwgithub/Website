import { Link } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { filterCsvRows, getCsvFilterValues, loadCsvWords, loadEnglishToChineseRows } from "../services/csvWords.js";
import {
  formatFilterValuesParam,
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
  const [filterType, setFilterType] = useState(savedSettings.filterType);
  const [filterValues, setFilterValues] = useState(savedSettings.filterValues);
  const [rangeStart, setRangeStart] = useState(savedSettings.rangeStart);
  const [rangeEnd, setRangeEnd] = useState(savedSettings.rangeEnd);
  const [orderMode, setOrderMode] = useState(savedSettings.orderMode);
  const [timerSeconds, setTimerSeconds] = useState(savedSettings.timerSeconds);
  const [showPinyin, setShowPinyin] = useState(savedSettings.showPinyin);
  const [showChineseUsage, setShowChineseUsage] = useState(savedSettings.showChineseUsage);
  const [showMeaningCount, setShowMeaningCount] = useState(savedSettings.showMeaningCount);
  const [englishQuestionCount, setEnglishQuestionCount] = useState(savedEnglishSettings.questionCount);
  const [englishFilterType, setEnglishFilterType] = useState(savedEnglishSettings.filterType);
  const [englishFilterValues, setEnglishFilterValues] = useState(savedEnglishSettings.filterValues);
  const [englishRangeStart, setEnglishRangeStart] = useState(savedEnglishSettings.rangeStart);
  const [englishRangeEnd, setEnglishRangeEnd] = useState(savedEnglishSettings.rangeEnd);
  const [englishOrderMode, setEnglishOrderMode] = useState(savedEnglishSettings.orderMode);
  const [englishTimerSeconds, setEnglishTimerSeconds] = useState(savedEnglishSettings.timerSeconds);
  const [showEnglishChineseSentence, setShowEnglishChineseSentence] = useState(savedEnglishSettings.showChineseSentence);
  const [practiceQuestionCount, setPracticeQuestionCount] = useState("20");
  const [englishRows, setEnglishRows] = useState([]);
  const [csvRows, setCsvRows] = useState([]);
  const [loadingCsv, setLoadingCsv] = useState(false);
  const [csvError, setCsvError] = useState("");
  const parsedQuestionCount = Number.parseInt(questionCount, 10);
  const safeQuestionCount = Math.max(1, Math.min(100, parsedQuestionCount || 20));
  const parsedEnglishQuestionCount = Number.parseInt(englishQuestionCount, 10);
  const safeEnglishQuestionCount = Math.max(1, Math.min(100, parsedEnglishQuestionCount || 20));
  const safeTimerSeconds = clampNumber(timerSeconds, 0, 600);
  const safeEnglishTimerSeconds = clampNumber(englishTimerSeconds, 0, 600);
  const safePracticeQuestionCount = clampNumber(practiceQuestionCount, 1, 100);
  const filteredRows = useMemo(() => filterCsvRows(csvRows, filterType, filterValues), [csvRows, filterType, filterValues]);
  const englishFilteredRows = useMemo(
    () => filterCsvRows(englishRows, englishFilterType, englishFilterValues),
    [englishRows, englishFilterType, englishFilterValues]
  );
  const filterValuesKey = `${filterType}:${formatFilterValuesParam(filterValues)}`;
  const englishFilterValuesKey = `${englishFilterType}:${formatFilterValuesParam(englishFilterValues)}`;
  const previousFilterValuesKey = useRef(filterValuesKey);
  const previousEnglishFilterValuesKey = useRef(englishFilterValuesKey);
  const availableFilterValues = useMemo(() => getCsvFilterValues(csvRows, filterType), [csvRows, filterType]);
  const availableEnglishFilterValues = useMemo(
    () => getCsvFilterValues(englishRows, englishFilterType),
    [englishRows, englishFilterType]
  );
  const englishRangeMax = Math.max(1, englishFilteredRows.length);
  const rangeMax = Math.max(1, filteredRows.length);
  const safeEnglishRangeStart = clampNumber(englishRangeStart, 1, englishRangeMax);
  const safeEnglishRangeEnd = clampNumber(englishRangeEnd || englishRangeMax, safeEnglishRangeStart, englishRangeMax);
  const safeRangeStart = clampNumber(rangeStart, 1, rangeMax);
  const safeRangeEnd = clampNumber(rangeEnd || rangeMax, safeRangeStart, rangeMax);
  const englishQuizOptions = `count=${safeEnglishQuestionCount}&filter=${englishFilterType}&values=${encodeURIComponent(
    formatFilterValuesParam(englishFilterValues)
  )}&start=${safeEnglishRangeStart}&end=${safeEnglishRangeEnd}&order=${englishOrderMode}&timer=${safeEnglishTimerSeconds}&sentence=${
    showEnglishChineseSentence ? "1" : "0"
  }`;
  const quizOptions = `count=${safeQuestionCount}&filter=${filterType}&values=${encodeURIComponent(
    formatFilterValuesParam(filterValues)
  )}&start=${safeRangeStart}&end=${safeRangeEnd}&order=${orderMode}&timer=${safeTimerSeconds}&pinyin=${showPinyin ? "1" : "0"}&usage=${
    showChineseUsage ? "1" : "0"
  }&meaningCount=${
    showMeaningCount ? "1" : "0"
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
    if (previousFilterValuesKey.current === filterValuesKey) {
      return;
    }

    previousFilterValuesKey.current = filterValuesKey;
    setRangeStart("1");
    setRangeEnd(String(rangeMax));
  }, [filterValuesKey, rangeMax]);

  useEffect(() => {
    if (previousEnglishFilterValuesKey.current === englishFilterValuesKey) {
      return;
    }

    previousEnglishFilterValuesKey.current = englishFilterValuesKey;
    setEnglishRangeStart("1");
    setEnglishRangeEnd(String(englishRangeMax));
  }, [englishFilterValuesKey, englishRangeMax]);

  useEffect(() => {
    saveChineseToEnglishSettings({
      questionCount,
      filterType,
      filterValues,
      rangeStart,
      rangeEnd,
      orderMode,
      timerSeconds,
      showPinyin,
      showChineseUsage,
      showMeaningCount,
    });
  }, [filterType, filterValues, orderMode, questionCount, rangeEnd, rangeStart, showChineseUsage, showMeaningCount, showPinyin, timerSeconds]);

  useEffect(() => {
    saveEnglishToChineseSettings({
      questionCount: englishQuestionCount,
      filterType: englishFilterType,
      filterValues: englishFilterValues,
      rangeStart: englishRangeStart,
      rangeEnd: englishRangeEnd,
      orderMode: englishOrderMode,
      timerSeconds: englishTimerSeconds,
      showChineseSentence: showEnglishChineseSentence,
    });
  }, [englishFilterType, englishFilterValues, englishOrderMode, englishQuestionCount, englishRangeEnd, englishRangeStart, englishTimerSeconds, showEnglishChineseSentence]);

  function handleQuestionCountChange(event) {
    setQuestionCount(event.target.value.replace(/\D/g, ""));
  }

  function handleEnglishQuestionCountChange(event) {
    setEnglishQuestionCount(event.target.value.replace(/\D/g, ""));
  }

  function handlePracticeQuestionCountChange(event) {
    setPracticeQuestionCount(event.target.value.replace(/\D/g, ""));
  }

  function handleTimerSecondsChange(event) {
    setTimerSeconds(event.target.value.replace(/\D/g, ""));
  }

  function handleEnglishTimerSecondsChange(event) {
    setEnglishTimerSeconds(event.target.value.replace(/\D/g, ""));
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

  function toggleFilterValue(value) {
    setFilterValues((currentValues) => toggleValue(currentValues, value, availableFilterValues));
  }

  function toggleEnglishFilterValue(value) {
    setEnglishFilterValues((currentValues) => toggleValue(currentValues, value, availableEnglishFilterValues));
  }

  function handleFilterTypeChange(event) {
    setFilterType(event.target.value);
    setFilterValues(["all"]);
  }

  function handleEnglishFilterTypeChange(event) {
    setEnglishFilterType(event.target.value);
    setEnglishFilterValues(["all"]);
  }

  function toggleValue(currentValues, value, availableValues = []) {
    if (value === "all") {
      return ["all"];
    }

    const activeValues = currentValues.includes("all") ? availableValues : currentValues;
    const nextValues = activeValues.includes(value)
      ? activeValues.filter((currentValue) => currentValue !== value)
      : [...activeValues, value];

    return nextValues;
  }

  function renderFilterOptions({ type, values, availableValues, onTypeChange, onToggle, onSetValues }) {
    const daoGroups = type === "dao" ? groupDaoValues(availableValues) : [];

    return (
      <>
        <label className="question-count">
          Filter by
          <select value={type} onChange={onTypeChange}>
            <option value="hsk">HSK</option>
            <option value="dao">Dao</option>
          </select>
        </label>
        {type === "dao" && daoGroups.length > 0 ? (
          <fieldset className="dao-group-options">
            <legend>Dao sets</legend>
            <div className="filter-bulk-actions">
              <button type="button" onClick={() => onSetValues(["all"])}>Select all</button>
              <button type="button" onClick={() => onSetValues([])}>Deselect all</button>
            </div>
            {daoGroups.map((group) => {
              const selectedCount = values.includes("all")
                ? group.values.length
                : group.values.filter((value) => values.includes(value)).length;
              const isSelected = selectedCount === group.values.length;

              return (
                <section className="dao-group-card" key={group.label}>
                  <label className="dao-group-select">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onSetValues(toggleDaoGroup(values, group.values, availableValues))}
                    />
                    <span>{group.label}</span>
                  </label>
                  <small>{selectedCount}/{group.values.length}</small>
                  <div className="dao-group-values">
                    {group.values.map((value) => (
                      <label key={value}>
                        <input
                          type="checkbox"
                          checked={values.includes("all") || values.includes(value)}
                          onChange={() => onToggle(value)}
                        />
                        {formatFilterLabel(value)}
                      </label>
                    ))}
                  </div>
                </section>
              );
            })}
          </fieldset>
        ) : (
          <fieldset className="band-options">
          <legend>{type === "dao" ? "Dao sets" : "HSK bands"}</legend>
          <div className="filter-bulk-actions">
            <button type="button" onClick={() => onSetValues(["all"])}>Select all</button>
            <button type="button" onClick={() => onSetValues([])}>Deselect all</button>
          </div>
          {availableValues.map((value) => (
            <label key={value}>
              <input type="checkbox" checked={values.includes("all") || values.includes(value)} onChange={() => onToggle(value)} />
              {formatFilterLabel(value)}
            </label>
          ))}
          </fieldset>
        )}
      </>
    );
  }

  function formatFilterLabel(value) {
    return /^Band/i.test(value) ? value.replace("Band", "Band ") : value;
  }

  function renderRangeOptions({ start, end, onStartChange, onEndChange }) {
    return (
      <div className="range-grid">
        <label>
          Question range start
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={start}
            onChange={onStartChange}
          />
        </label>
        <label>
          Question range end
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={end}
            onChange={onEndChange}
          />
        </label>
      </div>
    );
  }

  return (
    <main className="page home-page">
      <section className="hero-panel mode-panel">
        <h2 className="mode-title">Choose mode</h2>
        <div className="mode-grid">
          <button
            className={`mode-button ${selectedMode === "english-to-chinese" ? "selected" : ""}`}
            onClick={() => setSelectedMode("english-to-chinese")}
            aria-label="English to Chinese"
          >
            <img src="data/en.png" alt="" aria-hidden="true" />
          </button>
          <button
            className={`mode-button ${selectedMode === "chinese-to-english" ? "selected" : ""}`}
            onClick={() => setSelectedMode("chinese-to-english")}
            aria-label="Chinese to English"
          >
            <img src="data/cn.png" alt="" aria-hidden="true" />
          </button>
          <button
            className={`mode-button ${selectedMode === "adverb-game" ? "selected" : ""}`}
            onClick={() => setSelectedMode("adverb-game")}
            aria-label="Adverb Game"
          >
            <img src="data/adverb.png" alt="" aria-hidden="true" />
          </button>
          <button
            className={`mode-button ${selectedMode === "synonym-selection" ? "selected" : ""}`}
            onClick={() => setSelectedMode("synonym-selection")}
            aria-label="Chinese Synonym Selection"
          >
            <img src="data/synonym.png" alt="" aria-hidden="true" />
          </button>
          <button
            className={`mode-button ${selectedMode === "sentence-builder" ? "selected" : ""}`}
            onClick={() => setSelectedMode("sentence-builder")}
            aria-label="Sentence Builder"
          >
            <img src="data/sentence.png" alt="" aria-hidden="true" />
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
            {renderFilterOptions({
              type: englishFilterType,
              values: englishFilterValues,
              availableValues: availableEnglishFilterValues,
              onTypeChange: handleEnglishFilterTypeChange,
              onToggle: toggleEnglishFilterValue,
              onSetValues: setEnglishFilterValues,
            })}
            {renderRangeOptions({
              start: englishRangeStart,
              end: englishRangeEnd,
              onStartChange: handleEnglishRangeStartChange,
              onEndChange: handleEnglishRangeEndChange,
            })}
            <label className="question-count">
              Question order
              <select value={englishOrderMode} onChange={(event) => setEnglishOrderMode(event.target.value)}>
                <option value="random">Random</option>
                <option value="weighted">Weighted random</option>
                <option value="in-order">In order</option>
              </select>
            </label>
            <label className="question-count">
              Auto-flip timer
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={englishTimerSeconds}
                onChange={handleEnglishTimerSecondsChange}
                placeholder="0"
              />
              <span className="field-hint">Seconds. Use 0 to turn off.</span>
            </label>
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
            {renderFilterOptions({
              type: filterType,
              values: filterValues,
              availableValues: availableFilterValues,
              onTypeChange: handleFilterTypeChange,
              onToggle: toggleFilterValue,
              onSetValues: setFilterValues,
            })}
            {renderRangeOptions({
              start: rangeStart,
              end: rangeEnd,
              onStartChange: handleRangeStartChange,
              onEndChange: handleRangeEndChange,
            })}
            <label className="question-count">
              Question order
              <select value={orderMode} onChange={(event) => setOrderMode(event.target.value)}>
                <option value="random">Random</option>
                <option value="weighted">Weighted random</option>
                <option value="in-order">In order</option>
              </select>
            </label>
            <label className="question-count">
              Auto-flip timer
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={timerSeconds}
                onChange={handleTimerSecondsChange}
                placeholder="0"
              />
              <span className="field-hint">Seconds. Use 0 to turn off.</span>
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
              <label>
                <input
                  type="checkbox"
                  checked={showMeaningCount}
                  onChange={(event) => setShowMeaningCount(event.target.checked)}
                />
                Show meaning count
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
          <PracticeModeStart count={practiceQuestionCount} onCountChange={handlePracticeQuestionCountChange} to={`/adverbs?count=${safePracticeQuestionCount}`} />
        )}
        {selectedMode === "synonym-selection" && (
          <PracticeModeStart count={practiceQuestionCount} onCountChange={handlePracticeQuestionCountChange} to={`/synonyms?count=${safePracticeQuestionCount}`} />
        )}
        {selectedMode === "sentence-builder" && (
          <PracticeModeStart count={practiceQuestionCount} onCountChange={handlePracticeQuestionCountChange} to={`/sentence-builder?count=${safePracticeQuestionCount}`} />
        )}
      </section>
    </main>
  );
}

function PracticeModeStart({ count, onCountChange, to }) {
  return (
    <div className="setup-options">
      <label className="question-count">
        Number of questions
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={count}
          onChange={onCountChange}
          placeholder="20"
        />
      </label>
      <Link className="play-button setup-start" to={to}>
        Start
      </Link>
    </div>
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

function groupDaoValues(values) {
  const groups = values.reduce((result, value) => {
    const match = String(value).match(/^(\d+)\./);
    const groupKey = match ? match[1] : "Other";
    if (!result.has(groupKey)) {
      result.set(groupKey, []);
    }
    result.get(groupKey).push(value);
    return result;
  }, new Map());

  return [...groups.entries()]
    .map(([key, groupValues]) => ({
      label: key === "Other" ? "Other" : `${key}.x`,
      sortValue: key === "Other" ? Number.MAX_SAFE_INTEGER : Number(key),
      values: groupValues,
    }))
    .sort((firstGroup, secondGroup) => firstGroup.sortValue - secondGroup.sortValue);
}

function toggleDaoGroup(currentValues, groupValues, availableValues = []) {
  const activeValues = currentValues.includes("all") ? availableValues : currentValues;
  const isWholeGroupSelected = groupValues.every((value) => activeValues.includes(value));

  if (isWholeGroupSelected) {
    const nextValues = activeValues.filter((value) => !groupValues.includes(value));
    return nextValues;
  }

  return [...new Set([...activeValues, ...groupValues])];
}
