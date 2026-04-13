export interface Doctor {
  id: string;
  name: string;
  color: string; // hex background color
  archived?: boolean;
}

export interface Shift {
  id: string;
  doctorId: string;
  date: string; // YYYY-MM-DD
  startHour: number; // 9-23
  endHour: number; // 10-24
  room: 1 | 2;
}

// 4 day types × 3 time slots = 12 rate categories
export interface RatesBySlot {
  weekdayMorning: number;     // 평일 오전 (09-13)
  weekdayAfternoon: number;   // 평일 오후 (14-18)
  weekdayEvening: number;     // 평일 저녁 (19-24)
  saturdayMorning: number;    // 토요일 오전 (09-13)
  saturdayAfternoon: number;  // 토요일 오후 (14-18)
  saturdayEvening: number;    // 토요일 저녁 (19-24)
  sundayMorning: number;      // 일요일 오전 (09-13)
  sundayAfternoon: number;    // 일요일 오후 (14-18)
  sundayEvening: number;      // 일요일 저녁 (19-24)
  holidayMorning: number;     // 공휴일 오전 (09-13)
  holidayAfternoon: number;   // 공휴일 오후 (14-18)
  holidayEvening: number;     // 공휴일 저녁 (19-24)
}

// 지점 월별 시급 (모든 의사에게 적용)
export interface BranchMonthlyRate {
  month: string; // YYYY-MM
  rates: Partial<RatesBySlot>;
}

// 설/추석 등 연휴 기간 특별 시급
export interface SpecialRatePeriod {
  id: string;
  name: string;         // "설 연휴", "추석 연휴"
  startDate: string;    // YYYY-MM-DD
  endDate: string;      // YYYY-MM-DD
  morning: number;      // 오전 시급 (만원/hr)
  afternoon: number;    // 오후 시급
  evening: number;      // 저녁 시급
}

export type DayType = 'weekday' | 'saturday' | 'sunday' | 'holiday';
export type TimeSlot = 'morning' | 'afternoon' | 'evening';

export interface WageBreakdownRow {
  dayType: DayType;
  timeSlot: TimeSlot;
  hours: number;
  rate: number;
  wage: number;
  specialPeriodName?: string; // 특별 시급 기간 이름 (예: "설 연휴")
}

export interface WageBreakdown {
  rows: WageBreakdownRow[];
  totalHours: number;
  totalWage: number;
  workDays: number;
}

export interface WeeklyHours {
  weekNumber: number;
  weekLabel: string;
  hours: number;
  shifts: number;
}

export const DAY_TYPE_LABELS: Record<DayType, string> = {
  weekday: '평일',
  saturday: '토요일',
  sunday: '일요일',
  holiday: '공휴일',
};

export const TIME_SLOT_LABELS: Record<TimeSlot, string> = {
  morning: '오전 (09-13)',
  afternoon: '오후 (14-18)',
  evening: '저녁 (19-24)',
};

export const DEFAULT_RATES: RatesBySlot = {
  weekdayMorning: 4,
  weekdayAfternoon: 4,
  weekdayEvening: 6,
  saturdayMorning: 6,
  saturdayAfternoon: 6,
  saturdayEvening: 6,
  sundayMorning: 6,
  sundayAfternoon: 6,
  sundayEvening: 6,
  holidayMorning: 6,
  holidayAfternoon: 6,
  holidayEvening: 6,
};

// Helper: build RatesBySlot key from day type + time slot
export function rateKey(dayType: DayType, timeSlot: TimeSlot): keyof RatesBySlot {
  const map: Record<DayType, Record<TimeSlot, keyof RatesBySlot>> = {
    weekday: { morning: 'weekdayMorning', afternoon: 'weekdayAfternoon', evening: 'weekdayEvening' },
    saturday: { morning: 'saturdayMorning', afternoon: 'saturdayAfternoon', evening: 'saturdayEvening' },
    sunday: { morning: 'sundayMorning', afternoon: 'sundayAfternoon', evening: 'sundayEvening' },
    holiday: { morning: 'holidayMorning', afternoon: 'holidayAfternoon', evening: 'holidayEvening' },
  };
  return map[dayType][timeSlot];
}

export const DOCTOR_COLORS = [
  '#FFB74D', '#FFF176', '#81C784', '#F48FB1', '#90CAF9',
  '#CE93D8', '#80CBC4', '#FFAB91', '#A5D6A7', '#B39DDB',
];

export type Tab = 'schedule' | 'wage' | 'availability' | 'compare' | 'export' | 'settings';
