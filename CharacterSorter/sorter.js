const sampleCharacters = [
  { id: "aurora", name: "Aurora", category: "main" },
  { id: "blake", name: "Blake", category: "main" },
  { id: "ciel", name: "Ciel", category: "main" },
  { id: "dara", name: "Dara", category: "main" },
  { id: "elliot", name: "Elliot", category: "side" },
  { id: "faye", name: "Faye", category: "side" },
  { id: "gale", name: "Gale", category: "side" },
  { id: "hana", name: "Hana", category: "side" },
];

let characters = sampleCharacters;

const startPanel = document.querySelector("#startPanel");
const sortPanel = document.querySelector("#sortPanel");
const resultsPanel = document.querySelector("#resultsPanel");
const progressText = document.querySelector("#progressText");
const startButton = document.querySelector("#startButton");
const leftChoice = document.querySelector("#leftChoice");
const rightChoice = document.querySelector("#rightChoice");
const tieButton = document.querySelector("#tieButton");
const undoButton = document.querySelector("#undoButton");
const restartButton = document.querySelector("#restartButton");
const sortAgainButton = document.querySelector("#sortAgainButton");
const downloadButton = document.querySelector("#downloadButton");
const resultsList = document.querySelector("#resultsList");
const disableTies = document.querySelector("#disableTies");
const importFile = document.querySelector("#importFile");
const importStatus = document.querySelector("#importStatus");
const categoryOptions = document.querySelector("#categoryOptions");
const savedListSelect = document.querySelector("#savedListSelect");
const deleteSavedListButton = document.querySelector("#deleteSavedListButton");

let state = createEmptyState();

const SAVED_LISTS_KEY = "characterSorter.savedImports.v1";

function createEmptyState() {
  return {
    lists: [],
    nextLists: [],
    leftList: [],
    rightList: [],
    mergedList: [],
    leftIndex: 0,
    rightIndex: 0,
    round: 0,
    totalComparisonsEstimate: 1,
    comparisonsMade: 0,
    history: [],
    results: [],
  };
}

function startSorter() {
  const selectedCategories = [...document.querySelectorAll("#categoryOptions input:checked")].map(
    (input) => input.value,
  );
  const selectedCharacters = characters.filter((character) =>
    selectedCategories.includes(character.category),
  );

  if (selectedCharacters.length < 2) {
    progressText.textContent = "Pick at least 2 characters";
    return;
  }

  state = createEmptyState();
  state.lists = shuffle(selectedCharacters).map((character) => [character]);
  state.totalComparisonsEstimate = Math.max(1, Math.ceil(selectedCharacters.length * Math.log2(selectedCharacters.length)));

  startPanel.classList.add("hidden");
  resultsPanel.classList.add("hidden");
  sortPanel.classList.remove("hidden");
  tieButton.disabled = disableTies.checked;

  loadNextPair();
}

function loadNextPair() {
  if (state.leftIndex < state.leftList.length && state.rightIndex < state.rightList.length) {
    renderPair();
    return;
  }

  finishCurrentMerge();

  if (state.lists.length <= 1 && state.leftList.length === 0 && state.rightList.length === 0) {
    showResults(state.lists[0] || []);
    return;
  }

  if (state.lists.length === 0) {
    state.lists = state.nextLists;
    state.nextLists = [];
    state.round += 1;
  }

  if (state.lists.length === 1) {
    state.nextLists.push(state.lists.shift());
    loadNextPair();
    return;
  }

  state.leftList = state.lists.shift();
  state.rightList = state.lists.shift();
  state.mergedList = [];
  state.leftIndex = 0;
  state.rightIndex = 0;
  renderPair();
}

function renderPair() {
  const leftCharacter = state.leftList[state.leftIndex];
  const rightCharacter = state.rightList[state.rightIndex];
  leftChoice.innerHTML = renderCharacter(leftCharacter);
  rightChoice.innerHTML = renderCharacter(rightCharacter);
  updateProgress();
}

function renderCharacter(character) {
  const imageMarkup = character.image
    ? `<img class="avatar image-avatar" src="${escapeHtml(character.image)}" alt="">`
    : `<span class="avatar">${escapeHtml(character.name.slice(0, 1))}</span>`;

  return `
    ${imageMarkup}
    <span class="character-name">${escapeHtml(character.name)}</span>
  `;
}

function choose(winner) {
  saveHistory();
  const leftCharacter = state.leftList[state.leftIndex];
  const rightCharacter = state.rightList[state.rightIndex];

  if (winner === "left") {
    state.mergedList.push(leftCharacter);
    state.leftIndex += 1;
  }

  if (winner === "right") {
    state.mergedList.push(rightCharacter);
    state.rightIndex += 1;
  }

  if (winner === "tie") {
    state.mergedList.push(leftCharacter, rightCharacter);
    state.leftIndex += 1;
    state.rightIndex += 1;
  }

  state.comparisonsMade += 1;
  loadNextPair();
}

function finishCurrentMerge() {
  if (state.leftList.length === 0 && state.rightList.length === 0) {
    return;
  }

  const leftovers = [
    ...state.leftList.slice(state.leftIndex),
    ...state.rightList.slice(state.rightIndex),
  ];

  state.nextLists.push([...state.mergedList, ...leftovers]);
  state.leftList = [];
  state.rightList = [];
  state.mergedList = [];
  state.leftIndex = 0;
  state.rightIndex = 0;
}

function saveHistory() {
  state.history.push({
    lists: cloneLists(state.lists),
    nextLists: cloneLists(state.nextLists),
    leftList: [...state.leftList],
    rightList: [...state.rightList],
    mergedList: [...state.mergedList],
    leftIndex: state.leftIndex,
    rightIndex: state.rightIndex,
    round: state.round,
    comparisonsMade: state.comparisonsMade,
  });
  undoButton.disabled = false;
}

function undo() {
  const previous = state.history.pop();
  if (!previous) {
    return;
  }

  Object.assign(state, previous);
  undoButton.disabled = state.history.length === 0;
  renderPair();
}

function showResults(results) {
  state.results = results;
  sortPanel.classList.add("hidden");
  resultsPanel.classList.remove("hidden");
  progressText.textContent = "100% sorted";
  resultsList.innerHTML = results
    .map((character) => `<li>${escapeHtml(character.name)}</li>`)
    .join("");
}

function updateProgress() {
  const percentage = Math.min(
    99,
    Math.round((state.comparisonsMade / state.totalComparisonsEstimate) * 100),
  );
  progressText.textContent = `${percentage}% sorted`;
}

function cloneLists(lists) {
  return lists.map((list) => [...list]);
}

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function renderCategories() {
  const categories = [...new Set(characters.map((character) => character.category || "default"))];
  categoryOptions.innerHTML = categories
    .map(
      (category) => `
        <label>
          <input type="checkbox" value="${escapeHtml(category)}" checked>
          ${escapeHtml(toTitleCase(category))}
        </label>
      `,
    )
    .join("");
}

function importCharacters(event) {
  const file = event.target.files[0];

  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const importedCharacters = parseImportFile(file.name, String(reader.result || ""));

      if (importedCharacters.length < 2) {
        throw new Error("Import needs at least 2 characters.");
      }

      characters = importedCharacters;
      renderCategories();
      const savedName = saveImportedList(file.name, importedCharacters);
      renderSavedListSelect(savedName);
      importStatus.textContent = `Loaded and saved ${characters.length} characters from ${file.name}.`;
      progressText.textContent = "0% sorted";
    } catch (error) {
      importStatus.textContent = error.message;
    }
  });
  reader.readAsText(file);
}

function saveImportedList(fileName, importedCharacters) {
  const savedLists = getSavedLists();
  const baseName = fileName.replace(/\.[^.]+$/, "") || "Imported List";
  let savedName = baseName;

  if (savedLists[savedName]) {
    const timestamp = new Date().toISOString().slice(0, 19).replace("T", " ");
    savedName = `${baseName} (${timestamp})`;
  }

  savedLists[savedName] = importedCharacters;
  localStorage.setItem(SAVED_LISTS_KEY, JSON.stringify(savedLists));
  return savedName;
}

function loadSavedList(listName) {
  const savedLists = getSavedLists();
  const savedCharacters = savedLists[listName];

  if (!savedCharacters) {
    return;
  }

  characters = normalizeImportedRows(savedCharacters);
  renderCategories();
  importStatus.textContent = `Loaded saved list "${listName}" with ${characters.length} characters.`;
  progressText.textContent = "0% sorted";
}

function deleteSavedList() {
  const listName = savedListSelect.value;

  if (!listName) {
    return;
  }

  const savedLists = getSavedLists();
  delete savedLists[listName];
  localStorage.setItem(SAVED_LISTS_KEY, JSON.stringify(savedLists));
  renderSavedListSelect();
  importStatus.textContent = `Deleted saved list "${listName}".`;
}

function renderSavedListSelect(selectedName = "") {
  const listNames = Object.keys(getSavedLists()).sort((left, right) => left.localeCompare(right));
  savedListSelect.innerHTML = [
    `<option value="">Choose saved list</option>`,
    ...listNames.map(
      (listName) =>
        `<option value="${escapeHtml(listName)}" ${listName === selectedName ? "selected" : ""}>${escapeHtml(listName)}</option>`,
    ),
  ].join("");
}

function getSavedLists() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SAVED_LISTS_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function parseImportFile(fileName, text) {
  if (fileName.toLowerCase().endsWith(".json")) {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) {
      throw new Error("JSON import must be an array.");
    }
    return normalizeImportedRows(parsed);
  }

  return normalizeImportedRows(parseCsv(text));
}

function parseCsv(text) {
  const rows = text
    .trim()
    .split(/\r?\n/)
    .map((row) => splitCsvRow(row));
  const headers = rows.shift()?.map((header) => header.trim().toLowerCase()) || [];

  return rows.map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, row[index] || ""])),
  );
}

function splitCsvRow(row) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < row.length; index += 1) {
    const character = row[index];
    const nextCharacter = row[index + 1];

    if (character === '"' && nextCharacter === '"') {
      current += '"';
      index += 1;
    } else if (character === '"') {
      inQuotes = !inQuotes;
    } else if (character === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }

  values.push(current.trim());
  return values;
}

function normalizeImportedRows(rows) {
  return rows
    .map((row, index) => ({
      id: String(row.id || slugify(row.name || `character-${index + 1}`)),
      name: String(row.name || "").trim(),
      category: String(row.category || "custom").trim() || "custom",
      image: String(row.image || row.imageUrl || "").trim(),
    }))
    .filter((character) => character.name);
}

function downloadRanking() {
  const csvRows = [
    ["rank", "name", "category"],
    ...state.results.map((character, index) => [
      String(index + 1),
      character.name,
      character.category || "",
    ]),
  ];
  const csv = csvRows.map((row) => row.map(formatCsvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "character-ranking.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function formatCsvCell(value) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function toTitleCase(value) {
  return String(value)
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

startButton.addEventListener("click", startSorter);
leftChoice.addEventListener("click", () => choose("left"));
rightChoice.addEventListener("click", () => choose("right"));
tieButton.addEventListener("click", () => choose("tie"));
undoButton.addEventListener("click", undo);
restartButton.addEventListener("click", () => window.location.reload());
sortAgainButton.addEventListener("click", () => window.location.reload());
downloadButton.addEventListener("click", downloadRanking);
importFile.addEventListener("change", importCharacters);
savedListSelect.addEventListener("change", (event) => loadSavedList(event.target.value));
deleteSavedListButton.addEventListener("click", deleteSavedList);
undoButton.disabled = true;
renderSavedListSelect();
renderCategories();
