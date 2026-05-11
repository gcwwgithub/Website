export default function ColorBadge({ colorValue }) {
  const rawLevel = Number.parseInt(colorValue, 10);
  const level = Math.max(1, Number.isNaN(rawLevel) ? 1 : rawLevel);
  const barLevel = Math.min(10, level);

  return (
    <div className="severity-meter" aria-label={`Severity ${level} out of 10`}>
      <div className="severity-track">
        <span style={{ width: `${barLevel * 10}%` }} />
      </div>
      <strong>{level}/10</strong>
    </div>
  );
}
