import { firebaseConfigWarning, isFirebaseConfigured } from "../firebase.js";
import { useState } from "react";

export default function Settings() {
  const [message, setMessage] = useState("");

  function deleteAllMemory() {
    const shouldDelete = window.confirm("Do you really want to delete all memory?");
    if (!shouldDelete) {
      return;
    }

    window.localStorage.clear();
    setMessage("All saved memory has been deleted.");
  }

  return (
    <main className="page narrow-page">
      <p className="eyebrow">Settings</p>
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
        <h2>Firebase</h2>
        <p>Status: {isFirebaseConfigured ? "Configured" : "Missing configuration"}</p>
        {!isFirebaseConfigured && <p className="error">{firebaseConfigWarning}</p>}
        <p className="muted">Environment values are loaded from `.env.local` during local development.</p>
      </section>
    </main>
  );
}
