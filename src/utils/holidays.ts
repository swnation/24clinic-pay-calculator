// Korean public holidays
// Includes fixed holidays and known lunar calendar dates for 2025-2027
const KOREAN_HOLIDAYS: Record<string, string> = {
  // 2025
  '2025-01-01': '신정',
  '2025-01-28': '설날 전날',
  '2025-01-29': '설날',
  '2025-01-30': '설날 다음날',
  '2025-03-01': '삼일절',
  '2025-05-05': '어린이날',
  '2025-05-06': '부처님오신날',
  '2025-06-06': '현충일',
  '2025-08-15': '광복절',
  '2025-10-03': '개천절',
  '2025-10-05': '추석 전날',
  '2025-10-06': '추석',
  '2025-10-07': '추석 다음날',
  '2025-10-08': '대체공휴일',
  '2025-10-09': '한글날',
  '2025-12-25': '크리스마스',
  // 2026
  '2026-01-01': '신정',
  '2026-02-16': '설날 전날',
  '2026-02-17': '설날',
  '2026-02-18': '설날 다음날',
  '2026-03-01': '삼일절',
  '2026-03-02': '대체공휴일(삼일절)',
  '2026-05-05': '어린이날',
  '2026-05-24': '부처님오신날',
  '2026-05-25': '대체공휴일(부처님오신날)',
  '2026-06-06': '현충일',
  '2026-08-15': '광복절',
  '2026-09-24': '추석 전날',
  '2026-09-25': '추석',
  '2026-09-26': '추석 다음날',
  '2026-10-03': '개천절',
  '2026-10-05': '대체공휴일(개천절)',
  '2026-10-09': '한글날',
  '2026-12-25': '크리스마스',
  // 2027
  '2027-01-01': '신정',
  '2027-02-06': '설날 전날',
  '2027-02-07': '설날',
  '2027-02-08': '설날 다음날',
  '2027-02-09': '대체공휴일(설날)',
  '2027-03-01': '삼일절',
  '2027-05-05': '어린이날',
  '2027-05-13': '부처님오신날',
  '2027-06-06': '현충일',
  '2027-06-07': '대체공휴일(현충일)',
  '2027-08-15': '광복절',
  '2027-08-16': '대체공휴일(광복절)',
  '2027-10-03': '개천절',
  '2027-10-04': '대체공휴일(개천절)',
  '2027-10-09': '한글날',
  '2027-10-14': '추석 전날',
  '2027-10-15': '추석',
  '2027-10-16': '추석 다음날',
  '2027-12-25': '크리스마스',
};

export function isKoreanHoliday(dateStr: string): boolean {
  return dateStr in KOREAN_HOLIDAYS;
}

export function getHolidayName(dateStr: string): string | null {
  return KOREAN_HOLIDAYS[dateStr] || null;
}

export function getKoreanHolidaysForYear(year: number): string[] {
  const prefix = `${year}-`;
  return Object.keys(KOREAN_HOLIDAYS).filter(d => d.startsWith(prefix));
}

export function isSunday(dateStr: string): boolean {
  return new Date(dateStr + 'T00:00:00').getDay() === 0;
}

export function isSaturday(dateStr: string): boolean {
  return new Date(dateStr + 'T00:00:00').getDay() === 6;
}

export function isHolidayOrSunday(dateStr: string, customHolidays: string[]): boolean {
  return isSunday(dateStr) || isKoreanHoliday(dateStr) || customHolidays.includes(dateStr);
}
