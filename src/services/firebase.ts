import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as fbSignOut, type User } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, deleteDoc, getDocs, collection } from 'firebase/firestore';

// TODO: Firebase Console에서 프로젝트 생성 후 아래 값을 채워주세요
// 1. https://console.firebase.google.com 에서 프로젝트 생성
// 2. Authentication > Sign-in method > Google 사용 설정
// 3. Firestore Database 생성 (test mode로 시작)
// 4. 프로젝트 설정 > 일반 > 웹 앱 추가 > config 복사
const firebaseConfig = {
  apiKey: "AIzaSyAHstAXzlNXuASznOeWoruZYNF_S3sRDYk",
  authDomain: "clinic-schedule-calc.firebaseapp.com",
  projectId: "clinic-schedule-calc",
  storageBucket: "clinic-schedule-calc.firebasestorage.app",
  messagingSenderId: "185031215692",
  appId: "1:185031215692:web:b83e41c93b0a01c85ac2e9",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export type { User };

const googleProvider = new GoogleAuthProvider();

// --- Auth ---

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutGoogle(): Promise<void> {
  await fbSignOut(auth);
}

// --- User Profiles ---

export interface UserProfile {
  email: string;
  displayName: string;
  doctorId: string;
  doctorName: string;
  role: 'admin' | 'doctor';
  createdAt: number;
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

export async function setUserProfile(uid: string, profile: UserProfile): Promise<void> {
  await setDoc(doc(db, 'users', uid), profile);
}

export async function updateUserRole(uid: string, role: 'admin' | 'doctor'): Promise<void> {
  await setDoc(doc(db, 'users', uid), { role }, { merge: true });
}

export async function deleteUserProfile(uid: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid));
}

export async function getAllUsers(): Promise<{ uid: string; profile: UserProfile }[]> {
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs.map(d => ({ uid: d.id, profile: d.data() as UserProfile }));
}

// --- App Data (shared) ---

export async function loadAppData(): Promise<Record<string, unknown> | null> {
  const snap = await getDoc(doc(db, 'appData', 'main'));
  return snap.exists() ? (snap.data() as Record<string, unknown>) : null;
}

export async function saveAppData(data: Record<string, unknown>): Promise<boolean> {
  try {
    await setDoc(doc(db, 'appData', 'main'), data);
    return true;
  } catch {
    return false;
  }
}
