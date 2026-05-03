import { Link, Outlet } from "react-router-dom";

export default function AppShell() {
  return (
    <div className="app-shell">
      <header className="top-bar">
        <Link className="home-title" to="/">
          <p className="eyebrow">Practice mode</p>
          <h1>Chinese Quiz</h1>
        </Link>
      </header>
      <Outlet />
    </div>
  );
}
