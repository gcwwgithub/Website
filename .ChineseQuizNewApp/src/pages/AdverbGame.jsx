import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { loadAdverbRows } from "../services/adverbCsv.js";

export default function AdverbGame() {
  const [rows, setRows] = useState([]);
  const [currentRow, setCurrentRow] = useState(null);
  const [options, setOptions] = useState([]);
  const [score, setScore] = useState({ correct: 0, wrong: 0 });
  const [selected, setSelected] = useState("");
  const [mistakes, setMistakes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const isAnswered = Boolean(selected);

  const weightedRows = useMemo(() => {
    const mistakeItems = new Set(mistakes.map((mistake) => mistake.item));
    return rows.flatMap((row) => (mistakeItems.has(row.item) ? [row, row, row] : [row]));
  }, [mistakes, rows]);

  useEffect(() => {
    async function loadGame() {
      try {
        const loadedRows = await loadAdverbRows();
        setRows(loadedRows);
        setNextQuestion(loadedRows, setCurrentRow, setOptions);
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    }

    loadGame();
  }, []);

  function answer(option) {
    if (!currentRow || selected) {
      return;
    }

    const wasCorrect = option === currentRow.item;
    setSelected(option);
    setScore((current) => ({
      correct: current.correct + (wasCorrect ? 1 : 0),
      wrong: current.wrong + (wasCorrect ? 0 : 1),
    }));

    if (!wasCorrect) {
      setMistakes((current) => [...current, currentRow]);
    }
  }

  function nextQuestion() {
    setSelected("");
    setNextQuestion(weightedRows.length ? weightedRows : rows, setCurrentRow, setOptions);
  }

  if (loading) {
    return <main className="page narrow-page">Loading adverb game...</main>;
  }

  if (error) {
    return (
      <main className="page narrow-page">
        <section className="panel empty-state">
          <h2>Could not load adverb game</h2>
          <p className="error">{error}</p>
        </section>
      </main>
    );
  }

  if (!currentRow) {
    return (
      <main className="page narrow-page">
        <section className="panel empty-state">
          <h2>No adverb questions found</h2>
          <p>Add adverb rows to the grammar CSV to play this mode.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="page narrow-page">
      <section className="quiz-card adverb-card">
        <div className="adverb-header">
          <p className="eyebrow">Adverb Game</p>
          <span>{score.correct} correct / {score.wrong} wrong</span>
        </div>
        <h2>
          <HighlightedPrompt text={currentRow.prompt} highlight={currentRow.highlight} />
        </h2>
        <div className="adverb-options">
          {options.map((option) => (
            <button
              className={getOptionClass(option, currentRow.item, selected)}
              disabled={isAnswered}
              key={option}
              onClick={() => answer(option)}
            >
              {option}
            </button>
          ))}
        </div>
        {isAnswered && (
          <div className={`adverb-feedback ${selected === currentRow.item ? "correct" : "wrong"}`}>
            <strong>{selected === currentRow.item ? "Correct" : "Wrong"}</strong>
            <p>Focus adverb: {currentRow.item}</p>
            <div className="mandarin-answer">
              <span>Mandarin sentence</span>
              <p>{currentRow.chinesePrompt}</p>
            </div>
            <p>Category: {currentRow.category.replaceAll("_", " ")}</p>
            <button onClick={nextQuestion}>Next</button>
          </div>
        )}
      </section>
      <section className="panel adverb-summary">
        <h3>Mistakes</h3>
        {mistakes.length ? (
          mistakes.slice(-5).map((mistake, index) => (
            <p key={`${mistake.item}-${index}`}>{mistake.item}: {mistake["example sentence 1"]}</p>
          ))
        ) : (
          <p>No mistakes yet.</p>
        )}
      </section>
      <Link className="back-link" to="/play">Change mode</Link>
    </main>
  );
}

function setNextQuestion(sourceRows, setCurrentRow, setOptions) {
  if (!sourceRows.length) {
    setCurrentRow(null);
    setOptions([]);
    return;
  }

  const sourceRow = sourceRows[Math.floor(Math.random() * sourceRows.length)];
  const example = pickExampleSentence(sourceRow);
  const nextRow = {
    ...sourceRow,
    prompt: example.text,
    chinesePrompt: example.chinesePrompt,
    highlight: example.highlight,
  };
  const distractors = sourceRows
    .filter((row) => row.item !== nextRow.item)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3)
    .map((row) => row.item);

  setCurrentRow(nextRow);
  setOptions([nextRow.item, ...distractors].sort(() => Math.random() - 0.5));
}

function pickExampleSentence(row) {
  const examples = [
    {
      text: row["example sentence 1"],
      chinesePrompt: row["chinese sentence 1"],
      highlight: inferHighlight(row.item, row["example sentence 1"]),
    },
    {
      text: row["example sentence 2"],
      chinesePrompt: row["chinese sentence 2"],
      highlight: inferHighlight(row.item, row["example sentence 2"]),
    },
    {
      text: row["example sentence 3"],
      chinesePrompt: row["chinese sentence 3"],
      highlight: inferHighlight(row.item, row["example sentence 3"]),
    },
    {
      text: row["example sentence 4"],
      chinesePrompt: row["chinese sentence 4"],
      highlight: inferHighlight(row.item, row["example sentence 4"]),
    },
  ].filter((example) => example.text);

  return examples[Math.floor(Math.random() * examples.length)] || {
    text: row["example sentence 1"],
    chinesePrompt: row["chinese sentence 1"],
    highlight: "",
  };
}

function HighlightedPrompt({ text, highlight }) {
  if (!highlight || !text.toLowerCase().includes(highlight.toLowerCase())) {
    return text;
  }

  const startIndex = text.toLowerCase().indexOf(highlight.toLowerCase());
  const endIndex = startIndex + highlight.length;

  return (
    <>
      {text.slice(0, startIndex)}
      <mark>{text.slice(startIndex, endIndex)}</mark>
      {text.slice(endIndex)}
    </>
  );
}

function inferHighlight(item, sentence) {
  const highlightByItem = {
    才: ["Only after", "until", "Only when"],
    不由得: ["could not help"],
    说不定: ["Maybe", "Perhaps"],
    有点: ["a little", "a bit"],
    也只是: ["only"],
    那就是: ["problem is that", "suggestion is that", "reason is that"],
    突然出现了: ["suddenly appeared"],
    似乎: ["seems"],
    好像: ["looks as if", "seems like", "looks like"],
    看起来: ["looks"],
    试图: ["tried", "attempted"],
    想要: ["want", "wants"],
    总之: ["In short", "All in all", "In conclusion"],
    果然: ["As expected", "Sure enough"],
    只好: ["no choice but", "had to"],
    只能: ["can only"],
    一定: ["definitely", "must", "certain"],
    由于: ["Due to", "Because of"],
    因为: ["Because"],
    首先: ["First", "First of all"],
    最重要的是: ["Most importantly", "most important"],
    是否: ["whether"],
    大约: ["about"],
    尽情地: ["as much as they liked", "freely"],
    已经: ["already"],
    正在: ["currently", "now"],
    刚刚: ["just"],
    马上: ["right away", "soon", "immediately"],
    立刻: ["immediately"],
    曾经: ["once"],
    暂时: ["temporarily", "for now"],
    最近: ["Recently", "lately"],
    终于: ["finally"],
    一直: ["always", "kept", "have been"],
    经常: ["often"],
    常常: ["frequently", "often"],
    偶尔: ["occasionally", "sometimes"],
    很少: ["rarely", "seldom"],
    从不: ["never"],
    往往: ["often"],
    再三: ["repeatedly", "again and again"],
    大概: ["probably"],
    可能: ["may", "might"],
    也许: ["Maybe", "Perhaps"],
    未必: ["not necessarily", "may not"],
    居然: ["actually", "unexpectedly"],
    偏偏: ["Of all", "just had to"],
    幸好: ["Fortunately", "Luckily"],
    差点: ["almost", "nearly"],
    完全: ["completely"],
    相当: ["quite", "rather"],
    十分: ["very", "extremely"],
    极其: ["extremely"],
    格外: ["especially", "particularly"],
    颇: ["rather", "quite"],
    略微: ["slightly", "a little"],
    因此: ["therefore", "so"],
    所以: ["so"],
    于是: ["so"],
    因而: ["therefore", "as a result"],
    然而: ["however"],
    不过: ["but"],
    而且: ["also", "and"],
    再说: ["Besides", "Moreover"],
    同时: ["At the same time", "at the same time"],
  };

  const candidates = highlightByItem[item] || [];
  return candidates.find((candidate) => sentence.toLowerCase().includes(candidate.toLowerCase())) || "";
}

function getOptionClass(option, correct, selected) {
  if (!selected) {
    return "";
  }

  if (option === correct) {
    return "correct-option";
  }

  if (option === selected) {
    return "wrong-option";
  }

  return "";
}
