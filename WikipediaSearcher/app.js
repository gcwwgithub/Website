const apiUrl = "https://en.wikipedia.org/w/api.php";
const state = {
  start: null,
  target: null,
  current: null,
  path: [],
  isLoading: false,
  startedAt: 0,
  timerId: 0,
  finishedAt: 0,
  filterMode: "filtered",
  hintsEnabled: false,
  searchMode: "random",
};

const elements = {
  menuOverlay: document.querySelector("#menuOverlay"),
  searchModeRadios: [...document.querySelectorAll("input[name='searchMode']")],
  randomSearchControls: document.querySelector("#randomSearchControls"),
  predefinedSearchControls: document.querySelector("#predefinedSearchControls"),
  startSearchButton: document.querySelector("#startSearchButton"),
  startCustomSearchButton: document.querySelector("#startCustomSearchButton"),
  randomStartButton: document.querySelector("#randomStartButton"),
  randomTargetButton: document.querySelector("#randomTargetButton"),
  customStartInput: document.querySelector("#customStartInput"),
  customTargetInput: document.querySelector("#customTargetInput"),
  pageFilterSelect: document.querySelector("#pageFilterSelect"),
  hintsToggle: document.querySelector("#hintsToggle"),
  hintIndicator: document.querySelector("#hintIndicator"),
  filterDescription: document.querySelector("#filterDescription"),
  newSearchButton: document.querySelector("#newSearchButton"),
  startTitle: document.querySelector("#startTitle"),
  targetTitle: document.querySelector("#targetTitle"),
  stepCount: document.querySelector("#stepCount"),
  timerValue: document.querySelector("#timerValue"),
  currentTitle: document.querySelector("#currentTitle"),
  articleContent: document.querySelector("#articleContent"),
  messagePanel: document.querySelector("#messagePanel"),
  completionOverlay: document.querySelector("#completionOverlay"),
  completionRoute: document.querySelector("#completionRoute"),
  completionTime: document.querySelector("#completionTime"),
  completionSteps: document.querySelector("#completionSteps"),
  completionNewSearchButton: document.querySelector("#completionNewSearchButton"),
  completionMenuButton: document.querySelector("#completionMenuButton"),
};

function wikiRequest(params) {
  const url = new URL(apiUrl);
  Object.entries({
    origin: "*",
    format: "json",
    formatversion: "2",
    ...params,
  }).forEach(([key, value]) => url.searchParams.set(key, value));

  return fetch(url).then((response) => {
    if (!response.ok) throw new Error("Wikipedia did not respond.");
    return response.json();
  });
}

async function loadRandomPair() {
  const first = await loadRandomPage();
  let second = await loadRandomPage();
  let attempts = 0;

  while (normalizeTitle(first.title) === normalizeTitle(second.title) && attempts < 8) {
    attempts++;
    second = await loadRandomPage();
  }

  return [first, second];
}

async function loadRandomPage() {
  const selected = [];
  let attempts = 0;

  while (!selected.length && attempts < 12) {
    attempts++;
    const data = await wikiRequest({
      action: "query",
      generator: "random",
      grnnamespace: "0",
      grnlimit: state.filterMode === "filtered" ? "20" : "1",
      prop: "info|categories",
      cllimit: "max",
      inprop: "url",
    });

    const pages = (data.query?.pages || []).filter((page) => page.title && page.pageid);
    const allowed = pages.filter(isAllowedRandomPage);
    selected.push(...allowed.slice(0, 1));
  }

  if (!selected.length) throw new Error("Could not get a matching article.");
  return selected[0];
}

async function loadArticlePage(title) {
  const data = await wikiRequest({
    action: "parse",
    page: title,
    prop: "text|displaytitle",
    redirects: "1",
    disableeditsection: "1",
    disabletoc: "1",
    mobileformat: "1",
  });

  if (!data.parse?.text) throw new Error("That article could not be opened.");

  return {
    pageid: data.parse.pageid,
    title: data.parse.title,
    displaytitle: data.parse.displaytitle,
    fullurl: `https://en.wikipedia.org/wiki/${encodeURIComponent(data.parse.title.replaceAll(" ", "_"))}`,
    html: data.parse.text,
  };
}

function setLoading(message) {
  state.isLoading = true;
  elements.articleContent.innerHTML = `<p>${escapeHtml(message)}</p>`;
  elements.messagePanel.innerHTML = "";
  elements.newSearchButton.disabled = true;
}

function clearLoading() {
  state.isLoading = false;
  elements.newSearchButton.disabled = false;
  elements.startSearchButton.disabled = false;
  elements.startCustomSearchButton.disabled = false;
  elements.randomStartButton.disabled = false;
  elements.randomTargetButton.disabled = false;
}

function normalizeTitle(title) {
  return String(title || "").replace(/_/g, " ").trim().toLowerCase();
}

function render() {
  elements.startTitle.textContent = state.start?.title || "Loading...";
  elements.targetTitle.textContent = state.target?.title || "Loading...";
  elements.currentTitle.textContent = state.current?.title || "Loading...";
  elements.stepCount.textContent = String(Math.max(0, state.path.length - 1));

  const arrived = state.current && state.target && normalizeTitle(state.current.title) === normalizeTitle(state.target.title);
  if (arrived) {
    showCompletion();
  }
  updateHintIndicator();
}

function renderArticle(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const output = doc.querySelector(".mw-parser-output") || doc.body;

  output.querySelectorAll("script, style, form, button, input, textarea, select, iframe").forEach((node) => node.remove());
  output.querySelectorAll(".mw-editsection, .reference, .reflist, .navbox, .metadata, .ambox, .printfooter").forEach((node) => node.remove());

  output.querySelectorAll("img, source").forEach((media) => {
    normalizeMediaAttribute(media, "src");
    normalizeMediaAttribute(media, "data-src");
    normalizeSrcset(media);
    media.loading = "lazy";
  });

  output.querySelectorAll("a").forEach((link) => {
    const title = getWikiTitleFromHref(link.getAttribute("href") || "");
    link.removeAttribute("onclick");
    link.removeAttribute("target");

    if (title && !link.classList.contains("new")) {
      link.href = "#";
      link.dataset.wikiTitle = title;
      link.title = `Open ${title}`;
    } else {
      const href = link.getAttribute("href") || "";
      if (href.startsWith("//")) link.href = `https:${href}`;
      else if (href.startsWith("/")) link.href = `https://en.wikipedia.org${href}`;
      link.rel = "noreferrer";
      link.target = "_blank";
    }
  });

  elements.articleContent.innerHTML = "";
  elements.articleContent.append(...Array.from(output.childNodes));
  updateHintIndicator();
  window.scrollTo({ top: 0 });
}

function normalizeMediaAttribute(element, attribute) {
  const value = element.getAttribute(attribute);
  if (!value) return;
  if (value.startsWith("//")) element.setAttribute(attribute, `https:${value}`);
  else if (value.startsWith("/")) element.setAttribute(attribute, `https://en.wikipedia.org${value}`);
}

function normalizeSrcset(element) {
  const value = element.getAttribute("srcset");
  if (!value) return;
  const normalized = value
    .split(",")
    .map((entry) => {
      const parts = entry.trim().split(/\s+/);
      const url = parts.shift() || "";
      const fixedUrl = url.startsWith("//") ? `https:${url}` : url.startsWith("/") ? `https://en.wikipedia.org${url}` : url;
      return [fixedUrl, ...parts].join(" ");
    })
    .join(", ");
  element.setAttribute("srcset", normalized);
}

function getWikiTitleFromHref(href) {
  if (!href || href.startsWith("#")) return "";
  let rawTitle = "";

  try {
    const url = new URL(href, "https://en.wikipedia.org");
    if (url.hostname !== "en.wikipedia.org" || !url.pathname.startsWith("/wiki/")) return "";
    if (url.search) return "";
    rawTitle = url.pathname.slice("/wiki/".length);
  } catch {
    return "";
  }

  const title = decodeURIComponent(rawTitle).replace(/_/g, " ").trim();
  if (!title || title.includes(":")) return "";
  return title;
}

function showError(message) {
  elements.messagePanel.innerHTML = "";
  const error = document.createElement("div");
  error.className = "error-message";
  error.textContent = message;
  elements.messagePanel.appendChild(error);
}

function isAllowedRandomPage(page) {
  if (state.filterMode === "all") return true;
  const title = page.title || "";
  const categories = page.categories || [];
  const categoryText = categories.map((category) => category.title || "").join(" ").toLowerCase();

  if (!title || title.includes(":")) return false;
  if (/[\u0080-\uFFFF]/.test(title)) return false;
  if (/\b(disambiguation|list of|index of|outline of|glossary of|timeline of)\b/i.test(title)) return false;
  if (/\((film|song|album|novel|book|tv series|television series|episode|software|soundtrack|play|musical|opera|band|comics?)\)$/i.test(title)) return false;
  if (/\b(disambiguation|lists|indexes|redirects|given names|surnames)\b/.test(categoryText)) return false;

  const plainTitle = title.toLowerCase().replace(/\([^)]*\)/g, "").replace(/[^a-z\s'-]/g, " ");
  const words = plainTitle.split(/\s+/).filter(Boolean);
  if (words.length === 1 && words[0].length < 5) return false;
  if (words.some((word) => word.length > 18)) return false;

  return true;
}

async function openPage(page) {
  state.current = null;
  setLoading(`Opening ${page.title}...`);
  updateHintIndicator();
  try {
    const article = await loadArticlePage(page.title);
    state.current = article;
    state.path.push(article);
    renderArticle(article.html);
    clearLoading();
    render();
  } catch (error) {
    clearLoading();
    render();
    showError(error.message || "Could not open that article.");
  }
}

async function goToArticle(title) {
  if (state.isLoading) return;
  await openPage({ title });
}

async function startNewSearch() {
  state.filterMode = elements.pageFilterSelect.value;
  state.hintsEnabled = elements.hintsToggle.checked;
  elements.menuOverlay.hidden = true;
  elements.completionOverlay.hidden = true;
  document.body.classList.remove("has-overlay");
  elements.startSearchButton.disabled = true;
  setLoading("Finding a start and destination...");
  try {
    stopTimer();
    state.startedAt = 0;
    state.finishedAt = 0;
    updateTimer();
    const [start, target] = await loadRandomPair();
    state.start = start;
    state.target = target;
    state.current = null;
    state.path = [];
    startTimer();
    await openPage(start);
  } catch (error) {
    clearLoading();
    render();
    showError(error.message || "Could not start a new search.");
    elements.menuOverlay.hidden = false;
  }
}

async function startSelectedSearch() {
  const startTitle = elements.customStartInput.value.trim();
  const targetTitle = elements.customTargetInput.value.trim();

  if (!startTitle || !targetTitle) {
    showError("Type or randomize both a start page and a destination page.");
    return;
  }

  state.filterMode = elements.pageFilterSelect.value;
  state.hintsEnabled = elements.hintsToggle.checked;
  elements.menuOverlay.hidden = true;
  elements.completionOverlay.hidden = true;
  document.body.classList.remove("has-overlay");
  elements.startCustomSearchButton.disabled = true;
  setLoading("Opening selected pages...");

  try {
    stopTimer();
    state.startedAt = 0;
    state.finishedAt = 0;
    updateTimer();

    const [start, target] = await Promise.all([
      loadArticlePage(startTitle),
      loadArticlePage(targetTitle),
    ]);

    if (normalizeTitle(start.title) === normalizeTitle(target.title)) {
      throw new Error("Start and destination must be different pages.");
    }

    state.start = { pageid: start.pageid, title: start.title };
    state.target = { pageid: target.pageid, title: target.title };
    state.current = null;
    state.path = [];
    startTimer();
    await openPage(state.start);
  } catch (error) {
    clearLoading();
    render();
    showError(error.message || "Could not start with those pages.");
    elements.menuOverlay.hidden = false;
  }
}

async function randomizeCustomInput(input) {
  state.filterMode = elements.pageFilterSelect.value;
  elements.randomStartButton.disabled = true;
  elements.randomTargetButton.disabled = true;
  elements.startCustomSearchButton.disabled = true;
  try {
    const page = await loadRandomPage();
    input.value = page.title;
  } catch (error) {
    showError(error.message || "Could not randomize that page.");
  } finally {
    elements.randomStartButton.disabled = false;
    elements.randomTargetButton.disabled = false;
    elements.startCustomSearchButton.disabled = false;
  }
}

function updateSearchModeControls() {
  const selectedMode = elements.searchModeRadios.find((radio) => radio.checked)?.value || "random";
  state.searchMode = selectedMode;
  elements.randomSearchControls.hidden = selectedMode !== "random";
  elements.predefinedSearchControls.hidden = selectedMode !== "predefined";
}

function showMenu() {
  stopTimer();
  state.startedAt = 0;
  state.finishedAt = 0;
  state.isLoading = false;
  state.path = [];
  state.current = null;
  state.start = null;
  state.target = null;
  state.hintsEnabled = elements.hintsToggle.checked;
  elements.menuOverlay.hidden = false;
  elements.completionOverlay.hidden = true;
  document.body.classList.add("has-overlay");
  elements.startSearchButton.disabled = false;
  elements.startCustomSearchButton.disabled = false;
  elements.randomStartButton.disabled = false;
  elements.randomTargetButton.disabled = false;
  elements.newSearchButton.disabled = true;
  updateSearchModeControls();
  elements.currentTitle.textContent = "Wikipedia Searcher";
  elements.startTitle.textContent = "Not started";
  elements.targetTitle.textContent = "Not started";
  elements.stepCount.textContent = "0";
  elements.articleContent.innerHTML = "<p>Choose options from the menu to begin.</p>";
  elements.messagePanel.innerHTML = "";
  updateTimer();
  updateHintIndicator();
}

function showCompletion() {
  if (!elements.completionOverlay.hidden) return;
  stopTimer();
  elements.completionRoute.textContent = `${state.start.title} => ${state.target.title}`;
  elements.completionTime.textContent = elements.timerValue.textContent;
  elements.completionSteps.textContent = String(Math.max(0, state.path.length - 1));
  elements.completionOverlay.hidden = false;
  document.body.classList.add("has-overlay");
  elements.newSearchButton.disabled = true;
}

function updateHintIndicator() {
  elements.hintIndicator.classList.remove("is-disabled", "is-present", "is-absent");

  if (!state.hintsEnabled) {
    elements.hintIndicator.classList.add("is-disabled");
    elements.hintIndicator.textContent = "Hints Disabled";
    return;
  }

  if (!state.target || !state.current) {
    elements.hintIndicator.classList.add("is-disabled");
    elements.hintIndicator.textContent = "Hints Waiting";
    return;
  }

  const targetTitle = normalizeTitle(state.target.title);
  const targetIsOnPage = [...elements.articleContent.querySelectorAll("a[data-wiki-title]")]
    .some((link) => normalizeTitle(link.dataset.wikiTitle) === targetTitle);

  elements.hintIndicator.classList.add(targetIsOnPage ? "is-present" : "is-absent");
  elements.hintIndicator.textContent = targetIsOnPage ? "End Link On Page" : "End Link Not On Page";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function startTimer() {
  state.startedAt = Date.now();
  state.finishedAt = 0;
  updateTimer();
  state.timerId = window.setInterval(updateTimer, 1000);
}

function stopTimer() {
  if (state.timerId) {
    window.clearInterval(state.timerId);
    state.timerId = 0;
  }
  if (state.startedAt && !state.finishedAt) state.finishedAt = Date.now();
  updateTimer();
}

function updateTimer() {
  const end = state.finishedAt || Date.now();
  const seconds = state.startedAt ? Math.max(0, Math.floor((end - state.startedAt) / 1000)) : 0;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  elements.timerValue.textContent = `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

elements.articleContent.addEventListener("click", (event) => {
  const link = event.target.closest("a[data-wiki-title]");
  if (!link) return;
  event.preventDefault();
  goToArticle(link.dataset.wikiTitle);
});

elements.startSearchButton.addEventListener("click", startNewSearch);
elements.startCustomSearchButton.addEventListener("click", startSelectedSearch);
elements.randomStartButton.addEventListener("click", () => randomizeCustomInput(elements.customStartInput));
elements.randomTargetButton.addEventListener("click", () => randomizeCustomInput(elements.customTargetInput));
elements.searchModeRadios.forEach((radio) => {
  radio.addEventListener("change", updateSearchModeControls);
});
elements.newSearchButton.addEventListener("click", startNewSearch);
elements.completionNewSearchButton.addEventListener("click", startNewSearch);
elements.completionMenuButton.addEventListener("click", showMenu);
elements.pageFilterSelect.addEventListener("change", () => {
  elements.filterDescription.textContent = elements.pageFilterSelect.value === "all"
    ? "Random start and destination can be any main-namespace Wikipedia article."
    : "Filters out disambiguation pages, list pages, media-title pages, and titles that look like non-English terms.";
});
showMenu();
