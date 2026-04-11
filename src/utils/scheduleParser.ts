export interface ParsedShift {
  doctorName: string;
  date: string; // YYYY-MM-DD
  startHour: number;
  endHour: number;
  room: 1 | 2;
}

export interface ParseResult {
  year: number;
  month: number;
  branchName: string;
  shifts: ParsedShift[];
  doctorNames: string[];
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function shiftsOverlap(
  a: { start: number; end: number },
  b: { start: number; end: number }
): boolean {
  return a.start < b.end && a.end > b.start;
}

function parseSingleMonth(text: string, yearMonth: { year: number; month: number }, branchName: string): ParseResult {
  const { year, month } = yearMonth;
  const lines = text.split('\n');
  const allShifts: ParsedShift[] = [];
  const doctorNamesSet = new Set<string>();

  let currentDay: number | null = null;
  let dayShiftBuffer: { name: string; start: number; end: number }[] = [];

  const flushDay = () => {
    if (currentDay === null || dayShiftBuffer.length === 0) return;

    const dateStr = `${year}-${pad(month)}-${pad(currentDay)}`;
    const room1: { name: string; start: number; end: number }[] = [];

    for (const shift of dayShiftBuffer) {
      const overlapsRoom1 = room1.some(r1 => shiftsOverlap(r1, shift));
      const room: 1 | 2 = overlapsRoom1 ? 2 : 1;

      if (!overlapsRoom1) {
        room1.push(shift);
      }

      doctorNamesSet.add(shift.name);
      allShifts.push({
        doctorName: shift.name,
        date: dateStr,
        startHour: shift.start,
        endHour: shift.end,
        room,
      });
    }
  };

  for (const line of lines) {
    // Normalize: remove non-breaking spaces, BOM, and normalize dashes/brackets
    const trimmed = line
      .replace(/[\u00A0\uFEFF]/g, ' ')
      .replace(/[–—]/g, '-')      // en-dash, em-dash → hyphen
      .replace(/（/g, '(').replace(/）/g, ')')  // full-width brackets
      .trim();
    if (!trimmed) continue;

    // Check if this is a day number (1-31, optionally followed by holiday name)
    const dayMatch = trimmed.match(/^(\d{1,2})(?:\s+\S+.*)?$/);
    if (dayMatch && !/\(\d{1,2}-\d{1,2}\)/.test(trimmed)) {
      const num = parseInt(dayMatch[1]);
      if (num >= 1 && num <= 31) {
        flushDay();
        currentDay = num;
        dayShiftBuffer = [];
        continue;
      }
    }

    // Check if this is a shift entry: "이름 (시작-종료)" (supports 1 or 2 digit hours)
    const shiftMatch = trimmed.match(/^(.+?)\s*\((\d{1,2})-(\d{1,2})\)$/);
    if (shiftMatch && currentDay !== null) {
      dayShiftBuffer.push({
        name: shiftMatch[1].trim(),
        start: parseInt(shiftMatch[2]),
        end: parseInt(shiftMatch[3]),
      });
    }
  }

  flushDay();

  return {
    year,
    month,
    branchName,
    shifts: allShifts,
    doctorNames: [...doctorNamesSet],
  };
}

/** Parse a single month's schedule text */
export function parseScheduleText(text: string): ParseResult {
  const monthMatch = text.match(/(\d{4})\.(\d{2})/);
  if (!monthMatch) throw new Error('월 정보를 찾을 수 없습니다 (예: 2026.04)');

  const year = parseInt(monthMatch[1]);
  const month = parseInt(monthMatch[2]);

  const branchMatch = text.match(/지점명\s*\n?\s*(.+?)점/);
  const branchName = branchMatch ? branchMatch[1].trim() : '';

  return parseSingleMonth(text, { year, month }, branchName);
}

/** Parse multiple months from a single pasted text block */
export function parseMultiMonthText(text: string): ParseResult[] {
  // Split by year-month pattern "YYYY.MM" which appears as month header
  // Each month section starts with the pattern like " 2026.04 " or "2026.04"
  const monthPattern = /(\d{4})\.(\d{2})/g;
  const matches: { index: number; year: number; month: number }[] = [];

  let m;
  while ((m = monthPattern.exec(text)) !== null) {
    matches.push({
      index: m.index,
      year: parseInt(m[1]),
      month: parseInt(m[2]),
    });
  }

  if (matches.length === 0) {
    throw new Error('월 정보를 찾을 수 없습니다 (예: 2026.04)');
  }

  // Extract branch name from the first occurrence
  const branchMatch = text.match(/지점명\s*\n?\s*(.+?)점/);
  const branchName = branchMatch ? branchMatch[1].trim() : '';

  // If only one month found, use single parse
  if (matches.length === 1) {
    return [parseSingleMonth(text, matches[0], branchName)];
  }

  // Split text into month sections
  const results: ParseResult[] = [];

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    const section = text.substring(start, end);

    const result = parseSingleMonth(section, matches[i], branchName);
    if (result.shifts.length > 0) {
      results.push(result);
    }
  }

  // Sort by year-month
  results.sort((a, b) => a.year * 100 + a.month - (b.year * 100 + b.month));

  return results;
}
