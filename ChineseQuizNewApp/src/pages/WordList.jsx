import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { deleteWord, getWords } from "../services/words.js";
import { weightColor } from "../utils/quiz.js";

export default function WordList() {
  const [words, setWords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadWords() {
    setLoading(true);
    setError("");
    try {
      setWords(await getWords());
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWords();
  }, []);

  async function handleDelete(wordId) {
    await deleteWord(wordId);
    await loadWords();
  }

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Word List</p>
          <h2>{words.length} words</h2>
        </div>
        <Link className="button-link" to="/words/new">
          Add Word
        </Link>
      </div>

      {loading && <p>Loading words...</p>}
      {error && <p className="error">{error}</p>}

      <div className="word-list">
        {words.map((word) => (
          <article className="word-row" key={word.id}>
            <div>
              <span className={`weight-dot ${weightColor(word.defaultWeight)}`} />
              <h3>{word.chinese}</h3>
              <p>{word.pinyin}</p>
              <p>{word.english}</p>
            </div>
            <div className="row-actions">
              <Link to={`/words/${word.id}/edit`}>Edit</Link>
              <button className="text-button" onClick={() => handleDelete(word.id)}>
                Delete
              </button>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
