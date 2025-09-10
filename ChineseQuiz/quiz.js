// Column names (exact from your CSV)
const COLS = {
  zh: "Chinese Words",
  pinyin: "pinyin",
  en: "English Words",
  qtype: "Question Type",
  category: "Category",
  zhUsage: "Chinese Usage in a Sentence",
  enUsage: "English Usage in a sentence",
  color: "Color",
  zhHint: "Chinese Usage in a Sentence Hint"
};

// State
let rows = [];
let current = null;   // { row, type }
let right = 0, wrong = 0;
let lastAction = null; // { key, deltaChange: +1|-1, rightInc:0|1, wrongInc:0|1, rowRef 
let allRows = [];     // full filtered dataset
let rowLimit = null;  // numeric limit from the input
let rowRanges = null; // array of [start,end] ranges (1-based indexing)

// ---- Progress persistence (localStorage) ----
const STORAGE_KEY = 'quizProgressV1';
let progress = {}; // { [rowKey]: { delta:number, correct:number, wrong:number } }

function getRowKey(row) {
  // reasonably unique per card
  return `${row[COLS.zh]||''}||${row[COLS.pinyin]||''}||${row[COLS.en]||''}`;
}

function loadProgress() {
  try { progress = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
  catch { progress = {}; }
}

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}


function getEffectiveColor(row) {
  const base = parseInt(row[COLS.color]);
  if (isNaN(base)) return null;
  const delta = (progress[getRowKey(row)]?.delta) || 0;
  return base + delta; // can go above 10 or below 1; getColorShade clamps
}

// UI refs
const el = id => document.getElementById(id);
const questionEl = el("question");
const answerEl = el("answer");
const pinyinEl = el("pinyin");
const quizTypeTag = el("quizTypeTag");
const categoryEl = el("category");
const colorChip = el("colorChip");
const colorText = el("colorText");
const rowIndex = el("rowIndex");
const extrasArea = el("extrasArea");
const statsEl = el("stats");
const pinyinAnswerEl = document.getElementById("pinyinAnswer");

const flipBtn = el("flipBtn");
const nextBtn = el("nextBtn");
const rightBtn = el("rightBtn");
const wrongBtn = el("wrongBtn");

const showEnglishUsageBtn = el("showEnglishUsage");
const showChineseUsageBtn = el("showChineseUsage");
const showHintBtn = el("showHint");
const speakBtn = el("speakBtn");

// Helpers
const rand = n => Math.floor(Math.random() * n);

function normalizeCategory(catRaw) {
  const s = String(catRaw || "").toLowerCase();
  if (s.includes("both")) return ["english","chinese"];
  if (s.includes("english")) return ["english"];
  if (s.includes("sentence")) return ["sentence"]; // chinese sentence
  if (s.includes("chinese")) return ["chinese"];
  // Fallback to both main types
  return ["english","chinese"];
}

function chooseTypeForRow(row) {
  const allowed = normalizeCategory(row[COLS.category]);
  return allowed[rand(allowed.length)];
}

function applyRowLimit() {
  if (rowRanges && rowRanges.length) {
    rows = [];
    for (const [start, end] of rowRanges) {
      // CSV rows are zero-based, but user input is 1-based
      const s = Math.max(0, start - 1);
      const e = Math.min(allRows.length - 1, end - 1);
      rows.push(...allRows.slice(s, e + 1));
    }
  } else {
    const n = rowLimit && rowLimit > 0 ? Math.min(rowLimit, allRows.length) : allRows.length;
    rows = allRows.slice(0, n);
  }

  right = 0; wrong = 0; updateStats();
  pickNewCard();
}

function pickNewCard() {
  if (!rows.length) {
    questionEl.textContent = "No rows loaded. Load a CSV first.";
    return;
  }
  const row = rows[rand(rows.length)];
  const type = chooseTypeForRow(row);
  current = { row, type };
  renderCard();
}

function refreshCurrentColorUI() {
  if (!current) return;
  const eff = getEffectiveColor(current.row);
  if (eff != null) {
    colorText.textContent = eff;
    colorChip.style.background = getColorShade(eff);
  } else {
    colorText.textContent = "—";
    colorChip.style.background = "transparent";
  }
}

function renderCard() {
  if (!current) return;
  const { row, type } = current;

  // Reset areas
  answerEl.style.display = "none";
  answerEl.textContent = "";
  extrasArea.innerHTML = "";
  showEnglishUsageBtn.style.display = "none";
  showChineseUsageBtn.style.display = "none";
  showHintBtn.style.display = "none";
  rightBtn.style.display = "none";
wrongBtn.style.display = "none";
pinyinEl.textContent = "";
pinyinEl.style.display = "none";
pinyinAnswerEl.textContent = "";
pinyinAnswerEl.style.display = "none";
speakBtn.style.display = "none";

showEnglishUsageBtn.disabled = false; showEnglishUsageBtn.textContent = "Show English Usage";
showChineseUsageBtn.disabled = false; showChineseUsageBtn.textContent = "Show Chinese Usage";
showHintBtn.disabled = false; showHintBtn.textContent = "Show Hint (Chinese Usage Hint)";

  // Core labels
  quizTypeTag.textContent = type === "english" ? "English quiz"
                          : type === "chinese" ? "Chinese quiz"
                          : "Chinese sentence quiz";
  categoryEl.textContent = row[COLS.category] || "—";
const eff = getEffectiveColor(row);
if (eff != null) {
  colorText.textContent = eff;
  colorChip.style.background = getColorShade(eff);
} else {
  colorText.textContent = "—";
  colorChip.style.background = "transparent";
}
  rowIndex.textContent = rows.indexOf(row) >= 0 ? `Row ${rows.indexOf(row)+1}/${rows.length}` : "—";

  // Question & pinyin
  pinyinEl.textContent = "";
if (type === "english") {
  questionEl.textContent = row[COLS.zh] || "—";
  if (row[COLS.pinyin]) {
    pinyinEl.textContent = row[COLS.pinyin];
    pinyinEl.style.display = "block";
  }

showHintBtn.style.display = row[COLS.zhHint] ? "inline-block" : "none";

} else if (type === "chinese") {
  // Show English term as question (translate to Chinese)
  questionEl.textContent = row[COLS.en] || "—";

  // Show English usage immediately (once)
  if (row[COLS.enUsage]) {
    const block = document.createElement("div");
    block.id = "english-usage";
    block.className = "usage-block";
    block.innerHTML = `<strong>English Usage:</strong>\n${row[COLS.enUsage]}`;
    extrasArea.appendChild(block);

    showEnglishUsageBtn.style.display = "none";
    showEnglishUsageBtn.disabled = true;
  }

  // Hint button available for Chinese quiz
  showHintBtn.style.display = row[COLS.zhHint] ? "inline-block" : "none";


  } else {
    // "sentence" — ask to use word in a sentence
    questionEl.textContent = (row[COLS.zh] || "—") + "  —  use this word in your own Chinese sentence.";
    if (row[COLS.pinyin]) pinyinEl.textContent = row[COLS.pinyin];
  }

  // Hidden answer
  if (type === "english") {
    answerEl.textContent = row[COLS.en] || "—";
  } else if (type === "chinese") {
    answerEl.textContent = row[COLS.zh] || "—";
  } else {
    const zh = row[COLS.zh] || "—";
    const en = row[COLS.en] || "—";
    const pin = row[COLS.pinyin] ? ` (${row[COLS.pinyin]})` : "";
    answerEl.textContent = `Target word: ${zh}${pin}\nMeaning: ${en}`;
  }
}

function reveal() {
  if (!current) return;
  answerEl.style.display = "block";
  rightBtn.style.display = "inline-block";
  wrongBtn.style.display = "inline-block";
  
  // Hide hint and remove any existing hint text once the answer is revealed
  showHintBtn.style.display = "none";
  const hint = document.getElementById("hint-block");
  if (hint) hint.remove();

 if (current.type === "chinese") {
    if (pinyinEl) {
      pinyinEl.textContent = "";
      pinyinEl.style.display = "none";
    }
    if (typeof pinyinAnswerEl !== "undefined" && pinyinAnswerEl && current.row[COLS.pinyin]) {
      pinyinAnswerEl.textContent = current.row[COLS.pinyin];
      pinyinAnswerEl.style.display = "block";
    }
  }

  // After reveal: show usage buttons as before
  if (current.type === "english") {
    if (current.row[COLS.enUsage]) showEnglishUsageBtn.style.display = "inline-block";
    if (current.row[COLS.zhUsage]) showChineseUsageBtn.style.display = "inline-block";
  } else if (current.type === "chinese") {
    if (current.row[COLS.zhUsage]) showChineseUsageBtn.style.display = "inline-block";
  }

  // Voice: show Speak button when there's Chinese to read
  if (typeof speakBtn !== "undefined" && speakBtn) {
    const hasChinese = !!(current.row && current.row[COLS.zh] && String(current.row[COLS.zh]).trim());
    speakBtn.style.display = hasChinese ? "inline-block" : "none";
    speakBtn.disabled = !hasChinese;
  }
}


function showEnglishUsage() {
  if (!current) return;
  if (document.getElementById("english-usage")) return; // already appended

  const txt = current.row[COLS.enUsage];
  if (!txt) return;

  const block = document.createElement("div");
  block.id = "english-usage";                // marker to prevent duplicates
  block.className = "usage-block";
  block.innerHTML = `<strong>English Usage:</strong>\n${txt}`;
  extrasArea.appendChild(block);

  showEnglishUsageBtn.disabled = true;
  showEnglishUsageBtn.textContent = "English Usage Shown";
}

function updateStats() {
  statsEl.textContent = `${right} right · ${wrong} wrong`;
}

function showChineseUsage() {
  if (!current) return;
  if (document.getElementById("chinese-usage")) return; // already appended

  const txt = current.row[COLS.zhUsage];
  if (!txt) return;

  const block = document.createElement("div");
  block.id = "chinese-usage";               // marker to prevent duplicates
  block.className = "usage-block";
  block.innerHTML = `<strong>Chinese Usage:</strong>\n${txt}`;

  // 🔊 Add a play button for the sentence
  const playBtn = document.createElement("button");
  playBtn.className = "btn";
  playBtn.style.marginTop = "8px";
  playBtn.textContent = "🔊 Play sentence";
  playBtn.addEventListener("click", () => speakChinese(txt));
  block.appendChild(document.createElement("br"));
  block.appendChild(playBtn);

  extrasArea.appendChild(block);

  showChineseUsageBtn.disabled = true;
  showChineseUsageBtn.textContent = "Chinese Usage Shown";
}


function showHint() {
  if (!current) return;
  if (document.getElementById("hint-block")) return; // already appended

  const txt = current.row[COLS.zhHint];
  if (!txt) return;

  const block = document.createElement("div");
  block.id = "hint-block";                  // marker to prevent duplicates
  block.className = "hint-block";
  block.innerHTML = `<strong>Hint:</strong>\n${txt}`;
  extrasArea.appendChild(block);

  showHintBtn.disabled = true;
  showHintBtn.textContent = "Hint Shown";
}


// Wire buttons
document.addEventListener("DOMContentLoaded", () => {
  loadProgress();
  el("downloadProgress").addEventListener("click", downloadProgressCsv);
  el("flipBtn").addEventListener("click", reveal);
  el("nextBtn").addEventListener("click", pickNewCard);

el("rightBtn").addEventListener("click", () => {
  if (!current) return;
  const key = getRowKey(current.row);
  const entry = progress[key] || { delta: 0, correct: 0, wrong: 0 };

  // apply
  entry.delta = (entry.delta || 0) - 1;
  entry.correct = (entry.correct || 0) + 1;
  progress[key] = entry; saveProgress();
  

  // record for undo
  lastAction = { key, deltaChange: -1, rightInc: 1, wrongInc: 0, rowRef: current.row };

  // ui updates
  right++; updateStats();
  refreshCurrentColorUI();

  // next
  setTimeout(pickNewCard, 120);
});

const rowLimitInput = el("rowLimit");
if (rowLimitInput) {
  rowLimitInput.addEventListener("input", () => {
    const v = parseInt(rowLimitInput.value, 10);
    rowLimit = Number.isFinite(v) && v > 0 ? v : null;
    if (allRows.length) applyRowLimit();
  });
}

  const rowRangeInput = el("rowRange");
  if (rowRangeInput) {
    rowRangeInput.addEventListener("input", () => {
      rowRanges = parseRowRanges(rowRangeInput.value);
      if (allRows.length) applyRowLimit();
    });
  }

el("wrongBtn").addEventListener("click", () => {
  if (!current) return;
  const key = getRowKey(current.row);
  const entry = progress[key] || { delta: 0, correct: 0, wrong: 0 };

  // apply
  entry.delta = (entry.delta || 0) + 1;
  entry.wrong = (entry.wrong || 0) + 1;
  progress[key] = entry; saveProgress();

  // record for undo
  lastAction = { key, deltaChange: +1, rightInc: 0, wrongInc: 1, rowRef: current.row };

  // ui updates
  wrong++; updateStats();
  refreshCurrentColorUI();

  // next
  setTimeout(pickNewCard, 120);
});

el("undoBtn").addEventListener("click", () => {
  if (!lastAction) return;

  // revert progress
  const entry = progress[lastAction.key] || { delta: 0, correct: 0, wrong: 0 };
  entry.delta = (entry.delta || 0) - lastAction.deltaChange;           // reverse delta
  entry.correct = (entry.correct || 0) - (lastAction.rightInc || 0);   // reverse counts
  entry.wrong   = (entry.wrong   || 0) - (lastAction.wrongInc || 0);
  progress[lastAction.key] = entry; saveProgress();

  // revert global stats
  right -= (lastAction.rightInc || 0);
  wrong -= (lastAction.wrongInc || 0);
  if (right < 0) right = 0;
  if (wrong < 0) wrong = 0;
  updateStats();

  // If the current card is the same as the undone one, refresh its color UI
  if (current && getRowKey(current.row) === lastAction.key) {
    refreshCurrentColorUI();
  }

  // Clear last action (single‑level undo)
  lastAction = null;
});

  el("showEnglishUsage").addEventListener("click", showEnglishUsage);
  el("showChineseUsage").addEventListener("click", showChineseUsage);
  el("showHint").addEventListener("click", showHint);

  // 1) Local file picker
  el("csvFile").addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (file) parseCSVFile(file);
  });

  speakBtn.addEventListener("click", () => {
  if (!current) return;
  if (current.type === "english" || current.type === "sentence") {
    speakChinese(current.row[COLS.zh]);
  } else if (current.type === "chinese") {
    speakChinese(current.row[COLS.zh]);
  }
});

  // 2) Default fetch from same repo path
  el("loadDefault").addEventListener("click", async () => {
    try {
      const resp = await fetch("sheet.csv", { cache: "no-store" });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const text = await resp.text();
      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        complete: (res) => {
          allRows = res.data.filter(r => r && (r[COLS.zh] || r[COLS.en]));
          applyRowLimit();
        },
        error: (err) => alert("CSV parse error: " + err.message)
      });
    } catch (e) {
      alert("Could not load CSV from repo path. Error: " + e.message);
    }
  });
  
});

// CSV parsing for local file
function parseCSVFile(file) {
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: (res) => {
       allRows = res.data.filter(r => {
  if (!r) return false;
  return r[COLS.zh]?.trim() && r[COLS.en]?.trim() && r[COLS.category]?.trim();
});
applyRowLimit();
    },
    error: (err) => {
      alert("CSV parse error: " + err.message);
    }
  });
}

function getColorShade(val) {
  // Clamp value between 1 and 10
  const v = Math.max(1, Math.min(val, 10));
  // Map 1 → 0 (bright), 10 → 1 (dark)
  const t = (v - 1) / 9;
  // Interpolate from bright yellow-green to dark red/grey
  const r = Math.round(255 * t + 100 * (1 - t));  // red grows
  const g = Math.round(255 * (1 - t));            // green decreases
  const b = Math.round(80 + 50 * t);              // blue stays low
  return `rgb(${r}, ${g}, ${b})`;
}

function csvEscape(s) {
  const v = String(s ?? '');
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function buildProgressCsv() {
  // Exact original column order
  const header = [
    COLS.zh,
    COLS.pinyin,
    COLS.en,
    COLS.qtype,
    COLS.category,
    COLS.zhUsage,
    COLS.enUsage,
    COLS.color,
    COLS.zhHint
  ];

  const lines = [header.map(csvEscape).join(",")];

  for (const row of rows) {
    const key = getRowKey(row);
    const baseColor = parseInt(row[COLS.color]);
    const delta = (progress[key]?.delta) || 0;
    const eff = isNaN(baseColor) ? "" : (baseColor + delta);

    // Write original values, except Color which uses effective value
    const record = [
      row[COLS.zh] || "",
      row[COLS.pinyin] || "",
      row[COLS.en] || "",
      row[COLS.qtype] || "",
      row[COLS.category] || "",
      row[COLS.zhUsage] || "",
      row[COLS.enUsage] || "",
      eff === "" ? "" : String(eff),
      row[COLS.zhHint] || ""
    ];

    lines.push(record.map(csvEscape).join(","));
  }

  return lines.join("\r\n"); // Windows-friendly newlines
}

function downloadProgressCsv() {
  const csv = buildProgressCsv();
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  a.href = url;
  a.download = `quiz-progress-${ts}.csv`;
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(url);
  a.remove();
}

function parseRowRanges(str) {
  if (!str) return null;
  return str.split(",").map(r => {
    const [start, end] = r.split("-").map(v => parseInt(v.trim(), 10));
    if (!isNaN(start) && !isNaN(end) && start <= end) {
      return [start, end];
    }
    if (!isNaN(start) && isNaN(end)) { 
      return [start, start]; // single row
    }
    return null;
  }).filter(Boolean);
}

function speakChinese(text) {
  if (!text) return;
  // stop anything already speaking
  try { speechSynthesis.cancel(); } catch {}
  const u = new SpeechSynthesisUtterance(String(text));
  u.lang = "zh-CN"; // Mandarin
  speechSynthesis.speak(u);
}