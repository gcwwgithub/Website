export default function LoadingScreen({ label = "Loading", progress = null }) {
  const normalizedProgress = progress == null ? null : Math.max(0, Math.min(100, Math.round(progress)));

  return (
    <main className="page narrow-page loading-page" aria-busy="true">
      <section className="panel loading-panel">
        <p className="eyebrow">{label}</p>
        <div className="loading-track" aria-hidden="true">
          <span style={{ width: `${normalizedProgress ?? 42}%` }} />
        </div>
        {normalizedProgress != null && <p className="muted">{normalizedProgress}% ready</p>}
      </section>
    </main>
  );
}
