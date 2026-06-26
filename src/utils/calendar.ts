import type { Shift, Doctor } from '../types';

/** 숫자를 2자리 0-padding 문자열로 (예: 3 -> "03") */
export function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

export const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

/** 월 이동 (delta는 -1 또는 +1). 연도 경계 자동 처리. */
export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  if (delta < 0) {
    return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  }
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}

/** 달력 그리드용 일자 배열. 앞쪽 빈칸(null) + 1~말일 + 7의 배수가 되도록 뒤쪽 빈칸. */
export function buildCalendarDays(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const startDayOfWeek = firstDay.getDay();
  const totalDays = lastDay.getDate();

  const days: (number | null)[] = [];
  for (let i = 0; i < startDayOfWeek; i++) days.push(null);
  for (let d = 1; d <= totalDays; d++) days.push(d);
  while (days.length % 7 !== 0) days.push(null);

  return days;
}

export type TimeSlotKey = 'morning' | 'afternoon' | 'evening';
export const TIME_SLOT_KEYS: TimeSlotKey[] = ['morning', 'afternoon', 'evening'];

export function getTimeSlotKey(startHour: number): TimeSlotKey {
  if (startHour < 14) return 'morning';
  if (startHour < 19) return 'afternoon';
  return 'evening';
}

export type DayRooms = Record<TimeSlotKey, { room1: Shift[]; room2: Shift[] }>;

/** 근무 목록을 날짜 -> 시간대 -> 진료실별로 구조화 */
export function buildStructuredShifts(shifts: Shift[]): Map<string, DayRooms> {
  const map = new Map<string, DayRooms>();
  for (const s of shifts) {
    if (!map.has(s.date)) {
      map.set(s.date, {
        morning: { room1: [], room2: [] },
        afternoon: { room1: [], room2: [] },
        evening: { room1: [], room2: [] },
      });
    }
    const dayData = map.get(s.date)!;
    const slot = getTimeSlotKey(s.startHour);
    if (s.room === 1) dayData[slot].room1.push(s);
    else dayData[slot].room2.push(s);
  }
  return map;
}

/** 해당 월에 2진료실 근무가 하나라도 있는지 */
export function hasRoom2(shifts: Shift[]): boolean {
  return shifts.some(s => s.room === 2);
}

export function doctorName(doctors: Doctor[], id: string): string {
  return doctors.find(d => d.id === id)?.name || '?';
}

export function doctorColor(doctors: Doctor[], id: string): string {
  return doctors.find(d => d.id === id)?.color || '#E0E0E0';
}
