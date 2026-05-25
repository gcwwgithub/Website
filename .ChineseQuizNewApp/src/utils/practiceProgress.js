import { getColorProgressId } from "../services/progressIdentity.js";

export function buildPracticeSession(rows, count, orderMode, reviewSetKey = "") {
  if (orderMode === "in-order") {
    return rows.slice(0, Math.min(count, rows.length));
  }

  if (orderMode === "review-again") {
    return buildReviewAgainSession(rows, reviewSetKey);
  }

  if (orderMode === "weighted") {
    return buildWeightedSession(rows, count);
  }

  return shuffleRows(rows).slice(0, Math.min(count, rows.length));
}

export function normalizeOrderMode(orderMode) {
  return ["random", "weighted", "in-order", "review-again"].includes(orderMode) ? orderMode : "random";
}

export function updateColorValue(colorValue, wasCorrect) {
  const parsedColor = Number.parseInt(colorValue, 10);
  const currentColor = Number.isNaN(parsedColor) ? 1 : parsedColor;

  if (wasCorrect) {
    return String(Math.max(1, currentColor - 1));
  }

  return String(currentColor < 5 ? 7 : currentColor + 2);
}

export function applySavedColorProgress(rows, storageKey) {
  const progress = readColorProgress(storageKey);

  return rows.map((row) => {
    const savedColor = progress[getColorProgressId(row)];
    if (savedColor === undefined) {
      return { ...row, __hasSavedColorProgress: false };
    }

    return { ...row, Color: String(savedColor), __hasSavedColorProgress: true };
  });
}

export function saveColorProgress(row, colorValue, storageKey) {
  const progressId = getColorProgressId(row);
  if (!progressId) {
    return;
  }

  const progress = readColorProgress(storageKey);
  progress[progressId] = String(colorValue);

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(progress));
  } catch {
    // The game should continue normally if browser storage is unavailable.
  }
}

export function shuffleRows(rows) {
  return [...rows].sort(() => Math.random() - 0.5);
}

export function buildReviewAgainParams(basePath, searchParams, rows, options = {}) {
  const params = new URLSearchParams(searchParams);
  const reviewSetKey = saveReviewSet(rows, options.prefix || "review-again");
  params.set("order", "review-again");
  params.set("reviewSet", reviewSetKey);
  params.set("run", String(Date.now()));
  return `${basePath}?${params.toString()}`;
}

export function isReviewAgainMode(orderMode) {
  return orderMode === "review-again";
}

function buildReviewAgainSession(rows, reviewSetKey) {
  const reviewIds = readReviewSet(reviewSetKey);
  if (!reviewIds.length) {
    return [];
  }

  const rowsById = new Map(rows.map((row) => [getColorProgressId(row), row]));
  return reviewIds.map((progressId) => rowsById.get(progressId)).filter(Boolean);
}

function saveReviewSet(rows, prefix) {
  const reviewSetKey = `${prefix}-${Date.now()}`;
  const progressIds = rows.map(getColorProgressId).filter(Boolean);

  try {
    window.sessionStorage.setItem(reviewSetKey, JSON.stringify(progressIds));
  } catch {
    // Review-again is optional; the normal session should still finish.
  }

  return reviewSetKey;
}

function readReviewSet(reviewSetKey) {
  if (!reviewSetKey) {
    return [];
  }

  try {
    const savedSet = window.sessionStorage.getItem(reviewSetKey);
    const parsedSet = savedSet ? JSON.parse(savedSet) : [];
    return Array.isArray(parsedSet) ? parsedSet : [];
  } catch {
    return [];
  }
}

function buildWeightedSession(rows, count) {
  return takeWeightedRows(rows, count);
}

function takeWeightedRows(rows, count) {
  const availableRows = [...rows];
  const selectedRows = [];
  const targetCount = Math.min(count, rows.length);

  while (selectedRows.length < targetCount && availableRows.length) {
    const totalWeight = availableRows.reduce((sum, row) => sum + getWeightedSelectionWeight(row), 0);
    let pick = Math.random() * totalWeight;
    let selectedIndex = 0;

    for (let index = 0; index < availableRows.length; index += 1) {
      pick -= getWeightedSelectionWeight(availableRows[index]);
      if (pick <= 0) {
        selectedIndex = index;
        break;
      }
    }

    const [selectedRow] = availableRows.splice(selectedIndex, 1);
    selectedRows.push(selectedRow);
  }

  return selectedRows;
}

function isNewPracticeRow(row) {
  return !row?.__hasSavedColorProgress || row.Color === "" || row.Color == null;
}

function getWeightedSelectionWeight(row) {
  const colorWeight = getSelectionWeight(row.Color) * 1.25;
  const seenMultiplier = isNewPracticeRow(row) ? 0.5 : 1.5;

  return colorWeight * seenMultiplier;
}

function getSelectionWeight(colorValue) {
  const parsedColor = Number.parseInt(colorValue, 10);
  if (Number.isNaN(parsedColor)) {
    return 1;
  }

  const normalizedColor = Math.max(1, parsedColor);
  return normalizedColor ** 3;
}

function readColorProgress(storageKey) {
  try {
    const savedProgress = window.localStorage.getItem(storageKey);
    return savedProgress ? JSON.parse(savedProgress) : {};
  } catch {
    return {};
  }
}
