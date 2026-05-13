export default function TimerStatus({ isFlipped, timerSeconds, timerRemaining, wasAutoFlipped }) {
  if (timerSeconds <= 0 || (isFlipped && !wasAutoFlipped)) {
    return null;
  }

  return (
    <p className={`timer-status ${wasAutoFlipped ? "expired" : ""}`}>
      {wasAutoFlipped ? (
        "Auto flipped"
      ) : (
        <>
          Time remaining: <span className="timer-count">{timerRemaining}s</span>
        </>
      )}
    </p>
  );
}
