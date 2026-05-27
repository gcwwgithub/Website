const characterSets = {
  hiragana: [
    ["あ", ["a"]], ["い", ["i"]], ["う", ["u"]], ["え", ["e"]], ["お", ["o"]],
    ["か", ["ka"]], ["き", ["ki"]], ["く", ["ku"]], ["け", ["ke"]], ["こ", ["ko"]],
    ["さ", ["sa"]], ["し", ["shi", "si"]], ["す", ["su"]], ["せ", ["se"]], ["そ", ["so"]],
    ["た", ["ta"]], ["ち", ["chi", "ti"]], ["つ", ["tsu", "tu"]], ["て", ["te"]], ["と", ["to"]],
    ["な", ["na"]], ["に", ["ni"]], ["ぬ", ["nu"]], ["ね", ["ne"]], ["の", ["no"]],
    ["は", ["ha"]], ["ひ", ["hi"]], ["ふ", ["fu", "hu"]], ["へ", ["he"]], ["ほ", ["ho"]],
    ["ま", ["ma"]], ["み", ["mi"]], ["む", ["mu"]], ["め", ["me"]], ["も", ["mo"]],
    ["や", ["ya"]], ["ゆ", ["yu"]], ["よ", ["yo"]],
    ["ら", ["ra"]], ["り", ["ri"]], ["る", ["ru"]], ["れ", ["re"]], ["ろ", ["ro"]],
    ["わ", ["wa"]], ["を", ["wo", "o"]], ["ん", ["n"]]
  ],
  katakana: [
    ["ア", ["a"]], ["イ", ["i"]], ["ウ", ["u"]], ["エ", ["e"]], ["オ", ["o"]],
    ["カ", ["ka"]], ["キ", ["ki"]], ["ク", ["ku"]], ["ケ", ["ke"]], ["コ", ["ko"]],
    ["サ", ["sa"]], ["シ", ["shi", "si"]], ["ス", ["su"]], ["セ", ["se"]], ["ソ", ["so"]],
    ["タ", ["ta"]], ["チ", ["chi", "ti"]], ["ツ", ["tsu", "tu"]], ["テ", ["te"]], ["ト", ["to"]],
    ["ナ", ["na"]], ["ニ", ["ni"]], ["ヌ", ["nu"]], ["ネ", ["ne"]], ["ノ", ["no"]],
    ["ハ", ["ha"]], ["ヒ", ["hi"]], ["フ", ["fu", "hu"]], ["ヘ", ["he"]], ["ホ", ["ho"]],
    ["マ", ["ma"]], ["ミ", ["mi"]], ["ム", ["mu"]], ["メ", ["me"]], ["モ", ["mo"]],
    ["ヤ", ["ya"]], ["ユ", ["yu"]], ["ヨ", ["yo"]],
    ["ラ", ["ra"]], ["リ", ["ri"]], ["ル", ["ru"]], ["レ", ["re"]], ["ロ", ["ro"]],
    ["ワ", ["wa"]], ["ヲ", ["wo", "o"]], ["ン", ["n"]]
  ],
  kanji: [
    ["日", ["hi", "nichi", "jitsu"]], ["月", ["tsuki", "getsu", "gatsu"]],
    ["火", ["hi", "ka"]], ["水", ["mizu", "sui"]],
    ["木", ["ki", "moku", "boku"]], ["金", ["kane", "kin", "kon"]],
    ["土", ["tsuchi", "do", "to"]], ["人", ["hito", "jin", "nin"]],
    ["山", ["yama", "san"]], ["川", ["kawa", "gawa", "sen"]],
    ["田", ["ta", "da"]], ["口", ["kuchi", "kou", "ku"]],
    ["目", ["me", "moku"]], ["耳", ["mimi", "ji"]],
    ["手", ["te", "shu"]], ["足", ["ashi", "soku"]],
    ["大", ["oo", "dai", "tai"]], ["小", ["ko", "shou"]],
    ["中", ["naka", "chuu", "juu"]], ["上", ["ue", "jou", "kami"]],
    ["下", ["shita", "ka", "ge"]], ["左", ["hidari", "sa"]],
    ["右", ["migi", "u", "yuu"]], ["学", ["gaku", "mana"]],
    ["生", ["sei", "shou", "nama", "i"]], ["先", ["saki", "sen"]],
    ["一", ["ichi", "hito"]], ["二", ["ni", "futa"]],
    ["三", ["san", "mi"]], ["四", ["shi", "yon", "yo"]],
    ["五", ["go", "itsu"]], ["六", ["roku", "mu"]],
    ["七", ["shichi", "nana"]], ["八", ["hachi", "ya"]],
    ["九", ["kyuu", "ku", "kokono"]], ["十", ["juu", "tou"]],
    ["百", ["hyaku"]], ["千", ["sen", "chi"]],
    ["万", ["man", "ban"]], ["円", ["en"]],
    ["年", ["nen", "toshi"]], ["時", ["ji", "toki"]],
    ["分", ["fun", "bun", "pun", "wa"]], ["今", ["ima", "kon"]],
    ["何", ["nani", "nan", "ka"]], ["本", ["hon", "moto"]],
    ["名", ["na", "mei", "myou"]], ["子", ["ko", "shi", "su"]],
    ["女", ["onna", "jo", "nyo"]], ["男", ["otoko", "dan", "nan"]],
    ["父", ["chichi", "fu"]], ["母", ["haha", "bo"]],
    ["友", ["tomo", "yuu"]], ["私", ["watashi", "shi"]],
    ["語", ["go", "kata"]], ["国", ["kuni", "koku"]],
    ["車", ["kuruma", "sha"]], ["電", ["den"]],
    ["雨", ["ame", "u"]], ["天", ["ten", "ama"]],
    ["気", ["ki", "ke"]], ["空", ["sora", "kuu"]],
    ["花", ["hana", "ka"]], ["草", ["kusa", "sou"]],
    ["虫", ["mushi", "chuu"]], ["犬", ["inu", "ken"]],
    ["魚", ["sakana", "gyo"]], ["食", ["ta", "shoku", "jiki"]],
    ["飲", ["no", "in"]], ["見", ["mi", "ken"]],
    ["聞", ["ki", "bun", "mon"]], ["話", ["hana", "wa"]],
    ["読", ["yo", "doku"]], ["書", ["ka", "sho"]],
    ["行", ["i", "kou", "gyou"]], ["来", ["ku", "rai"]],
    ["帰", ["kae", "ki"]], ["入", ["hai", "nyuu", "i"]],
    ["出", ["de", "shutsu", "da"]], ["立", ["ta", "ritsu"]],
    ["休", ["yasu", "kyuu"]], ["買", ["ka", "bai"]],
    ["売", ["u", "bai"]], ["新", ["atara", "shin"]],
    ["古", ["furu", "ko"]], ["高", ["taka", "kou"]],
    ["安", ["yasu", "an"]], ["長", ["naga", "chou"]],
    ["白", ["shiro", "haku"]], ["黒", ["kuro", "koku"]],
    ["赤", ["aka", "seki"]], ["青", ["ao", "sei", "shou"]]
  ]
};

const labels = {
  mixed: "Mixed",
  hiragana: "Hiragana",
  katakana: "Katakana",
  kanji: "Kanji"
};

const hints = {
  hiragana: "Type the romanized sound.",
  katakana: "Type the romanized sound.",
  kanji: "Type a common romanized reading.",
  mixed: "Select the form and type the romanized sound or reading."
};

const state = {
  mode: "mixed",
  questionLimit: 20,
  current: null,
  questionIndex: 0,
  correct: 0,
  wrong: 0,
  skipped: 0,
  history: [],
  lastCharacter: null,
  locked: false
};

const menuPanel = document.querySelector("#menuPanel");
const gamePanel = document.querySelector("#gamePanel");
const resultsPanel = document.querySelector("#resultsPanel");
const homeLink = document.querySelector("#homeLink");
const setupForm = document.querySelector("#setupForm");
const questionCount = document.querySelector("#questionCount");
const quizTitle = document.querySelector("#quizTitle");
const formChoicePanel = document.querySelector("#formChoicePanel");
const characterPrompt = document.querySelector("#characterPrompt");
const promptHint = document.querySelector("#promptHint");
const answerForm = document.querySelector("#answerForm");
const answerInput = document.querySelector("#answerInput");
const feedback = document.querySelector("#feedback");
const hintButton = document.querySelector("#hintButton");
const skipButton = document.querySelector("#skipButton");
const progressText = document.querySelector("#progressText");
const scoreText = document.querySelector("#scoreText");
const finalScore = document.querySelector("#finalScore");
const finalCorrect = document.querySelector("#finalCorrect");
const finalWrong = document.querySelector("#finalWrong");
const finalSkipped = document.querySelector("#finalSkipped");
const correctList = document.querySelector("#correctList");
const wrongList = document.querySelector("#wrongList");
const skippedList = document.querySelector("#skippedList");
const playAgainButton = document.querySelector("#playAgainButton");
let advanceTimer = null;

function normalizeAnswer(value) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function setScreen(screen) {
  menuPanel.classList.toggle("hidden", screen !== "menu");
  gamePanel.classList.toggle("hidden", screen !== "game");
  resultsPanel.classList.toggle("hidden", screen !== "results");
  document.body.dataset.screen = screen;
  homeLink.textContent = screen === "menu" ? "WebPlayground" : "Home";
}

function getPool() {
  if (state.mode === "mixed") {
    return Object.entries(characterSets).flatMap(([type, items]) =>
      items.map(([character, answers]) => ({ type, character, answers }))
    );
  }

  return characterSets[state.mode].map(([character, answers]) => ({
    type: state.mode,
    character,
    answers
  }));
}

function answerLabel(item) {
  return item.answers.join(", ");
}

function answerSummary(item) {
  return state.mode === "mixed" ? `${labels[item.type]}: ${answerLabel(item)}` : answerLabel(item);
}

function updateStats() {
  progressText.textContent = `Question ${Math.min(state.questionIndex + 1, state.questionLimit)} / ${state.questionLimit}`;
  scoreText.textContent = `${state.correct} correct`;
}

function setFeedback(message, tone = "neutral") {
  feedback.textContent = message;
  feedback.className = `feedback ${tone}`;
}

function pickCharacter() {
  if (state.questionIndex >= state.questionLimit) {
    finishGame();
    return;
  }

  const pool = getPool();
  let next = pool[Math.floor(Math.random() * pool.length)];

  if (pool.length > 1) {
    while (next.character === state.lastCharacter) {
      next = pool[Math.floor(Math.random() * pool.length)];
    }
  }

  state.current = next;
  state.lastCharacter = next.character;
  characterPrompt.textContent = next.character;
  promptHint.textContent = hints[state.mode];
  answerInput.value = "";
  updateStats();
  window.setTimeout(() => answerInput.focus(), 0);
}

function recordResult(status, submittedAnswer = "", selectedType = "") {
  state.history.push({
    status,
    character: state.current.character,
    type: state.current.type,
    selectedType,
    submittedAnswer,
    acceptedAnswer: answerLabel(state.current)
  });

  if (status === "correct") {
    state.correct += 1;
  } else if (status === "wrong") {
    state.wrong += 1;
  } else {
    state.skipped += 1;
  }

  state.questionIndex += 1;
  updateStats();
}

function startGame(event) {
  event.preventDefault();
  window.clearTimeout(advanceTimer);

  const formData = new FormData(setupForm);
  const parsedCount = Number.parseInt(questionCount.value, 10);
  state.mode = formData.get("mode") || "mixed";
  state.questionLimit = Number.isFinite(parsedCount)
    ? Math.min(100, Math.max(5, parsedCount))
    : 20;
  state.current = null;
  state.questionIndex = 0;
  state.correct = 0;
  state.wrong = 0;
  state.skipped = 0;
  state.history = [];
  state.lastCharacter = null;
  state.locked = false;

  questionCount.value = state.questionLimit;
  quizTitle.textContent = labels[state.mode];
  formChoicePanel.classList.toggle("hidden", state.mode !== "mixed");
  setFeedback("Ready.", "neutral");
  setScreen("game");
  pickCharacter();
}

function checkAnswer(event) {
  event.preventDefault();

  if (state.locked) {
    return;
  }

  const submitted = normalizeAnswer(answerInput.value);
  if (!submitted) {
    setFeedback("Type an answer first, or skip this one.", "incorrect");
    answerInput.focus();
    return;
  }

  const acceptedAnswers = state.current.answers.map(normalizeAnswer);
  const selectedType = state.mode === "mixed" ? new FormData(answerForm).get("formChoice") : "";
  const answerIsCorrect = acceptedAnswers.includes(submitted);
  const typeIsCorrect = state.mode !== "mixed" || selectedType === state.current.type;
  const isCorrect = answerIsCorrect && typeIsCorrect;
  state.locked = true;
  recordResult(isCorrect ? "correct" : "wrong", submitted, selectedType);

  if (isCorrect) {
    setFeedback(`Correct. ${state.current.character} = ${answerSummary(state.current)}.`, "correct");
  } else if (state.mode === "mixed" && !typeIsCorrect && answerIsCorrect) {
    setFeedback(`Wrong form. ${state.current.character} = ${answerSummary(state.current)}.`, "incorrect");
  } else {
    setFeedback(`Wrong. ${state.current.character} = ${answerSummary(state.current)}.`, "incorrect");
  }

  advanceTimer = window.setTimeout(() => {
    state.locked = false;
    pickCharacter();
  }, 650);
}

function skipQuestion() {
  if (state.locked) {
    return;
  }

  state.locked = true;
  recordResult("skipped", "", "");
  setFeedback(`Skipped. ${state.current.character} = ${answerSummary(state.current)}.`, "incorrect");
  advanceTimer = window.setTimeout(() => {
    state.locked = false;
    pickCharacter();
  }, 350);
}

function renderResultList(container, items, emptyText) {
  container.innerHTML = "";

  if (items.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-result";
    empty.textContent = emptyText;
    container.append(empty);
    return;
  }

  items.forEach((item) => {
    const row = document.createElement("article");
    row.className = "result-item";
    const submitted = item.submittedAnswer ? `Your answer: ${item.submittedAnswer}` : "No answer";
    const selectedType = item.selectedType ? `<p>Selected: ${labels[item.selectedType]}</p>` : "";
    const accepted = item.selectedType
      ? `Accepted: ${labels[item.type]} - ${item.acceptedAnswer}`
      : `Accepted: ${item.acceptedAnswer}`;
    row.innerHTML = `
      <span class="result-character">${item.character}</span>
      <div>
        ${item.selectedType ? `<strong>${labels[item.type]}</strong>` : ""}
        ${selectedType}
        <p>${submitted}</p>
        <p>${accepted}</p>
      </div>
    `;
    container.append(row);
  });
}

function finishGame() {
  window.clearTimeout(advanceTimer);
  state.locked = false;
  const answered = state.correct + state.wrong + state.skipped;
  progressText.textContent = "Finished";
  scoreText.textContent = `${state.correct} correct`;
  finalScore.textContent = `${state.correct}/${answered}`;
  finalCorrect.textContent = state.correct;
  finalWrong.textContent = state.wrong;
  finalSkipped.textContent = state.skipped;

  renderResultList(correctList, state.history.filter((item) => item.status === "correct"), "No correct answers yet.");
  renderResultList(wrongList, state.history.filter((item) => item.status === "wrong"), "No wrong answers.");
  renderResultList(skippedList, state.history.filter((item) => item.status === "skipped"), "No skipped questions.");
  setScreen("results");
}

setupForm.addEventListener("submit", startGame);
answerForm.addEventListener("submit", checkAnswer);
skipButton.addEventListener("click", skipQuestion);
homeLink.addEventListener("click", (event) => {
  if (document.body.dataset.screen === "menu") {
    return;
  }

  event.preventDefault();
  window.clearTimeout(advanceTimer);
  state.locked = false;
  progressText.textContent = "Question 1 / 20";
  scoreText.textContent = "0 correct";
  setScreen("menu");
});
hintButton.addEventListener("click", () => {
  const answer = state.current.answers[0];
  const hint = answer.length <= 2 ? answer[0] : `${answer[0]}${".".repeat(answer.length - 1)}`;
  setFeedback(`Hint: ${hint}`, "neutral");
  answerInput.focus();
});
playAgainButton.addEventListener("click", () => {
  window.clearTimeout(advanceTimer);
  state.locked = false;
  progressText.textContent = "Question 1 / 20";
  scoreText.textContent = "0 correct";
  setScreen("menu");
});

setScreen("menu");
