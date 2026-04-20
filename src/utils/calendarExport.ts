import type { Shift, Doctor } from '../types';

interface CalendarEvent {
  title: string;
  date: string; // YYYY-MM-DD
  startHour: number;
  endHour: number;
  color?: string; // hex color
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

// Map hex color to closest Google Calendar color ID (1-11)
function hexToGoogleColorId(hex: string): string {
  const colors: [string, string][] = [
    ['1', '#a4bdfc'], // Lavender
    ['2', '#7ae7bf'], // Sage
    ['3', '#dbadff'], // Grape
    ['4', '#ff887c'], // Flamingo
    ['5', '#fbd75b'], // Banana
    ['6', '#ffb878'], // Tangerine
    ['7', '#46d6db'], // Peacock
    ['8', '#e1e1e1'], // Graphite
    ['9', '#5484ed'], // Blueberry
    ['10', '#51b749'], // Basil
    ['11', '#dc2127'], // Tomato
  ];

  const hexToRgb = (h: string) => {
    const r = parseInt(h.slice(1, 3), 16);
    const g = parseInt(h.slice(3, 5), 16);
    const b = parseInt(h.slice(5, 7), 16);
    return [r, g, b];
  };

  const [r, g, b] = hexToRgb(hex);
  let closest = '5'; // default: Banana
  let minDist = Infinity;

  for (const [id, colorHex] of colors) {
    const [cr, cg, cb] = hexToRgb(colorHex);
    const dist = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2;
    if (dist < minDist) {
      minDist = dist;
      closest = id;
    }
  }
  return closest;
}

export function generateCalendarEvents(
  shifts: Shift[],
  doctor: Doctor,
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
      events.push({ title: `${branchName}${blocks[0].room}`, date, startHour: 9, endHour: 24, color: doctor.color });
    } else {
      const parts = blocks.map(b =>
        `${branchName}${b.room}(${pad(b.startHour)}-${pad(b.endHour)})`
      );
      events.push({
        title: parts.join(', '),
        date,
        startHour: blocks[0].startHour,
        endHour: blocks[blocks.length - 1].endHour,
        color: doctor.color,
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

function formatUTCNow(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
}

export function generateICS(events: CalendarEvent[]): string {
  const now = formatUTCNow();
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//24Clinic//PayCalculator//KO',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:24시 열린의원 근무',
    'X-WR-TIMEZONE:Asia/Seoul',
    // VTIMEZONE for Google Calendar compatibility
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
    const colorId = event.color ? hexToGoogleColorId(event.color) : '5';
    lines.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${now}`,
      `CREATED:${now}`,
      `LAST-MODIFIED:${now}`,
      `DTSTART;TZID=Asia/Seoul:${formatDateTimeICS(event.date, event.startHour)}`,
      `DTEND;TZID=Asia/Seoul:${formatDateTimeICS(event.date, event.endHour)}`,
      `SUMMARY:${event.title}`,
      `COLOR:${event.color || '#FBD75B'}`,
      `X-GOOGLE-CALENDAR-CONTENT-COLOR:${event.color || '#FBD75B'}`,
      `X-APPLE-CALENDAR-COLOR:${event.color || '#FBD75B'}`,
      `X-OUTLOOK-COLOR:${event.color || '#FBD75B'}`,
      // Google Calendar uses numeric color IDs via categories
      `CATEGORIES:color${colorId}`,
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
