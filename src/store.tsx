import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { Doctor, Shift, RatesBySlot, DoctorMonthlyRate } from './types';
import { DEFAULT_RATES, DOCTOR_COLORS } from './types';
import { getKoreanHolidaysForYear } from './utils/holidays';

interface AppState {
  doctors: Doctor[];
  shifts: Shift[];
  defaultRates: RatesBySlot;
  doctorMonthlyRates: DoctorMonthlyRate[];
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
  setDefaultRates: (rates: RatesBySlot) => void;
  setDoctorMonthlyRate: (doctorId: string, month: string, rates: Partial<RatesBySlot>) => void;
  removeDoctorMonthlyRate: (doctorId: string, month: string) => void;
  toggleHoliday: (date: string) => void;
  setCustomHolidays: (dates: string[]) => void;
  setBranchName: (name: string) => void;
  getShiftsForMonth: (month: string) => Shift[];
  getShiftsForDoctor: (doctorId: string, month: string) => Shift[];
}

const STORAGE_KEY = '24clinic-pay-calculator-state';

const defaultDoctors: Doctor[] = [
  { id: 'd1', name: '지아영', color: DOCTOR_COLORS[0] },
  { id: 'd2', name: '김정훈', color: DOCTOR_COLORS[1] },
  { id: 'd3', name: '유성우', color: '#E0E0E0' },
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

const defaultState: AppState = {
  doctors: defaultDoctors,
  shifts: [],
  defaultRates: { ...DEFAULT_RATES },
  doctorMonthlyRates: [],
  customHolidays: defaultHolidays,
  branchName: '잠실',
};

function loadState(): AppState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...defaultState, ...parsed };
    }
  } catch {
    // ignore
  }
  return defaultState;
}

function saveState(state: AppState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let nextId = Date.now();
function genId(): string {
  return `id_${nextId++}`;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(loadState);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const addDoctor = (name: string): Doctor => {
    const usedColors = state.doctors.map(d => d.color);
    const color = DOCTOR_COLORS.find(c => !usedColors.includes(c)) || DOCTOR_COLORS[0];
    const doctor: Doctor = { id: genId(), name, color };
    setState(s => ({ ...s, doctors: [...s.doctors, doctor] }));
    return doctor;
  };

  const updateDoctor = (doctor: Doctor) => {
    setState(s => ({
      ...s,
      doctors: s.doctors.map(d => d.id === doctor.id ? doctor : d),
    }));
  };

  const removeDoctor = (id: string) => {
    setState(s => ({
      ...s,
      doctors: s.doctors.filter(d => d.id !== id),
      shifts: s.shifts.filter(sh => sh.doctorId !== id),
      doctorMonthlyRates: s.doctorMonthlyRates.filter(r => r.doctorId !== id),
    }));
  };

  const addShift = (shift: Omit<Shift, 'id'>) => {
    const newShift: Shift = { ...shift, id: genId() };
    setState(s => ({ ...s, shifts: [...s.shifts, newShift] }));
  };

  const updateShift = (shift: Shift) => {
    setState(s => ({
      ...s,
      shifts: s.shifts.map(sh => sh.id === shift.id ? shift : sh),
    }));
  };

  const removeShift = (id: string) => {
    setState(s => ({
      ...s,
      shifts: s.shifts.filter(sh => sh.id !== id),
    }));
  };

  const setDefaultRates = (rates: RatesBySlot) => {
    setState(s => ({ ...s, defaultRates: rates }));
  };

  const setDoctorMonthlyRate = (doctorId: string, month: string, rates: Partial<RatesBySlot>) => {
    setState(s => {
      const existing = s.doctorMonthlyRates.findIndex(
        r => r.doctorId === doctorId && r.month === month
      );
      const newRates = [...s.doctorMonthlyRates];
      if (existing >= 0) {
        newRates[existing] = { doctorId, month, rates };
      } else {
        newRates.push({ doctorId, month, rates });
      }
      return { ...s, doctorMonthlyRates: newRates };
    });
  };

  const removeDoctorMonthlyRate = (doctorId: string, month: string) => {
    setState(s => ({
      ...s,
      doctorMonthlyRates: s.doctorMonthlyRates.filter(
        r => !(r.doctorId === doctorId && r.month === month)
      ),
    }));
  };

  const toggleHoliday = (date: string) => {
    setState(s => ({
      ...s,
      customHolidays: s.customHolidays.includes(date)
        ? s.customHolidays.filter(d => d !== date)
        : [...s.customHolidays, date],
    }));
  };

  const setCustomHolidays = (dates: string[]) => {
    setState(s => ({ ...s, customHolidays: dates }));
  };

  const setBranchName = (name: string) => {
    setState(s => ({ ...s, branchName: name }));
  };

  const getShiftsForMonth = (month: string): Shift[] => {
    return state.shifts.filter(s => s.date.startsWith(month));
  };

  const getShiftsForDoctor = (doctorId: string, month: string): Shift[] => {
    return state.shifts.filter(s => s.doctorId === doctorId && s.date.startsWith(month));
  };

  return (
    <AppContext.Provider value={{
      state,
      addDoctor, updateDoctor, removeDoctor,
      addShift, updateShift, removeShift,
      setDefaultRates, setDoctorMonthlyRate, removeDoctorMonthlyRate,
      toggleHoliday, setCustomHolidays,
      setBranchName,
      getShiftsForMonth, getShiftsForDoctor,
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
