import { Link } from "react-router-dom";

export default function MainMenu() {
  return (
    <main className="page home-page">
      <section className="hero-panel home-hero">
        <p className="eyebrow">Daily practice</p>
        <h2>Chinese Quiz</h2>
        <p className="home-copy">Review vocabulary with a simple weighted quiz.</p>
        <Link className="play-button" to="/play">
          Play
        </Link>
      </section>
    </main>
  );
}
