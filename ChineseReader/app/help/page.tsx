"use client";

import { useState } from "react";
import { RouteLink } from "../components/route-link";

const SENTENCE_JSON = `{
  "sentences": [
    {
      "source": "这既不是有事情要发生的前兆，也并不是什么非日常的光景。",
      "translation": "This was neither a sign that something was about to happen, nor an unusual sight."
    }
  ]
}`;

const CSV_EXAMPLE = `source,meaning,pinyin,kind,synonyms,translations,contexts,notes,image_url
现充,a person with a fulfilling real life,xiàn chōng,word,现实生活充实的人,real-life winner | socially fulfilled person,现充爆炸了该多好……,Internet slang derived from Japanese 現実充実.,
前兆,,qián zhào,phrase,,,,,
非日常,extraordinary,,phrase,,,,`;

const VOCAB_PROMPT = `Create a detailed word-and-phrase CSV database for my Chinese reader.

Return valid CSV only, with no Markdown fences or explanation. Use exactly these headers:
source,meaning,pinyin,kind,synonyms,translations,contexts,notes,image_url

Rules:
- Include only useful words and phrases from the Chinese content, not full sentences.
- Every source must be between 1 and 8 characters, including punctuation.
- source is required. Other columns may be blank.
- kind must be exactly word or phrase.
- Preserve Chinese text exactly and use tone-marked pinyin when known.
- Separate multiple synonyms, translations, or contexts with a vertical bar: first | second | third.
- Leave image_url blank unless a reliable public image URL is provided.
- Do not invent uncertain meanings; explain ambiguity briefly in notes.

Chinese content:
[PASTE CONTENT HERE]`;

const SENTENCE_PROMPT = `Create a sentence-translation JSON database for my Chinese reader.

Return valid JSON only, with no Markdown fences or explanation. Use exactly this structure:
{"sentences":[{"source":"complete Chinese sentence including its ending punctuation","translation":"natural English translation of the full sentence"}]}

Rules:
- Split the supplied Chinese into complete sentences.
- Preserve each Chinese sentence exactly, including ending punctuation.
- Translate the complete sentence naturally and accurately.
- Include only source and translation. Do not add pinyin, notes, definitions, or extra fields.
- Do not omit, merge, reorder, or duplicate sentences.

Chinese content:
[PASTE CONTENT HERE]`;

function CopyBlock({ title, value }: { title: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };
  return <section className="help-card copy-card"><div className="card-heading"><h2>{title}</h2><button type="button" onClick={() => void copy()}>{copied ? "Copied" : "Copy"}</button></div><pre>{value}</pre></section>;
}

export default function HelpPage() {
  return <main className="help-page">
    <header className="help-header"><RouteLink href="/" loadingLabel="Opening reader">← Back to reader</RouteLink><span className="reader-mark">语</span><strong>Import database help</strong></header>
    <div className="help-content">
      <div className="help-intro"><p className="eyebrow">TWO LOOKUP DATABASES</p><h1>Sentences stay simple.<br />Words use CN.csv.</h1><p>The source files live in <code>ChineseReader/data</code>. The reader loads full sentence translations from <code>data/translations.json</code> and detailed word or phrase rows from <code>data/CN.csv</code>. Sentence entries are used exactly as written. Highlighting 1-8 characters searches the CSV rows.</p></div>

      <div className="format-grid"><CopyBlock title="CN.csv · words and phrases" value={CSV_EXAMPLE} /><CopyBlock title="translations.json · full sentences" value={SENTENCE_JSON} /></div>
      <aside className="help-tip"><b>The 8-character rule</b><span>It applies only to highlighted detailed lookups from <code>CN.csv</code>. Full sentences belong inside <code>translations.json</code> and have no 8-character limit.</span></aside>

      <section className="help-card"><h2>Which file should I edit?</h2><div className="field-table"><div><b>Reader action</b><b>Repo file</b></div><div><code>Click sentence</code><span><code>data/translations.json</code> — exact Chinese sentence plus English translation.</span></div><div><code>Highlight 1-8</code><span><code>data/CN.csv</code> — one row per word or phrase. The reader shows and edits English Translation, Chinese Usage in a Sentence, English Usage in a sentence, and Notes.</span></div><div><code>Export changes</code><span>Use <code>Export CSV</code> or <code>Export JSON</code> in the reader toolbar to download updated files after browser edits.</span></div><div><code>Refresh site</code><span>Run <code>npm.cmd run dev</code> or <code>npm.cmd run build</code>. The data files are copied into <code>public/data</code>, then <code>out/</code> is regenerated for GitHub Pages.</span></div></div></section>

      <aside className="help-tip"><b>Blank CSV cells</b><span><code>CN.csv</code> can contain blank cells. The reader keeps them blank instead of inventing fallback text.</span></aside>

      <div className="prompt-heading"><p className="eyebrow">READY-TO-USE PROMPTS</p><h2>Generate each database separately</h2><p>For best results, paste the same chapter into both prompts. One response becomes <code>CN.csv</code>; the other becomes <code>translations.json</code>.</p></div>
      <CopyBlock title="Prompt · CN.csv words and phrases" value={VOCAB_PROMPT} />
      <CopyBlock title="Prompt · translations.json full sentences" value={SENTENCE_PROMPT} />
    </div>
  </main>;
}
