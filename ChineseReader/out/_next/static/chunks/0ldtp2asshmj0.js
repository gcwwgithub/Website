(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,57213,e=>{"use strict";var s=e.i(43476),n=e.i(71645);e.s(["RouteLink",0,function({href:e,children:a,className:i,loadingLabel:t}){let[r,l]=(0,n.useState)(!1),c=`/Website/ChineseReader/out${"/"===e?"/":`${e}/`}`;return(0,s.jsxs)(s.Fragment,{children:[(0,s.jsx)("a",{href:c,className:i,onClick:e=>{0!==e.button||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||l(!0)},"aria-busy":r,children:a}),r&&(0,s.jsxs)("div",{className:"route-loading",role:"status","aria-live":"polite",children:[(0,s.jsx)("span",{className:"route-spinner"}),(0,s.jsx)("strong",{children:t}),(0,s.jsx)("small",{children:"Please wait a moment…"})]})]})}])},99494,e=>{"use strict";var s=e.i(43476),n=e.i(71645),a=e.i(57213);let i=`{
  "sentences": [
    {
      "source": "这既不是有事情要发生的前兆，也并不是什么非日常的光景。",
      "translation": "This was neither a sign that something was about to happen, nor an unusual sight."
    }
  ]
}`,t=`source,meaning,pinyin,kind,synonyms,translations,contexts,notes,image_url
现充,a person with a fulfilling real life,xi\xe0n chōng,word,现实生活充实的人,real-life winner | socially fulfilled person,现充爆炸了该多好……,Internet slang derived from Japanese 現実充実.,
前兆,,qi\xe1n zh\xe0o,phrase,,,,,
非日常,extraordinary,,phrase,,,,`,r=`Create a detailed word-and-phrase CSV database for my Chinese reader.

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
[PASTE CONTENT HERE]`,l=`Create a sentence-translation JSON database for my Chinese reader.

Return valid JSON only, with no Markdown fences or explanation. Use exactly this structure:
{"sentences":[{"source":"complete Chinese sentence including its ending punctuation","translation":"natural English translation of the full sentence"}]}

Rules:
- Split the supplied Chinese into complete sentences.
- Preserve each Chinese sentence exactly, including ending punctuation.
- Translate the complete sentence naturally and accurately.
- Include only source and translation. Do not add pinyin, notes, definitions, or extra fields.
- Do not omit, merge, reorder, or duplicate sentences.

Chinese content:
[PASTE CONTENT HERE]`;function c({title:e,value:a}){let[i,t]=(0,n.useState)(!1),r=async()=>{await navigator.clipboard.writeText(a),t(!0),window.setTimeout(()=>t(!1),1600)};return(0,s.jsxs)("section",{className:"help-card copy-card",children:[(0,s.jsxs)("div",{className:"card-heading",children:[(0,s.jsx)("h2",{children:e}),(0,s.jsx)("button",{type:"button",onClick:()=>void r(),children:i?"Copied":"Copy"})]}),(0,s.jsx)("pre",{children:a})]})}e.s(["default",0,function(){return(0,s.jsxs)("main",{className:"help-page",children:[(0,s.jsxs)("header",{className:"help-header",children:[(0,s.jsx)(a.RouteLink,{href:"/",loadingLabel:"Opening reader",children:"← Back to reader"}),(0,s.jsx)("span",{className:"reader-mark",children:"语"}),(0,s.jsx)("strong",{children:"Import database help"})]}),(0,s.jsxs)("div",{className:"help-content",children:[(0,s.jsxs)("div",{className:"help-intro",children:[(0,s.jsx)("p",{className:"eyebrow",children:"TWO LOOKUP DATABASES"}),(0,s.jsxs)("h1",{children:["Sentences stay simple.",(0,s.jsx)("br",{}),"Words use CN.csv."]}),(0,s.jsxs)("p",{children:["The source files live in ",(0,s.jsx)("code",{children:"ChineseReader/data"}),". The reader loads full sentence translations from ",(0,s.jsx)("code",{children:"data/translations.json"})," and detailed word or phrase rows from ",(0,s.jsx)("code",{children:"data/CN.csv"}),". Sentence entries are used exactly as written. Highlighting 1-8 characters searches the CSV rows."]})]}),(0,s.jsxs)("div",{className:"format-grid",children:[(0,s.jsx)(c,{title:"CN.csv · words and phrases",value:t}),(0,s.jsx)(c,{title:"translations.json · full sentences",value:i})]}),(0,s.jsxs)("aside",{className:"help-tip",children:[(0,s.jsx)("b",{children:"The 8-character rule"}),(0,s.jsxs)("span",{children:["It applies only to highlighted detailed lookups from ",(0,s.jsx)("code",{children:"CN.csv"}),". Full sentences belong inside ",(0,s.jsx)("code",{children:"translations.json"})," and have no 8-character limit."]})]}),(0,s.jsxs)("section",{className:"help-card",children:[(0,s.jsx)("h2",{children:"Which file should I edit?"}),(0,s.jsxs)("div",{className:"field-table",children:[(0,s.jsxs)("div",{children:[(0,s.jsx)("b",{children:"Reader action"}),(0,s.jsx)("b",{children:"Repo file"})]}),(0,s.jsxs)("div",{children:[(0,s.jsx)("code",{children:"Click sentence"}),(0,s.jsxs)("span",{children:[(0,s.jsx)("code",{children:"data/translations.json"})," — exact Chinese sentence plus English translation."]})]}),(0,s.jsxs)("div",{children:[(0,s.jsx)("code",{children:"Highlight 1-8"}),(0,s.jsxs)("span",{children:[(0,s.jsx)("code",{children:"data/CN.csv"})," — one row per word or phrase. The reader shows and edits English Translation, Chinese Usage in a Sentence, English Usage in a sentence, and Notes."]})]}),(0,s.jsxs)("div",{children:[(0,s.jsx)("code",{children:"Export changes"}),(0,s.jsxs)("span",{children:["Use ",(0,s.jsx)("code",{children:"Export CSV"})," or ",(0,s.jsx)("code",{children:"Export JSON"})," in the reader toolbar to download updated files after browser edits."]})]}),(0,s.jsxs)("div",{children:[(0,s.jsx)("code",{children:"Refresh site"}),(0,s.jsxs)("span",{children:["Run ",(0,s.jsx)("code",{children:"npm.cmd run dev"})," or ",(0,s.jsx)("code",{children:"npm.cmd run build"}),". The data files are copied into ",(0,s.jsx)("code",{children:"public/data"}),", then ",(0,s.jsx)("code",{children:"out/"})," is regenerated for GitHub Pages."]})]})]})]}),(0,s.jsxs)("aside",{className:"help-tip",children:[(0,s.jsx)("b",{children:"Blank CSV cells"}),(0,s.jsxs)("span",{children:[(0,s.jsx)("code",{children:"CN.csv"})," can contain blank cells. The reader keeps them blank instead of inventing fallback text."]})]}),(0,s.jsxs)("div",{className:"prompt-heading",children:[(0,s.jsx)("p",{className:"eyebrow",children:"READY-TO-USE PROMPTS"}),(0,s.jsx)("h2",{children:"Generate each database separately"}),(0,s.jsxs)("p",{children:["For best results, paste the same chapter into both prompts. One response becomes ",(0,s.jsx)("code",{children:"CN.csv"}),"; the other becomes ",(0,s.jsx)("code",{children:"translations.json"}),"."]})]}),(0,s.jsx)(c,{title:"Prompt · CN.csv words and phrases",value:r}),(0,s.jsx)(c,{title:"Prompt · translations.json full sentences",value:l})]})]})}])}]);