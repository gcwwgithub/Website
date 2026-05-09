const state = {
  title: "",
  rows: 5,
  columns: 6,
  rowLabels: ["", "", "", "", ""],
  columnLabels: ["", "", "", "", "", ""],
  cellLabels: {},
  cells: {},
  items: [],
  importedBatches: [],
  selectedItemId: null,
};

const gridTitle = document.querySelector("#gridTitle");
const gridBoard = document.querySelector("#gridBoard");
const itemList = document.querySelector("#itemList");
const itemSearch = document.querySelector("#itemSearch");
const itemForm = document.querySelector("#itemForm");
const itemName = document.querySelector("#itemName");
const itemImage = document.querySelector("#itemImage");
const rowCount = document.querySelector("#rowCount");
const columnCount = document.querySelector("#columnCount");
const resizeGridButton = document.querySelector("#resizeGridButton");
const exportButton = document.querySelector("#exportButton");
const downloadTemplateButton = document.querySelector("#downloadTemplateButton");
const itemImportInput = document.querySelector("#itemImportInput");
const gridImportInput = document.querySelector("#gridImportInput");
const itemImportStatus = document.querySelector("#itemImportStatus");
const gridFileStatus = document.querySelector("#gridFileStatus");
const importedBatchList = document.querySelector("#importedBatchList");
const tabButtons = document.querySelectorAll("[data-tab]");
const tabPanels = document.querySelectorAll("[data-panel]");
const TEMPLATE_PATH = "data/Template.json";

function render() {
  gridTitle.value = state.title;
  rowCount.value = state.rows;
  columnCount.value = state.columns;
  renderItems();
  renderImportedBatches();
  renderGrid();
}

function renderItems() {
  const query = itemSearch.value.trim().toLowerCase();
  const items = state.items.filter((item) => item.name.toLowerCase().includes(query));
  itemList.innerHTML = items.length
    ? items.map(renderItem).join("")
    : `<p class="empty-state">${query ? "No matching items" : "Import a CSV or add items manually"}</p>`;
}

function renderItem(item) {
  const selected = item.id === state.selectedItemId ? " selected" : "";
  return `
    <button class="item-card${selected}" type="button" draggable="true" data-item-id="${escapeHtml(item.id)}">
      <span class="item-thumb">${item.image ? `<img src="${escapeHtml(item.image)}" alt="">` : escapeHtml(item.name.slice(0, 1))}</span>
      <span class="item-name">${escapeHtml(item.name)}</span>
    </button>
  `;
}

function renderGrid() {
  gridBoard.style.setProperty("--columns", state.columns);
  gridBoard.innerHTML = "";

  for (let row = 0; row < state.rows; row++) {
    for (let column = 0; column < state.columns; column++) {
      gridBoard.appendChild(createGridCell(row, column));
    }
  }
}

function createGridCell(row, column) {
  const key = cellKey(row, column);
  const cell = createNode("div", "grid-cell");
  const drop = createNode("button", "cell-drop");
  drop.type = "button";
  drop.dataset.cell = key;
  drop.innerHTML = renderCellContent(key);
  drop.addEventListener("click", () => placeSelectedItem(key));
  drop.addEventListener("dragover", (event) => {
    event.preventDefault();
    drop.classList.add("drag-over");
  });
  drop.addEventListener("dragleave", () => drop.classList.remove("drag-over"));
  drop.addEventListener("drop", (event) => {
    event.preventDefault();
    drop.classList.remove("drag-over");
    const itemId = event.dataTransfer.getData("text/plain");
    placeItem(key, itemId);
  });

  const label = createNode("div", "cell-label");
  const input = document.createElement("textarea");
  input.value = state.cellLabels[key] || "";
  input.placeholder = "Click to Edit";
  input.rows = 2;
  input.addEventListener("input", () => {
    state.cellLabels[key] = input.value;
  });
  label.appendChild(input);
  cell.append(drop, label);
  return cell;
}

function renderCellContent(key) {
  const item = state.items.find((candidate) => candidate.id === state.cells[key]);
  if (!item) {
    return "Click to Add";
  }

  return `
    <span class="cell-item ${item.image ? "cell-image" : ""}">
      ${item.image ? `<img src="${escapeHtml(item.image)}" alt="">` : ""}
      <strong title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</strong>
    </span>
  `;
}

function placeSelectedItem(key) {
  if (!state.selectedItemId) {
    return;
  }
  placeItem(key, state.selectedItemId);
}

function placeItem(key, itemId) {
  if (!state.items.some((item) => item.id === itemId)) {
    return;
  }
  state.cells[key] = itemId;
  renderGrid();
}

function resizeGrid() {
  state.rows = clampNumber(rowCount.value, 1, 10, state.rows);
  state.columns = clampNumber(columnCount.value, 1, 10, state.columns);
  state.rowLabels.length = state.rows;
  state.columnLabels.length = state.columns;

  Object.keys(state.cells).forEach((key) => {
    const [row, column] = key.split(":").map(Number);
    if (row >= state.rows || column >= state.columns) {
      delete state.cells[key];
      delete state.cellLabels[key];
    }
  });
  renderGrid();
}

function addItem(event) {
  event.preventDefault();
  const name = itemName.value.trim();
  if (!name) return;
  state.items.push({
    id: makeUniqueItemId(`${slugify(name)}-${Date.now()}`),
    name,
    image: itemImage.value.trim(),
    batchId: "",
  });
  itemName.value = "";
  itemImage.value = "";
  renderItems();
}

function exportGrid() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${slugify(state.title) || "grid"}.json`;
  link.click();
  URL.revokeObjectURL(url);
  gridFileStatus.textContent = "Grid JSON exported.";
}

async function downloadTemplate() {
  try {
    await downloadFile(TEMPLATE_PATH, "Template.json");
    gridFileStatus.textContent = "Template downloaded.";
  } catch {
    gridFileStatus.textContent = "Template download failed.";
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

async function importItems(event) {
  const files = [...event.target.files];
  if (!files.length) return;

  let importedCount = 0;
  const failures = [];

  for (const file of files) {
    try {
      const text = await file.text();
      const items = file.name.toLowerCase().endsWith(".json")
        ? parseItemsJson(text)
        : parseCsv(text);

      importedCount += importItemsBatch(file.name, items);
    } catch (error) {
      failures.push(`${file.name}: ${error.message || "Could not read that file."}`);
    }

  }

  render();
  itemImportStatus.textContent = formatImportStatus(importedCount, failures);
  itemImportInput.value = "";
}

function importGrid(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const imported = JSON.parse(String(reader.result || "{}"));

      if (!imported || typeof imported !== "object" || Array.isArray(imported)) {
        throw new Error("JSON must be an exported grid object.");
      }

      Object.assign(state, {
        ...state,
        ...imported,
        items: Array.isArray(imported.items) ? normalizeImportedItems(imported.items) : state.items,
        importedBatches: Array.isArray(imported.importedBatches) ? imported.importedBatches : [],
        cells: imported.cells || {},
        cellLabels: imported.cellLabels || {},
        rowLabels: Array.isArray(imported.rowLabels) ? imported.rowLabels : state.rowLabels,
        columnLabels: Array.isArray(imported.columnLabels) ? imported.columnLabels : state.columnLabels,
      });
      render();
      gridFileStatus.textContent = `Imported grid from ${file.name}.`;
    } catch (error) {
      gridFileStatus.textContent = `Grid import failed: ${error.message || "Could not read that file."}`;
    }
    gridImportInput.value = "";
  });
  reader.readAsText(file);
}

function parseItemsJson(text) {
  const parsed = JSON.parse(text || "[]");

  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (Array.isArray(parsed.items)) {
    return parsed.items;
  }

  throw new Error("JSON must be an array or an object with an items array.");
}

function importItemsBatch(fileName, rows) {
  const batchId = `${slugify(fileName) || "import"}-${Date.now()}-${state.importedBatches.length}`;
  const items = normalizeImportedItems(rows).map((item) => ({
    ...item,
    id: makeUniqueItemId(item.id),
    batchId,
  }));

  if (!items.length) {
    throw new Error("file needs at least 1 item with a name.");
  }

  state.importedBatches.push({
    id: batchId,
    name: fileName,
    count: items.length,
  });
  state.items.push(...items);
  state.selectedItemId = null;
  return items.length;
}

function renderImportedBatches() {
  const batches = state.importedBatches || [];
  importedBatchList.innerHTML = batches.length
    ? batches.map(renderImportedBatch).join("")
    : `<p class="empty-state compact">No imported batches</p>`;
}

function renderImportedBatch(batch) {
  return `
    <div class="batch-row">
      <span>
        <strong>${escapeHtml(batch.name)}</strong>
        <small>${Number(batch.count) || 0} items</small>
      </span>
      <button type="button" class="remove-batch-button" data-batch-id="${escapeHtml(batch.id)}">Remove</button>
    </div>
  `;
}

function removeImportedBatch(batchId) {
  const batchItemIds = new Set(
    state.items.filter((item) => item.batchId === batchId).map((item) => item.id),
  );

  state.items = state.items.filter((item) => item.batchId !== batchId);
  state.importedBatches = state.importedBatches.filter((batch) => batch.id !== batchId);

  Object.keys(state.cells).forEach((key) => {
    if (batchItemIds.has(state.cells[key])) {
      delete state.cells[key];
    }
  });

  if (batchItemIds.has(state.selectedItemId)) {
    state.selectedItemId = null;
  }

  itemImportStatus.textContent = "Imported batch removed.";
  render();
}

function formatImportStatus(importedCount, failures) {
  const messages = [];

  if (importedCount) {
    messages.push(`Imported ${importedCount} items.`);
  }

  if (failures.length) {
    messages.push(`Failed: ${failures.join("; ")}`);
  }

  return messages.join(" ") || "Item import failed.";
}

function parseCsv(text) {
  const rows = text
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
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

function normalizeImportedItems(rows) {
  const seen = new Set();

  return rows
    .map((row, index) => {
      const name = String(row.name || "").trim();
      const id = String(row.id || slugify(name || `item-${index + 1}`));
      return {
        id: makeUniqueId(id, seen),
        name,
        image: normalizeImageUrl(String(row.image || row.imageUrl || row.imageurl || "").trim()),
        batchId: String(row.batchId || ""),
      };
    })
    .filter((item) => item.name);
}

function makeUniqueItemId(id) {
  const usedIds = new Set(state.items.map((item) => item.id));
  return makeUniqueId(id, usedIds);
}

function makeUniqueId(id, seen) {
  const fallback = id || "item";
  let uniqueId = fallback;
  let suffix = 2;

  while (seen.has(uniqueId)) {
    uniqueId = `${fallback}-${suffix}`;
    suffix += 1;
  }

  seen.add(uniqueId);
  return uniqueId;
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

function switchTab(tabName) {
  tabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tabName);
  });
  tabPanels.forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.panel === tabName);
  });
}

function cellKey(row, column) {
  return `${row}:${column}`;
}

function createNode(tag, className) {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function slugify(value) {
  return String(value).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

gridTitle.addEventListener("input", () => {
  state.title = gridTitle.value;
});
itemSearch.addEventListener("input", renderItems);
itemForm.addEventListener("submit", addItem);
resizeGridButton.addEventListener("click", resizeGrid);
exportButton.addEventListener("click", exportGrid);
downloadTemplateButton.addEventListener("click", downloadTemplate);
itemImportInput.addEventListener("change", importItems);
gridImportInput.addEventListener("change", importGrid);
tabButtons.forEach((button) => {
  button.addEventListener("click", () => switchTab(button.dataset.tab));
});

itemList.addEventListener("click", (event) => {
  const card = event.target.closest(".item-card");
  if (!card) return;
  state.selectedItemId = card.dataset.itemId;
  renderItems();
});

itemList.addEventListener("dragstart", (event) => {
  const card = event.target.closest(".item-card");
  if (!card) return;
  event.dataTransfer.setData("text/plain", card.dataset.itemId);
});

importedBatchList.addEventListener("click", (event) => {
  const button = event.target.closest(".remove-batch-button");
  if (!button) return;
  removeImportedBatch(button.dataset.batchId);
});

render();
