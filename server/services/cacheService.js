import { getFirestoreDb } from './firebase.js';

const collectionName = process.env.FIREBASE_CACHE_COLLECTION || 'questionCache';

export async function getCachedQuestions(cacheKey) {
  const db = getFirestoreDb();

  if (!db) {
    return null;
  }

  const doc = await db.collection(collectionName).doc(cacheKey).get();

  if (!doc.exists) {
    return null;
  }

  const data = doc.data();

  if (!Array.isArray(data?.questions) || data.questions.length === 0) {
    return null;
  }

  return data;
}

export async function saveQuestionsToCache(cacheKey, payload) {
  const db = getFirestoreDb();

  if (!db) {
    return;
  }

  await db.collection(collectionName).doc(cacheKey).set({
    ...payload,
    cachedAt: new Date().toISOString(),
  });
}
