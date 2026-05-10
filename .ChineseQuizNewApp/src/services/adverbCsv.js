const ADVERB_CSV_PATH = "data/ADVERB.csv";
const SENTENCE_CSV_PATH = "data/SENTENCE.csv";
const SYNONYM_CSV_PATH = "data/SYNONYM.csv";
const REQUIRED_COLUMNS = ["item", "type", "category", "example sentence 1", "chinese sentence 1"];
const SYNONYM_REQUIRED_COLUMNS = ["Chinese Word", "Chinese Sentence", "Wrong Answer 1", "Wrong Answer 2", "Wrong Answer 3"];

export async function loadAdverbRows() {
  const response = await fetch(ADVERB_CSV_PATH);
  if (!response.ok) {
    throw new Error(`Could not load adverb CSV: ${response.status}`);
  }

  const csvText = await response.text();
  return parseCsv(csvText).filter((row) => row.type === "adverb" && row.item && row["example sentence 1"]);
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

export async function loadSentenceRows() {
  const response = await fetch(SENTENCE_CSV_PATH);
  if (!response.ok) {
    throw new Error(`Could not load sentence CSV: ${response.status}`);
  }

  const csvText = await response.text();
  return parseCsvRows(csvText)
    .map((columns, index) => ({
      __rowNumber: index + 1,
      parts: columns.map((column) => column.trim()).filter(Boolean),
    }))
    .filter((row) => row.parts.length > 1);
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
