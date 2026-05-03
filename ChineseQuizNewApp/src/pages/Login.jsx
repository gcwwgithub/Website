import { signInWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { useState } from "react";
import { Navigate } from "react-router-dom";
import { auth, firebaseConfigWarning, googleProvider, isFirebaseConfigured } from "../firebase.js";
import { useAuth } from "../state/AuthContext.jsx";

export default function Login() {
  const { user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  if (loading) return <main className="centered">Loading...</main>;
  if (user) return <Navigate to="/" replace />;

  async function handleEmailLogin(event) {
    event.preventDefault();
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (loginError) {
      setError(loginError.message);
    }
  }

  async function handleGoogleLogin() {
    setError("");
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (loginError) {
      setError(loginError.message);
    }
  }

  return (
    <main className="login-page">
      <section className="panel login-panel">
        <p className="eyebrow">ChineseQuizNew</p>
        <h1>Sign in</h1>
        {!isFirebaseConfigured && <p className="error">{firebaseConfigWarning}</p>}
        <form onSubmit={handleEmailLogin}>
          <label>
            Email
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" />
          </label>
          <label>
            Password
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
            />
          </label>
          <button disabled={!isFirebaseConfigured}>Log in</button>
        </form>
        <button className="secondary-button" onClick={handleGoogleLogin} disabled={!isFirebaseConfigured}>
          Continue with Google
        </button>
        {error && <p className="error">{error}</p>}
      </section>
    </main>
  );
}
