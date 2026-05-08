let selectedVoiceName = null;
let ttsCanceled = false;
let pauseMs = 80;
let runId = 0;

const defaultSettings = { rate: 1, pitch: 1, volume: 1, pauseMs: 80 };
const preferredVoicePatterns = [/Xiaoxiao/i, /Huihui/i, /Chinese|Mandarin/i];

// Stored with unicode escapes so the file cannot get encoding-corrupted.
const pinyinMap = {
    "\u4f60": "ni3", "\u597d": "hao3", "\u6211": "wo3", "\u4eec": "men5", "\u4ed6": "ta1", "\u5979": "ta1",
    "\u662f": "shi4", "\u4e0d": "bu4", "\u4e86": "le5", "\u5728": "zai4", "\u6709": "you3", "\u548c": "he2",
    "\u4e5f": "ye3", "\u90fd": "dou1", "\u5f88": "hen3", "\u5c31": "jiu4", "\u8981": "yao4", "\u4f1a": "hui4",
    "\u80fd": "neng2", "\u53ef": "ke3", "\u4ee5": "yi3", "\u8fd9": "zhe4", "\u90a3": "na4", "\u54ea": "na3",
    "\u8c01": "shei2", "\u4ec0": "shen2", "\u4e48": "me5", "\u5417": "ma5", "\u5462": "ne5", "\u5427": "ba5",
    "\u7684": "de5", "\u5f97": "de5", "\u5730": "de5", "\u4e00": "yi1", "\u4e8c": "er4", "\u4e09": "san1",
    "\u56db": "si4", "\u4e94": "wu3", "\u516d": "liu4", "\u4e03": "qi1", "\u516b": "ba1", "\u4e5d": "jiu3",
    "\u5341": "shi2", "\u4eba": "ren2", "\u5927": "da4", "\u5c0f": "xiao3", "\u4e2d": "zhong1", "\u56fd": "guo2",
    "\u5b66": "xue2", "\u751f": "sheng1", "\u8001": "lao3", "\u5e08": "shi1", "\u670b": "peng2", "\u53cb": "you3",
    "\u5bb6": "jia1", "\u7238": "ba4", "\u5988": "ma1", "\u5403": "chi1", "\u559d": "he1", "\u770b": "kan4",
    "\u542c": "ting1", "\u8bf4": "shuo1", "\u8bfb": "du2", "\u5199": "xie3", "\u53bb": "qu4", "\u6765": "lai2",
    "\u56de": "hui2", "\u4e70": "mai3", "\u5356": "mai4", "\u505a": "zuo4", "\u7ed9": "gei3", "\u60f3": "xiang3",
    "\u559c": "xi3", "\u6b22": "huan1", "\u7231": "ai4", "\u77e5": "zhi1", "\u9053": "dao4", "\u660e": "ming2",
    "\u767d": "bai2", "\u89c9": "jue2", "\u4eca": "jin1", "\u5929": "tian1", "\u6628": "zuo2", "\u665a": "wan3",
    "\u65e9": "zao3", "\u4e0a": "shang4", "\u4e0b": "xia4", "\u5348": "wu3", "\u5e74": "nian2", "\u6708": "yue4",
    "\u65e5": "ri4", "\u65f6": "shi2", "\u5019": "hou5", "\u70b9": "dian3", "\u5206": "fen1", "\u949f": "zhong1",
    "\u4e66": "shu1", "\u6c34": "shui3", "\u8336": "cha2", "\u996d": "fan4", "\u83dc": "cai4", "\u94b1": "qian2",
    "\u8f66": "che1", "\u5e97": "dian4", "\u6821": "xiao4", "\u623f": "fang2", "\u95f4": "jian1", "\u8def": "lu4",
    "\u5de5": "gong1", "\u4f5c": "zuo4", "\u7535": "dian4", "\u8bdd": "hua4", "\u8111": "nao3", "\u5f71": "ying3",
    "\u73b0": "xian4", "\u7136": "ran2", "\u540e": "hou4", "\u56e0": "yin1", "\u4e3a": "wei4", "\u4f46": "dan4",
    "\u8fd8": "hai2", "\u53ea": "zhi3", "\u518d": "zai4", "\u5df2": "yi3", "\u7ecf": "jing1", "\u6b63": "zheng4",
    "\u522b": "bie2", "\u628a": "ba3", "\u88ab": "bei4", "\u8ba9": "rang4"
};

async function ensureVoicesReady() {
    if (speechSynthesis.getVoices().length) return;
    await new Promise((resolve) => {
        let done = false;
        const finish = () => {
            if (!done) {
                done = true;
                resolve();
            }
        };
        speechSynthesis.onvoiceschanged = () => {
            speechSynthesis.onvoiceschanged = null;
            finish();
        };
        const started = Date.now();
        const poll = () => {
            if (speechSynthesis.getVoices().length || Date.now() - started > 3000) finish();
            else setTimeout(poll, 100);
        };
        poll();
    });
}

function pickVoice() {
    const voices = speechSynthesis.getVoices();
    const selected = voices.find((voice) => voice.name === selectedVoiceName);
    if (selected) return selected;
    for (const pattern of preferredVoicePatterns) {
        const match = voices.find((voice) => pattern.test(`${voice.name} ${voice.lang}`));
        if (match) return match;
    }
    return voices.find((voice) => /^zh/i.test(voice.lang)) || voices[0] || null;
}

function isCjk(character) {
    const cp = character.codePointAt(0);
    return cp >= 0x3400 && cp <= 0x9FFF;
}

function tokenize(text) {
    const tokens = [];
    let index = 0;
    let cleanIndex = 0;
    const push = (text, className = "tok") => {
        tokens.push({ start: cleanIndex, end: cleanIndex + text.length, text, className });
        cleanIndex += text.length;
    };

    while (index < text.length) {
        const character = text[index];
        if (/\s/.test(character)) {
            let end = index;
            while (end < text.length && /\s/.test(text[end])) end++;
            push(text.slice(index, end), "tok space");
            index = end;
        } else if (/[A-Za-z0-9']/i.test(character)) {
            let end = index;
            while (end < text.length && /[A-Za-z0-9']/i.test(text[end])) end++;
            push(text.slice(index, end));
            index = end;
        } else if (isCjk(character)) {
            push(character, "tok cjk");
            index++;
        } else {
            push(character, "tok punctuation");
            index++;
        }
    }
    return tokens;
}

function renderReadPane(text) {
    const pane = document.getElementById("readPane");
    if (!pane) return null;
    const tokens = tokenize(text);
    const fragment = document.createDocumentFragment();
    const nodes = tokens.map((token, index) => {
        const span = document.createElement("span");
        span.className = token.className;
        span.dataset.index = String(index);
        span.textContent = token.text;
        fragment.appendChild(span);
        return span;
    });
    pane.innerHTML = "";
    pane.appendChild(fragment);
    return { tokens, nodes, lastToken: -1 };
}

function clearHighlight(map) {
    if (!map || map.lastToken < 0) return;
    map.nodes[map.lastToken].classList.remove("current");
    map.lastToken = -1;
}

function highlightToken(map, tokenIndex) {
    if (!map || tokenIndex < 0 || tokenIndex >= map.nodes.length || map.lastToken === tokenIndex) return;
    clearHighlight(map);
    map.nodes[tokenIndex].classList.add("current");
    map.lastToken = tokenIndex;
    map.nodes[tokenIndex].scrollIntoView({ block: "nearest", inline: "nearest" });
    updatePinyin(map.tokens[tokenIndex].text);
}

function splitIntoSpeechSegments(text) {
    const segments = [];
    let start = 0;
    let current = "";
    for (let index = 0; index < text.length; index++) {
        const character = text[index];
        current += character;
        if (/[\uFF0C,\uFF1B;]/.test(character)) {
            segments.push({ text: current, start, pauseAfter: pauseMs });
            start = index + 1;
            current = "";
        }
    }
    if (current) segments.push({ text: current, start, pauseAfter: 0 });
    return segments.filter((segment) => segment.text.trim());
}

function estimateTokenDuration(token, rate) {
    if (token.className.includes("cjk")) return Math.max(90, 210 / rate);
    if (token.className.includes("punctuation")) return 70;
    return Math.max(120, Math.min(420, (token.text.length * 55) / rate));
}

async function highlightSegment(segment, map, rate, control) {
    if (!map) return;
    const segmentEnd = segment.start + segment.text.length;
    const tokens = map.tokens
        .map((token, index) => ({ ...token, index }))
        .filter((token) =>
            token.end > segment.start &&
            token.start < segmentEnd &&
            !token.className.includes("space") &&
            !token.className.includes("punctuation")
        );

    for (const token of tokens) {
        if (control.stopped || ttsCanceled) return;
        highlightToken(map, token.index);
        await wait(estimateTokenDuration(token, rate));
    }
}

function normalizeSpeechOptions(options) {
    return {
        rate: clampNumber(options.rate, 0.1, 10, defaultSettings.rate),
        pitch: clampNumber(options.pitch, 0, 2, defaultSettings.pitch),
        volume: clampNumber(options.volume, 0, 1, defaultSettings.volume),
    };
}

function clampNumber(value, min, max, fallback) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
}

async function speakMixed(text, options = {}) {
    if (!text.trim()) return;
    await ensureVoicesReady();
    speechSynthesis.cancel();
    ttsCanceled = false;
    const currentRun = ++runId;
    const speechOptions = normalizeSpeechOptions(options);
    const highlightEnabled = document.getElementById("hlToggle")?.checked;
    const map = highlightEnabled ? renderReadPane(text) : null;
    if (!highlightEnabled) document.getElementById("readPane").innerHTML = "";

    for (const segment of splitIntoSpeechSegments(text)) {
        if (ttsCanceled || currentRun !== runId) break;
        const control = { stopped: false };
        const highlightPromise = highlightSegment(segment, map, speechOptions.rate, control);
        await speakSegment(segment.text, speechOptions);
        control.stopped = true;
        await highlightPromise;
        if (segment.pauseAfter > 0 && !ttsCanceled && currentRun === runId) await wait(segment.pauseAfter);
    }

    clearHighlight(map);
    updatePinyin("");
}

function speakSegment(text, speechOptions) {
    return new Promise((resolve) => {
        const utterance = new SpeechSynthesisUtterance(text);
        const voice = pickVoice();
        if (voice) {
            selectedVoiceName = voice.name;
            utterance.voice = voice;
            utterance.lang = voice.lang;
        }
        utterance.rate = speechOptions.rate;
        utterance.pitch = speechOptions.pitch;
        utterance.volume = speechOptions.volume;
        utterance.onend = resolve;
        utterance.onerror = (event) => {
            console.error("Speech synthesis error:", event.error || event);
            resolve();
        };
        speechSynthesis.speak(utterance);
    });
}

function updatePinyin(text) {
    const output = document.getElementById("currentPinyin");
    if (!output) return;
    const cjkCharacters = [...text].filter(isCjk);
    const known = cjkCharacters
        .map((character) => pinyinMap[character] ? `${character} ${pinyinMap[character]}` : character)
        .join("  ");
    output.textContent = known || "-";
}

function wait(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function setupVoiceSelect(selectElement) {
    const voices = speechSynthesis.getVoices();
    selectElement.innerHTML = "";
    voices.forEach((voice) => {
        const option = document.createElement("option");
        option.value = voice.name;
        option.textContent = `${voice.name} - (${voice.lang})`;
        selectElement.appendChild(option);
    });
    const defaultVoice = pickVoice();
    if (defaultVoice) {
        selectedVoiceName = defaultVoice.name;
        selectElement.value = defaultVoice.name;
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    const textInput = document.getElementById("txt");
    const rate = document.getElementById("rate");
    const pitch = document.getElementById("pitch");
    const volume = document.getElementById("volume");
    const pauseSlider = document.getElementById("sentenceDelay");
    const voiceSelect = document.getElementById("voiceSelect");

    const syncRate = () => document.getElementById("rateVal").textContent = `${Number(rate.value).toFixed(2)}x`;
    const syncPitch = () => document.getElementById("pitchVal").textContent = `${Number(pitch.value).toFixed(2)}x`;
    const syncVolume = () => document.getElementById("volumeVal").textContent = `${Math.round(Number(volume.value) * 100)}%`;
    const syncPause = () => {
        pauseMs = Number(pauseSlider.value);
        document.getElementById("pauseVal").textContent = `${pauseMs} ms`;
    };
    const syncAll = () => {
        syncRate();
        syncPitch();
        syncVolume();
        syncPause();
    };

    syncAll();
    rate.addEventListener("input", syncRate);
    pitch.addEventListener("input", syncPitch);
    volume.addEventListener("input", syncVolume);
    pauseSlider.addEventListener("input", syncPause);

    document.getElementById("resetSettingsBtn").addEventListener("click", () => {
        rate.value = String(defaultSettings.rate);
        pitch.value = String(defaultSettings.pitch);
        volume.value = String(defaultSettings.volume);
        pauseSlider.value = String(defaultSettings.pauseMs);
        syncAll();
    });

    await ensureVoicesReady();
    setupVoiceSelect(voiceSelect);
    voiceSelect.addEventListener("change", (event) => selectedVoiceName = event.target.value);

    document.getElementById("speakBtn").addEventListener("click", () => {
        speakMixed(textInput.value, {
            rate: Number(rate.value),
            pitch: Number(pitch.value),
            volume: Number(volume.value),
        });
    });
    document.getElementById("pauseBtn").addEventListener("click", () => speechSynthesis.pause());
    document.getElementById("resumeBtn").addEventListener("click", () => speechSynthesis.resume());
    document.getElementById("cancelBtn").addEventListener("click", () => {
        ttsCanceled = true;
        runId++;
        speechSynthesis.cancel();
        updatePinyin("");
    });
});
