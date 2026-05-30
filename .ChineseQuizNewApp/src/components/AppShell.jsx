import { Link, Outlet, useLocation } from "react-router-dom";
import { useSupabaseAuth } from "../services/supabaseAuth.js";

const GAME_ROUTES = new Set([
  "/adverbs",
  "/quiz",
  "/sentence-builder",
  "/synonyms",
  "/translate",
]);

export default function AppShell() {
  const { user, loading } = useSupabaseAuth();
  const location = useLocation();
  const isGameMode = GAME_ROUTES.has(location.pathname);
  const authLabel = loading ? "Checking sign-in" : user ? `Signed in: ${user.email || "Supabase user"}` : "Log in";

  return (
    <>
      <header className="top-bar">
        <div className="top-bar-inner">
          <div className="top-bar-left">
            {isGameMode ? (
              <Link className="site-home-link icon-only-link" to="/" aria-label="Home">
                <img src="data/home.svg" alt="" aria-hidden="true" />
              </Link>
            ) : (
              <a className="site-home-link" href="../index.html">
                <img src="data/icon.png" alt="" aria-hidden="true" />
                <span>Playground</span>
              </a>
            )}
          </div>
          <h1 className="top-bar-title">Chinese Quiz</h1>
          {user || loading ? (
            <div className={`auth-status ${user ? "signed-in" : ""}`}>
              <span className="auth-status-dot" aria-hidden="true" />
              <span>{authLabel}</span>
            </div>
          ) : (
            <Link className="auth-status auth-status-link" to="/settings">
              <span className="auth-status-dot" aria-hidden="true" />
              <span>{authLabel}</span>
            </Link>
          )}
        </div>
      </header>
      <div className="app-shell">
        <Outlet />
      </div>
    </>
  );
}
