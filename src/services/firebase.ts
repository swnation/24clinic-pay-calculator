import { initializeApp } from 'firebase/app';
import {
  getAuth, GoogleAuthProvider,
  signInWithPopup, signInWithRedirect, getRedirectResult,
  signOut as fbSignOut, type User,
} from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, deleteDoc, getDocs, collection, query, where } from 'firebase/firestore';

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

// GitHub Pages 등 COOP 헤더가 강제되는 환경에서는 popup이 window.close를 호출할 수 없어
// 로그인이 완료되지 않을 수 있다. 기본은 redirect, 로컬 dev에서만 popup 사용.
function shouldUseRedirect(): boolean {
  if (typeof window === 'undefined') return true;
  const host = window.location.hostname;
  return host !== 'localhost' && host !== '127.0.0.1';
}

export async function signInWithGoogle(): Promise<User | null> {
  if (shouldUseRedirect()) {
    await signInWithRedirect(auth, googleProvider);
    return null; // 리다이렉트 후 onAuthStateChanged / getRedirectResult가 처리
  }
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function consumeRedirectResult(): Promise<User | null> {
  try {
    const result = await getRedirectResult(auth);
    return result?.user ?? null;
  } catch (e) {
    console.error('Redirect result error:', e);
    return null;
  }
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
  personalRates?: Record<string, number>;
  personalMonthlyRates?: { month: string; rates: Record<string, number> }[];
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

// --- Availability ---

export type SlotStatus = 'available' | 'unavailable';

export interface DaySlotAvailability {
  morning?: SlotStatus;
  afternoon?: SlotStatus;
  evening?: SlotStatus;
  note?: string;
}

export interface AvailabilityData {
  doctorId: string;
  month: string;
  days: Record<string, DaySlotAvailability>; // key: YYYY-MM-DD
  submittedAt: number | null; // null = draft
  isDraft: boolean;
}

export async function saveAvailability(doctorId: string, month: string, data: AvailabilityData): Promise<boolean> {
  try {
    await setDoc(doc(db, 'availability', `${month}_${doctorId}`), data);
    return true;
  } catch {
    return false;
  }
}

export async function loadAvailability(doctorId: string, month: string): Promise<AvailabilityData | null> {
  const snap = await getDoc(doc(db, 'availability', `${month}_${doctorId}`));
  return snap.exists() ? (snap.data() as AvailabilityData) : null;
}

export async function loadAllAvailability(month: string): Promise<AvailabilityData[]> {
  const q = query(collection(db, 'availability'), where('month', '==', month));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as AvailabilityData);
}

// --- User profile partial update ---

export async function updateUserProfileField(uid: string, data: Partial<UserProfile>): Promise<void> {
  await setDoc(doc(db, 'users', uid), data, { merge: true });
}
