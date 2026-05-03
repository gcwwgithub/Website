import { Link } from "react-router-dom";
import { useState } from "react";

export default function PlayMode() {
  const [questionCount, setQuestionCount] = useState("20");
  const parsedQuestionCount = Number.parseInt(questionCount, 10);
  const safeQuestionCount = Math.max(1, Math.min(100, parsedQuestionCount || 20));
  const quizOptions = `count=${safeQuestionCount}`;

  function handleQuestionCountChange(event) {
    setQuestionCount(event.target.value.replace(/\D/g, ""));
  }

  return (
    <main className="page home-page">
      <section className="hero-panel mode-panel">
        <p className="eyebrow">Choose mode</p>
        <h2>Play Chinese Quiz</h2>
        <div className="mode-grid">
          <Link className="mode-button" to={`/quiz?mode=english-to-chinese&${quizOptions}`}>
            <span>English to Chinese</span>
            <small>See English, answer in Chinese.</small>
          </Link>
          <Link className="mode-button" to={`/quiz?mode=chinese-to-english&${quizOptions}`}>
            <span>Chinese to English</span>
            <small>See Chinese, answer in English or pinyin.</small>
          </Link>
        </div>
        <label className="question-count">
          Number of questions
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={questionCount}
            onChange={handleQuestionCountChange}
            placeholder="20"
          />
        </label>
      </section>
    </main>
  );
}
