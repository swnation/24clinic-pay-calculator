import type { Shift, Doctor } from '../types';

interface CalendarEvent {
  title: string;
  date: string; // YYYY-MM-DD
  startHour: number;
  endHour: number;
}

export function generateCalendarEvents(
  shifts: Shift[],
  _doctor: Doctor,
  branchName: string
): CalendarEvent[] {
  // Group shifts by date
  const byDate = new Map<string, Shift[]>();
  for (const shift of shifts) {
    const existing = byDate.get(shift.date) || [];
    existing.push(shift);
    byDate.set(shift.date, existing);
  }

  const events: CalendarEvent[] = [];

  for (const [date, dayShifts] of byDate) {
    // Sort by start hour
    const sorted = [...dayShifts].sort((a, b) => a.startHour - b.startHour);

    // Check if it's a full shift (covers 09-24 in one room)
    const isFullShift = sorted.length === 1
      && sorted[0].startHour === 9
      && sorted[0].endHour === 24;

    const isFullShiftMulti = sorted.length >= 2
      && sorted[0].startHour === 9
      && sorted[sorted.length - 1].endHour === 24
      && isContiguousWithBreaks(sorted);

    if (isFullShift) {
      events.push({
        title: branchName,
        date,
        startHour: 9,
        endHour: 24,
      });
    } else if (isFullShiftMulti) {
      // Full shift across rooms
      const parts = sorted.map(s => `${branchName}${s.room}(${pad(s.startHour)}-${pad(s.endHour)})`);
      events.push({
        title: parts.join(', '),
        date,
        startHour: sorted[0].startHour,
        endHour: sorted[sorted.length - 1].endHour,
      });
    } else if (sorted.length === 1) {
      const s = sorted[0];
      events.push({
        title: `${branchName}${s.room}(${pad(s.startHour)}-${pad(s.endHour)})`,
        date,
        startHour: s.startHour,
        endHour: s.endHour,
      });
    } else {
      // Multiple shifts, combine into one event
      const parts = sorted.map(s => `${branchName}${s.room}(${pad(s.startHour)}-${pad(s.endHour)})`);
      events.push({
        title: parts.join(', '),
        date,
        startHour: sorted[0].startHour,
        endHour: sorted[sorted.length - 1].endHour,
      });
    }
  }

  return events.sort((a, b) => a.date.localeCompare(b.date));
}

function isContiguousWithBreaks(shifts: Shift[]): boolean {
  for (let i = 1; i < shifts.length; i++) {
    const prevEnd = shifts[i - 1].endHour;
    const curStart = shifts[i].startHour;
    // Allow gap of break hours (13-14 or 18-19)
    if (curStart !== prevEnd && curStart !== prevEnd + 1) return false;
  }
  return true;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function formatDateTimeICS(dateStr: string, hour: number): string {
  const [y, m, d] = dateStr.split('-');
  if (hour === 24) {
    // Next day 00:00
    const nextDay = new Date(parseInt(y), parseInt(m) - 1, parseInt(d) + 1);
    const ny = nextDay.getFullYear();
    const nm = String(nextDay.getMonth() + 1).padStart(2, '0');
    const nd = String(nextDay.getDate()).padStart(2, '0');
    return `${ny}${nm}${nd}T000000`;
  }
  return `${y}${m}${d}T${pad(hour)}0000`;
}

export function generateICS(events: CalendarEvent[]): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//24Clinic//PayCalculator//KO',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:24시 열린의원 근무',
  ];

  for (const event of events) {
    const uid = `${event.date}-${event.startHour}-${event.endHour}@24clinic`;
    lines.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTART;TZID=Asia/Seoul:${formatDateTimeICS(event.date, event.startHour)}`,
      `DTEND;TZID=Asia/Seoul:${formatDateTimeICS(event.date, event.endHour)}`,
      `SUMMARY:${event.title}`,
      'STATUS:CONFIRMED',
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function downloadICS(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
