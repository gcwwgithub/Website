import { Outlet } from "react-router-dom";
import { useSupabaseAuth } from "../services/supabaseAuth.js";

export default function AppShell() {
  const { user, loading } = useSupabaseAuth();
  const authLabel = loading ? "Checking sign-in" : user ? `Signed in: ${user.email || "Supabase user"}` : "Not signed in";

  return (
    <>
      <header className="top-bar">
        <div className="top-bar-inner">
          <div className="top-bar-left">
            <a className="site-home-link" href="../index.html">
              WebPlayground
            </a>
          </div>
          <div className={`auth-status ${user ? "signed-in" : ""}`}>
            <span className="auth-status-dot" aria-hidden="true" />
            <span>{authLabel}</span>
          </div>
        </div>
      </header>
      <div className="app-shell">
        <Outlet />
      </div>
    </>
  );
}
