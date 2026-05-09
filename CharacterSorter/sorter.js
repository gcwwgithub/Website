const sampleCharacters = [
  { id: "aurora", name: "Aurora", attributes: ["Main Cast", "Playable Characters"] },
  { id: "blake", name: "Blake", attributes: ["Main Cast", "Playable Characters"] },
  { id: "ciel", name: "Ciel", attributes: ["Main Cast", "Playable Characters"] },
  { id: "dara", name: "Dara", attributes: ["Main Cast", "Playable Characters"] },
  { id: "elliot", name: "Elliot", attributes: ["Side Characters", "Notable NPCs"] },
  { id: "faye", name: "Faye", attributes: ["Side Characters", "Notable NPCs"] },
  { id: "gale", name: "Gale", attributes: ["Side Characters", "Notable NPCs"] },
  { id: "hana", name: "Hana", attributes: ["Side Characters", "Notable NPCs"] },
];

let characters = sampleCharacters;
let defaultLists = {};

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
const downloadTemplateButton = document.querySelector("#downloadTemplateButton");
const resultsList = document.querySelector("#resultsList");
const disableTies = document.querySelector("#disableTies");
const importFile = document.querySelector("#importFile");
const importStatus = document.querySelector("#importStatus");
const categoryOptions = document.querySelector("#categoryOptions");
const savedListSelect = document.querySelector("#savedListSelect");
const deleteSavedListButton = document.querySelector("#deleteSavedListButton");

let state = createEmptyState();

const SAVED_LISTS_KEY = "characterSorter.savedImports.v1";
const TEMPLATE_PATH = "data/Template.json";
const DEFAULT_LISTS = [
  { name: "Genshin Impact", path: "data/genshin-character-sorter-no-series-attr.json" },
  { name: "HSR", path: "data/hsr-character-sorter-no-series-attr.json" },
];

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
    maxComparisons: 1,
    comparisonsMade: 0,
    history: [],
    results: [],
  };
}

function startSorter() {
  const selectedAttributes = [...document.querySelectorAll("#categoryOptions input:checked")].map(
    (input) => input.value,
  );
  const selectedCharacters = dedupeCharacters(
    characters.filter((character) =>
      character.attributes.some((attribute) => selectedAttributes.includes(attribute)),
    ),
  );

  if (selectedCharacters.length < 2) {
    progressText.textContent = "Pick at least 2 characters";
    return;
  }

  state = createEmptyState();
  state.lists = shuffle(selectedCharacters).map((character) => [character]);
  state.maxComparisons = calculateMaxComparisons(state.lists);

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

  while (true) {
    if (state.lists.length === 0) {
      if (state.nextLists.length <= 1) {
        showResults(state.nextLists[0] || []);
        return;
      }

      state.lists = state.nextLists;
      state.nextLists = [];
      state.round += 1;
    }

    if (state.lists.length === 1) {
      state.nextLists.push(state.lists.shift());
      continue;
    }

    state.leftList = state.lists.shift();
    state.rightList = state.lists.shift();
    state.mergedList = [];
    state.leftIndex = 0;
    state.rightIndex = 0;
    renderPair();
    return;
  }
}

function renderPair() {
  const leftCharacter = state.leftList[state.leftIndex];
  const rightCharacter = state.rightList[state.rightIndex];
  leftChoice.innerHTML = renderCharacter(leftCharacter);
  rightChoice.innerHTML = renderCharacter(rightCharacter);
  attachImageFallback(leftChoice);
  attachImageFallback(rightChoice);
  updateProgress();
}

function renderCharacter(character) {
  const fallbackInitial = escapeHtml(character.name.slice(0, 1));
  const imageMarkup = character.image
    ? `
      <img class="avatar image-avatar" src="${escapeHtml(character.image)}" alt="">
      <span class="avatar fallback-avatar" hidden>${fallbackInitial}</span>
    `
    : `<span class="avatar">${fallbackInitial}</span>`;

  return `
    ${imageMarkup}
    <span class="character-name">${escapeHtml(character.name)}</span>
  `;
}

function attachImageFallback(container) {
  const image = container.querySelector(".image-avatar");
  const fallback = container.querySelector(".fallback-avatar");

  if (!image || !fallback) {
    return;
  }

  image.addEventListener("error", () => {
    image.hidden = true;
    fallback.hidden = false;
  });
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
  progressText.textContent = `Sorted in ${state.comparisonsMade} comparisons`;
  resultsList.innerHTML = results
    .map((character, index) => renderResultCharacter(character, index))
    .join("");
  resultsList.querySelectorAll(".result-row").forEach(attachImageFallback);
}

function renderResultCharacter(character, index) {
  const rank = index + 1;
  const fallbackInitial = escapeHtml(character.name.slice(0, 1));
  const imageMarkup = character.image
    ? `
      <img class="result-avatar image-avatar" src="${escapeHtml(character.image)}" alt="">
      <span class="result-avatar fallback-avatar" hidden>${fallbackInitial}</span>
    `
    : `<span class="result-avatar">${fallbackInitial}</span>`;

  return `
    <li class="result-row ${rank <= 5 ? "top-result" : ""}">
      <span class="rank-number">#${rank}</span>
      ${imageMarkup}
      <span class="result-name">${escapeHtml(character.name)}</span>
    </li>
  `;
}

function updateProgress() {
  const percentage = Math.min(99, Math.floor((state.comparisonsMade / state.maxComparisons) * 100));
  const comparisonLabel = disableTies.checked
    ? `${state.comparisonsMade} / ${state.maxComparisons} comparisons`
    : `${state.comparisonsMade} / up to ${state.maxComparisons} comparisons`;
  progressText.textContent = `${percentage}% sorted (${comparisonLabel})`;
}

function calculateMaxComparisons(lists) {
  let queue = lists.map((list) => list.length);
  let nextQueue = [];
  let comparisons = 0;

  while (queue.length > 1 || nextQueue.length > 1) {
    if (queue.length === 0) {
      queue = nextQueue;
      nextQueue = [];
    }

    if (queue.length === 1) {
      nextQueue.push(queue.shift());
      continue;
    }

    const leftLength = queue.shift();
    const rightLength = queue.shift();
    comparisons += leftLength + rightLength - 1;
    nextQueue.push(leftLength + rightLength);
  }

  return Math.max(1, comparisons);
}

function cloneLists(lists) {
  return lists.map((list) => [...list]);
}

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function renderCategories() {
  const attributeCounts = getAttributeCounts(characters);
  const attributes = Object.keys(attributeCounts).sort((left, right) => left.localeCompare(right));
  categoryOptions.innerHTML = [
    ...attributes.map(
      (attribute) => `
        <label>
          <input type="checkbox" value="${escapeHtml(attribute)}" checked>
          ${escapeHtml(attribute)} (${attributeCounts[attribute]})
        </label>
      `,
    ),
    attributes.length
      ? `
        <label>
          <input type="checkbox" id="selectAllAttributes" checked>
          Select All
        </label>
      `
      : "",
  ].join("");

  const selectAll = document.querySelector("#selectAllAttributes");
  if (selectAll) {
    selectAll.addEventListener("change", () => {
      document.querySelectorAll("#categoryOptions input:not(#selectAllAttributes)").forEach((input) => {
        input.checked = selectAll.checked;
      });
    });
  }
}

function getAttributeCounts(characterRows) {
  return characterRows.reduce((counts, character) => {
    character.attributes.forEach((attribute) => {
      counts[attribute] = (counts[attribute] || 0) + 1;
    });
    return counts;
  }, {});
}

function dedupeCharacters(characterRows) {
  const seen = new Set();
  return characterRows.filter((character) => {
    const key = character.id || slugify(character.name);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function syncSelectAllState() {
  const selectAll = document.querySelector("#selectAllAttributes");
  if (!selectAll) {
    return;
  }

  const boxes = [...document.querySelectorAll("#categoryOptions input:not(#selectAllAttributes)")];
  selectAll.checked = boxes.length > 0 && boxes.every((input) => input.checked);
}

categoryOptions.addEventListener("change", (event) => {
  if (event.target.id !== "selectAllAttributes") {
    syncSelectAllState();
  }
});

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
      importStatus.textContent = `Import failed: ${error.message}`;
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
  const { source, name } = parseListValue(listName);
  const sourceLists = source === "default" ? defaultLists : getSavedLists();
  const savedCharacters = sourceLists[name];

  if (!savedCharacters) {
    return;
  }

  characters = normalizeImportedRows(savedCharacters);
  renderCategories();
  importStatus.textContent = `Loaded ${source === "default" ? "default" : "saved"} list "${name}" with ${characters.length} characters.`;
  progressText.textContent = "0% sorted";
}

function deleteSavedList() {
  const { source, name } = parseListValue(savedListSelect.value);

  if (!name || source === "default") {
    return;
  }

  const savedLists = getSavedLists();
  delete savedLists[name];
  localStorage.setItem(SAVED_LISTS_KEY, JSON.stringify(savedLists));
  renderSavedListSelect();
  importStatus.textContent = `Deleted saved list "${name}".`;
}

function renderSavedListSelect(selectedName = "") {
  const defaultNames = Object.keys(defaultLists).sort((left, right) => left.localeCompare(right));
  const savedNames = Object.keys(getSavedLists()).sort((left, right) => left.localeCompare(right));
  const selectedValue = selectedName ? `saved:${selectedName}` : "";
  savedListSelect.innerHTML = [
    `<option value="">Choose saved list</option>`,
    ...defaultNames.map(
      (listName) =>
        `<option value="default:${escapeHtml(listName)}">Default - ${escapeHtml(listName)}</option>`,
    ),
    ...savedNames.map(
      (listName) =>
        `<option value="saved:${escapeHtml(listName)}" ${`saved:${listName}` === selectedValue ? "selected" : ""}>Saved - ${escapeHtml(listName)}</option>`,
    ),
  ].join("");
  deleteSavedListButton.disabled = !savedListSelect.value || savedListSelect.value.startsWith("default:");
}

function parseListValue(value) {
  const [source, ...nameParts] = String(value || "").split(":");
  const name = nameParts.join(":");
  return { source, name };
}

async function loadDefaultLists() {
  try {
    const lists = await Promise.all(
      DEFAULT_LISTS.map(async (list) => {
        const response = await fetch(list.path, { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`Default list "${list.name}" not found.`);
        }

        const rows = await response.json();
        if (!Array.isArray(rows)) {
          throw new Error(`Default list "${list.name}" must be a JSON array.`);
        }

        return [list.name, normalizeImportedRows(rows)];
      }),
    );
    defaultLists = Object.fromEntries(lists);

    const firstDefaultName = Object.keys(defaultLists)[0];
    if (firstDefaultName) {
      characters = defaultLists[firstDefaultName];
      importStatus.textContent = `Loaded default list "${firstDefaultName}".`;
    }
  } catch {
    defaultLists = { "Sample Characters": sampleCharacters };
    characters = sampleCharacters;
    importStatus.textContent = "Using sample characters. Import CSV or JSON to replace them.";
  }
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
      attributes: normalizeAttributes(row.attributes ?? row.attribute ?? row.category),
      image: normalizeImageUrl(String(row.image || row.imageUrl || "").trim()),
    }))
    .filter((character) => character.name);
}

function normalizeAttributes(value) {
  if (Array.isArray(value)) {
    const attributes = value.map((attribute) => String(attribute).trim()).filter(Boolean);
    return attributes.length ? attributes : ["Custom"];
  }

  const attributes = String(value || "Custom")
    .split(/[|;,]/)
    .map((attribute) => attribute.trim())
    .filter(Boolean);

  return attributes.length ? attributes : ["Custom"];
}

function normalizeImageUrl(imageUrl) {
  if (!imageUrl) {
    return "";
  }

  try {
    const url = new URL(imageUrl);

    if (url.hostname.endsWith("fandom.com")) {
      const fileFromQuery = url.searchParams.get("file");
      const fileFromPath = decodeURIComponent(url.pathname).match(/\/wiki\/File:(.+)$/i)?.[1];
      const fileName = fileFromQuery || fileFromPath;

      if (fileName) {
        return `${url.origin}/wiki/Special:Redirect/file/${encodeURIComponent(fileName)}`;
      }
    }
  } catch {
    return imageUrl;
  }

  return imageUrl;
}

function downloadRanking() {
  const csvRows = [
    ["rank", "name", "attributes"],
    ...state.results.map((character, index) => [
      String(index + 1),
      character.name,
      character.attributes.join("; "),
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

async function downloadTemplate() {
  try {
    await downloadFile(TEMPLATE_PATH, "Template.json");
    importStatus.textContent = "Template downloaded.";
  } catch {
    importStatus.textContent = "Template download failed.";
  }
}

async function downloadFile(path, fileName) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Download failed.");
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
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
downloadTemplateButton.addEventListener("click", downloadTemplate);
importFile.addEventListener("change", importCharacters);
savedListSelect.addEventListener("change", (event) => loadSavedList(event.target.value));
savedListSelect.addEventListener("change", () => {
  deleteSavedListButton.disabled = !savedListSelect.value || savedListSelect.value.startsWith("default:");
});
deleteSavedListButton.addEventListener("click", deleteSavedList);
undoButton.disabled = true;
deleteSavedListButton.disabled = true;

async function initializeLists() {
  await loadDefaultLists();
  renderSavedListSelect();
  renderCategories();
}

initializeLists();
