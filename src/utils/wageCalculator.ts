import type { Shift, RatesBySlot, WageBreakdown, WeeklyHours, DoctorMonthlyRate } from '../types';
import { isSaturday, isHolidayOrSunday } from './holidays';

export function getEffectiveRates(
  doctorId: string,
  month: string,
  defaultRates: RatesBySlot,
  doctorMonthlyRates: DoctorMonthlyRate[]
): RatesBySlot {
  const override = doctorMonthlyRates.find(
    r => r.doctorId === doctorId && r.month === month
  );
  if (!override) return defaultRates;
  return {
    weekdayDaytime: override.rates.weekdayDaytime ?? defaultRates.weekdayDaytime,
    weekdayEvening: override.rates.weekdayEvening ?? defaultRates.weekdayEvening,
    saturdayDaytime: override.rates.saturdayDaytime ?? defaultRates.saturdayDaytime,
    saturdayEvening: override.rates.saturdayEvening ?? defaultRates.saturdayEvening,
    sundayHoliday: override.rates.sundayHoliday ?? defaultRates.sundayHoliday,
  };
}

function isBreakHour(h: number): boolean {
  return h === 13 || h === 18;
}

function getHourRate(
  hour: number,
  isSat: boolean,
  isHolSun: boolean,
  rates: RatesBySlot
): number {
  if (isHolSun) return rates.sundayHoliday;
  if (isSat) return hour >= 19 ? rates.saturdayEvening : rates.saturdayDaytime;
  return hour >= 19 ? rates.weekdayEvening : rates.weekdayDaytime;
}

function getSlotCategory(
  hour: number,
  isSat: boolean,
  isHolSun: boolean
): keyof WageBreakdown {
  if (isHolSun) return 'sundayHolidayHours';
  if (isSat) return hour >= 19 ? 'saturdayEveningHours' : 'saturdayDaytimeHours';
  return hour >= 19 ? 'weekdayEveningHours' : 'weekdayDaytimeHours';
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
  customHolidays: string[]
): WageBreakdown {
  const breakdown: WageBreakdown = {
    weekdayDaytimeHours: 0,
    weekdayEveningHours: 0,
    saturdayDaytimeHours: 0,
    saturdayEveningHours: 0,
    sundayHolidayHours: 0,
    weekdayDaytimeWage: 0,
    weekdayEveningWage: 0,
    saturdayDaytimeWage: 0,
    saturdayEveningWage: 0,
    sundayHolidayWage: 0,
    totalHours: 0,
    totalWage: 0,
    workDays: 0,
  };

  const workDates = new Set<string>();

  for (const shift of shifts) {
    const isSat = isSaturday(shift.date);
    const isHolSun = isHolidayOrSunday(shift.date, customHolidays);

    workDates.add(shift.date);

    for (let h = shift.startHour; h < shift.endHour; h++) {
      if (isBreakHour(h)) continue;

      const category = getSlotCategory(h, isSat, isHolSun);
      breakdown[category]++;

      const rate = getHourRate(h, isSat, isHolSun, rates);
      const wageCategory = category.replace('Hours', 'Wage') as keyof WageBreakdown;
      (breakdown[wageCategory] as number) += rate;

      breakdown.totalHours++;
      breakdown.totalWage += rate;
    }
  }

  breakdown.workDays = workDates.size;
  return breakdown;
}

export function calculateWeeklyHours(
  shifts: Shift[],
  year: number,
  month: number
): WeeklyHours[] {
  const weeks: WeeklyHours[] = [];
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);

  // Find the Monday of the week containing the 1st
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
