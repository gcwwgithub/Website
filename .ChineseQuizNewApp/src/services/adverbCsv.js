const ADVERB_CSV_PATH = "data/ADVERB.csv";
const SENTENCE_CSV_PATH = "data/SENTENCE.csv";
const SYNONYM_CSV_PATH = "data/SYNONYM.csv";
const SYNONYM_EN_CSV_PATH = "data/SYNONYM_EN.csv";
const TRANSLATE_CSV_PATH = "data/TRANSLATE.csv";
const REQUIRED_COLUMNS = ["item", "type", "category", "example sentence 1", "chinese sentence 1", "ID"];
const SYNONYM_REQUIRED_COLUMNS = ["Chinese Word", "Chinese Sentence", "Wrong Answer 1", "Wrong Answer 2", "Wrong Answer 3", "ID"];
const SYNONYM_DETAIL_REQUIRED_COLUMNS = ["_Chinese Word", "_Pinyin", "_English"];
const TRANSLATE_REQUIRED_COLUMNS = ["_English", "_Possible Translation 1", "ID"];

export async function loadAdverbRows() {
  const response = await fetch(ADVERB_CSV_PATH);
  if (!response.ok) {
    throw new Error(`Could not load adverb CSV: ${response.status}`);
  }

  const csvText = await response.text();
  return parseCsv(csvText, ["ID"]).filter(hasAdverbQuestion);
}

export async function loadGrammarRows() {
  const response = await fetch(ADVERB_CSV_PATH);
  if (!response.ok) {
    throw new Error(`Could not load grammar CSV: ${response.status}`);
  }

  const csvText = await response.text();
  return parseCsv(csvText).filter((row) => row.item && row["example sentence 1"] && row["chinese sentence 1"]);
}

export async function loadSynonymRows() {
  const response = await fetch(SYNONYM_CSV_PATH);
  if (!response.ok) {
    throw new Error(`Could not load synonym CSV: ${response.status}`);
  }

  const csvText = await response.text();
  return parseCsv(csvText, SYNONYM_REQUIRED_COLUMNS).filter((row) => row["Chinese Word"] && row["Chinese Sentence"]);
}

export async function loadSynonymDetails() {
  const response = await fetch(SYNONYM_EN_CSV_PATH);
  if (!response.ok) {
    throw new Error(`Could not load synonym detail CSV: ${response.status}`);
  }

  const csvText = await response.text();
  return parseCsv(csvText, SYNONYM_DETAIL_REQUIRED_COLUMNS).reduce((detailsByWord, row) => {
    detailsByWord[row["_Chinese Word"]] = {
      pinyin: row["_Pinyin"],
      meaning: row["_English"],
    };
    return detailsByWord;
  }, {});
}

export async function loadSentenceRows() {
  const response = await fetch(SENTENCE_CSV_PATH);
  if (!response.ok) {
    throw new Error(`Could not load sentence CSV: ${response.status}`);
  }

  const csvText = await response.text();
  const rows = parseCsvRows(csvText);
  const hasHeader = rows[0]?.some((column) => column.trim().toLowerCase() === "color");
  const headers = hasHeader ? rows[0].map((column) => column.trim()) : [];
  const dataRows = hasHeader ? rows.slice(1) : rows;

  return dataRows
    .map((columns, index) => {
      const colorIndex = headers.findIndex((header) => header.toLowerCase() === "color");
      const idIndex = headers.findIndex((header) => header.toLowerCase() === "id");
      const alternateIndexes = headers
        .map((header, headerIndex) => ({ header: header.toLowerCase(), headerIndex }))
        .filter(({ header }) => header.startsWith("alt") || header.startsWith("alternate accepted answer"))
        .map(({ headerIndex }) => headerIndex);
      const parts = columns
        .map((column, columnIndex) => ({ column: column.trim(), columnIndex }))
        .filter(({ column, columnIndex }) => {
          if (!column) {
            return false;
          }
          if (!hasHeader) {
            return true;
          }
          return columnIndex !== colorIndex && columnIndex !== idIndex && !alternateIndexes.includes(columnIndex);
        })
        .map(({ column }) => column);

      return {
        __rowNumber: index + (hasHeader ? 2 : 1),
        ID: idIndex >= 0 ? columns[idIndex]?.trim() || "" : "",
        Color: colorIndex >= 0 ? columns[colorIndex]?.trim() || "1" : "1",
        alternateAnswers: alternateIndexes
          .map((columnIndex) => columns[columnIndex]?.trim())
          .filter(isUsableAlternateAnswer),
        parts,
      };
    })
    .filter((row) => row.ID && row.parts.length > 1);
}

export async function loadTranslateRows() {
  const response = await fetch(TRANSLATE_CSV_PATH);
  if (!response.ok) {
    throw new Error(`Could not load translate CSV: ${response.status}`);
  }

  const csvText = await response.text();
  return parseCsv(csvText, TRANSLATE_REQUIRED_COLUMNS)
    .map((row) => {
      const acceptedAnswers = Object.entries(row)
        .filter(([key]) => key.startsWith("_Possible Translation"))
        .map(([, value]) => value.trim())
        .filter(isUsableAlternateAnswer);

      return {
        ...row,
        Color: row.Color || "1",
        acceptedAnswers,
      };
    })
    .filter((row) => row._English && row.acceptedAnswers.length);
}

function isUsableAlternateAnswer(answer = "") {
  if (!answer.trim()) {
    return false;
  }

  return answer.trim().toLowerCase().replace(/[^a-z]/g, "") !== "empty";
}

function parseCsv(csvText, requiredColumns = REQUIRED_COLUMNS) {
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
  const normalizedHeaders = headers.map((header) => header.trim());
  const missingColumns = requiredColumns.filter((column) => !normalizedHeaders.includes(column));

  if (missingColumns.length) {
    throw new Error(`Adverb CSV is missing required columns: ${missingColumns.join(", ")}`);
  }

  return dataRows.map((dataRow, dataRowIndex) =>
    normalizedHeaders.reduce((word, header, index) => {
      word[header] = dataRow[index]?.trim() ?? "";
      word.__rowNumber = dataRowIndex + 2;
      return word;
    }, {})
  );
}

function hasAdverbQuestion(row) {
  if (!row.ID) {
    return false;
  }

  const hasNewShape = row._Chinese && (row.English || row._English) && row._EN1 && row._CN1;
  const hasOldShape = row.type === "adverb" && row.item && row["example sentence 1"];
  return hasNewShape || hasOldShape;
}

function parseCsvRows(csvText) {
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

  return rows.filter((currentRow) => currentRow.some((value) => value.trim()));
}
