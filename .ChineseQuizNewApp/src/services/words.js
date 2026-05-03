import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase.js";

export function wordsCollection() {
  return collection(db, "words");
}

export function userProgressDoc(userId, wordId) {
  return doc(db, "users", userId, "progress", wordId);
}

export function dailySessionDoc(userId, dateKey) {
  return doc(db, "users", userId, "dailySessions", dateKey);
}

export async function getWords() {
  const snapshot = await getDocs(query(wordsCollection(), orderBy("createdAt", "desc")));
  return snapshot.docs.map((wordDoc) => ({ id: wordDoc.id, ...wordDoc.data() }));
}

export async function getWord(wordId) {
  const snapshot = await getDoc(doc(db, "words", wordId));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

export async function saveWord(wordId, values) {
  const payload = {
    chinese: values.chinese.trim(),
    pinyin: values.pinyin.trim(),
    english: values.english.trim(),
    example: values.example.trim(),
    updatedAt: serverTimestamp(),
  };

  if (wordId) {
    await updateDoc(doc(db, "words", wordId), payload);
    return wordId;
  }

  const newDoc = await addDoc(wordsCollection(), {
    ...payload,
    createdAt: serverTimestamp(),
    defaultWeight: 3,
  });
  return newDoc.id;
}

export async function deleteWord(wordId) {
  await deleteDoc(doc(db, "words", wordId));
}

export async function getUserProgress(userId) {
  const snapshot = await getDocs(collection(db, "users", userId, "progress"));
  return new Map(snapshot.docs.map((progressDoc) => [progressDoc.id, progressDoc.data()]));
}

export async function updateWordProgress({ userId, word, wasCorrect }) {
  const progressRef = userProgressDoc(userId, word.id);
  const existing = await getDoc(progressRef);
  const currentWeight = existing.exists()
    ? existing.data().weight ?? word.defaultWeight ?? 3
    : word.defaultWeight ?? 3;
  const nextWeight = Math.max(1, Math.min(10, currentWeight + (wasCorrect ? -1 : 1)));

  await setDoc(
    progressRef,
    {
      wordId: word.id,
      weight: nextWeight,
      correctCount: (existing.data()?.correctCount ?? 0) + (wasCorrect ? 1 : 0),
      wrongCount: (existing.data()?.wrongCount ?? 0) + (wasCorrect ? 0 : 1),
      lastReviewedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return nextWeight;
}

export async function recordDailyAttempt({ userId, dateKey, wordId, wasCorrect }) {
  const sessionRef = dailySessionDoc(userId, dateKey);
  const snapshot = await getDoc(sessionRef);
  const data = snapshot.exists() ? snapshot.data() : {};

  await setDoc(
    sessionRef,
    {
      date: dateKey,
      total: (data.total ?? 0) + 1,
      correct: (data.correct ?? 0) + (wasCorrect ? 1 : 0),
      wrong: (data.wrong ?? 0) + (wasCorrect ? 0 : 1),
      wordIds: Array.from(new Set([...(data.wordIds ?? []), wordId])),
      updatedAt: serverTimestamp(),
      createdAt: data.createdAt ?? serverTimestamp(),
    },
    { merge: true }
  );
}
