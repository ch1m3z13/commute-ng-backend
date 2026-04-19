import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getStorage, Storage } from 'firebase-admin/storage';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');

export function initializeFirebase() {
  if (getApps().length === 0) {
    initializeApp({
      credential: cert(serviceAccount),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    });
  }
}

export const auth: Auth = getAuth();
export const db: Firestore = getFirestore();
export const storage: Storage = getStorage();
