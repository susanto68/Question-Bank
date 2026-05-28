import admin from 'firebase-admin';

function getCredential() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return admin.credential.applicationDefault();
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }

  return admin.credential.cert({
    projectId,
    clientEmail,
    privateKey: privateKey.replace(/\\n/g, '\n'),
  });
}

export function initFirebaseAdmin() {
  const credential = getCredential();

  if (!credential) {
    return null;
  }

  if (!admin.apps.length) {
    admin.initializeApp({
      credential,
    });
  }

  return admin;
}

export function getAdminAuth() {
  const app = initFirebaseAdmin();
  if (!app) return null;
  return admin.auth();
}

export function getAdminFirestore() {
  const app = initFirebaseAdmin();
  if (!app) return null;
  return admin.firestore();
}
