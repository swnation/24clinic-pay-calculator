import type { Shift, Doctor } from '../types';

interface CalendarEvent {
  title: string;
  date: string; // YYYY-MM-DD
  startHour: number;
  endHour: number;
}

interface MergedBlock {
  room: 1 | 2;
  startHour: number;
  endHour: number;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function isConsecutive(endHour: number, startHour: number): boolean {
  return startHour === endHour || startHour === endHour + 1;
}

function mergeShiftsIntoBlocks(shifts: Shift[]): MergedBlock[] {
  if (shifts.length === 0) return [];

  const byRoom = new Map<number, Shift[]>();
  for (const s of shifts) {
    if (!byRoom.has(s.room)) byRoom.set(s.room, []);
    byRoom.get(s.room)!.push(s);
  }

  const blocks: MergedBlock[] = [];

  for (const [room, roomShifts] of byRoom) {
    const sorted = [...roomShifts].sort((a, b) => a.startHour - b.startHour);
    let current: MergedBlock = { room: room as 1 | 2, startHour: sorted[0].startHour, endHour: sorted[0].endHour };
    for (let i = 1; i < sorted.length; i++) {
      if (isConsecutive(current.endHour, sorted[i].startHour)) {
        current.endHour = sorted[i].endHour;
      } else {
        blocks.push(current);
        current = { room: room as 1 | 2, startHour: sorted[i].startHour, endHour: sorted[i].endHour };
      }
    }
    blocks.push(current);
  }

  blocks.sort((a, b) => a.startHour - b.startHour);
  return blocks;
}

export function generateCalendarEvents(
  shifts: Shift[],
  _doctor: Doctor,
  branchName: string
): CalendarEvent[] {
  const byDate = new Map<string, Shift[]>();
  for (const shift of shifts) {
    const existing = byDate.get(shift.date) || [];
    existing.push(shift);
    byDate.set(shift.date, existing);
  }

  const events: CalendarEvent[] = [];

  for (const [date, dayShifts] of byDate) {
    const blocks = mergeShiftsIntoBlocks(dayShifts);
    const isFullShift = blocks.length === 1 && blocks[0].startHour === 9 && blocks[0].endHour === 24;

    if (isFullShift) {
      events.push({ title: `${branchName}${blocks[0].room}`, date, startHour: 9, endHour: 24 });
    } else {
      const parts = blocks.map(b => `${branchName}${b.room}(${pad(b.startHour)}-${pad(b.endHour)})`);
      events.push({
        title: parts.join(', '),
        date,
        startHour: blocks[0].startHour,
        endHour: blocks[blocks.length - 1].endHour,
      });
    }
  }

  return events.sort((a, b) => a.date.localeCompare(b.date));
}

function formatDateTimeICS(dateStr: string, hour: number): string {
  const [y, m, d] = dateStr.split('-');
  if (hour === 24) {
    const nextDay = new Date(parseInt(y), parseInt(m) - 1, parseInt(d) + 1);
    const ny = nextDay.getFullYear();
    const nm = String(nextDay.getMonth() + 1).padStart(2, '0');
    const nd = String(nextDay.getDate()).padStart(2, '0');
    return `${ny}${nm}${nd}T000000`;
  }
  return `${y}${m}${d}T${pad(hour)}0000`;
}

function formatDateICS(dateStr: string): string {
  return dateStr.replace(/-/g, '');
}

function nextDateICS(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const next = new Date(y, m - 1, d + 1);
  return `${next.getFullYear()}${pad(next.getMonth() + 1)}${pad(next.getDate())}`;
}

function formatUTCNow(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
}

export function generateICS(events: CalendarEvent[], allDay = false): string {
  const now = formatUTCNow();
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//24Clinic//PayCalculator//KO',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:24시 열린의원 근무',
    'X-WR-TIMEZONE:Asia/Seoul',
    'BEGIN:VTIMEZONE',
    'TZID:Asia/Seoul',
    'X-LIC-LOCATION:Asia/Seoul',
    'BEGIN:STANDARD',
    'TZOFFSETFROM:+0900',
    'TZOFFSETTO:+0900',
    'TZNAME:KST',
    'DTSTART:19700101T000000',
    'END:STANDARD',
    'END:VTIMEZONE',
  ];

  for (const event of events) {
    const uid = `${event.date}-${event.startHour}-${event.endHour}-${now}@24clinic`;
    lines.push('BEGIN:VEVENT', `UID:${uid}`, `DTSTAMP:${now}`);

    if (allDay) {
      lines.push(
        `DTSTART;VALUE=DATE:${formatDateICS(event.date)}`,
        `DTEND;VALUE=DATE:${nextDateICS(event.date)}`,
      );
    } else {
      lines.push(
        `DTSTART;TZID=Asia/Seoul:${formatDateTimeICS(event.date, event.startHour)}`,
        `DTEND;TZID=Asia/Seoul:${formatDateTimeICS(event.date, event.endHour)}`,
      );
    }

    lines.push(
      `SUMMARY:${event.title}`,
      'STATUS:CONFIRMED',
      'TRANSP:OPAQUE',
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
