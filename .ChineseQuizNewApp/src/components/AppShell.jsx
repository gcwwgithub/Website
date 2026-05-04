import { Link, Outlet } from "react-router-dom";

export default function AppShell() {
  return (
    <>
      <header className="top-bar">
        <div className="top-bar-inner">
          <Link className="home-title" to="/">
            <h1>Chinese Quiz</h1>
          </Link>
        </div>
      </header>
      <div className="app-shell">
        <Outlet />
      </div>
    </>
  );
}
