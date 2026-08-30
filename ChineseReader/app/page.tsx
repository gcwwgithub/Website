"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { pinyin } from "pinyin-pro";
import { parseBookFile, type ParsedBook } from "./lib/file-readers";
import { RouteLink } from "./components/route-link";

const SAMPLE_TEXT = `这既不是有事情要发生的前兆，也并不是什么非日常的光景。

要说和平时有什么差别的话，也就是下午的烈日中，在从大学下课回家的路上看到穿着母校校服的男生女生。`;

const SAMPLE_BOOK: ParsedBook = {
  title: "A quiet afternoon · Sample",
  format: "TXT",
  sections: [{ id: "sample", title: "Sample passage", text: SAMPLE_TEXT }],
};

type CatalogBook = {
  id: string;
  title: string;
  author?: string;
  format: ParsedBook["format"];
  file: string;
  description?: string;
};

type ReadingToken = {
  character: string;
  pinyin: string;
  isChinese: boolean;
  sourceIndex: number;
};

type TranslationEntry = {
  id?: string;
  source: string;
  normalized?: string;
  meaning: string;
  pinyin?: string;
  notes?: string;
  kind?: "word" | "phrase" | "sentence";
  synonyms?: string[] | string;
  translations?: string[] | string;
  contexts?: string[] | string;
  imageUrl?: string;
  updatedAt?: string;
  csvFields?: { label: string; value: string }[];
};

type PlaybackState = "idle" | "playing" | "paused";
type PlaybackMode = "selection" | "page" | null;
type LookupState = "idle" | "loading" | "found" | "missing" | "error";
type LookupMode = "detail" | "sentence";
type PanelTab = "lookup" | "edit" | "settings";
type ThemeMode = "paper" | "light" | "dark";
type PageNavigationState = { phase: "idle" | "loading" | "loaded"; direction: "previous" | "next" | null; label: string };
type SentenceRange = { start: number; end: number; source: string };
type CsvField = { label: string; value: string };
const DETAIL_CHARACTER_LIMIT = 8;
const TRANSLATION_STORAGE_KEY = "chinese-reader-translations";
const READER_PROGRESS_KEY = "chinese-reader-current-book";
const READER_SETTINGS_KEY = "chinese-reader-settings";
const BOOKS_MANIFEST_URL = "books/manifest.json";
const SENTENCE_DATABASE_URLS = ["data/translations.json", "data/translation.json"];
const WORD_DATABASE_URLS = ["data/CN.csv", "data/CV.csv"];
const DISPLAY_CSV_FIELDS = [
  "English Words",
  "Chinese Usage in a Sentence",
  "English Usage in a sentence",
  "Notes",
];

function buildTokens(text: string): ReadingToken[] {
  let sourceOffset = 0;
  return pinyin(text, {
    type: "all",
    toneType: "symbol",
    nonZh: "consecutive",
    toneSandhi: true,
  }).map((item) => {
    const token = {
      character: item.origin,
      pinyin: item.isZh ? item.pinyin : "",
      isChinese: item.isZh,
      sourceIndex: sourceOffset,
    };
    sourceOffset += item.origin.length;
    return token;
  });
}

function sentenceRangeAt(text: string, clickedIndex: number) {
  const isTerminal = (character: string) => /[。！？!?…]/.test(character);
  const isClosingMark = (character: string) => /[”’」』】）》〗〕］]/.test(character);
  const isBoundary = (character: string) => isTerminal(character) || isClosingMark(character) || character === "\n";
  let anchor = Math.max(0, Math.min(clickedIndex, text.length - 1));

  // Clicking any mark in `！？`, `！！`, `……`, or a closing quote still
  // resolves to the sentence immediately before the punctuation sequence.
  while (anchor > 0 && (isTerminal(text[anchor]) || isClosingMark(text[anchor]))) anchor -= 1;

  let start = anchor;
  while (start > 0 && !isBoundary(text[start - 1])) start -= 1;

  let end = anchor;
  while (end < text.length && !isTerminal(text[end]) && text[end] !== "\n") end += 1;
  while (end < text.length && (isTerminal(text[end]) || isClosingMark(text[end]))) end += 1;

  return { start, end };
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"' && quoted && text[index + 1] === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') quoted = !quoted;
    else if (character === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else cell += character;
  }

  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  if (!rows.length) return [];
  const headers = rows[0].map((value) => value.trim().replace(/^\uFEFF/, ""));
  return rows.slice(1).map((values) => {
    const row: Record<string, unknown> = {};
    const fields = headers.map((header, index) => ({ label: header, value: values[index] ?? "" }));
    fields.forEach((field) => {
      row[field.label] = field.value;
      row[field.label.toLowerCase()] = field.value;
    });
    row.csvFields = fields;
    return row;
  });
}

function cleanImportedRows(raw: unknown): TranslationEntry[] {
  const container = raw as {
    translations?: unknown;
    entries?: unknown;
    meanings?: unknown;
    sentences?: unknown;
  };
  const rows = Array.isArray(raw)
    ? raw
    : Array.isArray(container?.translations)
      ? container.translations
      : Array.isArray(container?.entries)
        ? container.entries
        : Array.isArray(container?.meanings)
          ? container.meanings
          : Array.isArray(container?.sentences)
            ? container.sentences
            : [];

  return rows.flatMap((value) => {
    const item = value as Record<string, unknown>;
    const readList = (input: unknown) => {
      if (Array.isArray(input)) return input.map(String).map((entry) => entry.trim()).filter(Boolean);
      if (typeof input !== "string" || !input.trim()) return [];
      const clean = input.trim();
      if (clean.startsWith("[")) {
        try { const parsed = JSON.parse(clean); if (Array.isArray(parsed)) return parsed.map(String).map((entry) => entry.trim()).filter(Boolean); } catch { /* use pipe-separated fallback */ }
      }
      return clean.split("|").map((entry) => entry.trim()).filter(Boolean);
    };
    const source = String(item.source ?? item.chinese ?? item.text ?? item["Chinese Words"] ?? item["chinese words"] ?? "").trim();
    const isSentenceFile = Array.isArray(container?.sentences);
    const meaning = String(item.meaning ?? item.translation ?? item.english ?? item["English Words"] ?? item["english words"] ?? "").trim();
    if (!source || (isSentenceFile && !meaning)) return [];
    if (!isSentenceFile && [...source].length > DETAIL_CHARACTER_LIMIT) return [];
    const rawKind = String(item.kind ?? "").toLowerCase();
    const kind: TranslationEntry["kind"] =
      isSentenceFile ? "sentence" :
      rawKind === "word"
        ? rawKind
        : "phrase";
    return [{
      source,
      meaning,
      pinyin: String(item.pinyin ?? item.Pinyin ?? "").trim(),
      notes: String(item.notes ?? item.Notes ?? item.note ?? item.context ?? "").trim(),
      synonyms: readList(item.synonyms ?? item.chinese_synonyms),
      translations: readList(item.translations),
      contexts: readList(item.contexts ?? item["Chinese Usage in a Sentence"] ?? item["chinese usage in a sentence"] ?? item["English Usage in a sentence"] ?? item["english usage in a sentence"]),
      imageUrl: String(item.imageUrl ?? item.image_url ?? item["image_url"] ?? "").trim(),
      kind,
      csvFields: Array.isArray(item.csvFields) ? item.csvFields as { label: string; value: string }[] : undefined,
    }];
  });
}

function normalizeLookup(value: string) {
  return value.normalize("NFKC").replace(/\s+/g, "").trim();
}

function readSavedList(value: string[] | string | undefined) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function displayCsvLabel(label: string) {
  return label === "English Words" ? "English Translation" : label;
}

function isChineseUsageField(label: string) {
  return label === "Chinese Usage in a Sentence";
}

function csvFieldValue(fields: CsvField[] | undefined, label: string) {
  return fields?.find((field) => field.label === label)?.value ?? "";
}

function withCsvFieldValue(fields: CsvField[] | undefined, label: string, value: string) {
  const next = [...(fields ?? [])];
  const index = next.findIndex((field) => field.label === label);
  if (index >= 0) next[index] = { ...next[index], value };
  else next.push({ label, value });
  return next;
}

function csvEscape(value: string) {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function hexToRgb(hex: string) {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!match) return { red: 240, green: 202, blue: 104 };
  const value = Number.parseInt(match[1], 16);
  return {
    red: (value >> 16) & 255,
    green: (value >> 8) & 255,
    blue: value & 255,
  };
}

function rgbToHex(red: number, green: number, blue: number) {
  const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value || 0)));
  return `#${[clamp(red), clamp(green), clamp(blue)].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function downloadText(filename: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function loadTranslationDatabase(): TranslationEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const rows = JSON.parse(window.localStorage.getItem(TRANSLATION_STORAGE_KEY) || "[]");
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function saveTranslationDatabase(entries: TranslationEntry[]) {
  window.localStorage.setItem(TRANSLATION_STORAGE_KEY, JSON.stringify(entries));
}

function mergeTranslationEntries(entries: TranslationEntry[]) {
  const byKey = new Map<string, TranslationEntry>();
  entries.forEach((entry) => {
    const normalized = entry.normalized || normalizeLookup(entry.source);
    const kind = entry.kind || ([...entry.source].length === 1 ? "word" : "phrase");
    if (!entry.source.trim()) return;
    byKey.set(`${normalized}:${kind}`, { ...entry, normalized, kind });
  });
  return Array.from(byKey.values());
}

function upsertTranslationEntries(entries: TranslationEntry[]) {
  const existing = loadTranslationDatabase();
  const byKey = new Map(existing.map((entry) => [`${entry.normalized || normalizeLookup(entry.source)}:${entry.kind || "phrase"}`, entry]));
  const now = new Date().toISOString();

  entries.forEach((entry) => {
    const normalized = normalizeLookup(entry.source);
    const kind = entry.kind || ([...entry.source].length === 1 ? "word" : "phrase");
    const meaning = entry.meaning.trim();
    if (!entry.source.trim()) return;

    byKey.set(`${normalized}:${kind}`, {
      ...byKey.get(`${normalized}:${kind}`),
      ...entry,
      id: entry.id || crypto.randomUUID(),
      normalized,
      meaning,
      synonyms: JSON.stringify(readSavedList(entry.synonyms)),
      translations: JSON.stringify(readSavedList(entry.translations).length ? readSavedList(entry.translations) : [meaning]),
      contexts: JSON.stringify(readSavedList(entry.contexts)),
      kind,
      updatedAt: now,
    });
  });

  const database = Array.from(byKey.values());
  saveTranslationDatabase(database);
  return database;
}

function bookFileUrl(file: string) {
  if (/^https?:\/\//i.test(file)) return file;
  return `books/${file.replace(/^\/+/, "")}`;
}

function splitSpeechChunks(text: string, startOffset: number) {
  const chunks: { text: string; start: number }[] = [];
  const matches = text.matchAll(/[^。！？!?…\n]+[。！？!?…]*|\n+/g);
  let buffer = "";
  let bufferStart = startOffset;

  for (const match of matches) {
    const part = match[0];
    const partStart = startOffset + (match.index ?? 0);
    if (!part.trim()) continue;
    if (!buffer) bufferStart = partStart;
    if (buffer.length + part.length > 360 && buffer.trim()) {
      chunks.push({ text: buffer.trim(), start: bufferStart });
      buffer = "";
      bufferStart = partStart;
    }
    buffer += part;
  }

  if (buffer.trim()) chunks.push({ text: buffer.trim(), start: bufferStart });
  return chunks.length ? chunks : [{ text, start: startOffset }];
}

async function parseCatalogBook(item: CatalogBook) {
  if (!item.file) return SAMPLE_BOOK;
  const response = await fetch(bookFileUrl(item.file));
  if (!response.ok) throw new Error(`${item.title} could not be loaded.`);
  const blob = await response.blob();
  const file = new File([blob], item.file.split("/").pop() || item.title, { type: blob.type });
  return parseBookFile(file);
}

async function fetchFirstText(urls: string[]) {
  for (const url of urls) {
    const response = await fetch(url);
    if (response.ok) return { url, text: await response.text() };
  }
  throw new Error("No matching file was found.");
}

function Icon({ name }: { name: "upload" | "database" | "play" | "pause" | "back" | "forward" | "book" | "audio" | "settings" | "copy" }) {
  const paths = {
    upload: "M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14v5h14v-5",
    database: "M4 6c0-2 3.6-3 8-3s8 1 8 3-3.6 3-8 3-8-1-8-3Zm0 0v6c0 2 3.6 3 8 3s8-1 8-3V6m-16 6v6c0 2 3.6 3 8 3s8-1 8-3v-6",
    play: "M8 5.5v13L18.5 12 8 5.5Z",
    pause: "M7 5h4v14H7V5Zm6 0h4v14h-4V5Z",
    back: "m14.5 5-7 7 7 7",
    forward: "m9.5 5 7 7-7 7",
    book: "M4 5.5A3.5 3.5 0 0 1 7.5 2H12v17H7.5A3.5 3.5 0 0 0 4 22V5.5Zm16 0A3.5 3.5 0 0 0 16.5 2H12v17h4.5A3.5 3.5 0 0 1 20 22V5.5Z",
    audio: "M4 9v6h4l5 4V5L8 9H4Zm12.5-.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12",
    settings: "M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Zm0-12v2m0 13v2m8.5-8.5h-2m-13 0h-2m14.5-6.5-1.4 1.4M6.9 17.1l-1.4 1.4m0-13 1.4 1.4m10.2 10.2 1.4 1.4",
    copy: "M8 8h10v12H8V8Zm-3 8H4V4h10v1",
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={paths[name]} /></svg>;
}

export default function Home() {
  const [book, setBook] = useState<ParsedBook>(SAMPLE_BOOK);
  const [sectionIndex, setSectionIndex] = useState(0);
  const [view, setView] = useState<"shelf" | "reader">("shelf");
  const [catalog, setCatalog] = useState<CatalogBook[]>([]);
  const [activeBookId, setActiveBookId] = useState("sample");
  const [catalogState, setCatalogState] = useState<"loading" | "ready" | "error">("loading");
  const [catalogMessage, setCatalogMessage] = useState("");
  const [lookupText, setLookupText] = useState("");
  const [lookupMode, setLookupMode] = useState<LookupMode>("detail");
  const [selectionMessage, setSelectionMessage] = useState("");
  const [selectionStart, setSelectionStart] = useState(-1);
  const [showPinyin, setShowPinyin] = useState(true);
  const [rate, setRate] = useState(0.8);
  const [highlightColor, setHighlightColor] = useState("#f0ca68");
  const [themeMode, setThemeMode] = useState<ThemeMode>("paper");
  const [clipboardMessage, setClipboardMessage] = useState("");
  const [playback, setPlayback] = useState<PlaybackState>("idle");
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [activePageIndex, setActivePageIndex] = useState(-1);
  const [lookupState, setLookupState] = useState<LookupState>("idle");
  const [entry, setEntry] = useState<TranslationEntry | null>(null);
  const [meaningDraft, setMeaningDraft] = useState("");
  const [panelTab, setPanelTab] = useState<PanelTab>("lookup");
  const [synonyms, setSynonyms] = useState<string[]>([]);
  const [translationsList, setTranslationsList] = useState<string[]>([""]);
  const [contexts, setContexts] = useState<string[]>([""]);
  const [notesDraft, setNotesDraft] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [csvDraftFields, setCsvDraftFields] = useState<CsvField[]>([]);
  const [databaseTotal, setDatabaseTotal] = useState(0);
  const [databaseEntries, setDatabaseEntries] = useState<TranslationEntry[]>([]);
  const [databaseMessage, setDatabaseMessage] = useState("Loading translations.json and CN.csv…");
  const [importing, setImporting] = useState(false);
  const [clearingDatabase, setClearingDatabase] = useState(false);
  const [fileState, setFileState] = useState<"idle" | "loading" | "error">("idle");
  const [fileMessage, setFileMessage] = useState("");
  const [lookupVersion, setLookupVersion] = useState(0);
  const [pageNavigation, setPageNavigation] = useState<PageNavigationState>({ phase: "idle", direction: null, label: "" });
  const [sentenceSources, setSentenceSources] = useState<string[]>([]);
  const databaseInput = useRef<HTMLInputElement>(null);
  const readerText = useRef<HTMLDivElement>(null);
  const fallbackTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const syncTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const fallbackCursor = useRef(0);
  const speechTokens = useRef<ReadingToken[]>([]);
  const speechIndexes = useRef<number[]>([]);
  const speechSegments = useRef<{ start: number; end: number; tokenIndexes: number[] }[]>([]);
  const speechStart = useRef(-1);
  const lastHighlightedIndex = useRef(-1);
  const boundarySeen = useRef(false);
  const speechRunId = useRef(0);
  const pageChangeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pageLoadedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoredProgress = useRef(false);

  const currentSection = book.sections[sectionIndex] ?? book.sections[0];
  const currentText = currentSection?.text ?? "";
  const sentenceRanges = useMemo(() => {
    const ranges: SentenceRange[] = [];
    for (const source of sentenceSources) {
      let searchFrom = 0;
      while (searchFrom < currentText.length) {
        const start = currentText.indexOf(source, searchFrom);
        if (start < 0) break;
        ranges.push({ start, end: start + source.length, source });
        searchFrom = start + Math.max(1, source.length);
      }
    }
    return ranges.sort((left, right) => left.start - right.start || (right.end - right.start) - (left.end - left.start));
  }, [currentText, sentenceSources]);
  const pageCharacters = useMemo(() => currentText.split(""), [currentText]);
  const pageImages = useMemo(() => {
    const byOffset = new Map<number, NonNullable<typeof currentSection.images>>();
    (currentSection?.images ?? []).forEach((image) => {
      const offset = Math.max(0, Math.min(currentText.length, image.offset));
      byOffset.set(offset, [...(byOffset.get(offset) ?? []), image]);
    });
    return byOffset;
  }, [currentSection, currentText.length]);
  const pagePinyin = useMemo(() => {
    if (!showPinyin) return [] as string[];
    const labels = new Array<string>(currentText.length).fill("");
    buildTokens(currentText).forEach((token) => {
      if (token.isChinese) labels[token.sourceIndex] = token.pinyin;
    });
    return labels;
  }, [currentText, showPinyin]);
  const progress = book.sections.length
    ? Math.round(((sectionIndex + 1) / book.sections.length) * 100)
    : 0;
  const highlightRgb = useMemo(() => hexToRgb(highlightColor), [highlightColor]);

  useEffect(() => {
    const loadDatabases = async () => {
      const messages: string[] = [];
      const loadedEntries: TranslationEntry[] = [];

      try {
        const { text } = await fetchFirstText(SENTENCE_DATABASE_URLS);
        const raw = JSON.parse(text);
        loadedEntries.push(...cleanImportedRows(raw).filter((entry) => entry.kind === "sentence"));
      } catch {
        messages.push("translations.json was not found.");
      }

      try {
        const { text } = await fetchFirstText(WORD_DATABASE_URLS);
        const rows = parseCsv(text);
        loadedEntries.push(...cleanImportedRows(rows).filter((entry) => entry.kind !== "sentence"));
      } catch {
        messages.push("CN.csv was not found.");
      }

      const localEntries = loadTranslationDatabase().filter((entry) => entry.kind !== "sentence");
      const merged = mergeTranslationEntries([...loadedEntries, ...localEntries]);
      setDatabaseEntries(merged);
      setDatabaseTotal(merged.length);
      setDatabaseMessage(messages.length ? messages.join(" ") : "Loaded sentence translations from translations.json and word/phrase details from CN.csv.");
    };

    void loadDatabases();
  }, []);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(READER_SETTINGS_KEY) || "null") as { rate?: number; highlightColor?: string; themeMode?: ThemeMode } | null;
      if (typeof saved?.rate === "number") setRate(Math.max(0.5, Math.min(1.5, saved.rate)));
      if (typeof saved?.highlightColor === "string" && /^#[0-9a-f]{6}$/i.test(saved.highlightColor)) setHighlightColor(saved.highlightColor);
      if (saved?.themeMode === "paper" || saved?.themeMode === "light" || saved?.themeMode === "dark") setThemeMode(saved.themeMode);
    } catch {
      // Keep defaults when settings are absent or malformed.
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(READER_SETTINGS_KEY, JSON.stringify({ rate, highlightColor, themeMode }));
  }, [highlightColor, rate, themeMode]);

  useEffect(() => {
    const loadCatalog = async () => {
      try {
        const response = await fetch(BOOKS_MANIFEST_URL);
        if (!response.ok) throw new Error("Book shelf manifest could not be loaded.");
        const rows = await response.json() as CatalogBook[];
        const books = rows.filter((item) => item.id && item.title && item.format);
        setCatalog(books);
        setCatalogState("ready");
        setCatalogMessage(books.length ? "" : "No TXT, PDF, or EPUB files were found in public/books yet.");

        if (!restoredProgress.current) {
          restoredProgress.current = true;
          const saved = JSON.parse(window.localStorage.getItem(READER_PROGRESS_KEY) || "null") as { bookId?: string; sectionIndex?: number } | null;
          const savedBook = books.find((item) => item.id === saved?.bookId);
          if (savedBook) void loadShelfBook(savedBook, saved?.sectionIndex ?? 0, true);
        }
      } catch (error) {
        setCatalogState("error");
        setCatalogMessage(error instanceof Error ? error.message : "The book shelf could not be loaded.");
      }
    };

    void loadCatalog();
  }, []);

  useEffect(() => () => {
    book.assetUrls?.forEach((url) => URL.revokeObjectURL(url));
  }, [book]);

  useEffect(() => {
    if (!lookupText.trim()) return;
    const timer = window.setTimeout(() => {
      setLookupState("loading");
      try {
        const normalized = normalizeLookup(lookupText);
        const match = databaseEntries.find((item) =>
          (item.normalized || normalizeLookup(item.source)) === normalized &&
          (lookupMode === "sentence" ? item.kind === "sentence" : item.kind !== "sentence")
        ) ?? null;
        setEntry(match);
        setMeaningDraft(match?.meaning ?? "");
        setSynonyms(readSavedList(match?.synonyms));
        const savedTranslations = readSavedList(match?.translations);
        const savedContexts = readSavedList(match?.contexts);
        setTranslationsList(savedTranslations.length ? savedTranslations : [match?.meaning ?? ""]);
        setContexts(savedContexts.length ? savedContexts : [""]);
        setNotesDraft(match?.notes ?? "");
        setImageUrl(match?.imageUrl ?? "");
        setCsvDraftFields(DISPLAY_CSV_FIELDS.map((label) => ({
          label,
          value: csvFieldValue(match?.csvFields, label),
        })));
        setLookupState(match ? "found" : "missing");
      } catch (error) {
        setLookupState("error");
      }
    }, 100);
    return () => {
      window.clearTimeout(timer);
    };
  }, [databaseEntries, lookupText, lookupMode, lookupVersion]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        setSentenceSources(databaseEntries
          .filter((item) => item.kind === "sentence")
          .map((item) => item.source?.trim())
          .filter((source): source is string => Boolean(source)));
      } catch (error) {
        setSentenceSources([]);
      }
    }, 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, [databaseEntries, lookupVersion]);

  const clearSpeechTimers = () => {
    if (fallbackTimer.current) clearInterval(fallbackTimer.current);
    fallbackTimer.current = null;
    syncTimers.current.forEach((timer) => clearTimeout(timer));
    syncTimers.current = [];
  };

  const stop = () => {
    speechRunId.current += 1;
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    clearSpeechTimers();
    lastHighlightedIndex.current = -1;
    setPlayback("idle");
    setPlaybackMode(null);
    setActiveIndex(-1);
    setActivePageIndex(-1);
  };

  const highlightSpeechIndex = (index: number) => {
    if (index < lastHighlightedIndex.current) return;
    lastHighlightedIndex.current = index;
    setActiveIndex(index);
    const token = speechTokens.current[index];
    setActivePageIndex(token && speechStart.current >= 0 ? speechStart.current + token.sourceIndex : -1);
    const position = speechIndexes.current.indexOf(index);
    if (position >= 0) fallbackCursor.current = Math.max(fallbackCursor.current, position + 1);
  };

  const startFallbackHighlight = (speed: number) => {
    if (!speechIndexes.current.length) return;
    if (fallbackTimer.current) clearInterval(fallbackTimer.current);
    fallbackTimer.current = setInterval(() => {
      if (boundarySeen.current) {
        if (fallbackTimer.current) clearInterval(fallbackTimer.current);
        fallbackTimer.current = null;
        return;
      }
      const cursor = Math.min(fallbackCursor.current, speechIndexes.current.length - 1);
      highlightSpeechIndex(speechIndexes.current[cursor]);
      fallbackCursor.current = cursor + 1;
    }, Math.max(220, 420 / speed));
  };

  const syncToBoundary = (charIndex: number, speed: number) => {
    syncTimers.current.forEach((timer) => clearTimeout(timer));
    syncTimers.current = [];
    const segment = speechSegments.current.find((item) => charIndex >= item.start && charIndex < item.end)
      ?? speechSegments.current.find((item) => item.start >= charIndex);
    if (!segment) return;
    highlightSpeechIndex(segment.tokenIndexes[0]);
    const step = Math.max(240, 460 / speed);
    segment.tokenIndexes.slice(1).forEach((index, offset) => {
      syncTimers.current.push(setTimeout(() => {
        highlightSpeechIndex(index);
      }, step * (offset + 1)));
    });
  };

  const play = (text: string, start: number, mode: Exclude<PlaybackMode, null>, speed = rate) => {
    if (!text || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    stop();
    const chunks = splitSpeechChunks(text, start);
    let chunkIndex = 0;
    const runId = speechRunId.current + 1;
    speechRunId.current = runId;
    setPlaybackMode(mode);

    const speakChunk = () => {
      if (speechRunId.current !== runId) return;
      const chunk = chunks[chunkIndex];
      if (!chunk) {
        clearSpeechTimers();
        lastHighlightedIndex.current = -1;
        setPlayback("idle");
        setPlaybackMode(null);
        setActiveIndex(-1);
        setActivePageIndex(-1);
        return;
      }

      const nextTokens = buildTokens(chunk.text);
      const segmenter = new Intl.Segmenter("zh-CN", { granularity: "word" });
      speechTokens.current = nextTokens;
      speechIndexes.current = nextTokens.map((token, index) => token.isChinese ? index : -1).filter((index) => index >= 0);
      speechSegments.current = Array.from(segmenter.segment(chunk.text)).map((segment) => ({
        start: segment.index,
        end: segment.index + segment.segment.length,
        tokenIndexes: nextTokens.map((token, index) =>
          token.isChinese && token.sourceIndex >= segment.index && token.sourceIndex < segment.index + segment.segment.length
            ? index
            : -1,
        ).filter((index) => index >= 0),
      })).filter((segment) => segment.tokenIndexes.length);
      speechStart.current = chunk.start;
      lastHighlightedIndex.current = -1;
      fallbackCursor.current = 0;
      boundarySeen.current = false;

      const utterance = new SpeechSynthesisUtterance(chunk.text);
      utterance.lang = "zh-CN";
      utterance.rate = speed;
      const voice = window.speechSynthesis.getVoices().find((item) => /^(zh-CN|zh-Hans|zh)/i.test(item.lang));
      if (voice) utterance.voice = voice;
      utterance.onstart = () => {
        if (speechRunId.current !== runId) return;
        setPlayback("playing");
        syncToBoundary(0, speed);
        window.setTimeout(() => {
          if (speechRunId.current === runId && !boundarySeen.current) startFallbackHighlight(speed);
        }, 650);
      };
      utterance.onboundary = (event) => {
        if (speechRunId.current === runId) {
          boundarySeen.current = true;
          if (fallbackTimer.current) clearInterval(fallbackTimer.current);
          fallbackTimer.current = null;
          syncToBoundary(Math.max(0, event.charIndex), speed);
        }
      };
      utterance.onend = () => {
        if (speechRunId.current !== runId) return;
        clearSpeechTimers();
        chunkIndex += 1;
        speakChunk();
      };
      utterance.onerror = () => {
        if (speechRunId.current !== runId) return;
        clearSpeechTimers();
        setPlayback("idle");
        setPlaybackMode(null);
      };
      window.speechSynthesis.speak(utterance);
    };

    speakChunk();
  };

  const togglePlayback = (mode: Exclude<PlaybackMode, null>) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const isSameSource = playbackMode === mode;
    if (isSameSource && playback === "playing") {
      window.speechSynthesis.pause();
      clearSpeechTimers();
      setPlayback("paused");
    } else if (isSameSource && playback === "paused") {
      window.speechSynthesis.resume();
      fallbackCursor.current = Math.max(0, speechIndexes.current.indexOf(activeIndex) + 1);
      startFallbackHighlight(rate);
      setPlayback("playing");
    } else if (mode === "page") play(currentText, 0, "page");
    else play(lookupText, selectionStart, "selection");
  };

  const selectedPageStart = () => {
    if (!lookupText || selectionStart < 0) return 0;
    if (lookupMode === "sentence") return selectionStart;
    return sentenceRangeAt(currentText, selectionStart).start;
  };

  const toggleFooterPlayback = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (playbackMode === "page" && playback === "playing") {
      window.speechSynthesis.pause();
      clearSpeechTimers();
      setPlayback("paused");
      return;
    }
    if (playbackMode === "page" && playback === "paused") {
      window.speechSynthesis.resume();
      fallbackCursor.current = Math.max(0, speechIndexes.current.indexOf(activeIndex) + 1);
      startFallbackHighlight(rate);
      setPlayback("playing");
      return;
    }
    const start = selectedPageStart();
    play(currentText.slice(start), start, "page");
  };

  const selectedSentenceText = () => {
    if (!lookupText || selectionStart < 0) return "";
    if (lookupMode === "sentence") return lookupText;
    const { start, end } = sentenceRangeAt(currentText, selectionStart);
    return currentText.slice(start, end).trim();
  };

  const copyText = async (text: string, label: string) => {
    if (!text.trim()) return;
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
      else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
      }
      setClipboardMessage(`${label} copied`);
      window.setTimeout(() => setClipboardMessage(""), 1800);
    } catch {
      setClipboardMessage("Copy unavailable");
      window.setTimeout(() => setClipboardMessage(""), 1800);
    }
  };

  const changeHighlightRgb = (channel: "red" | "green" | "blue", value: number) => {
    const next = { ...highlightRgb, [channel]: value };
    setHighlightColor(rgbToHex(next.red, next.green, next.blue));
  };

  const changeRate = (next: number) => {
    setRate(next);
    if (!playbackMode) return;
    const start = playbackMode === "page" ? Math.max(0, speechStart.current) : selectionStart;
    const text = playbackMode === "page" ? currentText.slice(start) : lookupText;
    window.setTimeout(() => play(text, start, playbackMode, next), 60);
  };

  const selectText = (text: string, start: number, mode: LookupMode = "detail") => {
    const clean = text.trim();
    if (!clean || !/\p{Script=Han}/u.test(clean)) return;
    if (mode === "detail" && [...clean].length > DETAIL_CHARACTER_LIMIT) {
      setSelectionMessage(`Highlight up to ${DETAIL_CHARACTER_LIMIT} characters for a detailed lookup. Click once inside a sentence to translate the full sentence.`);
      window.getSelection()?.removeAllRanges();
      return;
    }
    stop();
    setSelectionMessage("");
    setClipboardMessage("");
    setLookupMode(mode);
    setLookupText(clean);
    setSelectionStart(start + text.indexOf(clean));
    setLookupState("loading");
    setPanelTab("lookup");
  };

  const captureSelection = () => {
    const selection = window.getSelection();
    if (!selection?.rangeCount || !readerText.current) return;
    const range = selection.getRangeAt(0);
    if (!readerText.current.contains(range.commonAncestorContainer)) return;
    const prefix = range.cloneRange();
    prefix.selectNodeContents(readerText.current);
    prefix.setEnd(range.startContainer, range.startOffset);
    if (selection.toString().trim()) selectText(selection.toString(), prefix.toString().length, "detail");
  };

  const selectSentenceAt = (index: number) => {
    if (window.getSelection()?.toString().trim()) return;
    const importedRange = sentenceRanges
      .filter((range) => index >= range.start && index < range.end)
      .sort((left, right) => (left.end - left.start) - (right.end - right.start))[0];
    if (importedRange) {
      selectText(importedRange.source, importedRange.start, "sentence");
      return;
    }
    const { start, end } = sentenceRangeAt(currentText, index);
    const sentence = currentText.slice(start, end);
    selectText(sentence, start, "sentence");
  };

  const changeSection = (next: number) => {
    if (next < 0 || next >= book.sections.length || pageNavigation.phase === "loading") return;
    const direction = next < sectionIndex ? "previous" : "next";
    const target = book.sections[next];
    if (pageChangeTimer.current) clearTimeout(pageChangeTimer.current);
    if (pageLoadedTimer.current) clearTimeout(pageLoadedTimer.current);
    stop();
    setPageNavigation({ phase: "loading", direction, label: `Loading ${direction} page…` });
    pageChangeTimer.current = setTimeout(() => {
      setSectionIndex(next);
      window.localStorage.setItem(READER_PROGRESS_KEY, JSON.stringify({ bookId: activeBookId, sectionIndex: next }));
      setLookupText("");
      setSelectionStart(-1);
      setEntry(null);
      setMeaningDraft("");
      setLookupState("idle");
      setPageNavigation({ phase: "loaded", direction, label: `${target?.title || `Page ${next + 1}`} loaded` });
      pageLoadedTimer.current = setTimeout(() => setPageNavigation({ phase: "idle", direction: null, label: "" }), 1100);
    }, 180);
  };

  const loadShelfBook = async (catalogBook: CatalogBook, savedSectionIndex = 0, quiet = false) => {
    stop();
    setFileState("loading");
    setFileMessage(quiet ? `Restoring ${catalogBook.title}…` : `Opening ${catalogBook.title}…`);
    try {
      const parsed = await parseCatalogBook(catalogBook);
      const nextSectionIndex = Math.max(0, Math.min(savedSectionIndex, parsed.sections.length - 1));
      setBook({ ...parsed, title: parsed.title || catalogBook.title });
      setActiveBookId(catalogBook.id);
      setSectionIndex(nextSectionIndex);
      setView("reader");
      setLookupText("");
      setSelectionStart(-1);
      setEntry(null);
      setMeaningDraft("");
      setLookupState("idle");
      setFileState("idle");
      setFileMessage(parsed.notice || `${catalogBook.format} loaded from the shelf.`);
      window.localStorage.setItem(READER_PROGRESS_KEY, JSON.stringify({ bookId: catalogBook.id, sectionIndex: nextSectionIndex }));
    } catch (error) {
      setFileState("error");
      setFileMessage(error instanceof Error ? error.message : "The book could not be opened.");
      setView("shelf");
    }
  };

  const saveMeaning = async () => {
    if (!lookupText) return;
    setLookupState("loading");
    try {
      const nextCsvFields = DISPLAY_CSV_FIELDS.reduce(
        (fields, label) => withCsvFieldValue(fields, label, csvFieldValue(csvDraftFields, label)),
        entry?.csvFields ?? [{ label: "Chinese Words", value: lookupText }],
      );
      const primaryMeaning = csvFieldValue(nextCsvFields, "English Words");
      const database = upsertTranslationEntries([{
        source: lookupText,
        meaning: primaryMeaning,
        pinyin: entry?.pinyin || pinyin(lookupText, { toneType: "symbol", toneSandhi: true }),
        notes: csvFieldValue(nextCsvFields, "Notes"),
        synonyms: readSavedList(entry?.synonyms),
        translations: primaryMeaning ? [primaryMeaning] : [],
        contexts: [
          csvFieldValue(nextCsvFields, "Chinese Usage in a Sentence"),
          csvFieldValue(nextCsvFields, "English Usage in a sentence"),
        ].filter(Boolean),
        imageUrl: entry?.imageUrl ?? "",
        kind: [...lookupText].length === 1 ? "word" : "phrase",
        csvFields: nextCsvFields,
      }]);
      const merged = mergeTranslationEntries([...databaseEntries.filter((item) => item.kind === "sentence"), ...database]);
      setDatabaseEntries(merged);
      setDatabaseTotal(merged.length);
      setMeaningDraft(primaryMeaning);
      setEntry({ ...entry, source: lookupText, meaning: primaryMeaning, notes: csvFieldValue(nextCsvFields, "Notes"), csvFields: nextCsvFields });
      setLookupState("found");
      setLookupVersion((version) => version + 1);
    } catch {
      setLookupState("error");
    }
  };

  const exportCsv = () => {
    const rows = databaseEntries.filter((item) => item.kind !== "sentence");
    const headers = Array.from(new Set(rows.flatMap((item) => item.csvFields?.map((field) => field.label) ?? [])));
    const csvHeaders = headers.length ? headers : ["Chinese Words", "pinyin", "English Words", "Chinese Usage in a Sentence", "English Usage in a sentence", "_Formal", "Notes", "_HSK", "_Dao", "ID"];
    const csv = [
      csvHeaders.join(","),
      ...rows.map((item) => csvHeaders.map((header) => csvEscape(csvFieldValue(item.csvFields, header))).join(",")),
    ].join("\n");
    downloadText("CN.csv", `${csv}\n`, "text/csv;charset=utf-8");
  };

  const exportJson = () => {
    const sentences = databaseEntries
      .filter((item) => item.kind === "sentence")
      .map((item) => ({ source: item.source, translation: item.meaning }));
    downloadText("translations.json", `${JSON.stringify({ sentences }, null, 2)}\n`, "application/json;charset=utf-8");
  };

  const importDatabase = async (file?: File) => {
    if (!file) return;
    setImporting(true);
    setDatabaseMessage(`Reading ${file.name}…`);
    try {
      const text = await file.text();
      const raw = file.name.toLowerCase().endsWith(".csv") ? parseCsv(text) : JSON.parse(text);
      const entries = cleanImportedRows(raw);
      if (!entries.length) throw new Error("No source and meaning pairs were found.");
      let imported = 0;
      for (let start = 0; start < entries.length; start += 100) {
        const batch = entries.slice(start, start + 100);
        const database = upsertTranslationEntries(batch);
        imported += batch.length;
        const merged = mergeTranslationEntries([...databaseEntries.filter((item) => item.kind === "sentence"), ...database]);
        setDatabaseEntries(merged);
        setDatabaseTotal(merged.length);
        setDatabaseMessage(`Imported ${imported} of ${entries.length}…`);
      }
      setDatabaseMessage(`Merged ${imported.toLocaleString()} translations.`);
      setLookupVersion((version) => version + 1);
    } catch (error) {
      setDatabaseMessage(error instanceof Error ? error.message : "The database file could not be imported.");
    } finally {
      setImporting(false);
      if (databaseInput.current) databaseInput.current.value = "";
    }
  };

  const clearDatabase = async () => {
    if (!databaseTotal || clearingDatabase) return;
    const confirmed = window.confirm("Clear browser-saved word/phrase overrides?\n\nThe repo files translations.json and CN.csv will not be changed.");
    if (!confirmed) return;

    setClearingDatabase(true);
    setDatabaseMessage("Clearing sentence and word/phrase entries…");
    try {
      const deleted = loadTranslationDatabase().length;
      saveTranslationDatabase([]);
      setDatabaseTotal(databaseEntries.length);
      setDatabaseMessage(`Cleared ${deleted.toLocaleString()} local word/phrase override entries. Reload to restore untouched CN.csv values where an override replaced them.`);
      setEntry(null);
      setMeaningDraft("");
      setSynonyms([]);
      setTranslationsList([""]);
      setContexts([""]);
      setNotesDraft("");
      setImageUrl("");
      setLookupState(lookupText ? "missing" : "idle");
      setPanelTab("lookup");
      setLookupVersion((version) => version + 1);
    } catch (error) {
      setDatabaseMessage(error instanceof Error ? error.message : "The databases could not be cleared.");
    } finally {
      setClearingDatabase(false);
    }
  };

  if (view === "shelf") {
    return (
      <main className="shelf-page">
        <header className="shelf-header">
          <span className="reader-mark">语</span>
          <div>
            <p className="eyebrow">Reader Shelf</p>
            <h1>Choose a book</h1>
          </div>
          <RouteLink className="topbar-link" href="/help" loadingLabel="Opening help">? Help</RouteLink>
        </header>

        <section className="shelf-content">
          <div className="shelf-intro">
            <p>Books are loaded from <code>ChineseReader/public/books</code>. Add TXT, PDF, or EPUB files there, then run the dev server or build command to refresh the shelf.</p>
            {fileMessage && <p className={`file-status ${fileState}`}>{fileMessage}</p>}
            {catalogMessage && <p className={`file-status ${catalogState === "error" ? "error" : "idle"}`}>{catalogMessage}</p>}
          </div>

          <div className="book-grid">
            {catalogState === "loading" ? (
              <div className="shelf-loading"><span className="route-spinner" /><strong>Loading shelf</strong></div>
            ) : catalog.map((item) => (
              <button className={`book-card ${activeBookId === item.id ? "active" : ""}`} type="button" key={item.id} onClick={() => void loadShelfBook(item)}>
                <span>{item.format}</span>
                <strong>{item.title}</strong>
                {item.author && <small>{item.author}</small>}
                {item.description && <p>{item.description}</p>}
              </button>
            ))}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className={`reader-app theme-${themeMode}`} style={{ "--highlight": highlightColor } as CSSProperties}>
      <header className="topbar">
        <div className="topbar-left">
          <button className="reader-mark shelf-mark" type="button" onClick={() => setView("shelf")} aria-label="Back to shelf">语</button>
          <button type="button" onClick={() => databaseInput.current?.click()} disabled={importing}><Icon name="database" /> {importing ? "Importing…" : "Import database"}</button>
          <button type="button" onClick={exportCsv}><Icon name="database" /> Export CSV</button>
          <button type="button" onClick={exportJson}><Icon name="database" /> Export JSON</button>
          <RouteLink className="topbar-link" href="/help" loadingLabel="Opening help">? Help</RouteLink>
          <input ref={databaseInput} type="file" accept=".json,.csv,application/json,text/csv" hidden onChange={(event) => void importDatabase(event.target.files?.[0])} />
        </div>
        <div className="book-heading"><strong>{book.title}</strong><small>{currentSection?.title}</small></div>
        <div className="topbar-right">
          <span>{databaseTotal.toLocaleString()} matches</span>
          <button className={`page-pinyin-toggle ${showPinyin ? "active" : ""}`} type="button" onClick={() => setShowPinyin((value) => !value)}>拼 Pinyin</button>
          <button className={`settings-button ${panelTab === "settings" ? "active" : ""}`} type="button" onClick={() => setPanelTab("settings")} aria-label="Open settings"><Icon name="settings" /> Settings</button>
          <span className="interaction-hint">Click sentence · Highlight ≤8</span>
        </div>
      </header>

      <div className="reader-layout">
        <section className="book-side">
          <div className="book-page">
            {pageNavigation.phase !== "idle" && <div className={`page-load-indicator ${pageNavigation.phase}`} role="status" aria-live="polite"><span className="page-load-spinner" />{pageNavigation.label}</div>}
            <div className="page-meta"><span>{book.format}</span><strong>{currentSection?.title}</strong></div>
            <div className={`continuous-text ${showPinyin ? "pinyin-mode" : ""}`} ref={readerText} onMouseUp={captureSelection} onTouchEnd={() => window.setTimeout(captureSelection, 30)}>
              {pageCharacters.map((character, index) => <Fragment key={index}>
                {(pageImages.get(index) ?? []).map((image) => <EpubIllustration key={image.id} src={image.src} alt={image.alt} />)}
                <span className={`page-character ${activePageIndex === index ? "spoken-character" : ""} ${lookupMode === "sentence" && index >= selectionStart && index < selectionStart + lookupText.length ? "selected-sentence" : ""}`} data-pinyin={pagePinyin[index] || undefined} onClick={() => selectSentenceAt(index)}>{character}</span>
              </Fragment>)}
              {(pageImages.get(currentText.length) ?? []).map((image) => <EpubIllustration key={image.id} src={image.src} alt={image.alt} />)}
            </div>
            {!currentText && !currentSection?.images?.length && <div className="empty-page">No selectable Chinese text or illustrations were found on this page.</div>}
          </div>

          <footer className="reader-footer">
            <button className={`page-arrow ${pageNavigation.phase === "loading" && pageNavigation.direction === "previous" ? "working" : ""}`} data-label="Previous page" type="button" onClick={() => changeSection(sectionIndex - 1)} disabled={sectionIndex === 0 || pageNavigation.phase === "loading"} aria-label="Previous page">{pageNavigation.phase === "loading" && pageNavigation.direction === "previous" ? <span className="page-button-spinner" /> : <Icon name="back" />}</button>
            <div className="progress-label"><strong>{progress}%</strong><small>{sectionIndex + 1} / {book.sections.length}</small></div>
            <button className="footer-play" type="button" onClick={toggleFooterPlayback} disabled={!currentText} aria-label={playbackMode === "page" && playback === "playing" ? "Pause reading" : lookupText ? "Read from selection" : "Read whole page"}><Icon name={playbackMode === "page" && playback === "playing" ? "pause" : "play"} /></button>
            <button className={`page-arrow ${pageNavigation.phase === "loading" && pageNavigation.direction === "next" ? "working" : ""}`} data-label="Next page" type="button" onClick={() => changeSection(sectionIndex + 1)} disabled={sectionIndex >= book.sections.length - 1 || pageNavigation.phase === "loading"} aria-label="Next page">{pageNavigation.phase === "loading" && pageNavigation.direction === "next" ? <span className="page-button-spinner" /> : <Icon name="forward" />}</button>
          </footer>
        </section>

        <aside className="explain-side">
          {panelTab === "settings" ? (
            <div className="explanation settings-explanation">
              <div className="selection-label"><span>SETTINGS</span></div>
              <h1>Reader settings</h1>
              <div className="settings-panel">
                <label className="setting-row"><span>Audio speed <strong>{rate.toFixed(1)}×</strong></span><input type="range" min="0.5" max="1.5" step="0.1" value={rate} onChange={(event) => changeRate(Number(event.target.value))} /></label>
                <div className="setting-row"><span>Reader theme <strong>{themeMode === "paper" ? "Yuliu Paper" : themeMode === "light" ? "Light" : "Dark"}</strong></span><div className="theme-options">
                  {[
                    ["paper", "Yuliu Paper"],
                    ["light", "Light"],
                    ["dark", "Dark"],
                  ].map(([value, label]) => <button key={value} className={themeMode === value ? "active" : ""} type="button" onClick={() => setThemeMode(value as ThemeMode)}>{label}</button>)}
                </div></div>
                <label className="setting-row"><span>Highlight color <strong>{highlightColor.toUpperCase()}</strong></span><input type="color" value={highlightColor} onChange={(event) => setHighlightColor(event.target.value)} /></label>
                <div className="color-swatches">
                  {["#f0ca68", "#82d6bd", "#93c5fd", "#fca5a5", "#c4b5fd"].map((color) => <button key={color} type="button" style={{ backgroundColor: color }} className={highlightColor === color ? "active" : ""} onClick={() => setHighlightColor(color)} aria-label={`Use highlight color ${color}`} />)}
                </div>
                <div className="advanced-color">
                  <span>Advanced RGB</span>
                  {[
                    ["red", "R", highlightRgb.red],
                    ["green", "G", highlightRgb.green],
                    ["blue", "B", highlightRgb.blue],
                  ].map(([channel, label, value]) => <label key={channel}><b>{label}</b><input type="number" min="0" max="255" value={value} onChange={(event) => changeHighlightRgb(channel as "red" | "green" | "blue", Number(event.target.value))} /></label>)}
                </div>
              </div>
              <DatabaseStatus total={databaseTotal} message={databaseMessage} clearing={clearingDatabase} onClear={() => void clearDatabase()} compact />
            </div>
          ) : !lookupText ? (
            <div className="explain-empty">
              <Icon name="book" />
              <strong>Click a sentence or highlight a phrase</strong>
              <p>Click once inside a sentence for its English translation. Highlight up to 8 characters for detailed word or phrase information.</p>
              {selectionMessage && <p className="selection-warning">{selectionMessage}</p>}
              <DatabaseStatus total={databaseTotal} message={databaseMessage} clearing={clearingDatabase} onClear={() => void clearDatabase()} />
              {fileMessage && <p className={`file-status ${fileState}`}>{fileMessage}</p>}
            </div>
          ) : (
            <div className={`explanation ${lookupMode === "sentence" ? "sentence-explanation" : ""}`}>
              {lookupMode === "sentence" ? <>
                <div className="selection-label"><span>FULL SENTENCE</span><button type="button" onClick={() => setShowPinyin((value) => !value)}>{showPinyin ? "Hide pinyin" : "Show pinyin"}</button></div>
                <div className="selection-heading">
                  <h1>{lookupText}</h1>
                  <div className="selection-actions">
                    <button className="selection-audio" type="button" onClick={() => togglePlayback("selection")} aria-label={playbackMode === "selection" && playback === "playing" ? "Pause sentence" : "Read sentence"}><Icon name={playbackMode === "selection" && playback === "playing" ? "pause" : "play"} /></button>
                    <button className="selection-copy" type="button" onClick={() => void copyText(lookupText, "Sentence")} aria-label="Copy selected sentence"><Icon name="copy" /></button>
                  </div>
                </div>
                {showPinyin && <p className="selection-pinyin sentence-pinyin">{pinyin(lookupText, { toneType: "symbol", toneSandhi: true })}</p>}
                {clipboardMessage && <p className="clipboard-status">{clipboardMessage}</p>}
                <div className={`match-status ${lookupState}`}><i /><span>{lookupState === "found" ? "Sentence translation" : lookupState === "loading" ? "Searching sentence database…" : lookupState === "error" ? "Database unavailable" : "No sentence translation found"}</span></div>
                {lookupState === "found" ? <div className="sentence-translation">{entry?.meaning}</div> : lookupState === "missing" ? <p className="sentence-missing">Import this sentence using the sentence JSON format. Sentence entries contain only the original Chinese and its English translation.</p> : null}
                <p className="save-note">Highlight 1–8 characters if you want detailed word or phrase fields.</p>
                <DatabaseStatus total={databaseTotal} message={databaseMessage} clearing={clearingDatabase} onClear={() => void clearDatabase()} compact />
              </> : <>
              <div className="panel-tabs" role="tablist">
                <button className={panelTab === "lookup" ? "active" : ""} type="button" onClick={() => setPanelTab("lookup")}>Lookup</button>
                <button className={panelTab === "edit" ? "active" : ""} type="button" onClick={() => setPanelTab("edit")}>Edit details</button>
              </div>
              <div className="selection-label"><span>{panelTab === "edit" ? "EDIT WORD / PHRASE" : "SELECTED TEXT"}</span><button type="button" onClick={() => setShowPinyin((value) => !value)}>{showPinyin ? "Hide pinyin" : "Show pinyin"}</button></div>
              <div className="selection-heading">
                <h1>{lookupText}</h1>
                <div className="selection-actions">
                  <button className="selection-audio" type="button" onClick={() => togglePlayback("selection")} aria-label={playbackMode === "selection" && playback === "playing" ? "Pause selection" : "Read selection"}><Icon name={playbackMode === "selection" && playback === "playing" ? "pause" : "play"} /></button>
                  <button className="selection-copy" type="button" onClick={() => void copyText(lookupText, "Word")} aria-label="Copy selected word or phrase"><Icon name="copy" /></button>
                  <button className="selection-copy wide" type="button" onClick={() => void copyText(selectedSentenceText(), "Sentence")}>Sentence</button>
                </div>
              </div>
              {showPinyin && <p className="selection-pinyin">{entry?.pinyin || pinyin(lookupText, { toneType: "symbol", toneSandhi: true })}</p>}
              {clipboardMessage && <p className="clipboard-status">{clipboardMessage}</p>}

              {panelTab === "lookup" ? <>
              <div className={`match-status ${lookupState}`}>
                <i />
                <span>{lookupState === "found" ? "Exact database match" : lookupState === "loading" ? "Searching database…" : lookupState === "error" ? "Database unavailable" : "No exact match"}</span>
              </div>

              {entry?.csvFields?.length ? <div className="csv-fields">
                {DISPLAY_CSV_FIELDS.map((label) => {
                  const value = csvFieldValue(entry.csvFields, label);
                  return <div key={label}><b>{displayCsvLabel(label)}</b><span>{value}</span>{isChineseUsageField(label) && value.trim() ? <button className="field-audio" type="button" onClick={() => play(value, -1, "selection")} aria-label="Read Chinese usage sentence"><Icon name="audio" /></button> : null}</div>;
                })}
              </div> : null}
              <button className="save-meaning" type="button" onClick={() => { if (!translationsList.some((value) => value.trim())) setTranslationsList([meaningDraft]); setPanelTab("edit"); }}>Edit all details</button>
              <p className="save-note">Edits are saved in this browser until you export an updated CN.csv.</p>

              <DatabaseStatus total={databaseTotal} message={databaseMessage} clearing={clearingDatabase} onClear={() => void clearDatabase()} compact />
              </> : <div className="details-form">
                {DISPLAY_CSV_FIELDS.map((label) => (
                  <label className="detail-field" key={label}>
                    <span>{displayCsvLabel(label)}{isChineseUsageField(label) && csvFieldValue(csvDraftFields, label).trim() ? <button className="inline-audio" type="button" onClick={() => play(csvFieldValue(csvDraftFields, label), -1, "selection")} aria-label="Read Chinese usage sentence"><Icon name="audio" /></button> : null}</span>
                    <textarea
                      value={csvFieldValue(csvDraftFields, label)}
                      onChange={(event) => setCsvDraftFields((fields) => withCsvFieldValue(fields, label, event.target.value))}
                      placeholder={label === "English Words" ? "English translation" : displayCsvLabel(label)}
                    />
                  </label>
                ))}
                <button className="save-meaning" type="button" onClick={() => void saveMeaning()} disabled={lookupState === "loading"}>{entry ? "Save changes" : "Create entry"}</button>
              </div>}
              </>}
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}

function EpubIllustration({ src, alt }: { src: string; alt: string }) {
  return <figure className="epub-illustration">
    {/* Blob URLs preserve images that live inside the locally opened EPUB. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={src} alt={alt} loading="lazy" />
  </figure>;
}

function DatabaseStatus({ total, message, clearing, onClear, compact = false }: { total: number; message: string; clearing: boolean; onClear: () => void; compact?: boolean }) {
  return <div className={`database-note ${compact ? "compact" : ""}`}><div><b>{total.toLocaleString()} database entries</b><span>{message}</span></div><button type="button" onClick={onClear} disabled={clearing}>{clearing ? "Clearing…" : "Clear overrides"}</button></div>;
}

function FieldList({ label, values, onChange, placeholder, multiline = false, required = false }: { label: string; values: string[]; onChange: (values: string[]) => void; placeholder: string; multiline?: boolean; required?: boolean }) {
  const shown = values.length ? values : [""];
  const update = (index: number, value: string) => onChange(shown.map((item, itemIndex) => itemIndex === index ? value : item));
  return <fieldset className="detail-list"><legend>{label}{required ? " *" : ""}</legend>{shown.map((value, index) => <div className="detail-row" key={index}>{multiline ? <textarea value={value} onChange={(event) => update(index, event.target.value)} placeholder={placeholder} /> : <input value={value} onChange={(event) => update(index, event.target.value)} placeholder={placeholder} />}<button type="button" onClick={() => onChange(shown.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove ${label}`}>×</button></div>)}<button className="add-detail" type="button" onClick={() => onChange([...shown, ""])}>＋ Add {label.toLowerCase().replace(/s$/, "")}</button></fieldset>;
}
