import { doc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { database } from "../firebase/config";

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  provider: "email" | "google" | "github";
  createdAt?: any;
  photoURL?: string;
  lastLogin?: any;
}

/**
 * Creates a new user record in Firestore at users/{uid}
 * @param uid - Firebase user uid
 * @param profile - User profile inputs
 */
export async function createUserRecord(uid: string, profile: { name: string; email: string; provider: "email" | "google" | "github"; photoURL?: string }) {
  try {
    const userRef = doc(database, "users", uid);
    await setDoc(userRef, {
      uid,
      name: profile.name || "",
      email: profile.email || "",
      provider: profile.provider,
      photoURL: profile.photoURL || "",
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp()
    });
  } catch (error) {
    console.error("Error creating user record: ", error);
    throw error;
  }
}

/**
 * Updates the last login timestamp for the user
 * @param uid - Firebase user uid
 */
export async function updateUserLastLogin(uid: string) {
  try {
    const userRef = doc(database, "users", uid);
    await updateDoc(userRef, {
      lastLogin: serverTimestamp()
    });
  } catch (error) {
    console.error("Error updating user last login: ", error);
    throw error;
  }
}
