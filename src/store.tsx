import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { Doctor, Shift, RatesBySlot, DoctorMonthlyRate, BranchMonthlyRate, SpecialRatePeriod } from './types';
import { DEFAULT_RATES, DOCTOR_COLORS } from './types';
import { getKoreanHolidaysForYear } from './utils/holidays';

interface AppState {
  doctors: Doctor[];
  shifts: Shift[];
  defaultRates: RatesBySlot;
  doctorMonthlyRates: DoctorMonthlyRate[];
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
  setDoctorMonthlyRate: (doctorId: string, month: string, rates: Partial<RatesBySlot>) => void;
  removeDoctorMonthlyRate: (doctorId: string, month: string) => void;
  setBranchMonthlyRate: (month: string, rates: Partial<RatesBySlot>) => void;
  removeBranchMonthlyRate: (month: string) => void;
  addSpecialRatePeriod: (period: Omit<SpecialRatePeriod, 'id'>) => void;
  removeSpecialRatePeriod: (id: string) => void;
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

// 잠실점 월별 시급 프리셋 (기본급 4,6과 다른 항목만)
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
  doctorMonthlyRates: [],
  branchMonthlyRates: presetBranchMonthlyRates,
  specialRatePeriods: [],
  customHolidays: defaultHolidays,
  branchName: '잠실',
};

function loadState(): AppState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Pick only valid keys from stored rates with type checking
      const mergedRates = { ...DEFAULT_RATES };
      if (parsed?.defaultRates && typeof parsed.defaultRates === 'object') {
        for (const key of Object.keys(DEFAULT_RATES) as Array<keyof typeof DEFAULT_RATES>) {
          const storedValue = parsed.defaultRates[key];
          if (typeof storedValue === 'number') mergedRates[key] = storedValue;
        }
      }
      return {
        ...defaultState,
        ...parsed,
        defaultRates: mergedRates,
        // Ensure new fields exist even if stored data is old
        branchMonthlyRates: parsed.branchMonthlyRates || presetBranchMonthlyRates,
        specialRatePeriods: parsed.specialRatePeriods || [],
      };
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

  const bulkImport = (
    shifts: { doctorName: string; date: string; startHour: number; endHour: number; room: 1 | 2 }[],
    monthsToReplace: string[]
  ) => {
    setState(s => {
      // Build name -> doctor map, creating new doctors as needed
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

      // Remove existing shifts for replaced months
      const filteredShifts = monthsToReplace.length > 0
        ? s.shifts.filter(sh => !monthsToReplace.some(mp => sh.date.startsWith(mp)))
        : s.shifts;

      // Create new shift objects with resolved doctorIds
      const newShifts: Shift[] = shifts.map(sh => ({
        id: genId(),
        doctorId: nameToId.get(sh.doctorName)!,
        date: sh.date,
        startHour: sh.startHour,
        endHour: sh.endHour,
        room: sh.room,
      }));

      return {
        ...s,
        doctors: [...s.doctors, ...newDoctors],
        shifts: [...filteredShifts, ...newShifts],
      };
    });
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

  const setBranchMonthlyRate = (month: string, rates: Partial<RatesBySlot>) => {
    setState(s => {
      const existing = s.branchMonthlyRates.findIndex(r => r.month === month);
      const newRates = [...s.branchMonthlyRates];
      if (existing >= 0) {
        newRates[existing] = { month, rates };
      } else {
        newRates.push({ month, rates });
      }
      return { ...s, branchMonthlyRates: newRates };
    });
  };

  const removeBranchMonthlyRate = (month: string) => {
    setState(s => ({
      ...s,
      branchMonthlyRates: s.branchMonthlyRates.filter(r => r.month !== month),
    }));
  };

  const addSpecialRatePeriod = (period: Omit<SpecialRatePeriod, 'id'>) => {
    setState(s => ({
      ...s,
      specialRatePeriods: [...s.specialRatePeriods, { ...period, id: genId() }],
    }));
  };

  const removeSpecialRatePeriod = (id: string) => {
    setState(s => ({
      ...s,
      specialRatePeriods: s.specialRatePeriods.filter(p => p.id !== id),
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
      addShift, updateShift, removeShift, bulkImport,
      setDefaultRates, setDoctorMonthlyRate, removeDoctorMonthlyRate,
      setBranchMonthlyRate, removeBranchMonthlyRate,
      addSpecialRatePeriod, removeSpecialRatePeriod,
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
