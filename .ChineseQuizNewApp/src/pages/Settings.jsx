import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { isSupabaseConfigured, supabaseConfigWarning } from "../supabase.js";
import {
  signInWithSupabasePassword,
  signOutOfSupabase,
  useSupabaseAuth,
} from "../services/supabaseAuth.js";
import { deleteRemoteColorProgress } from "../services/colorProgressTracking.js";

export default function Settings() {
  const navigate = useNavigate();
  const { user, loading } = useSupabaseAuth();
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authError, setAuthError] = useState("");
  const [supabaseMemoryMessage, setSupabaseMemoryMessage] = useState("");
  const [supabaseMemoryError, setSupabaseMemoryError] = useState("");
  const [isDeletingSupabaseMemory, setIsDeletingSupabaseMemory] = useState(false);

  function deleteAllMemory() {
    const shouldDelete = window.confirm("Do you really want to delete all memory?");
    if (!shouldDelete) {
      return;
    }

    window.localStorage.clear();
    setMessage("All saved memory has been deleted.");
  }

  async function handleSignIn(event) {
    event.preventDefault();
    setAuthMessage("");
    setAuthError("");
    try {
      await signInWithSupabasePassword({ email: email.trim(), password });
      setPassword("");
      setAuthMessage("Signed in.");
      navigate("/");
    } catch (error) {
      setAuthError(error.message);
    }
  }

  async function handleSignOut() {
    setAuthMessage("");
    setAuthError("");
    try {
      await signOutOfSupabase();
      setAuthMessage("Signed out.");
    } catch (error) {
      setAuthError(error.message);
    }
  }

  async function deleteSupabaseMemory() {
    if (!user?.id) {
      return;
    }

    const shouldDelete = window.confirm("Do you really want to delete all Supabase memory?");
    if (!shouldDelete) {
      return;
    }

    setSupabaseMemoryMessage("");
    setSupabaseMemoryError("");
    setIsDeletingSupabaseMemory(true);

    try {
      await deleteRemoteColorProgress({ userId: user.id });
      setSupabaseMemoryMessage("All Supabase memory has been deleted.");
    } catch (error) {
      setSupabaseMemoryError(error.message);
    } finally {
      setIsDeletingSupabaseMemory(false);
    }
  }

  return (
    <main className="page narrow-page">
      <div className="page-heading-row">
        <Link className="secondary-button settings-link icon-only-button" to="/" aria-label="Go home">
          <img src="data/home.svg" alt="" aria-hidden="true" />
        </Link>
      </div>
      <section className="panel">
        <h2>Memory</h2>
        <p className="muted">
          This clears saved local progress, including color values stored on this browser.
        </p>
        <button className="danger-button" type="button" onClick={deleteAllMemory}>
          Delete all memory
        </button>
        {message && <p className="success-message">{message}</p>}
      </section>
      <section className="panel">
        <h2>Supabase</h2>
        <p>Status: {isSupabaseConfigured ? "Configured" : "Missing configuration"}</p>
        {!isSupabaseConfigured && <p className="error">{supabaseConfigWarning}</p>}
        <div className={`sign-in-banner ${user ? "signed-in" : ""}`}>
          <strong>{loading ? "Checking sign-in" : user ? "You are signed in" : "You are not signed in"}</strong>
          <span>{user ? user.email || "Supabase user" : "Log in with your Supabase email and password to unlock database pages."}</span>
        </div>
        <p className="muted">
          Supabase mirrors your CSV color progress when you are signed in. Access is enforced by Supabase row level security.
        </p>
        {loading && <p className="muted">Checking sign-in...</p>}
        {!loading && user && (
          <div className="account-card">
            <p>Signed in as {user.email || "Supabase user"}</p>
            <p className="muted">Database permissions are checked by Supabase policies.</p>
            <div className="account-actions">
              <button className="secondary-button" type="button" onClick={handleSignOut}>
                Sign out
              </button>
              <button
                className="danger-button"
                type="button"
                onClick={deleteSupabaseMemory}
                disabled={isDeletingSupabaseMemory}
              >
                {isDeletingSupabaseMemory ? "Deleting..." : "Delete Supabase memory"}
              </button>
            </div>
          </div>
        )}
        {!loading && !user && (
          <form className="auth-form" onSubmit={handleSignIn}>
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
            <button type="submit" disabled={!isSupabaseConfigured || !email.trim() || !password}>
              Log in
            </button>
          </form>
        )}
        {authMessage && <p className="success-message">{authMessage}</p>}
        {authError && <p className="error">{authError}</p>}
        {supabaseMemoryMessage && <p className="success-message">{supabaseMemoryMessage}</p>}
        {supabaseMemoryError && <p className="error">{supabaseMemoryError}</p>}
      </section>
    </main>
  );
}
