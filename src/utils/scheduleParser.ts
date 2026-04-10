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

export function parseScheduleText(text: string): ParseResult {
  // Extract year-month from "2026.04" pattern
  const monthMatch = text.match(/(\d{4})\.(\d{2})/);
  if (!monthMatch) throw new Error('월 정보를 찾을 수 없습니다 (예: 2026.04)');

  const year = parseInt(monthMatch[1]);
  const month = parseInt(monthMatch[2]);

  // Extract branch name (지점명 뒤의 텍스트)
  const branchMatch = text.match(/지점명\s*\n?\s*(.+?)점/);
  const branchName = branchMatch ? branchMatch[1].trim() : '';

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
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check if this is a day number (1-31, standalone)
    if (/^\d{1,2}$/.test(trimmed)) {
      const num = parseInt(trimmed);
      if (num >= 1 && num <= 31) {
        flushDay();
        currentDay = num;
        dayShiftBuffer = [];
        continue;
      }
    }

    // Check if this is a shift entry: "이름 (시작-종료)"
    const shiftMatch = trimmed.match(/^(.+?)\s*\((\d{2})-(\d{2})\)$/);
    if (shiftMatch && currentDay !== null) {
      dayShiftBuffer.push({
        name: shiftMatch[1].trim(),
        start: parseInt(shiftMatch[2]),
        end: parseInt(shiftMatch[3]),
      });
    }
  }

  // Flush last day
  flushDay();

  return {
    year,
    month,
    branchName,
    shifts: allShifts,
    doctorNames: [...doctorNamesSet],
  };
}
