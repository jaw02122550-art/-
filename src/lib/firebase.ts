import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// The exported applet ships firebase-applet-config.json with a masked apiKey, so when the
// app runs in the Base44 preview (BASE44_PREVIEW_MODE=1) the key can instead be supplied
// through the environment. Unset/any other value keeps the committed config unchanged.
const apiKey =
  (process.env.BASE44_PREVIEW_MODE === '1' ? process.env.FIREBASE_API_KEY : undefined) ||
  firebaseConfig.apiKey;

const app = initializeApp({ ...firebaseConfig, apiKey });
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Auth error:", error);
    throw error;
  }
};

export const logout = () => signOut(auth);

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore connected");
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();
