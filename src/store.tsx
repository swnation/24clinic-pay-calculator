import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import type { Doctor, Shift, RatesBySlot, BranchMonthlyRate, SpecialRatePeriod } from './types';
import { DEFAULT_RATES, DOCTOR_COLORS } from './types';
import { getKoreanHolidaysForYear } from './utils/holidays';
import {
  auth, signInWithGoogle, signOutGoogle,
  getUserProfile, setUserProfile, updateUserRole, deleteUserProfile, getAllUsers,
  loadAppData, saveAppData,
  type User, type UserProfile,
} from './services/firebase';
import { onAuthStateChanged } from 'firebase/auth';

export type { UserProfile };

interface AppState {
  doctors: Doctor[];
  shifts: Shift[];
  defaultRates: RatesBySlot;
  branchMonthlyRates: BranchMonthlyRate[];
  specialRatePeriods: SpecialRatePeriod[];
  customHolidays: string[];
  branchName: string;
}

interface AppContextType {
  state: AppState;
  addDoctor: (name: string) => Doctor;
  updateDoctor: (doctor: Doctor) => void;
  removeDoctor: (id: string) => void;
  addShift: (shift: Omit<Shift, 'id'>) => void;
  updateShift: (shift: Shift) => void;
  removeShift: (id: string) => void;
  bulkImport: (shifts: { doctorName: string; date: string; startHour: number; endHour: number; room: 1 | 2 }[], monthsToReplace: string[]) => void;
  setDefaultRates: (rates: RatesBySlot) => void;
  setBranchMonthlyRate: (month: string, rates: Partial<RatesBySlot>) => void;
  removeBranchMonthlyRate: (month: string) => void;
  addSpecialRatePeriod: (period: Omit<SpecialRatePeriod, 'id'>) => void;
  removeSpecialRatePeriod: (id: string) => void;
  toggleHoliday: (date: string) => void;
  setCustomHolidays: (dates: string[]) => void;
  setBranchName: (name: string) => void;
  getShiftsForMonth: (month: string) => Shift[];
  getShiftsForDoctor: (doctorId: string, month: string) => Shift[];
  importData: (data: Record<string, unknown>) => void;
  resetData: () => void;

  // Auth & User
  firebaseUser: User | null;
  currentUser: UserProfile | null;
  authLoading: boolean;
  needsRegistration: boolean;
  isAdmin: boolean;
  signIn: () => Promise<void>;
  signOut: () => void;
  registerUser: (doctorName: string) => Promise<{ success: boolean; error?: string }>;

  // User management (admin)
  allUsers: { uid: string; profile: UserProfile }[];
  refreshUsers: () => Promise<void>;
  setRole: (uid: string, role: 'admin' | 'doctor') => Promise<void>;
  removeUser: (uid: string) => Promise<void>;

  // Save
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  saveNow: () => Promise<void>;
}

const defaultDoctors: Doctor[] = [
  { id: 'd3', name: '유성우', color: '#E0E0E0' },
  { id: 'd1', name: '지아영', color: DOCTOR_COLORS[0] },
  { id: 'd2', name: '김정훈', color: DOCTOR_COLORS[1] },
  { id: 'd4', name: '김기현', color: DOCTOR_COLORS[3] },
  { id: 'd5', name: '김민욱', color: DOCTOR_COLORS[2] },
  { id: 'd6', name: '이현수', color: DOCTOR_COLORS[8] },
  { id: 'd7', name: '원동현', color: '#EF9A9A' },
];

const now = new Date();
const currentYear = now.getFullYear();
const defaultHolidays = [
  ...getKoreanHolidaysForYear(currentYear - 1),
  ...getKoreanHolidaysForYear(currentYear),
  ...getKoreanHolidaysForYear(currentYear + 1),
];

const presetBranchMonthlyRates: BranchMonthlyRate[] = [
  { month: '2024-09', rates: { saturdayEvening: 7 } },
  { month: '2025-01', rates: { weekdayEvening: 7, saturdayAfternoon: 7, sundayMorning: 7, sundayAfternoon: 7, sundayEvening: 7, holidayMorning: 7, holidayAfternoon: 7, holidayEvening: 7 } },
  { month: '2025-09', rates: { saturdayAfternoon: 7 } },
  { month: '2025-10', rates: { saturdayAfternoon: 7 } },
  { month: '2025-11', rates: { saturdayEvening: 7 } },
  { month: '2025-12', rates: { weekdayEvening: 7, saturdayAfternoon: 7 } },
  { month: '2026-01', rates: { saturdayEvening: 7 } },
  { month: '2026-02', rates: { saturdayEvening: 7 } },
  { month: '2026-03', rates: { weekdayEvening: 7, saturdayAfternoon: 7, saturdayEvening: 7, sundayMorning: 7, sundayAfternoon: 7, sundayEvening: 7, holidayMorning: 7, holidayAfternoon: 7, holidayEvening: 7 } },
  { month: '2026-04', rates: { weekdayEvening: 7, saturdayAfternoon: 7, saturdayEvening: 7, sundayMorning: 8, sundayAfternoon: 8, sundayEvening: 8, holidayMorning: 8, holidayAfternoon: 8, holidayEvening: 8 } },
];

const defaultState: AppState = {
  doctors: defaultDoctors,
  shifts: [],
  defaultRates: { ...DEFAULT_RATES },
  branchMonthlyRates: presetBranchMonthlyRates,
  specialRatePeriods: [],
  customHolidays: defaultHolidays,
  branchName: '잠실',
};

function parseLoadedData(data: Record<string, unknown>): AppState {
  const parsed = data as Partial<AppState>;
  const mergedRates = { ...DEFAULT_RATES };
  if (parsed?.defaultRates && typeof parsed.defaultRates === 'object') {
    for (const key of Object.keys(DEFAULT_RATES) as Array<keyof typeof DEFAULT_RATES>) {
      const storedValue = (parsed.defaultRates as unknown as Record<string, unknown>)[key];
      if (typeof storedValue === 'number') mergedRates[key] = storedValue;
    }
  }
  return {
    ...defaultState,
    ...parsed,
    defaultRates: mergedRates,
    branchMonthlyRates: parsed.branchMonthlyRates || presetBranchMonthlyRates,
    specialRatePeriods: parsed.specialRatePeriods || [],
    doctors: [...(parsed.doctors || defaultDoctors)].sort((a: Doctor) => a.name === '유성우' ? -1 : 0),
  };
}

let nextId = Date.now();
function genId(): string {
  return `id_${nextId++}`;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(defaultState);

  // Auth state
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [needsRegistration, setNeedsRegistration] = useState(false);
  const [allUsers, setAllUsers] = useState<{ uid: string; profile: UserProfile }[]>([]);

  // Save state
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dataLoaded = useRef(false);

  // Firebase Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        try {
          const profile = await getUserProfile(user.uid);
          if (profile) {
            // Check if linked doctor still exists and is active
            const data = await loadAppData();
            if (data) {
              const loaded = parseLoadedData(data);
              const doctor = loaded.doctors.find(d => d.id === profile.doctorId);
              if (!doctor) {
                // Doctor was deleted - block access
                setCurrentUser(null);
                setNeedsRegistration(false);
                setAuthLoading(false);
                return;
              }
              setState(loaded);
            } else {
              // First time - seed default data
              await saveAppData(defaultState as unknown as Record<string, unknown>);
            }
            setCurrentUser(profile);
            setNeedsRegistration(false);
            dataLoaded.current = true;
          } else {
            // New user - load app data for doctor list
            const data = await loadAppData();
            if (data) {
              setState(parseLoadedData(data));
            } else {
              await saveAppData(defaultState as unknown as Record<string, unknown>);
            }
            setNeedsRegistration(true);
          }
        } catch (e) {
          console.error('Auth init error:', e);
        }
      } else {
        setCurrentUser(null);
        setNeedsRegistration(false);
        setState(defaultState);
        dataLoaded.current = false;
      }
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  // Auto-save to Firestore (debounced)
  useEffect(() => {
    if (!firebaseUser || !currentUser || !dataLoaded.current) return;
    if (currentUser.role !== 'admin') return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setSaveStatus('saving');
      const ok = await saveAppData(state as unknown as Record<string, unknown>);
      setSaveStatus(ok ? 'saved' : 'error');
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
      statusTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
    }, 3000);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [state, firebaseUser, currentUser]);

  // --- Actions ---

  const addDoctor = (name: string): Doctor => {
    const usedColors = state.doctors.map(d => d.color);
    const color = DOCTOR_COLORS.find(c => !usedColors.includes(c)) || DOCTOR_COLORS[0];
    const doctor: Doctor = { id: genId(), name, color };
    setState(s => ({ ...s, doctors: [...s.doctors, doctor] }));
    return doctor;
  };

  const updateDoctor = (doctor: Doctor) => {
    setState(s => ({ ...s, doctors: s.doctors.map(d => d.id === doctor.id ? doctor : d) }));
  };

  const removeDoctor = (id: string) => {
    setState(s => ({
      ...s,
      doctors: s.doctors.filter(d => d.id !== id),
      shifts: s.shifts.filter(sh => sh.doctorId !== id),
    }));
  };

  const addShift = (shift: Omit<Shift, 'id'>) => {
    setState(s => ({ ...s, shifts: [...s.shifts, { ...shift, id: genId() }] }));
  };

  const updateShift = (shift: Shift) => {
    setState(s => ({ ...s, shifts: s.shifts.map(sh => sh.id === shift.id ? shift : sh) }));
  };

  const removeShift = (id: string) => {
    setState(s => ({ ...s, shifts: s.shifts.filter(sh => sh.id !== id) }));
  };

  const bulkImport = (
    shifts: { doctorName: string; date: string; startHour: number; endHour: number; room: 1 | 2 }[],
    monthsToReplace: string[]
  ) => {
    setState(s => {
      const nameToId = new Map<string, string>();
      const usedColors = new Set(s.doctors.map(d => d.color));
      const newDoctors: Doctor[] = [];
      for (const d of s.doctors) nameToId.set(d.name, d.id);
      for (const sh of shifts) {
        if (!nameToId.has(sh.doctorName)) {
          const color = DOCTOR_COLORS.find(c => !usedColors.has(c)) || DOCTOR_COLORS[0];
          usedColors.add(color);
          const doc: Doctor = { id: genId(), name: sh.doctorName, color };
          newDoctors.push(doc);
          nameToId.set(sh.doctorName, doc.id);
        }
      }
      const filteredShifts = monthsToReplace.length > 0
        ? s.shifts.filter(sh => !monthsToReplace.some(mp => sh.date.startsWith(mp)))
        : s.shifts;
      const newShifts: Shift[] = shifts.map(sh => ({
        id: genId(),
        doctorId: nameToId.get(sh.doctorName)!,
        date: sh.date,
        startHour: sh.startHour,
        endHour: sh.endHour,
        room: sh.room,
      }));
      return { ...s, doctors: [...s.doctors, ...newDoctors], shifts: [...filteredShifts, ...newShifts] };
    });
  };

  const setDefaultRates = (rates: RatesBySlot) => setState(s => ({ ...s, defaultRates: rates }));

  const setBranchMonthlyRate = (month: string, rates: Partial<RatesBySlot>) => {
    setState(s => {
      const idx = s.branchMonthlyRates.findIndex(r => r.month === month);
      const newRates = [...s.branchMonthlyRates];
      if (idx >= 0) newRates[idx] = { month, rates };
      else newRates.push({ month, rates });
      return { ...s, branchMonthlyRates: newRates };
    });
  };

  const removeBranchMonthlyRate = (month: string) => {
    setState(s => ({ ...s, branchMonthlyRates: s.branchMonthlyRates.filter(r => r.month !== month) }));
  };

  const addSpecialRatePeriod = (period: Omit<SpecialRatePeriod, 'id'>) => {
    setState(s => ({ ...s, specialRatePeriods: [...s.specialRatePeriods, { ...period, id: genId() }] }));
  };

  const removeSpecialRatePeriod = (id: string) => {
    setState(s => ({ ...s, specialRatePeriods: s.specialRatePeriods.filter(p => p.id !== id) }));
  };

  const toggleHoliday = (date: string) => {
    setState(s => ({
      ...s,
      customHolidays: s.customHolidays.includes(date)
        ? s.customHolidays.filter(d => d !== date)
        : [...s.customHolidays, date],
    }));
  };

  const setCustomHolidays = (dates: string[]) => setState(s => ({ ...s, customHolidays: dates }));
  const setBranchName = (name: string) => setState(s => ({ ...s, branchName: name }));

  const getShiftsForMonth = (month: string): Shift[] => state.shifts.filter(s => s.date.startsWith(month));
  const getShiftsForDoctor = (doctorId: string, month: string): Shift[] =>
    state.shifts.filter(s => s.doctorId === doctorId && s.date.startsWith(month));

  const importData = (data: Record<string, unknown>) => {
    setState(parseLoadedData(data));
    dataLoaded.current = true;
  };

  const resetData = () => setState(defaultState);

  // --- Auth actions ---

  const signIn = useCallback(async () => {
    try {
      await signInWithGoogle();
      // onAuthStateChanged handles the rest
    } catch (e) {
      console.error('Sign in error:', e);
    }
  }, []);

  const signOut = useCallback(() => {
    signOutGoogle();
    // onAuthStateChanged handles cleanup
  }, []);

  const registerUser = useCallback(async (doctorName: string): Promise<{ success: boolean; error?: string }> => {
    if (!firebaseUser) return { success: false, error: '로그인이 필요합니다.' };

    const trimmed = doctorName.trim();
    if (!trimmed) return { success: false, error: '이름을 입력해주세요.' };

    // Find matching active doctor
    const doctor = state.doctors.find(d => d.name === trimmed);
    if (!doctor) return { success: false, error: '근무중인 의사 목록에 없는 이름입니다.' };

    // Check if doctor is already claimed
    const users = await getAllUsers();
    const claimed = users.find(u => u.profile.doctorId === doctor.id);
    if (claimed) return { success: false, error: `'${trimmed}' 은(는) 이미 다른 계정에 연결되어 있습니다.` };

    // Determine role: 유성우 = admin
    const role = doctor.name === '유성우' ? 'admin' : 'doctor';

    const profile: UserProfile = {
      email: firebaseUser.email || '',
      displayName: firebaseUser.displayName || trimmed,
      doctorId: doctor.id,
      doctorName: doctor.name,
      role,
      createdAt: Date.now(),
    };

    await setUserProfile(firebaseUser.uid, profile);
    setCurrentUser(profile);
    setNeedsRegistration(false);
    dataLoaded.current = true;
    setAllUsers([...users, { uid: firebaseUser.uid, profile }]);

    return { success: true };
  }, [firebaseUser, state.doctors]);

  // --- Admin: user management ---

  const refreshUsers = useCallback(async () => {
    const users = await getAllUsers();
    setAllUsers(users);
  }, []);

  const setRole = useCallback(async (uid: string, role: 'admin' | 'doctor') => {
    await updateUserRole(uid, role);
    setAllUsers(prev => prev.map(u => u.uid === uid ? { ...u, profile: { ...u.profile, role } } : u));
    // If changing own role
    if (firebaseUser?.uid === uid) {
      setCurrentUser(prev => prev ? { ...prev, role } : prev);
    }
  }, [firebaseUser]);

  const removeUser = useCallback(async (uid: string) => {
    await deleteUserProfile(uid);
    setAllUsers(prev => prev.filter(u => u.uid !== uid));
  }, []);

  // --- Save ---

  const saveNow = useCallback(async () => {
    if (!currentUser) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveStatus('saving');
    const ok = await saveAppData(state as unknown as Record<string, unknown>);
    setSaveStatus(ok ? 'saved' : 'error');
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    statusTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
  }, [state, currentUser]);

  const isAdmin = currentUser?.role === 'admin';

  return (
    <AppContext.Provider value={{
      state,
      addDoctor, updateDoctor, removeDoctor,
      addShift, updateShift, removeShift, bulkImport,
      setDefaultRates, setBranchMonthlyRate, removeBranchMonthlyRate,
      addSpecialRatePeriod, removeSpecialRatePeriod,
      toggleHoliday, setCustomHolidays, setBranchName,
      getShiftsForMonth, getShiftsForDoctor,
      importData, resetData,
      firebaseUser, currentUser, authLoading, needsRegistration, isAdmin,
      signIn, signOut, registerUser,
      allUsers, refreshUsers, setRole, removeUser,
      saveStatus, saveNow,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppStore(): AppContextType {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppStore must be used within AppProvider');
  return ctx;
}
