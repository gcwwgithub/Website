export default function ColorBadge({ colorValue, loseStreak }) {
  const rawLevel = Number.parseInt(colorValue, 10);
  const level = Math.max(1, Number.isNaN(rawLevel) ? 1 : rawLevel);
  const barLevel = Math.min(10, level);
  const isOverLimit = level > 10;
  const parsedLoseStreak = Number.parseInt(loseStreak, 10);
  const streakValue = Number.isNaN(parsedLoseStreak) ? 0 : parsedLoseStreak;

  return (
    <div className={`severity-meter ${isOverLimit ? "over-limit" : ""}`} aria-label={`Severity ${level} out of 10`}>
      <div className="severity-track">
        <span style={{ width: `${barLevel * 10}%` }} />
      </div>
      <strong>{level}/10</strong>
      <span className={`streak-pill ${streakValue < 0 ? "winning" : streakValue > 0 ? "losing" : ""}`}>
        Streak {streakValue}
      </span>
    </div>
  );
}
