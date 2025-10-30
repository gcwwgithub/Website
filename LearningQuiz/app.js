// =======================================
// Learning Flashcards (Upload CSV version)
// =======================================

const state = {
  questions: [],
  currentIndex: 0,
  isFlipped: false,
  loaded: false,
};

document.addEventListener("DOMContentLoaded", () => {
  // Wire UI
  const fileInput = document.getElementById("file-input");
  const fileName = document.getElementById("file-name");
  const loadSampleBtn = document.getElementById("load-sample-btn");

  fileInput.addEventListener("change", onFileChosen);
  loadSampleBtn.addEventListener("click", loadSampleCsvIfHosted);

  document.getElementById("flip-btn").onclick = flipCard;
  document.getElementById("correct-btn").onclick = () => updateColor(-1);
  document.getElementById("wrong-btn").onclick = () => updateColor(+1);
  document.getElementById("next-btn").onclick = nextQuestion;
  document.getElementById("copy-btn").onclick = copyCode;
  document.getElementById("reset-btn").onclick = resetScores;
  document.getElementById("copyq-btn").onclick = copyQuestionCode;

  // Keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    if (!state.loaded) return;
    if (e.code === "Space" || e.key === "Enter") {
      e.preventDefault();
      flipCard();
    } else if (e.key === "ArrowRight") {
      nextQuestion();
    } else if (e.key === "1") {
      updateColor(-1);
    } else if (e.key === "2") {
      updateColor(+1);
    }
  });

  function onFileChosen(ev) {
    const file = ev.target.files?.[0];
    if (!file) return;
    fileName.textContent = file.name;
    parseCsvFile(file);
  }
});

// ---- CSV parsing (Upload) ----
function parseCsvFile(file) {
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      try {
        buildQuestions(results.data);
        afterQuestionsLoaded();
      } catch (err) {
        console.error(err);
        alert("CSV format error. Check header names and rows.");
      }
    },
    error: (err) => {
      console.error("Parse error:", err);
      alert("Failed to parse CSV.");
    },
  });
}

// ---- Optional: load a sample hosted CSV (works on GitHub Pages / localhost) ----
async function loadSampleCsvIfHosted() {
  try {
    const res = await fetch("./questions.csv", { cache: "no-store" });
    if (!res.ok) throw new Error("No hosted CSV found");
    const text = await res.text();
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
    buildQuestions(parsed.data);
    document.getElementById("file-name").textContent = "Loaded: data/questions.csv";
    afterQuestionsLoaded();
  } catch (e) {
    alert("Could not load ./questions.csv. Upload a CSV instead.");
  }
}

// ---- Build internal model ----
function buildQuestions(rows) {
  const questions = [];
  console.log("Building questions from rows:", rows);
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // Column contract
    const category = (row["Category"] ?? "").toString().trim();
    const question = (row["Question"] ?? "").toString().trim();
    const codeQuestion = (row["Code Question"] ?? "").toString();
    const answer = (row["Answer"] ?? "").toString().trim();
    const codeAnswer = (row["Code Answer"] ?? "").toString();

    const colorCsv = Number.parseInt((row["Color"] ?? "0").toString(), 10);

    if (!question) continue; // skip empty questions

    const id = i; // stable per session
    const saved = getSavedColor(id);
    const color = Number.isFinite(saved) ? saved : (Number.isFinite(colorCsv) ? colorCsv : 0);

    questions.push({
      id,
      category,
      question,
      codeQuestion: codeQuestion?.trim() || "",
      answer,
      codeAnswer: codeAnswer?.trim() || "",
      color,
    });
  }

  if (questions.length === 0) {
    throw new Error("No valid rows.");
  }

  state.questions = questions;
}

// ---- After data load: enable UI and show first card ----
function afterQuestionsLoaded() {
  state.loaded = true;
  enableUi(true);
  pickRandomQuestion();
  renderCard();
  document.getElementById("tips").textContent = "Loaded. Use Flip / Correct / Wrong / Next or keyboard (Space, 1, 2, →).";
}

function enableUi(enable) {
  const ids = ["flip-btn", "correct-btn", "wrong-btn", "next-btn", "reset-btn"];
  ids.forEach((id) => (document.getElementById(id).disabled = !enable));

  const card = document.getElementById("card");
  card.classList.toggle("disabled", !enable);
}

// ---- Core interactions ----
function pickRandomQuestion() {
  const n = state.questions.length;
  state.currentIndex = Math.floor(Math.random() * n);
  state.isFlipped = false;
}

function nextQuestion() {
  pickRandomQuestion();
  renderCard();
}

function flipCard() {
  if (!state.loaded) return;
  state.isFlipped = !state.isFlipped;
  renderCard();
}

function renderCard() {
  const q = state.questions[state.currentIndex];

  const langBadgeQ = document.getElementById("lang-q");
  const langBadgeA = document.getElementById("lang-a");

  // Hide badges by default before rendering
  langBadgeQ.classList.add("hidden");
  langBadgeA.classList.add("hidden");

  // Meta
  document.getElementById("category").textContent = `Category: ${q.category || "—"}`;
  document.getElementById("score").textContent = `Score: ${q.color}`;
  document.getElementById("progress").textContent = `Question ${state.currentIndex + 1} of ${state.questions.length}`;

  // Faces
  const front = document.getElementById("card-front");
  const back = document.getElementById("card-back");
  front.classList.toggle("hidden", state.isFlipped);
  back.classList.toggle("hidden", !state.isFlipped);

  document.getElementById("question").textContent = q.question;
  // Normalize answer: treat "-" or blank as no answer
const hasAnswer =
  typeof q.answer === "string" &&
  q.answer.trim().length > 0 &&
  q.answer.trim() !== "-";

document.getElementById("answer").textContent = hasAnswer
  ? q.answer.trim()
  : "(No text answer)";


const codeAWrap = document.getElementById("codea-wrap");
const codeBlock = document.getElementById("code-block");
const codeContent = document.getElementById("code-content");
const copyBtn = document.getElementById("copy-btn");

const hasCodeA =
  typeof q.codeAnswer === "string" &&
  q.codeAnswer.trim().length > 0 &&
  q.codeAnswer.trim() !== "-";

if (hasCodeA) {
  codeAWrap.classList.remove("hidden");
  codeBlock.classList.remove("hidden");
  copyBtn.classList.remove("hidden");

const langA = detectLanguage(q.codeAnswer.trim());

codeContent.textContent = q.codeAnswer.trim();

codeContent.className = "language-" + langA;
codeBlock.className = "language-" + langA;

// Show the language badge
langBadgeA.textContent = langA.toUpperCase();
langBadgeA.classList.remove("hidden");

// Highlight syntax
Prism.highlightElement(codeContent);
} else {
  codeAWrap.classList.add("hidden");
  codeBlock.classList.add("hidden");
  copyBtn.classList.add("hidden");
  codeContent.textContent = "";
  codeContent.className = "";
  codeBlock.className = "";
}


const codeQWrap = document.getElementById("codeq-wrap");
const codeQBlock = document.getElementById("codeq-block");
const codeQContent = document.getElementById("codeq-content");
const copyQBtn = document.getElementById("copyq-btn");

const hasCodeQ =
  typeof q.codeQuestion === "string" &&
  q.codeQuestion.trim().length > 0 &&
  q.codeQuestion.trim() !== "-";

if (hasCodeQ) {
  codeQWrap.classList.remove("hidden");
  codeQBlock.classList.remove("hidden");
  copyQBtn.classList.remove("hidden");

const langQ = detectLanguage(q.codeQuestion.trim());

codeQContent.textContent = q.codeQuestion.trim();

codeQContent.className = "language-" + langQ;
codeQBlock.className = "language-" + langQ;

// Show the language badge
langBadgeQ.textContent = langQ.toUpperCase();
langBadgeQ.classList.remove("hidden");

// Highlight syntax
Prism.highlightElement(codeQContent);
} else {
  codeQWrap.classList.add("hidden");
  codeQBlock.classList.add("hidden");
  copyQBtn.classList.add("hidden");
  codeQContent.textContent = "";
  codeQContent.className = "";
  codeQBlock.className = "";
}


if (hasCodeQ || hasCodeA) {
  Prism.highlightAll();
}

}

// ---- Scoring / persistence ----
function updateColor(delta) {
  if (!state.loaded) return;
  const q = state.questions[state.currentIndex];
  q.color = clamp(q.color + delta, -999, 999);
  saveColor(q.id, q.color);
  renderCard();
}

function saveColor(id, color) {
  localStorage.setItem(`color_${id}`, String(color));
}

function getSavedColor(id) {
  const raw = localStorage.getItem(`color_${id}`);
  if (raw === null) return null;
  const num = Number.parseInt(raw, 10);
  return Number.isFinite(num) ? num : null;
}

function resetScores() {
  if (!state.loaded) return;
  if (!confirm("Reset all scores for this session's cards?")) return;
  state.questions.forEach((q) => {
    q.color = 0;
    localStorage.removeItem(`color_${q.id}`);
  });
  renderCard();
}

// ---- Utilities ----
function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

async function copyCode() {
  if (!state.loaded) return;
  const q = state.questions[state.currentIndex];
  if (!q.codeAnswer) return;
  try {
    await navigator.clipboard.writeText(q.codeAnswer);
    const btn = document.getElementById("copy-btn");
    const prev = btn.textContent;
    btn.textContent = "Copied!";
    setTimeout(() => (btn.textContent = prev), 1200);
  } catch (e) {
    console.error("Copy failed", e);
  }
}

async function copyQuestionCode() {
  if (!state.loaded) return;
  const q = state.questions[state.currentIndex];
  if (!q.codeQuestion || q.codeQuestion.trim().length === 0) return;
  try {
    await navigator.clipboard.writeText(q.codeQuestion.trim());
    const btn = document.getElementById("copyq-btn");
    const prev = btn.textContent;
    btn.textContent = "Copied!";
    setTimeout(() => (btn.textContent = prev), 1200);
  } catch (e) {
    console.error("Copy (question) failed", e);
  }
}

function detectLanguage(code){
  const s = code;
  if (/\b#include\b|\bstd::|::\s*\w+\s*\(|\btemplate\s*<|->\s*\w+\(/.test(s)) return "cpp";
  if (/\busing\s+namespace\s+std\b/.test(s)) return "cpp";
  if (/\bConsole\./.test(s) || /\busing\s+System/.test(s)) return "csharp";
  if (/\bdef\s+\w+\s*\(/.test(s) || /\bprint\(.+\)/.test(s)) return "python";
  if (/\bfunction\b|\bconst\b|\blet\b/.test(s) && /[{;)]\s*$/.test(s)) return "javascript";
  if (/\bclass\b\s+\w+\s*{/.test(s) && /public:|private:/.test(s)) return "cpp";
  // default
  return "cpp";
}

