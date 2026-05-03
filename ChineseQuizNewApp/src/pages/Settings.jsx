import { firebaseConfigWarning, isFirebaseConfigured } from "../firebase.js";

export default function Settings() {
  return (
    <main className="page narrow-page">
      <p className="eyebrow">Settings</p>
      <section className="panel">
        <h2>Firebase</h2>
        <p>Status: {isFirebaseConfigured ? "Configured" : "Missing configuration"}</p>
        {!isFirebaseConfigured && <p className="error">{firebaseConfigWarning}</p>}
        <p className="muted">Environment values are loaded from `.env.local` during local development.</p>
      </section>
    </main>
  );
}
