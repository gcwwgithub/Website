import { supabase } from "../supabase.js";
import { getColorProgressId } from "./progressIdentity.js";

export async function saveRemoteColorProgress({ userId, storageKey, row, colorValue, loseStreak, isFlagged, isNew }) {
  if (!supabase || !userId || !storageKey || !row) {
    return;
  }

  const payload = buildColorProgressPayload({ userId, storageKey, row, colorValue, loseStreak, isFlagged, isNew });
  if (!payload) {
    return;
  }

  const { error } = await supabase
    .from("chinese_quiz_color_progress")
    .upsert(payload, { onConflict: "user_id,game_mode,progress_id" });

  if (error) {
    throw error;
  }
}

export async function syncRemoteColorProgress({ userId, storageKey, rows, isNew }) {
  if (!supabase || !userId || !storageKey || !rows?.length) {
    return;
  }

  const payload = rows
    .map((row) =>
      buildColorProgressPayload({
        userId,
        storageKey,
        row,
        colorValue: row.Color,
        loseStreak: row["Lose Streak"],
        isFlagged: row.__isFlagged,
        isNew,
      })
    )
    .filter(Boolean);

  if (!payload.length) {
    return;
  }

  for (const batch of chunkRows(payload, 500)) {
    const { error } = await supabase
      .from("chinese_quiz_color_progress")
      .upsert(batch, { onConflict: "user_id,game_mode,progress_id" });

    if (error) {
      throw error;
    }
  }
}

export async function fetchRemoteColorProgress({ userId, storageKey }) {
  if (!supabase || !userId || !storageKey) {
    return {};
  }

  const { data, error } = await supabase
    .from("chinese_quiz_color_progress")
    .select("progress_id,color_value,lose_streak,is_flagged,is_new")
    .eq("user_id", userId)
    .eq("game_mode", getGameMode(storageKey));

  if (error) {
    throw error;
  }

  return (data || []).reduce((progressById, row) => {
    progressById[row.progress_id] = {
      colorValue: row.color_value,
      loseStreak: row.lose_streak,
      isFlagged: row.is_flagged,
      isNew: row.is_new,
    };
    return progressById;
  }, {});
}

export function applyRemoteColorProgress(rows, remoteProgress) {
  return rows.map((row) => {
    const progress = remoteProgress[getColorProgressId(row)];
    if (!progress) {
      return { ...row, __hasSavedColorProgress: false, __isFlagged: false };
    }

    return {
      ...row,
      Color: progress.colorValue == null ? row.Color : String(progress.colorValue),
      "Lose Streak": String(progress.loseStreak || 0),
      __hasSavedColorProgress: progress.isNew === false,
      __isFlagged: progress.isFlagged === true,
    };
  });
}

export async function deleteRemoteColorProgress({ userId }) {
  if (!supabase || !userId) {
    return;
  }

  const { error } = await supabase
    .from("chinese_quiz_color_progress")
    .delete()
    .eq("user_id", userId);

  if (error) {
    throw error;
  }
}

function buildColorProgressPayload({ userId, storageKey, row, colorValue, loseStreak, isFlagged, isNew }) {
  const progressId = getProgressId(row);
  if (!progressId) {
    return null;
  }

  const payload = {
    user_id: userId,
    game_mode: getGameMode(storageKey),
    progress_id: progressId,
    color_value: normalizeColorValue(colorValue),
    lose_streak: normalizeLoseStreak(loseStreak ?? row["Lose Streak"]),
    updated_at: new Date().toISOString(),
  };

  if (isNew !== undefined) {
    payload.is_new = Boolean(isNew);
  }

  if (isFlagged !== undefined) {
    payload.is_flagged = Boolean(isFlagged);
  }

  return payload;
}

function getProgressId(row) {
  return getColorProgressId(row);
}

function chunkRows(rows, size) {
  const chunks = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
}

function normalizeColorValue(colorValue) {
  const parsedColor = Number.parseInt(colorValue, 10);
  return Number.isNaN(parsedColor) ? null : parsedColor;
}

function normalizeLoseStreak(loseStreak) {
  const parsedLoseStreak = Number.parseInt(loseStreak, 10);
  return Number.isNaN(parsedLoseStreak) ? 0 : Math.max(0, parsedLoseStreak);
}

function getGameMode(storageKey) {
  if (storageKey === "chineseQuizNew.englishToChineseColorProgress.v1") {
    return "english-to-chinese";
  }

  if (storageKey === "chineseQuizNew.csvColorProgress.v1") {
    return "chinese-to-english";
  }

  if (storageKey === "chineseQuizNew.adverbColorProgress.v1") {
    return "adverb";
  }

  if (storageKey === "chineseQuizNew.synonymColorProgress.v1") {
    return "synonym";
  }

  if (storageKey === "chineseQuizNew.sentenceBuilderColorProgress.v1") {
    return "sentence-builder";
  }

  if (storageKey === "chineseQuizNew.translateColorProgress.v1") {
    return "translate";
  }

  return storageKey;
}
