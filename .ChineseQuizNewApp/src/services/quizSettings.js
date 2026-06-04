const CHINESE_TO_ENGLISH_SETTINGS_KEY = "chineseQuizNew.chineseToEnglishSettings.v1";
const ENGLISH_TO_CHINESE_SETTINGS_KEY = "chineseQuizNew.englishToChineseSettings.v1";
const PRACTICE_MODE_SETTINGS_PREFIX = "chineseQuizNew.practiceModeSettings";

export const HSK_BANDS = ["Band1", "Band2", "Band3", "Band4", "Band5", "Band6", "Band7", "Unknown"];

export const DEFAULT_CHINESE_TO_ENGLISH_SETTINGS = {
  questionCount: "20",
  filterType: "hsk",
  filterValues: ["all"],
  hskBands: ["all"],
  hskValues: ["all"],
  daoValues: ["all"],
  includeFlagged: false,
  rangeStart: "1",
  rangeEnd: "",
  orderMode: "weighted",
  timerSeconds: "0",
  showPinyin: true,
  showChineseUsage: true,
  showMeaningCount: true,
};

export const DEFAULT_ENGLISH_TO_CHINESE_SETTINGS = {
  questionCount: "20",
  filterType: "hsk",
  filterValues: ["all"],
  hskValues: ["all"],
  daoValues: ["all"],
  rangeStart: "1",
  rangeEnd: "",
  orderMode: "weighted",
  timerSeconds: "0",
  showChineseSentence: true,
};

export const DEFAULT_PRACTICE_MODE_SETTINGS = {
  questionCount: "20",
  rangeStart: "1",
  rangeEnd: "",
  orderMode: "weighted",
  timerSeconds: "0",
  showChineseSentence: false,
};

export function readChineseToEnglishSettings() {
  try {
    const savedSettings = window.localStorage.getItem(CHINESE_TO_ENGLISH_SETTINGS_KEY);
    if (!savedSettings) {
      return DEFAULT_CHINESE_TO_ENGLISH_SETTINGS;
    }

    return normalizeSettings(JSON.parse(savedSettings));
  } catch {
    return DEFAULT_CHINESE_TO_ENGLISH_SETTINGS;
  }
}

export function saveChineseToEnglishSettings(settings) {
  try {
    window.localStorage.setItem(
      CHINESE_TO_ENGLISH_SETTINGS_KEY,
      JSON.stringify(normalizeSettings(settings))
    );
  } catch {
    // The quiz still works if local storage is unavailable.
  }
}

export function readEnglishToChineseSettings() {
  try {
    const savedSettings = window.localStorage.getItem(ENGLISH_TO_CHINESE_SETTINGS_KEY);
    if (!savedSettings) {
      return DEFAULT_ENGLISH_TO_CHINESE_SETTINGS;
    }

    return normalizeEnglishSettings(JSON.parse(savedSettings));
  } catch {
    return DEFAULT_ENGLISH_TO_CHINESE_SETTINGS;
  }
}

export function saveEnglishToChineseSettings(settings) {
  try {
    window.localStorage.setItem(
      ENGLISH_TO_CHINESE_SETTINGS_KEY,
      JSON.stringify(normalizeEnglishSettings(settings))
    );
  } catch {
    // The quiz still works if local storage is unavailable.
  }
}

export function readPracticeModeSettings(mode) {
  try {
    const savedSettings = window.localStorage.getItem(getPracticeModeSettingsKey(mode));
    if (!savedSettings) {
      return DEFAULT_PRACTICE_MODE_SETTINGS;
    }

    return normalizePracticeModeSettings(JSON.parse(savedSettings));
  } catch {
    return DEFAULT_PRACTICE_MODE_SETTINGS;
  }
}

export function savePracticeModeSettings(mode, settings) {
  try {
    window.localStorage.setItem(
      getPracticeModeSettingsKey(mode),
      JSON.stringify(normalizePracticeModeSettings(settings))
    );
  } catch {
    // The quiz still works if local storage is unavailable.
  }
}

export function parseBandsParam(value) {
  return parseFilterValuesParam(value);
}

export function parseFilterValuesParam(value) {
  if (!value || value === "all") {
    return ["all"];
  }
  if (value === "none") {
    return [];
  }

  const values = value
    .split(",")
    .map((band) => band.trim())
    .filter(Boolean);

  return values;
}

export function formatBandsParam(bands) {
  return formatFilterValuesParam(bands);
}

export function formatFilterValuesParam(values) {
  const normalizedValues = normalizeFilterValues(values);
  if (!normalizedValues.length) {
    return "none";
  }
  return normalizedValues.includes("all") ? "all" : normalizedValues.join(",");
}

function normalizeSettings(settings = {}) {
  const legacyHskValues = settings.filterType === "dao" ? ["all"] : settings.filterValues || settings.hskBands;
  const legacyDaoValues = settings.filterType === "dao" ? settings.filterValues : ["all"];

  return {
    ...DEFAULT_CHINESE_TO_ENGLISH_SETTINGS,
    ...settings,
    filterType: normalizeFilterType(settings.filterType),
    filterValues: normalizeFilterValues(settings.filterValues || settings.hskBands),
    hskBands: normalizeFilterValues(settings.hskBands),
    hskValues: normalizeFilterValues(settings.hskValues || legacyHskValues),
    daoValues: normalizeFilterValues(settings.daoValues || legacyDaoValues),
    includeFlagged: settings.includeFlagged === true,
    orderMode: normalizeOrderMode(settings.orderMode),
    timerSeconds: normalizeTimerSeconds(settings.timerSeconds),
    showPinyin: settings.showPinyin !== false,
    showChineseUsage: settings.showChineseUsage !== false,
    showMeaningCount: settings.showMeaningCount !== false,
  };
}

function normalizeEnglishSettings(settings = {}) {
  const legacyHskValues = settings.filterType === "dao" ? ["all"] : settings.filterValues;
  const legacyDaoValues = settings.filterType === "dao" ? settings.filterValues : ["all"];

  return {
    ...DEFAULT_ENGLISH_TO_CHINESE_SETTINGS,
    ...settings,
    filterType: normalizeFilterType(settings.filterType),
    filterValues: normalizeFilterValues(settings.filterValues),
    hskValues: normalizeFilterValues(settings.hskValues || legacyHskValues),
    daoValues: normalizeFilterValues(settings.daoValues || legacyDaoValues),
    orderMode: normalizeEnglishOrderMode(settings.orderMode),
    timerSeconds: normalizeTimerSeconds(settings.timerSeconds),
    showChineseSentence: settings.showChineseSentence !== false,
  };
}

function normalizePracticeModeSettings(settings = {}) {
  return {
    ...DEFAULT_PRACTICE_MODE_SETTINGS,
    ...settings,
    orderMode: normalizePracticeOrderMode(settings.orderMode),
    timerSeconds: normalizeTimerSeconds(settings.timerSeconds),
    showChineseSentence: settings.showChineseSentence === true,
  };
}

function normalizeOrderMode(orderMode) {
  return ["weighted", "random", "in-order", "daily-review"].includes(orderMode) ? orderMode : "weighted";
}

function normalizeEnglishOrderMode(orderMode) {
  return ["weighted", "random", "in-order"].includes(orderMode) ? orderMode : "weighted";
}

function normalizePracticeOrderMode(orderMode) {
  return ["weighted", "random", "in-order"].includes(orderMode) ? orderMode : "weighted";
}

function normalizeTimerSeconds(timerSeconds) {
  const parsed = Number.parseInt(timerSeconds, 10);
  if (!parsed || parsed < 0) {
    return "0";
  }

  return String(Math.min(600, parsed));
}

function normalizeFilterType(filterType) {
  return filterType === "dao" ? "dao" : "hsk";
}

function normalizeFilterValues(values) {
  if (!Array.isArray(values) || values.includes("all")) {
    return ["all"];
  }

  return values.filter(Boolean);
}

function getPracticeModeSettingsKey(mode) {
  return `${PRACTICE_MODE_SETTINGS_PREFIX}.${mode || "default"}.v1`;
}
