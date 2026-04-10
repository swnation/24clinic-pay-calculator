export interface Doctor {
  id: string;
  name: string;
  color: string; // hex background color
}

export interface Shift {
  id: string;
  doctorId: string;
  date: string; // YYYY-MM-DD
  startHour: number; // 9-23
  endHour: number; // 10-24
  room: 1 | 2;
}

export interface RatesBySlot {
  weekdayDaytime: number;    // 평일주간 (09-13, 14-18) 만원/hr
  weekdayEvening: number;    // 평일야간 (19-24) 만원/hr
  saturdayDaytime: number;   // 토요일오후 (09-18) 만원/hr
  saturdayEvening: number;   // 토요일저녁 (19-24) 만원/hr
  sundayHoliday: number;     // 일공휴일 만원/hr
}

export interface DoctorMonthlyRate {
  doctorId: string;
  month: string; // YYYY-MM
  rates: Partial<RatesBySlot>;
}

export interface WageBreakdown {
  weekdayDaytimeHours: number;
  weekdayEveningHours: number;
  saturdayDaytimeHours: number;
  saturdayEveningHours: number;
  sundayHolidayHours: number;
  weekdayDaytimeWage: number;
  weekdayEveningWage: number;
  saturdayDaytimeWage: number;
  saturdayEveningWage: number;
  sundayHolidayWage: number;
  totalHours: number;
  totalWage: number;
  workDays: number;
}

export interface WeeklyHours {
  weekNumber: number;
  weekLabel: string; // e.g., "4/1 - 4/5"
  hours: number;
  shifts: number;
}

export const DEFAULT_RATES: RatesBySlot = {
  weekdayDaytime: 4,
  weekdayEvening: 6,
  saturdayDaytime: 6,
  saturdayEvening: 6,
  sundayHoliday: 6,
};

export const RATE_LABELS: Record<keyof RatesBySlot, string> = {
  weekdayDaytime: '평일주간 (09-18)',
  weekdayEvening: '평일야간 (19-24)',
  saturdayDaytime: '토요일오후 (09-18)',
  saturdayEvening: '토요일저녁 (19-24)',
  sundayHoliday: '일공휴일',
};

export const DOCTOR_COLORS = [
  '#FFB74D', // orange
  '#FFF176', // yellow
  '#81C784', // green
  '#F48FB1', // pink
  '#90CAF9', // blue
  '#CE93D8', // purple
  '#80CBC4', // teal
  '#FFAB91', // deep orange
  '#A5D6A7', // light green
  '#B39DDB', // deep purple
];

export type Tab = 'schedule' | 'wage' | 'export' | 'settings';
