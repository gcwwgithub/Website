export function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function weightColor(weight = 3) {
  if (weight <= 2) return "green";
  if (weight <= 5) return "amber";
  return "red";
}

export function buildDailyQueue(words, progressByWordId, limit = 10) {
  const scored = words.map((word) => {
    const progress = progressByWordId.get(word.id);
    const weight = progress?.weight ?? word.defaultWeight ?? 3;
    const isNew = !progress;
    return {
      ...word,
      weight,
      isNew,
      score: (isNew ? 4 : 0) + weight + Math.random(),
    };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}
