const CSV_PATH = "data/CN.csv";
const ENGLISH_TO_CHINESE_CSV_PATH = "data/EN.csv";
const VOCAB_REQUIRED_COLUMNS = [
  "Chinese Words",
  "pinyin",
  "English Words",
  "Chinese Usage in a Sentence",
  "English Usage in a sentence",
  "Band 0 HSK",
  "Dao",
  "ID",
];
const ENGLISH_TO_CHINESE_PROMPT_REQUIRED_COLUMNS = ["Chinese Words", "pinyin", "English Words", "Chinese Sentence", "ID"];

export async function loadCsvWords() {
  return loadCsv(CSV_PATH, VOCAB_REQUIRED_COLUMNS);
}

export async function loadEnglishToChineseRows() {
  const [baseRows, promptRows] = await Promise.all([
    loadCsv(CSV_PATH, VOCAB_REQUIRED_COLUMNS),
    loadCsv(ENGLISH_TO_CHINESE_CSV_PATH, ENGLISH_TO_CHINESE_PROMPT_REQUIRED_COLUMNS),
  ]);
  const promptRowsById = groupRowsById(promptRows);

  return baseRows.map((row) => ({
    ...row,
    __englishToChinesePrompts: promptRowsById.get(row.ID) || [],
  }));
}

async function loadCsv(path, requiredColumns) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(path, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Could not load CSV: ${response.status}`);
    }

    const csvText = await response.text();
    return parseCsv(csvText, requiredColumns);
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("CSV loading timed out.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export function filterCsvRowsByBand(rows, selectedBands) {
  return filterCsvRows(rows, "hsk", selectedBands);
}

export function filterCsvRows(rows, filterType, selectedValues) {
  const values = Array.isArray(selectedValues) ? selectedValues : [selectedValues];
  if (values.includes("all")) {
    return rows;
  }
  const column = filterType === "dao" ? "Dao" : "Band 0 HSK";

  return rows.filter((row) =>
    (row[column] || "")
      .split(";")
      .map((value) => value.trim())
      .some((value) => values.includes(value))
  );
}

export function filterCsvRowsBySelections(rows, { hskValues = ["all"], daoValues = ["all"], includeFlagged = false } = {}) {
  const hasHskSelection = hasActiveFilterSelection(hskValues);
  const hasDaoSelection = hasActiveFilterSelection(daoValues);
  const hasFlaggedSelection = includeFlagged === true;

  if (!hasHskSelection && !hasDaoSelection && !hasFlaggedSelection) {
    return [];
  }

  return rows.filter((row) =>
    (hasHskSelection && rowMatchesFilterValues(row, "Band 0 HSK", hskValues)) ||
    (hasDaoSelection && rowMatchesFilterValues(row, "Dao", daoValues)) ||
    (hasFlaggedSelection && row.__isFlagged === true)
  );
}

export function getCsvFilterValues(rows, filterType) {
  const column = filterType === "dao" ? "Dao" : "Band 0 HSK";
  const values = rows.flatMap((row) =>
    (row[column] || "")
      .split(";")
      .map((value) => value.trim())
      .filter(Boolean)
  );

  return [...new Set(values)].sort(compareFilterValues);
}

function compareFilterValues(firstValue, secondValue) {
  const firstNumber = Number.parseFloat(firstValue.replace(/^Band/i, ""));
  const secondNumber = Number.parseFloat(secondValue.replace(/^Band/i, ""));

  if (!Number.isNaN(firstNumber) && !Number.isNaN(secondNumber)) {
    return firstNumber - secondNumber;
  }

  return firstValue.localeCompare(secondValue, undefined, { numeric: true });
}

function rowMatchesFilterValues(row, column, selectedValues) {
  const values = Array.isArray(selectedValues) ? selectedValues : [selectedValues];
  if (values.includes("all")) {
    return true;
  }

  return (row[column] || "")
    .split(";")
    .map((value) => value.trim())
    .some((value) => values.includes(value));
}

function hasActiveFilterSelection(selectedValues) {
  const values = Array.isArray(selectedValues) ? selectedValues : [selectedValues];
  return values.includes("all") || values.length > 0;
}

function parseCsv(csvText, requiredColumns) {
  const rows = [];
  let row = [];
  let cell = "";
  let insideQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const character = csvText[index];
    const nextCharacter = csvText[index + 1];

    if (character === '"' && insideQuotes && nextCharacter === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      insideQuotes = !insideQuotes;
    } else if (character === "," && !insideQuotes) {
      row.push(cell);
      cell = "";
    } else if ((character === "\n" || character === "\r") && !insideQuotes) {
      if (character === "\r" && nextCharacter === "\n") {
        index += 1;
      }
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  const [headers = [], ...dataRows] = rows.filter((currentRow) =>
    currentRow.some((value) => value.trim())
  );
  const normalizedHeaders = headers.map((header) => normalizeHeaderName(header.trim()));
  const missingColumns = requiredColumns.filter((column) => !normalizedHeaders.includes(column));

  if (missingColumns.length) {
    throw new Error(`CSV is missing required columns: ${missingColumns.join(", ")}`);
  }

  return dataRows
    .map((dataRow, dataRowIndex) =>
      normalizedHeaders.reduce((word, header, index) => {
        const normalizedHeader = normalizeHeaderName(header);
        if (normalizedHeader) {
          word[normalizedHeader] = dataRow[index]?.trim() ?? "";
        }
        word.__rowNumber = dataRowIndex + 2;
        return word;
      }, {})
    )
    .map(normalizeParsedWord)
    .filter((word) => requiredColumns.every((column) => word[column]));
}

function normalizeParsedWord(word) {
  return {
    Color: "5",
    Encountered: "0",
    "Lose Streak": "0",
    ...word,
  };
}

function normalizeHeaderName(header) {
  if (header === "_apinyin") {
    return "pinyin";
  }
  if (header === "_HSK") {
    return "Band 0 HSK";
  }
  if (header === "_Dao") {
    return "Dao";
  }
  if (header === "_Formal") {
    return "Formal";
  }

  return header;
}

function groupRowsById(rows) {
  return rows.reduce((rowsById, row) => {
    const id = row.ID;
    if (!id) {
      return rowsById;
    }

    const existingRows = rowsById.get(id) || [];
    existingRows.push(row);
    rowsById.set(id, existingRows);
    return rowsById;
  }, new Map());
}
