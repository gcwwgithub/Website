const CHINESE_TO_ENGLISH_SETTINGS_KEY = "chineseQuizNew.chineseToEnglishSettings.v1";
const ENGLISH_TO_CHINESE_SETTINGS_KEY = "chineseQuizNew.englishToChineseSettings.v1";

export const HSK_BANDS = ["Band1", "Band2", "Band3", "Band4", "Band5", "Band6", "Band7", "Unknown"];

export const DEFAULT_CHINESE_TO_ENGLISH_SETTINGS = {
  questionCount: "20",
  hskBands: ["all"],
  rangeStart: "1",
  rangeEnd: "",
  orderMode: "random",
  showPinyin: true,
  showChineseUsage: true,
};

export const DEFAULT_ENGLISH_TO_CHINESE_SETTINGS = {
  questionCount: "20",
  rangeStart: "1",
  rangeEnd: "",
  showChineseSentence: true,
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

export function parseBandsParam(value) {
  if (!value || value === "all") {
    return ["all"];
  }

  const bands = value
    .split(",")
    .map((band) => band.trim())
    .filter((band) => HSK_BANDS.includes(band));

  return bands.length ? bands : ["all"];
}

export function formatBandsParam(bands) {
  const normalizedBands = normalizeBands(bands);
  return normalizedBands.includes("all") ? "all" : normalizedBands.join(",");
}

function normalizeSettings(settings = {}) {
  return {
    ...DEFAULT_CHINESE_TO_ENGLISH_SETTINGS,
    ...settings,
    hskBands: normalizeBands(settings.hskBands),
    orderMode: settings.orderMode === "weighted" ? "weighted" : "random",
    showPinyin: settings.showPinyin !== false,
    showChineseUsage: settings.showChineseUsage !== false,
  };
}

function normalizeEnglishSettings(settings = {}) {
  return {
    ...DEFAULT_ENGLISH_TO_CHINESE_SETTINGS,
    ...settings,
    showChineseSentence: settings.showChineseSentence !== false,
  };
}

function normalizeBands(bands) {
  if (!Array.isArray(bands) || bands.includes("all")) {
    return ["all"];
  }

  const normalizedBands = bands.filter((band) => HSK_BANDS.includes(band));
  return normalizedBands.length ? normalizedBands : ["all"];
}
