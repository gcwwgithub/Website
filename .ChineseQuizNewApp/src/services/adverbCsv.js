const ADVERB_CSV_PATH = "data/mandarin_adverbs_grammar_game.csv";

export async function loadAdverbRows() {
  const response = await fetch(ADVERB_CSV_PATH);
  if (!response.ok) {
    throw new Error(`Could not load adverb CSV: ${response.status}`);
  }

  const csvText = await response.text();
  return parseCsv(csvText).filter((row) => row.type === "adverb" && row.item && row["example sentence 1"]);
}

function parseCsv(csvText) {
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

  return dataRows.map((dataRow) =>
    headers.reduce((word, header, index) => {
      word[header.trim()] = dataRow[index]?.trim() ?? "";
      return word;
    }, {})
  );
}
