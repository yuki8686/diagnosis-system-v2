import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { environment } from "./env";

export function firestore() {
  if (!getApps().length) initializeApp({ credential: cert({ projectId: environment("FIREBASE_PROJECT_ID"), clientEmail: environment("FIREBASE_CLIENT_EMAIL"), privateKey: environment("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n") }) });
  return getFirestore();
}
