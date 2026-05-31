import { Link } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { loadAdverbRows, loadSentenceRows, loadSynonymRows, loadTranslateRows } from "../services/adverbCsv.js";
import { filterCsvRowsBySelections, getCsvFilterValues, loadCsvWords, loadEnglishToChineseRows } from "../services/csvWords.js";
import { applyRemoteColorProgress, fetchRemoteColorProgress } from "../services/colorProgressTracking.js";
import {
  formatFilterValuesParam,
  readChineseToEnglishSettings,
  readEnglishToChineseSettings,
  saveChineseToEnglishSettings,
  saveEnglishToChineseSettings,
} from "../services/quizSettings.js";
import { getColorProgressId } from "../services/progressIdentity.js";
import { useSupabaseAuth } from "../services/supabaseAuth.js";

const CSV_COLOR_PROGRESS_KEY = "chineseQuizNew.csvColorProgress.v1";

export default function PlayMode() {
  const { user, loading: authLoading } = useSupabaseAuth();
  const savedSettings = useMemo(() => readChineseToEnglishSettings(), []);
  const savedEnglishSettings = useMemo(() => readEnglishToChineseSettings(), []);
  const [selectedMode, setSelectedMode] = useState("");
  const [questionCount, setQuestionCount] = useState(savedSettings.questionCount);
  const [hskValues, setHskValues] = useState(savedSettings.hskValues);
  const [daoValues, setDaoValues] = useState(savedSettings.daoValues);
  const [includeFlagged, setIncludeFlagged] = useState(savedSettings.includeFlagged);
  const [rangeStart, setRangeStart] = useState(savedSettings.rangeStart);
  const [rangeEnd, setRangeEnd] = useState(savedSettings.rangeEnd);
  const [orderMode, setOrderMode] = useState(savedSettings.orderMode);
  const [timerSeconds, setTimerSeconds] = useState(savedSettings.timerSeconds);
  const [showPinyin, setShowPinyin] = useState(savedSettings.showPinyin);
  const [showChineseUsage, setShowChineseUsage] = useState(savedSettings.showChineseUsage);
  const [showMeaningCount, setShowMeaningCount] = useState(savedSettings.showMeaningCount);
  const [englishQuestionCount, setEnglishQuestionCount] = useState(savedEnglishSettings.questionCount);
  const [englishHskValues, setEnglishHskValues] = useState(savedEnglishSettings.hskValues);
  const [englishDaoValues, setEnglishDaoValues] = useState(savedEnglishSettings.daoValues);
  const [englishRangeStart, setEnglishRangeStart] = useState(savedEnglishSettings.rangeStart);
  const [englishRangeEnd, setEnglishRangeEnd] = useState(savedEnglishSettings.rangeEnd);
  const [englishOrderMode, setEnglishOrderMode] = useState(savedEnglishSettings.orderMode);
  const [englishTimerSeconds, setEnglishTimerSeconds] = useState(savedEnglishSettings.timerSeconds);
  const [showEnglishChineseSentence, setShowEnglishChineseSentence] = useState(savedEnglishSettings.showChineseSentence);
  const [practiceQuestionCount, setPracticeQuestionCount] = useState("20");
  const [practiceRangeStart, setPracticeRangeStart] = useState("1");
  const [practiceRangeEnd, setPracticeRangeEnd] = useState("");
  const [practiceOrderMode, setPracticeOrderMode] = useState("random");
  const [practiceTimerSeconds, setPracticeTimerSeconds] = useState("0");
  const [showAdverbChineseSentence, setShowAdverbChineseSentence] = useState(false);
  const [practiceRows, setPracticeRows] = useState([]);
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
  const safePracticeTimerSeconds = clampNumber(practiceTimerSeconds, 0, 600);
  const practiceRangeMax = Math.max(1, practiceRows.length);
  const safePracticeRangeStart = clampNumber(practiceRangeStart, 1, practiceRangeMax);
  const safePracticeRangeEnd = clampNumber(practiceRangeEnd || practiceRangeMax, safePracticeRangeStart, practiceRangeMax);
  const filteredRows = useMemo(
    () => filterCsvRowsBySelections(csvRows, { hskValues, daoValues, includeFlagged }),
    [csvRows, daoValues, hskValues, includeFlagged]
  );
  const englishFilteredRows = useMemo(
    () => filterCsvRowsBySelections(englishRows, { hskValues: englishHskValues, daoValues: englishDaoValues }),
    [englishDaoValues, englishHskValues, englishRows]
  );
  const filterValuesKey = `${formatFilterValuesParam(hskValues)}:${formatFilterValuesParam(daoValues)}`;
  const englishFilterValuesKey = `${formatFilterValuesParam(englishHskValues)}:${formatFilterValuesParam(englishDaoValues)}`;
  const previousFilterValuesKey = useRef(filterValuesKey);
  const previousEnglishFilterValuesKey = useRef(englishFilterValuesKey);
  const availableHskValues = useMemo(() => getCsvFilterValues(csvRows, "hsk"), [csvRows]);
  const availableDaoValues = useMemo(() => getCsvFilterValues(csvRows, "dao"), [csvRows]);
  const availableEnglishHskValues = useMemo(() => getCsvFilterValues(englishRows, "hsk"), [englishRows]);
  const availableEnglishDaoValues = useMemo(() => getCsvFilterValues(englishRows, "dao"), [englishRows]);
  const englishRangeMax = Math.max(1, englishFilteredRows.length);
  const rangeMax = Math.max(1, filteredRows.length);
  const safeEnglishRangeStart = clampNumber(englishRangeStart, 1, englishRangeMax);
  const safeEnglishRangeEnd = clampNumber(englishRangeEnd || englishRangeMax, safeEnglishRangeStart, englishRangeMax);
  const safeRangeStart = clampNumber(rangeStart, 1, rangeMax);
  const safeRangeEnd = clampNumber(rangeEnd || rangeMax, safeRangeStart, rangeMax);
  const englishQuizOptions = `count=${safeEnglishQuestionCount}&hsk=${encodeURIComponent(
    formatFilterValuesParam(englishHskValues)
  )}&dao=${encodeURIComponent(
    formatFilterValuesParam(englishDaoValues)
  )}&start=${safeEnglishRangeStart}&end=${safeEnglishRangeEnd}&order=${englishOrderMode}&timer=${safeEnglishTimerSeconds}&sentence=${
    showEnglishChineseSentence ? "1" : "0"
  }`;
  const quizOptions = `count=${safeQuestionCount}&hsk=${encodeURIComponent(
    formatFilterValuesParam(hskValues)
  )}&dao=${encodeURIComponent(
    formatFilterValuesParam(daoValues)
  )}&flagged=${includeFlagged ? "1" : "0"}&start=${safeRangeStart}&end=${safeRangeEnd}&order=${orderMode}&timer=${safeTimerSeconds}&pinyin=${showPinyin ? "1" : "0"}&usage=${
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
    if (selectedMode !== "chinese-to-english" || csvRows.length || authLoading) {
      return;
    }

    async function loadSetupData() {
      setLoadingCsv(true);
      setCsvError("");
      try {
          const loadedRows = await loadCsvWords();
          const rowsWithProgress = user?.id
            ? applyRemoteColorProgress(
                loadedRows,
                await fetchRemoteColorProgress({ userId: user.id, storageKey: CSV_COLOR_PROGRESS_KEY })
              )
            : applySavedSetupColorProgress(loadedRows);
          setCsvRows(rowsWithProgress);
      } catch (error) {
        setCsvError(error.message);
      } finally {
        setLoadingCsv(false);
      }
    }

    loadSetupData();
  }, [authLoading, csvRows.length, selectedMode, user?.id]);

  useEffect(() => {
    const loadPracticeRows = getPracticeRowsLoader(selectedMode);
    if (!loadPracticeRows) {
      setPracticeRows([]);
      return;
    }

    let isActive = true;

    async function loadSetupData() {
      setLoadingCsv(true);
      setCsvError("");
      try {
        const rows = await loadPracticeRows();
        if (isActive) {
          setPracticeRows(rows);
        }
      } catch (error) {
        if (isActive) {
          setCsvError(error.message);
          setPracticeRows([]);
        }
      } finally {
        if (isActive) {
          setLoadingCsv(false);
        }
      }
    }

    loadSetupData();

    return () => {
      isActive = false;
    };
  }, [selectedMode]);

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
    if (practiceRangeMax > 1 && (!practiceRangeEnd || Number(practiceRangeEnd) > practiceRangeMax)) {
      setPracticeRangeEnd(String(practiceRangeMax));
    }
  }, [practiceRangeEnd, practiceRangeMax]);

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
      filterType: "hsk",
      filterValues: hskValues,
      hskValues,
      daoValues,
      includeFlagged,
      rangeStart,
      rangeEnd,
      orderMode,
      timerSeconds,
      showPinyin,
      showChineseUsage,
      showMeaningCount,
    });
  }, [daoValues, hskValues, includeFlagged, orderMode, questionCount, rangeEnd, rangeStart, showChineseUsage, showMeaningCount, showPinyin, timerSeconds]);

  useEffect(() => {
    saveEnglishToChineseSettings({
      questionCount: englishQuestionCount,
      filterType: "hsk",
      filterValues: englishHskValues,
      hskValues: englishHskValues,
      daoValues: englishDaoValues,
      rangeStart: englishRangeStart,
      rangeEnd: englishRangeEnd,
      orderMode: englishOrderMode,
      timerSeconds: englishTimerSeconds,
      showChineseSentence: showEnglishChineseSentence,
    });
  }, [englishDaoValues, englishHskValues, englishOrderMode, englishQuestionCount, englishRangeEnd, englishRangeStart, englishTimerSeconds, showEnglishChineseSentence]);

  function handleQuestionCountChange(event) {
    setQuestionCount(event.target.value.replace(/\D/g, ""));
  }

  function handleEnglishQuestionCountChange(event) {
    setEnglishQuestionCount(event.target.value.replace(/\D/g, ""));
  }

  function handlePracticeQuestionCountChange(event) {
    setPracticeQuestionCount(event.target.value.replace(/\D/g, ""));
  }

  function handlePracticeRangeStartChange(event) {
    setPracticeRangeStart(event.target.value.replace(/\D/g, ""));
  }

  function handlePracticeRangeEndChange(event) {
    setPracticeRangeEnd(event.target.value.replace(/\D/g, ""));
  }

  function handlePracticeTimerSecondsChange(event) {
    setPracticeTimerSeconds(event.target.value.replace(/\D/g, ""));
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
    setHskValues((currentValues) => toggleValue(currentValues, value, availableHskValues));
  }

  function toggleEnglishFilterValue(value) {
    setEnglishHskValues((currentValues) => toggleValue(currentValues, value, availableEnglishHskValues));
  }

  function toggleDaoFilterValue(value) {
    setDaoValues((currentValues) => toggleValue(currentValues, value, availableDaoValues));
  }

  function toggleEnglishDaoFilterValue(value) {
    setEnglishDaoValues((currentValues) => toggleValue(currentValues, value, availableEnglishDaoValues));
  }

  function toggleValue(currentValues, value, availableValues = []) {
    if (value === "all") {
      return ["all"];
    }

    if (currentValues.includes("all")) {
      return [value];
    }

    const activeValues = currentValues;
    const nextValues = activeValues.includes(value)
      ? activeValues.filter((currentValue) => currentValue !== value)
      : [...activeValues, value];

    return nextValues;
  }

  function renderCombinedFilterOptions({
    hskValues: currentHskValues,
    daoValues: currentDaoValues,
    availableHskValues: currentAvailableHskValues,
    availableDaoValues: currentAvailableDaoValues,
    onToggleHsk,
    onSetHskValues,
    onToggleDao,
    onSetDaoValues,
    includeFlagged: currentIncludeFlagged,
    onIncludeFlaggedChange,
    showFlaggedFilter = false,
  }) {
    const daoGroups = groupDaoValues(currentAvailableDaoValues);

    return (
      <>
        <fieldset className="band-options">
          <legend>HSK bands</legend>
          <div className="filter-bulk-actions">
            <button type="button" onClick={() => onSetHskValues(["all"])}>Select all</button>
            <button type="button" onClick={() => onSetHskValues([])}>Deselect all</button>
          </div>
          {currentAvailableHskValues.map((value) => (
            <label key={value}>
              <input type="checkbox" checked={currentHskValues.includes("all") || currentHskValues.includes(value)} onChange={() => onToggleHsk(value)} />
              {formatFilterLabel(value)}
            </label>
          ))}
        </fieldset>
        {daoGroups.length > 0 && (
          <fieldset className="dao-group-options">
            <legend>Dao sets</legend>
            <div className="filter-bulk-actions">
              <button type="button" onClick={() => onSetDaoValues(["all"])}>Select all</button>
              <button type="button" onClick={() => onSetDaoValues([])}>Deselect all</button>
            </div>
            {daoGroups.map((group) => {
              const selectedCount = currentDaoValues.includes("all")
                ? group.values.length
                : group.values.filter((value) => currentDaoValues.includes(value)).length;
              const isSelected = selectedCount === group.values.length;

              return (
                <section className="dao-group-card" key={group.label}>
                  <label className="dao-group-select">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onSetDaoValues(toggleDaoGroup(currentDaoValues, group.values, currentAvailableDaoValues))}
                    />
                    <span>{group.label}</span>
                  </label>
                  <small>{selectedCount}/{group.values.length}</small>
                  <div className="dao-group-values">
                    {group.values.map((value) => (
                      <label key={value}>
                        <input
                          type="checkbox"
                          checked={currentDaoValues.includes("all") || currentDaoValues.includes(value)}
                          onChange={() => onToggleDao(value)}
                        />
                        {formatFilterLabel(value)}
                      </label>
                    ))}
                  </div>
                </section>
              );
            })}
          </fieldset>
        )}
        {showFlaggedFilter && (
          <fieldset className="band-options">
            <legend>Flagged cards</legend>
            <label>
              <input
                type="checkbox"
                checked={currentIncludeFlagged}
                onChange={(event) => onIncludeFlaggedChange(event.target.checked)}
              />
              Include flagged cards
            </label>
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
      <div className="mode-page-actions">
        <Link className="secondary-button settings-link icon-only-button" to="/settings" aria-label="Settings">
          <img src="data/setting.svg" alt="" aria-hidden="true" />
        </Link>
      </div>
      <section className="hero-panel mode-panel">
        <h2 className="mode-title">Choose mode</h2>
        <div className="mode-grid">
          <button
            className={`mode-button ${selectedMode === "chinese-to-english" ? "selected" : ""}`}
            onClick={() => setSelectedMode("chinese-to-english")}
            aria-label="Chinese to English"
          >
            <img src="data/cn.png" alt="" aria-hidden="true" />
          </button>
          <button
            className={`mode-button ${selectedMode === "english-to-chinese" ? "selected" : ""}`}
            onClick={() => setSelectedMode("english-to-chinese")}
            aria-label="English to Chinese"
          >
            <img src="data/en.png" alt="" aria-hidden="true" />
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
          <button
            className={`mode-button ${selectedMode === "translate" ? "selected" : ""}`}
            onClick={() => setSelectedMode("translate")}
            aria-label="Translate"
          >
            <img src="data/translate.png" alt="" aria-hidden="true" />
          </button>
        </div>
        {selectedMode && loadingCsv && (
          <div className="setup-options">
            <div className="loading-panel embedded-loading">
              <p className="eyebrow">Loading mode</p>
              <div className="loading-track" aria-hidden="true">
                <span />
              </div>
            </div>
          </div>
        )}
        {!loadingCsv && selectedMode === "english-to-chinese" && (
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
            {renderCombinedFilterOptions({
              hskValues: englishHskValues,
              daoValues: englishDaoValues,
              availableHskValues: availableEnglishHskValues,
              availableDaoValues: availableEnglishDaoValues,
              onToggleHsk: toggleEnglishFilterValue,
              onSetHskValues: setEnglishHskValues,
              onToggleDao: toggleEnglishDaoFilterValue,
              onSetDaoValues: setEnglishDaoValues,
              includeFlagged: false,
              onIncludeFlaggedChange: () => {},
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
        {!loadingCsv && selectedMode === "chinese-to-english" && (
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
            {renderCombinedFilterOptions({
              hskValues,
              daoValues,
              availableHskValues,
              availableDaoValues,
              onToggleHsk: toggleFilterValue,
              onSetHskValues: setHskValues,
              onToggleDao: toggleDaoFilterValue,
              onSetDaoValues: setDaoValues,
              includeFlagged,
              onIncludeFlaggedChange: setIncludeFlagged,
              showFlaggedFilter: true,
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
                <option value="daily-review">Daily Review</option>
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
        {!loadingCsv && selectedMode === "adverb-game" && (
          <PracticeModeStart
            count={practiceQuestionCount}
            onCountChange={handlePracticeQuestionCountChange}
            orderMode={practiceOrderMode}
            onOrderModeChange={(event) => setPracticeOrderMode(event.target.value)}
            timerSeconds={practiceTimerSeconds}
            onTimerSecondsChange={handlePracticeTimerSecondsChange}
            rangeStart={practiceRangeStart}
            rangeEnd={practiceRangeEnd}
            rangeMax={practiceRangeMax}
            onRangeStartChange={handlePracticeRangeStartChange}
            onRangeEndChange={handlePracticeRangeEndChange}
            to={`/adverbs?count=${safePracticeQuestionCount}&order=${practiceOrderMode}&sentence=${
              showAdverbChineseSentence ? "1" : "0"
            }&timer=${safePracticeTimerSeconds}&start=${safePracticeRangeStart}&end=${safePracticeRangeEnd}`}
          >
            <div className="setup-checks">
              <label>
                <input
                  type="checkbox"
                  checked={showAdverbChineseSentence}
                  onChange={(event) => setShowAdverbChineseSentence(event.target.checked)}
                />
                Show Chinese sentence
              </label>
            </div>
          </PracticeModeStart>
        )}
        {!loadingCsv && selectedMode === "synonym-selection" && (
          <PracticeModeStart
            count={practiceQuestionCount}
            onCountChange={handlePracticeQuestionCountChange}
            orderMode={practiceOrderMode}
            onOrderModeChange={(event) => setPracticeOrderMode(event.target.value)}
            timerSeconds={practiceTimerSeconds}
            onTimerSecondsChange={handlePracticeTimerSecondsChange}
            rangeStart={practiceRangeStart}
            rangeEnd={practiceRangeEnd}
            rangeMax={practiceRangeMax}
            onRangeStartChange={handlePracticeRangeStartChange}
            onRangeEndChange={handlePracticeRangeEndChange}
            to={`/synonyms?count=${safePracticeQuestionCount}&order=${practiceOrderMode}&timer=${safePracticeTimerSeconds}&start=${safePracticeRangeStart}&end=${safePracticeRangeEnd}`}
          />
        )}
        {!loadingCsv && selectedMode === "sentence-builder" && (
          <PracticeModeStart
            count={practiceQuestionCount}
            onCountChange={handlePracticeQuestionCountChange}
            orderMode={practiceOrderMode}
            onOrderModeChange={(event) => setPracticeOrderMode(event.target.value)}
            timerSeconds={practiceTimerSeconds}
            onTimerSecondsChange={handlePracticeTimerSecondsChange}
            rangeStart={practiceRangeStart}
            rangeEnd={practiceRangeEnd}
            rangeMax={practiceRangeMax}
            onRangeStartChange={handlePracticeRangeStartChange}
            onRangeEndChange={handlePracticeRangeEndChange}
            to={`/sentence-builder?count=${safePracticeQuestionCount}&order=${practiceOrderMode}&timer=${safePracticeTimerSeconds}&start=${safePracticeRangeStart}&end=${safePracticeRangeEnd}`}
          />
        )}
        {!loadingCsv && selectedMode === "translate" && (
          <PracticeModeStart
            count={practiceQuestionCount}
            onCountChange={handlePracticeQuestionCountChange}
            orderMode={practiceOrderMode}
            onOrderModeChange={(event) => setPracticeOrderMode(event.target.value)}
            timerSeconds={practiceTimerSeconds}
            onTimerSecondsChange={handlePracticeTimerSecondsChange}
            rangeStart={practiceRangeStart}
            rangeEnd={practiceRangeEnd}
            rangeMax={practiceRangeMax}
            onRangeStartChange={handlePracticeRangeStartChange}
            onRangeEndChange={handlePracticeRangeEndChange}
            to={`/translate?count=${safePracticeQuestionCount}&order=${practiceOrderMode}&timer=${safePracticeTimerSeconds}&start=${safePracticeRangeStart}&end=${safePracticeRangeEnd}`}
          />
        )}
      </section>
    </main>
  );
}

function PracticeModeStart({
  children,
  count,
  onCountChange,
  orderMode,
  onOrderModeChange,
  rangeStart,
  rangeEnd,
  rangeMax,
  onRangeStartChange,
  onRangeEndChange,
  timerSeconds,
  onTimerSecondsChange,
  to,
}) {
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
      <div className="range-grid">
        <label>
          Question range start
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={rangeStart}
            onChange={onRangeStartChange}
            placeholder="1"
          />
        </label>
        <label>
          Question range end
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={rangeEnd}
            onChange={onRangeEndChange}
            placeholder={String(rangeMax)}
          />
        </label>
      </div>
      <p className="muted">Available range: 1 to {rangeMax}</p>
      <label className="question-count">
        Question order
        <select value={orderMode} onChange={onOrderModeChange}>
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
          onChange={onTimerSecondsChange}
          placeholder="0"
        />
        <span className="field-hint">Seconds. Use 0 to turn off.</span>
      </label>
      {children}
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

function getPracticeRowsLoader(mode) {
  if (mode === "adverb-game") {
    return loadAdverbRows;
  }
  if (mode === "synonym-selection") {
    return loadSynonymRows;
  }
  if (mode === "sentence-builder") {
    return loadSentenceRows;
  }
  if (mode === "translate") {
    return loadTranslateRows;
  }
  return null;
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
  if (currentValues.includes("all")) {
    return groupValues;
  }

  const activeValues = currentValues.includes("all") ? availableValues : currentValues;
  const isWholeGroupSelected = groupValues.every((value) => activeValues.includes(value));

  if (isWholeGroupSelected) {
    const nextValues = activeValues.filter((value) => !groupValues.includes(value));
    return nextValues;
  }

  return [...new Set([...activeValues, ...groupValues])];
}

function applySavedSetupColorProgress(rows) {
  const progress = readSetupColorProgress();

  return rows.map((row) => {
    const savedProgress = progress[getColorProgressId(row)];
    if (typeof savedProgress === "object" && savedProgress !== null) {
      return {
        ...row,
        __isFlagged: savedProgress.isFlagged === true,
      };
    }

    return { ...row, __isFlagged: false };
  });
}

function readSetupColorProgress() {
  try {
    const savedProgress = window.localStorage.getItem(CSV_COLOR_PROGRESS_KEY);
    return savedProgress ? JSON.parse(savedProgress) : {};
  } catch {
    return {};
  }
}
