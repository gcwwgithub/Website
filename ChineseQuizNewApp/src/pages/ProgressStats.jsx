import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "../firebase.js";
import { useAuth } from "../state/AuthContext.jsx";

export default function ProgressStats() {
  const { user } = useAuth();
  const [progress, setProgress] = useState([]);
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    async function loadStats() {
      const progressSnapshot = await getDocs(collection(db, "users", user.uid, "progress"));
      const sessionSnapshot = await getDocs(
        query(collection(db, "users", user.uid, "dailySessions"), orderBy("date", "desc"))
      );
      setProgress(progressSnapshot.docs.map((progressDoc) => ({ id: progressDoc.id, ...progressDoc.data() })));
      setSessions(sessionSnapshot.docs.map((sessionDoc) => ({ id: sessionDoc.id, ...sessionDoc.data() })));
    }
    loadStats();
  }, [user.uid]);

  const correct = progress.reduce((total, item) => total + (item.correctCount ?? 0), 0);
  const wrong = progress.reduce((total, item) => total + (item.wrongCount ?? 0), 0);

  return (
    <main className="page">
      <p className="eyebrow">Progress</p>
      <div className="stats-grid">
        <Stat label="Tracked words" value={progress.length} />
        <Stat label="Correct" value={correct} />
        <Stat label="Wrong" value={wrong} />
      </div>
      <section className="panel">
        <h2>Daily sessions</h2>
        {sessions.length === 0 && <p>No quiz sessions recorded yet.</p>}
        {sessions.map((session) => (
          <div className="session-row" key={session.id}>
            <span>{session.date}</span>
            <span>{session.correct ?? 0} / {session.total ?? 0}</span>
          </div>
        ))}
      </section>
    </main>
  );
}

function Stat({ label, value }) {
  return (
    <section className="stat-card">
      <p>{label}</p>
      <strong>{value}</strong>
    </section>
  );
}
