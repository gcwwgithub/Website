import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getWord, saveWord } from "../services/words.js";

const emptyWord = {
  chinese: "",
  pinyin: "",
  english: "",
  example: "",
};

export default function AddEditWord() {
  const { wordId } = useParams();
  const navigate = useNavigate();
  const [word, setWord] = useState(emptyWord);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadWord() {
      if (!wordId) return;
      const existing = await getWord(wordId);
      if (existing) {
        setWord({
          chinese: existing.chinese ?? "",
          pinyin: existing.pinyin ?? "",
          english: existing.english ?? "",
          example: existing.example ?? "",
        });
      }
    }
    loadWord();
  }, [wordId]);

  function updateField(field, value) {
    setWord((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await saveWord(wordId, word);
      navigate("/words");
    } catch (saveError) {
      setError(saveError.message);
      setSaving(false);
    }
  }

  return (
    <main className="page narrow-page">
      <p className="eyebrow">{wordId ? "Edit Word" : "Add Word"}</p>
      <h2>{wordId ? "Update vocabulary" : "Create vocabulary"}</h2>
      <form className="panel form-panel" onSubmit={handleSubmit}>
        <label>
          Chinese
          <input value={word.chinese} onChange={(event) => updateField("chinese", event.target.value)} required />
        </label>
        <label>
          Pinyin
          <input value={word.pinyin} onChange={(event) => updateField("pinyin", event.target.value)} />
        </label>
        <label>
          English
          <input value={word.english} onChange={(event) => updateField("english", event.target.value)} required />
        </label>
        <label>
          Example
          <textarea value={word.example} onChange={(event) => updateField("example", event.target.value)} />
        </label>
        <button disabled={saving}>{saving ? "Saving..." : "Save Word"}</button>
        {error && <p className="error">{error}</p>}
      </form>
    </main>
  );
}
