import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getStorage, Storage } from 'firebase-admin/storage';

let _app: App | null = null;
let _initialized = false;

export function initializeFirebase() {
  if (_initialized) return;
  if (getApps().length === 0) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
    _app = initializeApp({
      credential: cert(serviceAccount),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    });
  } else {
    _app = getApps()[0];
  }
  _initialized = true;
}

export function getFirebaseAuth(): Auth {
  if (!_initialized || !_app) {
    throw new Error('Firebase not initialized. Call initializeFirebase() first.');
  }
  return getAuth(_app);
}

export function getFirebaseDb(): Firestore {
  if (!_initialized || !_app) {
    throw new Error('Firebase not initialized. Call initializeFirebase() first.');
  }
  return getFirestore(_app);
}

export function getFirebaseStorage(): Storage {
  if (!_initialized || !_app) {
    throw new Error('Firebase not initialized. Call initializeFirebase() first.');
  }
  return getStorage(_app);
}

export const auth = { getAuth: getFirebaseAuth } as unknown as Auth;
export const db = { getFirestore: getFirebaseDb } as unknown as Firestore;
export const storage = { getStorage: getFirebaseStorage } as unknown as Storage;