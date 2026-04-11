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

// Check if two shifts are consecutive (allowing break gaps 13→14, 18→19)
function isConsecutive(endHour: number, startHour: number): boolean {
  return startHour === endHour || startHour === endHour + 1;
}

// Merge consecutive same-room shifts into blocks
function mergeShiftsIntoBlocks(shifts: Shift[]): MergedBlock[] {
  if (shifts.length === 0) return [];

  // Group by room
  const byRoom = new Map<number, Shift[]>();
  for (const s of shifts) {
    if (!byRoom.has(s.room)) byRoom.set(s.room, []);
    byRoom.get(s.room)!.push(s);
  }

  const blocks: MergedBlock[] = [];

  for (const [room, roomShifts] of byRoom) {
    const sorted = [...roomShifts].sort((a, b) => a.startHour - b.startHour);

    let current: MergedBlock = {
      room: room as 1 | 2,
      startHour: sorted[0].startHour,
      endHour: sorted[0].endHour,
    };

    for (let i = 1; i < sorted.length; i++) {
      if (isConsecutive(current.endHour, sorted[i].startHour)) {
        // Merge: extend the end hour
        current.endHour = sorted[i].endHour;
      } else {
        blocks.push(current);
        current = {
          room: room as 1 | 2,
          startHour: sorted[i].startHour,
          endHour: sorted[i].endHour,
        };
      }
    }
    blocks.push(current);
  }

  // Sort blocks by start hour
  blocks.sort((a, b) => a.startHour - b.startHour);
  return blocks;
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
    const blocks = mergeShiftsIntoBlocks(dayShifts);

    // Check full shift: single block covering 09-24
    const isFullShift = blocks.length === 1
      && blocks[0].startHour === 9
      && blocks[0].endHour === 24;

    if (isFullShift) {
      // 풀근무: 잠실1 또는 잠실2 (시간 없이)
      events.push({ title: `${branchName}${blocks[0].room}`, date, startHour: 9, endHour: 24 });
    } else {
      const parts = blocks.map(b =>
        `${branchName}${b.room}(${pad(b.startHour)}-${pad(b.endHour)})`
      );
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
