// =================== GLOBAL VARIABLES ======================
let _ttsSelectedVoiceName = null;
let ttsCanceled = false;
let commaPauseMs = 100; // default pause at commas (ms)
let SINGLE_VOICE_CANDIDATES = [/Xiaoxiao/i, /Huihui/i, /Chinese|Mandarin/i];


// =================== VOICE HELPERS =========================
async function ensureVoicesReady() {
    // Fast path
    if (speechSynthesis.getVoices().length) return;

    // Listen once
    await new Promise((resolve) => {
        let done = false;
        const finish = () => { if (!done) { done = true; resolve(); } };

        // Event fires when voices populate (Chrome/Edge)
        const handler = () => {
            speechSynthesis.onvoiceschanged = null;
            finish();
        };
        speechSynthesis.onvoiceschanged = handler;

        // Also poll as a fallback (Safari/rare)
        const start = Date.now();
        (function poll() {
            if (speechSynthesis.getVoices().length || Date.now() - start > 3000) {
                // clear event handler; continue even if 0 voices (browser will still speak default)
                speechSynthesis.onvoiceschanged = null;
                finish();
            } else {
                setTimeout(poll, 100);
            }
        })();
    });
}


function pickSingleVoice() {
    const voices = speechSynthesis.getVoices();
    for (const re of SINGLE_VOICE_CANDIDATES) {
        const v = voices.find(v => re.test(`${v.name} ${v.lang}`));
        if (v) return v;
    }
    const zh = voices.find(v => /^zh/i.test(v.lang));
    return zh || voices[0];
}

// Map "spoken" indices (with … inserts) -> "clean" indices (no …).
// Any inserted pause marks/extra spaces map to -1.
function buildIndexMap(spoken, clean) {
    const map = new Int32Array(spoken.length);
    map.fill(-1);
    let i = 0; // spoken
    let j = 0; // clean
    while (i < spoken.length && j < clean.length) {
        const si = spoken[i];
        if (si === '…') { i++; continue; }           // skip pause marker
        if (si === ' ' && spoken[i - 1] === '…') { i++; continue; } // skip space after pause

        if (si === clean[j]) {
            map[i] = j;
            i++; j++;
        } else {
            // tolerate the extra space we sometimes inject after commas/semicolons
            if (si === ' ' && (clean[j] === '，' || clean[j] === ',' || clean[j] === '；')) { i++; continue; }
            // If chars don't line up (rare), advance spoken until next potential match
            i++;
        }
    }
    return map;
}

// Binary search the token that covers a clean char index
function findTokenByCharIndex(tokens, cleanCharIndex) {
    let lo = 0, hi = tokens.length - 1, ans = -1;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const t = tokens[mid];
        if (cleanCharIndex < t.start) hi = mid - 1;
        else if (cleanCharIndex >= t.end) lo = mid + 1;
        else { ans = mid; break; }
    }
    return ans;
}

// Tiny throttle to avoid doing DOM work more than ~60fps
function rafThrottle(fn) {
    let scheduled = false, lastArgs = null;
    return (...args) => {
        lastArgs = args;
        if (!scheduled) {
            scheduled = true;
            requestAnimationFrame(() => {
                scheduled = false;
                fn(...lastArgs);
            });
        }
    };
}


// =================== AMPLIFY COMMA PAUSE (SPEECH ONLY) ===================
function msToPauseMarker(ms) {
    if (ms <= 20) return "";
    if (ms <= 60) return "…";
    if (ms <= 120) return "……";
    if (ms <= 200) return "………";
    return "…………";
}

function amplifyCommaPauses(text, ms) {
    const marker = msToPauseMarker(ms);
    if (!marker) return text;

    const inject = `${marker} `;
    return text
        .replace(/，(?!…)/g, `，${inject}`)
        .replace(/,(?!…)/g, `,${inject}`)
        .replace(/；(?!…)/g, `；${inject}`);
}

// =================== HIGHLIGHT PANE ========================
const readPane = () => document.getElementById('readPane');
const hlEnabled = () => {
    const el = document.getElementById('hlToggle');
    return el ? el.checked : false;
};

function isCJK(ch) {
    const cp = ch.codePointAt(0);
    return (
        (cp >= 0x4E00 && cp <= 0x9FFF) ||   // CJK Unified Ideographs
        (cp >= 0x3400 && cp <= 0x4DBF) ||   // CJK Extension A
        (cp >= 0x3040 && cp <= 0x309F) ||   // Hiragana
        (cp >= 0x30A0 && cp <= 0x30FF)      // Katakana
    );
}

function tokenizeForHighlight(s) {
    const tokens = [];
    let i = 0, start = 0;
    const push = (text, cls = 'tok') => {
        tokens.push({ start, end: start + text.length, text, cls });
        start += text.length;
    };

    while (i < s.length) {
        const ch = s[i];

        // whitespace run
        if (/\s/.test(ch)) {
            let j = i;
            while (j < s.length && /\s/.test(s[j])) j++;
            push(s.slice(i, j), 'tok space'); i = j; continue;
        }

        // ASCII word run
        if (/[A-Za-z0-9]/.test(ch)) {
            let j = i;
            while (j < s.length && /[A-Za-z0-9]/.test(s[j])) j++;
            push(s.slice(i, j)); i = j; continue;
        }

        // CJK single char
        if (isCJK(ch)) { push(ch); i++; continue; }

        // punctuation / others single-char
        push(ch); i++;
    }
    return tokens;
}

function renderReadPane(cleanText) {
    const pane = readPane();
    if (!pane) return { tokens: [], nodes: [] };

    const tokens = tokenizeForHighlight(cleanText);
    pane.innerHTML = '';
    const frag = document.createDocumentFragment();
    const nodes = tokens.map((t, idx) => {
        const span = document.createElement('span');
        span.className = t.cls;
        span.dataset.i = String(idx);
        span.dataset.start = String(t.start);
        span.dataset.end = String(t.end);
        span.textContent = t.text;
        frag.appendChild(span);
        return span;
    });
    pane.appendChild(frag);
    return { tokens, nodes };
}

function clearHighlight(map) {
    if (!map || !map.nodes) return;
    map.nodes.forEach(node => node.classList.remove('current'));
}

function highlightWordByText(map, spokenWord) {
    const cleanWord = spokenWord.replace(/[.…]/g, '').trim();
    if (!cleanWord) return;

    const idx = map.tokens.findIndex(t => t.text === cleanWord);
    if (idx >= 0) {
        if (highlightWordByText._last != null) {
            map.nodes[highlightWordByText._last].classList.remove('current');
        }
        map.nodes[idx].classList.add('current');
        highlightWordByText._last = idx;

        map.nodes[idx].scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
}

// =================== SPEAK FUNCTION ========================
async function speakMixed(text, opts = {}) {
    if (!text) return;

    await ensureVoicesReady();
    speechSynthesis.cancel();
    ttsCanceled = false;

    const spokenText = amplifyCommaPauses(text, commaPauseMs);
    const cleanText = text;

    // --- safe highlight render ---
    let map = null, idxMap = null;
    try {
        if (hlEnabled()) {
            map = renderReadPane(cleanText);
        } else {
            const pane = readPane(); if (pane) pane.innerHTML = '';
        }
    } catch (e) {
        console.warn('Highlight pane disabled due to error:', e);
        map = null;
    }

    const utter = new SpeechSynthesisUtterance(spokenText);

    // pick voice if available; else let browser default
    try {
        const voices = speechSynthesis.getVoices();
        let voice = voices.find(v => v.name === _ttsSelectedVoiceName) || pickSingleVoice();
        if (voice) {
            _ttsSelectedVoiceName = voice.name;
            utter.voice = voice;
            utter.lang = voice.lang;
        }
    } catch { }

    utter.rate = typeof opts.rate === 'number' ? opts.rate : 1;
    utter.pitch = typeof opts.pitch === 'number' ? opts.pitch : 1;
    utter.volume = typeof opts.volume === 'number' ? opts.volume : 1;

    // Build mapping only if highlight is active and safe
    if (map) {
        try { idxMap = buildIndexMap(spokenText, cleanText); }
        catch (e) { console.warn('Index map disabled:', e); idxMap = null; }
    }

    let lastTok = -1;
    const doHighlight = rafThrottle((cleanIdx) => {
        if (!map) return;
        const tok = findTokenByCharIndex(map.tokens, cleanIdx);
        if (tok < 0 || tok === lastTok) return;
        if (lastTok >= 0) map.nodes[lastTok].classList.remove('current');
        map.nodes[tok].classList.add('current');
        lastTok = tok;
        map.nodes[tok].scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });

    utter.onboundary = (ev) => {
        if (!map || !idxMap) return;
        if (typeof ev.charIndex !== 'number') return;
        let s = ev.charIndex;
        while (s < idxMap.length && idxMap[s] === -1) s++;
        const cleanIdx = (s < idxMap.length) ? idxMap[s] : -1;
        if (cleanIdx >= 0) doHighlight(cleanIdx);
    };

    utter.onend = () => {
        if (map && lastTok >= 0) {
            map.nodes[lastTok].classList.remove('current');
            lastTok = -1;
        }
    };

    // **Surface any engine errors** so you can see what's wrong
    utter.onerror = (e) => {
        console.error('TTS error:', e.error || e);
        alert('Speech synthesis error: ' + (e.error || 'unknown'));
    };

    speechSynthesis.speak(utter);
}

// =================== UI BINDING (EVENTS) =====================
document.addEventListener('DOMContentLoaded', async () => {
    const txt = document.getElementById('txt');
    const rate = document.getElementById('rate');
    const pitch = document.getElementById('pitch');
    const volume = document.getElementById('volume');
    const pauseSlider = document.getElementById('sentenceDelay');
    const voiceSelect = document.getElementById('voiceSelect');

    const sync = {
        rate: () => (document.getElementById('rateVal').textContent = `${parseFloat(rate.value).toFixed(2)}×`),
        pitch: () => (document.getElementById('pitchVal').textContent = `${parseFloat(pitch.value).toFixed(2)}×`),
        volume: () => (document.getElementById('volumeVal').textContent = `${Math.round(volume.value * 100)}%`),
        pause: () => (document.getElementById('pauseVal').textContent = `${commaPauseMs} ms`)
    };

    sync.rate(); sync.pitch(); sync.volume(); sync.pause();

    rate.addEventListener('input', sync.rate);
    pitch.addEventListener('input', sync.pitch);
    volume.addEventListener('input', sync.volume);
    pauseSlider.addEventListener('input', () => {
        commaPauseMs = parseInt(pauseSlider.value);
        sync.pause();
    });

    await ensureVoicesReady();
    setupVoiceSelect(voiceSelect);

    voiceSelect.addEventListener('change', e => {
        _ttsSelectedVoiceName = e.target.value;
    });

    document.getElementById('speakBtn').addEventListener('click', () => {
        speechSynthesis.cancel();
        speakMixed(txt.value, {
            rate: parseFloat(rate.value),
            pitch: parseFloat(pitch.value),
            volume: parseFloat(volume.value)
        });
    });

    document.getElementById('pauseBtn').addEventListener('click', () => speechSynthesis.pause());
    document.getElementById('resumeBtn').addEventListener('click', () => speechSynthesis.resume());
    document.getElementById('cancelBtn').addEventListener('click', () => {
        ttsCanceled = true;
        speechSynthesis.cancel();
    });
});

// =============== Populate Voice Dropdown ===============
function setupVoiceSelect(selectEl) {
    const voices = speechSynthesis.getVoices();
    selectEl.innerHTML = '';
    voices.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v.name;
        opt.textContent = `${v.name} — (${v.lang})`;
        selectEl.appendChild(opt);
    });

    const defaultVoice = pickSingleVoice();
    if (defaultVoice) {
        _ttsSelectedVoiceName = defaultVoice.name;
        selectEl.value = defaultVoice.name;
    }
}
