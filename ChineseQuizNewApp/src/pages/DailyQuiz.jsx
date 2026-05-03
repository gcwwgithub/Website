import { useEffect, useMemo, useState } from "react";
import { getUserProgress, getWords, recordDailyAttempt, updateWordProgress } from "../services/words.js";
import { useAuth } from "../state/AuthContext.jsx";
import { buildDailyQueue, getTodayKey, weightColor } from "../utils/quiz.js";

export default function DailyQuiz() {
  const { user } = useAuth();
  const [queue, setQueue] = useState([]);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const todayKey = useMemo(() => getTodayKey(), []);
  const currentWord = queue[index];

  useEffect(() => {
    async function loadQuiz() {
      const [words, progress] = await Promise.all([getWords(), getUserProgress(user.uid)]);
      setQueue(buildDailyQueue(words, progress));
      setLoading(false);
    }
    loadQuiz();
  }, [user.uid]);

  async function submitAnswer(event) {
    event.preventDefault();
    if (!currentWord || !answer.trim()) return;

    const normalizedAnswer = answer.trim().toLowerCase();
    const correctAnswers = [currentWord.english, currentWord.pinyin]
      .filter(Boolean)
      .map((value) => value.trim().toLowerCase());
    const wasCorrect = correctAnswers.includes(normalizedAnswer);

    const nextWeight = await updateWordProgress({ userId: user.uid, word: currentWord, wasCorrect });
    await recordDailyAttempt({ userId: user.uid, dateKey: todayKey, wordId: currentWord.id, wasCorrect });

    setQueue((current) =>
      current.map((word) => (word.id === currentWord.id ? { ...word, weight: nextWeight } : word))
    );
    setMessage(wasCorrect ? "Correct. Weight decreased." : "Not quite. Weight increased.");
    setRevealed(true);
  }

  function nextWord() {
    setAnswer("");
    setRevealed(false);
    setMessage("");
    setIndex((current) => current + 1);
  }

  if (loading) return <main className="page">Loading quiz...</main>;

  if (!queue.length) {
    return (
      <main className="page">
        <section className="panel empty-state">
          <h2>No words yet</h2>
          <p>Add a few words before starting your daily quiz.</p>
        </section>
      </main>
    );
  }

  if (!currentWord) {
    return (
      <main className="page">
        <section className="panel empty-state">
          <p className="eyebrow">Daily Quiz</p>
          <h2>Session complete</h2>
          <p>You reviewed {queue.length} words today.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="page narrow-page">
      <p className="eyebrow">Daily Quiz {index + 1} / {queue.length}</p>
      <section className="quiz-card">
        <span className={`weight-pill ${weightColor(currentWord.weight)}`}>Weight {currentWord.weight}</span>
        <h2>{currentWord.chinese}</h2>
        <form onSubmit={submitAnswer}>
          <label>
            English or pinyin
            <input
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              disabled={revealed}
              autoFocus
            />
          </label>
          {!revealed && <button>Check</button>}
        </form>
        {revealed && (
          <div className="answer-panel">
            <p>{message}</p>
            <p><strong>Pinyin:</strong> {currentWord.pinyin || "None"}</p>
            <p><strong>English:</strong> {currentWord.english}</p>
            {currentWord.example && <p>{currentWord.example}</p>}
            <button onClick={nextWord}>Next</button>
          </div>
        )}
      </section>
    </main>
  );
}
