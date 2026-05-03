import { Link } from "react-router-dom";

const actions = [
  ["Daily Quiz", "/quiz", "Practice a mix of new and review words."],
  ["Word List", "/words", "Browse, add, and edit vocabulary."],
  ["Progress", "/progress", "Review your saved Firestore progress."],
  ["Settings", "/settings", "Check app and Firebase setup."],
];

export default function MainMenu() {
  return (
    <main className="page">
      <section className="hero-panel">
        <p className="eyebrow">Main Menu</p>
        <h2>Study words by weight, one small session at a time.</h2>
        <p className="status-line">React/Vite Firebase app is running.</p>
      </section>
      <div className="menu-grid">
        {actions.map(([title, to, text]) => (
          <Link className="menu-card" to={to} key={to}>
            <h3>{title}</h3>
            <p>{text}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
