import type { Shift, RatesBySlot, WageBreakdown, WageBreakdownRow, WeeklyHours, DoctorMonthlyRate, BranchMonthlyRate, DayType, TimeSlot, SpecialRatePeriod } from '../types';
import { rateKey } from '../types';
import { isSaturday, isHolidayOrSunday, isSunday } from './holidays';

// Priority: doctor override > branch monthly > default
export function getEffectiveRates(
  doctorId: string,
  month: string,
  defaultRates: RatesBySlot,
  branchMonthlyRates: BranchMonthlyRate[],
  doctorMonthlyRates: DoctorMonthlyRate[]
): RatesBySlot {
  const branchRate = branchMonthlyRates.find(r => r.month === month);
  const doctorRate = doctorMonthlyRates.find(
    r => r.doctorId === doctorId && r.month === month
  );
  return {
    ...defaultRates,
    ...branchRate?.rates,
    ...doctorRate?.rates,
  };
}

function isBreakHour(h: number): boolean {
  return h === 13 || h === 18;
}

function getTimeSlot(hour: number): TimeSlot {
  if (hour >= 19) return 'evening';
  if (hour >= 14) return 'afternoon';
  return 'morning';
}

function getDayType(dateStr: string, customHolidays: string[]): DayType {
  // 공휴일 (not Sunday) takes priority over day-of-week
  const isSun = isSunday(dateStr);
  const isHol = isHolidayOrSunday(dateStr, customHolidays) && !isSun;

  if (isHol) return 'holiday';
  if (isSun) return 'sunday';
  if (isSaturday(dateStr)) return 'saturday';
  return 'weekday';
}

interface SpecialMatch {
  period: SpecialRatePeriod;
  rate: number;
}

function findSpecialPeriod(
  dateStr: string,
  timeSlot: TimeSlot,
  specialPeriods: SpecialRatePeriod[]
): SpecialMatch | null {
  // Later-added (higher index) periods take priority over earlier ones
  for (let i = specialPeriods.length - 1; i >= 0; i--) {
    const period = specialPeriods[i];
    if (dateStr >= period.startDate && dateStr <= period.endDate) {
      const rate = timeSlot === 'morning' ? period.morning
        : timeSlot === 'afternoon' ? period.afternoon
        : period.evening;
      return { period, rate };
    }
  }
  return null;
}

export function calculateWorkHours(shift: Shift): number {
  let hours = 0;
  for (let h = shift.startHour; h < shift.endHour; h++) {
    if (!isBreakHour(h)) hours++;
  }
  return hours;
}

export function calculateMonthlyWage(
  shifts: Shift[],
  rates: RatesBySlot,
  customHolidays: string[],
  specialPeriods: SpecialRatePeriod[]
): WageBreakdown {
  const buckets = new Map<string, { dayType: DayType; timeSlot: TimeSlot; hours: number; wage: number; specialPeriodName?: string }>();
  const workDates = new Set<string>();

  for (const shift of shifts) {
    const dayType = getDayType(shift.date, customHolidays);
    workDates.add(shift.date);

    for (let h = shift.startHour; h < shift.endHour; h++) {
      if (isBreakHour(h)) continue;

      const timeSlot = getTimeSlot(h);
      const special = findSpecialPeriod(shift.date, timeSlot, specialPeriods);
      const rate = special ? special.rate : rates[rateKey(dayType, timeSlot)];

      // Key by special period ID + timeSlot, or regular dayType + timeSlot
      const key = special ? `special:${special.period.id}:${timeSlot}` : `${dayType}:${timeSlot}`;
      const bucketDayType = special ? 'holiday' : dayType;

      const bucket = buckets.get(key);
      if (bucket) {
        bucket.hours++;
        bucket.wage += rate;
      } else {
        buckets.set(key, {
          dayType: bucketDayType, timeSlot, hours: 1, wage: rate,
          specialPeriodName: special?.period.name,
        });
      }
    }
  }

  const rows: WageBreakdownRow[] = [];
  let totalHours = 0;
  let totalWage = 0;

  // Sort order: weekday, saturday, sunday, holiday × morning, afternoon, evening
  const dayOrder: DayType[] = ['weekday', 'saturday', 'sunday', 'holiday'];
  const slotOrder: TimeSlot[] = ['morning', 'afternoon', 'evening'];

  // Regular buckets
  for (const dt of dayOrder) {
    for (const ts of slotOrder) {
      const bucket = buckets.get(`${dt}:${ts}`);
      if (bucket && bucket.hours > 0) {
        const rate = rates[rateKey(dt, ts)];
        rows.push({ dayType: dt, timeSlot: ts, hours: bucket.hours, rate, wage: bucket.wage });
        totalHours += bucket.hours;
        totalWage += bucket.wage;
      }
    }
  }

  // Special period buckets - each period shown separately with its name
  for (const [key, bucket] of buckets) {
    if (!key.startsWith('special:') || bucket.hours === 0) continue;
    const rate = Math.round(bucket.wage / bucket.hours * 10) / 10;
    rows.push({
      dayType: 'holiday', timeSlot: bucket.timeSlot,
      hours: bucket.hours, rate, wage: bucket.wage,
      specialPeriodName: bucket.specialPeriodName,
    });
    totalHours += bucket.hours;
    totalWage += bucket.wage;
  }

  return { rows, totalHours, totalWage, workDays: workDates.size };
}

export function calculateWeeklyHours(
  shifts: Shift[],
  year: number,
  month: number
): WeeklyHours[] {
  const weeks: WeeklyHours[] = [];
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);

  let weekStart = new Date(firstDay);
  const dayOfWeek = weekStart.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  weekStart.setDate(weekStart.getDate() + diff);

  let weekNum = 1;
  while (weekStart <= lastDay) {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const weekShifts = shifts.filter(s => {
      const d = new Date(s.date + 'T00:00:00');
      return d >= weekStart && d <= weekEnd;
    });

    let hours = 0;
    for (const s of weekShifts) {
      hours += calculateWorkHours(s);
    }

    const startMonth = weekStart.getMonth() + 1;
    const startDate = weekStart.getDate();
    const endMonth = weekEnd.getMonth() + 1;
    const endDate = weekEnd.getDate();

    weeks.push({
      weekNumber: weekNum,
      weekLabel: startMonth === endMonth
        ? `${startMonth}/${startDate} - ${startMonth}/${endDate}`
        : `${startMonth}/${startDate} - ${endMonth}/${endDate}`,
      hours,
      shifts: weekShifts.length,
    });

    weekStart = new Date(weekStart);
    weekStart.setDate(weekStart.getDate() + 7);
    weekNum++;
  }

  return weeks;
}
