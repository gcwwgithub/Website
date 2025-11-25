// =======================================
// Learning Flashcards (Upload CSV + MCQ)
// =======================================

const state = {
  questions: [],
  currentIndex: 0,
  isFlipped: false,
  loaded: false,
  mode: "normal",      // already there if you used my MCQ version
  mcqLocked: false,    // already there
  lockFlip: false,     // NEW: hide Flip after MCQ pressed
  lockMcq: false,      // NEW: hide MCQ after Flip pressed
};

document.addEventListener("DOMContentLoaded", () => {
  // Wire UI
  const fileInput = document.getElementById("file-input");
  const fileName = document.getElementById("file-name");
  const loadSampleBtn = document.getElementById("load-sample-btn");

  fileInput.addEventListener("change", onFileChosen);
  loadSampleBtn.addEventListener("click", loadSampleCsvIfHosted);

  document.getElementById("flip-btn").onclick = onFlipClicked;
  document.getElementById("mcq-btn").onclick = startMcqMode;
  document.getElementById("correct-btn").onclick = () => {
    updateColor(+1);   
    nextQuestion();
  };

  document.getElementById("wrong-btn").onclick = () => {
    updateColor(-1);
    nextQuestion();
  };
  document.getElementById("next-btn").onclick = nextQuestion;
  document.getElementById("copy-btn").onclick = copyCode;
  document.getElementById("reset-btn").onclick = resetScores;
  document.getElementById("copyq-btn").onclick = copyQuestionCode;

  // Keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    if (!state.loaded) return;
    if (e.code === "Space" || e.key === "Enter") {
      e.preventDefault();
      onFlipClicked();
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

// ---- Optional: load a sample hosted CSV ----
async function loadSampleCsvIfHosted() {
  try {
    const res = await fetch("./questions.csv", { cache: "no-store" });
    if (!res.ok) throw new Error("No hosted CSV found");
    const text = await res.text();
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
    buildQuestions(parsed.data);
    document.getElementById("file-name").textContent = "Loaded: questions.csv";
    afterQuestionsLoaded();
  } catch (e) {
    alert("Could not load ./questions.csv. Upload a CSV instead.");
  }
}

// ---- Build internal model ----
function buildQuestions(rows) {
  const questions = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // Column contract (new order)
    // Category, Question, Code Question, QuestionImage, Answer, Code Answer, AnswerImage, Color, WrongAnswer1, WrongAnswer2, WrongAnswer3
    const category = (row["Category"] ?? "").toString().trim();
    const question = (row["Question"] ?? "").toString().trim();
    const codeQuestion = (row["Code Question"] ?? "").toString();
    // images ignored for now
    const answer = (row["Answer"] ?? "").toString().trim();
    const codeAnswer = (row["Code Answer"] ?? "").toString();
    const colorCsv = Number.parseInt((row["Color"] ?? "0").toString(), 10);

    // wrong answers (may be empty or "-")
    const w1 = (row["WrongAnswer1"] ?? "").toString().trim();
    const w2 = (row["WrongAnswer2"] ?? "").toString().trim();
    const w3 = (row["WrongAnswer3"] ?? "").toString().trim();

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
      wrongs: [w1, w2, w3],
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
  document.getElementById("tips").textContent = "Loaded. Use Flip / Do MCQ / Correct / Wrong / Next (Space, 1, 2, →).";
}

function enableUi(enable) {
  const ids = ["flip-btn", "mcq-btn", "correct-btn", "wrong-btn", "next-btn", "reset-btn"];
  ids.forEach((id) => (document.getElementById(id).disabled = !enable));

  const card = document.getElementById("card");
  card.classList.toggle("disabled", !enable);
}

// ---- Core interactions ----
function pickRandomQuestion() {
  const n = state.questions.length;
  state.currentIndex = Math.floor(Math.random() * n);
  state.isFlipped = false;
  state.mode = "normal";
  state.mcqLocked = false;

  // 🔹 Reset locks for the new question
  state.lockFlip = false;
  state.lockMcq = false;
}

function nextQuestion() {
  pickRandomQuestion();
  renderCard();
}

function onFlipClicked() {
  if (!state.loaded) return;

  state.isFlipped = !state.isFlipped;

  // 🔹 If this question has ever been flipped, MCQ is disabled until Next
  state.lockMcq = true;
  state.mode = "normal"; // ensure we're not in MCQ mode

  renderCard();
}

function startMcqMode() {
  if (!state.loaded) return;
  state.mode = "mcq";
  state.isFlipped = false;  // MCQ always on front
  state.mcqLocked = false;

  // 🔹 Once MCQ is chosen, Flip is disabled until Next
  state.lockFlip = true;

  renderCard();
}


// ---- Render ----
function renderCard() {
  const q = state.questions[state.currentIndex];

  const langBadgeQ = document.getElementById("lang-q");
  const langBadgeA = document.getElementById("lang-a");
  langBadgeQ.classList.add("hidden");
  langBadgeA.classList.add("hidden");

  // Meta
  document.getElementById("category").textContent = `Category: ${q.category || "—"}`;
  document.getElementById("score").textContent = `Score: ${q.color}`;
  document.getElementById("progress").textContent = `Question ${state.currentIndex + 1} of ${state.questions.length}`;

  // Faces visibility
  const front = document.getElementById("card-front");
  const back = document.getElementById("card-back");
  front.classList.toggle("hidden", state.isFlipped);
  back.classList.toggle("hidden", !state.isFlipped);

  // Controls visibility logic
  const flipBtn = document.getElementById("flip-btn");
  const mcqBtn = document.getElementById("mcq-btn");
  const correctBtn = document.getElementById("correct-btn");
  const wrongBtn = document.getElementById("wrong-btn");

  // 🔹 Flip button visibility
  // If MCQ was chosen for this question, hide Flip
  if (state.lockFlip) {
    flipBtn.style.display = "none";
  } else {
    flipBtn.style.display = "";
  }

  // 🔹 MCQ button visibility
  // Only show MCQ if:
  // - not flipped yet for this question (lockMcq is false)
  // - not currently flipped to the back
  // - not already in MCQ mode
  if (!state.lockMcq && !state.isFlipped && state.mode !== "mcq") {
    mcqBtn.style.display = "";
  } else {
    mcqBtn.style.display = "none";
  }

  // ===============================
  // MCQ BUTTON VISIBILITY LOGIC
  // ===============================

  // Case 1: In MCQ mode but NOT answered yet
  if (state.mode === "mcq" && !state.mcqLocked) {
    correctBtn.style.display = "none";
    wrongBtn.style.display = "none";
  }
  // Case 2: MCQ answered — show only the relevant one
  else if (state.mode === "mcq" && state.mcqLocked) {
    // If scoring update set a hidden flag on Correct or Wrong, respect it
    // (we will set these when clicking options)
  }
  // Case 3: Normal (Flip mode or plain question)
  else {
    correctBtn.style.display = "";
    wrongBtn.style.display = "";
  }

  // ----- FRONT content (Question) -----
  document.getElementById("question").textContent = q.question;

  // Code Question
  const codeQWrap = document.getElementById("codeq-wrap");
  const codeQBlock = document.getElementById("codeq-block");
  const codeQContent = document.getElementById("codeq-content");
  const copyQBtn = document.getElementById("copyq-btn");

  const hasCodeQ =
    typeof q.codeQuestion === "string" &&
    q.codeQuestion.trim().length > 0 &&
    q.codeQuestion.trim() !== "-";

  if (!state.isFlipped) {
    if (hasCodeQ) {
      codeQWrap.classList.remove("hidden");
      codeQBlock.classList.remove("hidden");
      copyQBtn.classList.remove("hidden");

      const langQ = detectLanguage(q.codeQuestion.trim());
      codeQContent.textContent = q.codeQuestion.trim();
      codeQContent.className = "language-" + langQ;
      codeQBlock.className = "language-" + langQ;

      // Language badge
      langBadgeQ.textContent = langQ.toUpperCase();
      langBadgeQ.classList.remove("hidden");

      Prism.highlightElement(codeQContent);
    } else {
      codeQWrap.classList.add("hidden");
      codeQBlock.classList.add("hidden");
      copyQBtn.classList.add("hidden");
      codeQContent.textContent = "";
      codeQContent.className = "";
      codeQBlock.className = "";
    }
  } else {
    // If showing back, ensure front code area is hidden
    codeQWrap.classList.add("hidden");
  }

  // ----- MCQ (front only) -----
  const mcqWrap = document.getElementById("mcq-wrap");
  const mcqOptions = document.getElementById("mcq-options");
  mcqWrap.classList.add("hidden");
  mcqOptions.innerHTML = "";

  if (!state.isFlipped && state.mode === "mcq") {
    const opts = buildMcqOptions(q);
    // If we can't build 2+ options, fallback to normal (hide MCQ UI)
    if (opts.length >= 2) {
      mcqWrap.classList.remove("hidden");
      renderMcqOptions(opts, q);
    } else {
      state.mode = "normal";
    }
  }

  // ----- BACK content (Answer) -----
  // text answer (treat "-" or blank as no answer)
  const hasAnswer =
    typeof q.answer === "string" &&
    q.answer.trim().length > 0 &&
    q.answer.trim() !== "-";
  document.getElementById("answer").textContent = hasAnswer ? q.answer.trim() : "(No text answer)";

  // Code Answer
  const codeAWrap = document.getElementById("codea-wrap");
  const codeBlock = document.getElementById("code-block");
  const codeContent = document.getElementById("code-content");
  const copyBtn = document.getElementById("copy-btn");

  const hasCodeA =
    typeof q.codeAnswer === "string" &&
    q.codeAnswer.trim().length > 0 &&
    q.codeAnswer.trim() !== "-";

  if (state.isFlipped && hasCodeA) {
    codeAWrap.classList.remove("hidden");
    codeBlock.classList.remove("hidden");
    copyBtn.classList.remove("hidden");

    const langA = detectLanguage(q.codeAnswer.trim());
    codeContent.textContent = q.codeAnswer.trim();
    codeContent.className = "language-" + langA;
    codeBlock.className = "language-" + langA;

    langBadgeA.textContent = langA.toUpperCase();
    langBadgeA.classList.remove("hidden");

    Prism.highlightElement(codeContent);
  } else {
    codeAWrap.classList.add("hidden");
    codeBlock.classList.add("hidden");
    copyBtn.classList.add("hidden");
    codeContent.textContent = "";
    codeContent.className = "";
    codeBlock.className = "";
  }
}

// ---- MCQ helpers ----
function buildMcqOptions(q) {
  const opts = [];
  const correct = (q.answer || "").trim();
  if (correct && correct !== "-") {
    opts.push({ text: correct, isCorrect: true });
  }

  // Collect wrong answers, drop blanks / "-"
  const wrongs = (q.wrongs || []).map(w => (w || "").trim()).filter(w => w && w !== "-");

  // Use up to 3 wrong answers
  for (const w of wrongs) {
    if (opts.length >= 4) break;
    if (!opts.some(o => o.text === w)) {
      opts.push({ text: w, isCorrect: false });
    }
  }

  // If more than 1 option, shuffle
  if (opts.length > 1) shuffle(opts);
  return opts;
}

function renderMcqOptions(opts, q) {
  const mcqOptions = document.getElementById("mcq-options");
  const correctBtn = document.getElementById("correct-btn");
  const wrongBtn = document.getElementById("wrong-btn");

  // Hide MCQ button once shown
  document.getElementById("mcq-btn").style.display = "none";

  // reset lock
  state.mcqLocked = false;

 opts.forEach((opt, idx) => {
  const btn = document.createElement("button");
  btn.className = "mcq-option";
  btn.textContent = opt.text;

  btn.addEventListener("click", () => {
    if (state.mcqLocked) return;
    state.mcqLocked = true;

    const allOptions = [...mcqOptions.children];

    // Disable all options and clear any previous correct/wrong styling
    allOptions.forEach(n => {
      n.classList.add("disabled");
      n.classList.remove("correct", "wrong");
    });

    if (opt.isCorrect) {
      // Only the clicked option should be green
      btn.classList.add("correct");

      // MCQ answered correctly → show Correct button, hide Wrong
      correctBtn.style.display = "";
      wrongBtn.style.display   = "none";

      // scoring happens when Correct button is pressed
    } else {
      // Clicked option is wrong -> red
      btn.classList.add("wrong");

      // Also reveal which one was actually correct -> green
      const correctIndex = opts.findIndex(o => o.isCorrect);
      if (correctIndex !== -1) {
        const correctNode = allOptions[correctIndex];
        if (correctNode && correctNode !== btn) {
          correctNode.classList.add("correct");
        }
      }

      // MCQ answered wrongly → show Wrong button, hide Correct
      wrongBtn.style.display   = "";
      correctBtn.style.display = "none";

      // scoring happens when Wrong button is pressed
    }
  });

  mcqOptions.appendChild(btn);
});

}

// ---- Scoring / persistence ----
function updateColor(delta) {
  if (!state.loaded) return;
  const q = state.questions[state.currentIndex];
  q.color = clamp(q.color + delta, -999, 999);
  saveColor(q.id, q.color);
  // Re-render but keep current face/mode; ensure we don't rebuild MCQ options after answering
  document.getElementById("score").textContent = `Score: ${q.color}`;
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
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
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

// Lightweight language detector
function detectLanguage(code) {
  const s = code;
  if (/\b#include\b|\bstd::|::\s*\w+\s*\(|\btemplate\s*<|->\s*\w+\(/.test(s)) return "cpp";
  if (/\busing\s+namespace\s+std\b/.test(s)) return "cpp";
  if (/\bConsole\./.test(s) || /\busing\s+System/.test(s)) return "csharp";
  if (/\bdef\s+\w+\s*\(/.test(s) || /\bprint\(.+\)/.test(s)) return "python";
  if (/\bfunction\b|\bconst\b|\blet\b/.test(s) && /[{;)]\s*$/.test(s)) return "javascript";
  if (/\bclass\b\s+\w+\s*{/.test(s) && /public:|private:/.test(s)) return "cpp";
  return "cpp";
}
