import admin from 'firebase-admin';

let dbInstance;

function getCredential() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return admin.credential.applicationDefault();
  }

  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;

  if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
    return null;
  }

  return admin.credential.cert({
    projectId: FIREBASE_PROJECT_ID,
    clientEmail: FIREBASE_CLIENT_EMAIL,
    privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  });
}

export function getFirestoreDb() {
  if (dbInstance) {
    return dbInstance;
  }

  const credential = getCredential();

  if (!credential) {
    return null;
  }

  if (!admin.apps.length) {
    admin.initializeApp({ credential });
  }

  dbInstance = admin.firestore();
  return dbInstance;
}
