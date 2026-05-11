export function buildPracticeSession(rows, count, orderMode) {
  if (orderMode === "in-order") {
    return rows.slice(0, Math.min(count, rows.length));
  }

  if (orderMode === "weighted") {
    return buildWeightedSession(rows, count);
  }

  return shuffleRows(rows).slice(0, Math.min(count, rows.length));
}

export function normalizeOrderMode(orderMode) {
  return ["random", "weighted", "in-order"].includes(orderMode) ? orderMode : "random";
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
    const savedColor = progress[row.__rowNumber];
    if (savedColor === undefined) {
      return row;
    }

    return { ...row, Color: String(savedColor) };
  });
}

export function saveColorProgress(rowNumber, colorValue, storageKey) {
  if (!rowNumber) {
    return;
  }

  const progress = readColorProgress(storageKey);
  progress[rowNumber] = String(colorValue);

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(progress));
  } catch {
    // The game should continue normally if browser storage is unavailable.
  }
}

export function shuffleRows(rows) {
  return [...rows].sort(() => Math.random() - 0.5);
}

function buildWeightedSession(rows, count) {
  const availableRows = [...rows];
  const selectedRows = [];
  const targetCount = Math.min(count, availableRows.length);

  while (selectedRows.length < targetCount && availableRows.length) {
    const totalWeight = availableRows.reduce((sum, row) => sum + getSelectionWeight(row.Color), 0);
    let pick = Math.random() * totalWeight;
    let selectedIndex = 0;

    for (let index = 0; index < availableRows.length; index += 1) {
      pick -= getSelectionWeight(availableRows[index].Color);
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

function getSelectionWeight(colorValue) {
  const parsedColor = Number.parseInt(colorValue, 10);
  if (Number.isNaN(parsedColor)) {
    return 1;
  }

  return Math.max(1, parsedColor);
}

function readColorProgress(storageKey) {
  try {
    const savedProgress = window.localStorage.getItem(storageKey);
    return savedProgress ? JSON.parse(savedProgress) : {};
  } catch {
    return {};
  }
}
