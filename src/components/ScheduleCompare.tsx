import { useState, useRef, useMemo, useEffect } from 'react';
import type { Shift } from '../types';
import { useAppStore } from '../store';
import { isHolidayOrSunday, isSaturday, getHolidayName } from '../utils/holidays';

interface Props {
  year: number;
  month: number;
  onMonthChange: (year: number, month: number) => void;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

type TimeSlotKey = 'morning' | 'afternoon' | 'evening';

function getTimeSlotKey(startHour: number): TimeSlotKey {
  if (startHour < 14) return 'morning';
  if (startHour < 19) return 'afternoon';
  return 'evening';
}

export default function ScheduleCompare({ year, month, onMonthChange }: Props) {
  const { state, getShiftsForMonth } = useAppStore();
  const [image, setImage] = useState<string | null>(null);
  const [filterDoctor, setFilterDoctor] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'screenshot' | 'parsed' | 'overlay'>('screenshot');
  const [overlayOpacity, setOverlayOpacity] = useState(0.5);
  const fileRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const monthStr = `${year}-${pad(month)}`;
  const shifts = getShiftsForMonth(monthStr);
  const filteredCount = filterDoctor === 'all' ? shifts.length : shifts.filter(s => s.doctorId === filterDoctor).length;

  const getDoctorName = (id: string) => state.doctors.find(d => d.id === id)?.name || '?';
  const getDoctorColor = (id: string) => state.doctors.find(d => d.id === id)?.color || '#E0E0E0';

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { setImage(reader.result as string); setViewMode('screenshot'); };
    reader.readAsDataURL(file);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
        if (!image) return;
        e.preventDefault();
        const modes: typeof viewMode[] = ['screenshot', 'parsed', 'overlay'];
        const idx = modes.indexOf(viewMode);
        const next = e.key === 'ArrowRight'
          ? modes[(idx + 1) % modes.length]
          : modes[(idx - 1 + modes.length) % modes.length];
        setViewMode(next);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [viewMode, image]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const startDayOfWeek = firstDay.getDay();
    const totalDays = lastDay.getDate();
    const days: (number | null)[] = [];
    for (let i = 0; i < startDayOfWeek; i++) days.push(null);
    for (let d = 1; d <= totalDays; d++) days.push(d);
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }, [year, month]);


  // Build structured data: date -> { morning/afternoon/evening } -> { room1, room2 }
  const structuredShifts = useMemo(() => {
    const map = new Map<string, Record<TimeSlotKey, { room1: Shift[]; room2: Shift[] }>>();
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
  }, [shifts]);

  // Month-level Room 2 detection for consistent grid
  const monthHasRoom2 = useMemo(() => shifts.some(s => s.room === 2), [shifts]);

  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const timeSlots: TimeSlotKey[] = ['morning', 'afternoon', 'evening'];

  const renderCalendar = (transparent = false) => (
    <div className="overflow-x-auto">
      <div className={`grid grid-cols-7 min-w-[840px] ${transparent ? '' : 'border-t border-l border-gray-400'}`}>
        {dayNames.map((name, i) => (
          <div key={name} className={`text-center text-xs font-bold py-1.5 ${transparent
            ? 'text-transparent select-none'
            : `border-b border-r border-gray-400 ${
              i === 0 ? 'bg-gray-700 text-red-300' : i === 6 ? 'bg-gray-700 text-blue-300' : 'bg-gray-700 text-white'
            }`
          }`}>{name}</div>
        ))}
        {calendarDays.map((day, idx) => {
          if (day === null) return <div key={`e-${idx}`} className={`h-[110px] ${transparent ? '' : 'border-b border-r border-gray-300 bg-white'}`} />;
          const dateStr = `${year}-${pad(month)}-${pad(day)}`;
          const isHolSun = isHolidayOrSunday(dateStr, state.customHolidays);
          const isSat = isSaturday(dateStr);
          const holiday = getHolidayName(dateStr);
          const dayData = structuredShifts.get(dateStr);
          const hasRoom2 = monthHasRoom2;
          return (
            <div key={dateStr} className={`h-[110px] p-0.5 ${transparent ? '' : 'border-b border-r border-gray-300 bg-white'}`}>
              <div className={`flex items-baseline gap-0.5 mb-0.5 ${transparent ? 'invisible' : ''}`}>
                <span className={`font-bold text-[11px] ${isHolSun ? 'text-red-500' : isSat ? 'text-blue-500' : 'text-gray-800'}`}>{day}</span>
                {holiday && <span className="text-[7px] text-red-500">{holiday}</span>}
              </div>
              <div className="flex flex-col">
                {timeSlots.map((slot, slotIdx) => {
                  const r1 = dayData?.[slot]?.room1 || [];
                  const r2 = dayData?.[slot]?.room2 || [];
                  return (
                    <div key={slot} className={`flex min-h-[24px] ${!transparent && slotIdx > 0 ? 'border-t border-dashed border-gray-300' : ''}`}>
                      <div className="flex-1 py-0.5 px-0.5">
                        {r1.map(s => (
                          <div key={s.id}
                            className={`text-[10px] sm:text-[11px] leading-snug px-1 py-[2px] rounded-sm whitespace-nowrap overflow-hidden ${filterDoctor !== 'all' && s.doctorId !== filterDoctor ? 'opacity-15' : ''}`}
                            style={{ backgroundColor: getDoctorColor(s.doctorId) }}>
                            <span className={`font-medium ${transparent ? 'text-transparent' : ''}`}>{getDoctorName(s.doctorId)}</span>
                            <span className={`ml-0.5 ${transparent ? 'text-transparent' : 'text-gray-700'}`}>({pad(s.startHour)}-{pad(s.endHour)})</span>
                          </div>
                        ))}
                      </div>
                      {hasRoom2 && (
                        <div className={`flex-1 py-0.5 px-0.5 ${!transparent ? 'border-l border-dashed border-gray-300' : ''}`}>
                          {r2.map(s => (
                            <div key={s.id}
                              className={`text-[10px] sm:text-[11px] leading-snug px-1 py-[2px] rounded-sm whitespace-nowrap overflow-hidden ${filterDoctor !== 'all' && s.doctorId !== filterDoctor ? 'opacity-15' : ''}`}
                              style={{ backgroundColor: getDoctorColor(s.doctorId) }}>
                              <span className={`font-medium ${transparent ? 'text-transparent' : ''}`}>{getDoctorName(s.doctorId)}</span>
                              <span className={`ml-0.5 ${transparent ? 'text-transparent' : 'text-gray-700'}`}>({pad(s.startHour)}-{pad(s.endHour)})</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        </div>
      </div>
  );

  return (
    <div ref={containerRef}>
      {/* Month navigation */}
      <div className="flex items-center justify-center gap-6 mb-3">
        <button onClick={() => { if (month === 1) onMonthChange(year - 1, 12); else onMonthChange(year, month - 1); }}
          className="p-2 hover:bg-gray-100 active:bg-gray-200 rounded text-lg select-none">&lt;</button>
        <h2 className="text-lg font-bold">{year}.{pad(month)}</h2>
        <button onClick={() => { if (month === 12) onMonthChange(year + 1, 1); else onMonthChange(year, month + 1); }}
          className="p-2 hover:bg-gray-100 active:bg-gray-200 rounded text-lg select-none">&gt;</button>
      </div>

      {/* Mode toggle */}
      <div className="flex items-center gap-1 mb-3 bg-gray-100 rounded-lg p-1 max-w-sm mx-auto">
        <button onClick={() => setViewMode('screenshot')}
          className={`flex-1 py-2 text-xs sm:text-sm font-medium rounded-md transition-all ${viewMode === 'screenshot' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
          스크린샷
        </button>
        <button onClick={() => setViewMode('parsed')}
          className={`flex-1 py-2 text-xs sm:text-sm font-medium rounded-md transition-all ${viewMode === 'parsed' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
          파싱결과 ({shifts.length})
        </button>
        {image && (
          <button onClick={() => setViewMode('overlay')}
            className={`flex-1 py-2 text-xs sm:text-sm font-medium rounded-md transition-all ${viewMode === 'overlay' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
            겹치기
          </button>
        )}
      </div>

      {/* Doctor filter */}
      {(viewMode === 'parsed' || viewMode === 'overlay') && (
        <div className="flex flex-wrap gap-1.5 mb-3 justify-center">
          <button onClick={() => setFilterDoctor('all')}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${
              filterDoctor === 'all' ? 'border-gray-700 bg-white shadow-sm' : 'border-gray-200 opacity-50'
            }`}>전체</button>
          {state.doctors.map(d => {
            const hasShifts = shifts.some(s => s.doctorId === d.id);
            if (!hasShifts) return null;
            return (
              <button key={d.id} onClick={() => setFilterDoctor(filterDoctor === d.id ? 'all' : d.id)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${
                  filterDoctor === d.id ? 'border-gray-700 shadow-sm' : 'border-gray-200 opacity-50'
                }`} style={{ backgroundColor: d.color }}>{d.name}</button>
            );
          })}
          {filterDoctor !== 'all' && <span className="text-[11px] text-gray-400 self-center">{filteredCount}건</span>}
        </div>
      )}

      {/* Screenshot mode */}
      {viewMode === 'screenshot' && (
        <div
          onPaste={(e) => {
            const items = e.clipboardData?.items;
            if (!items) return;
            for (const item of items) {
              if (item.type.startsWith('image/')) {
                e.preventDefault();
                const file = item.getAsFile();
                if (file) {
                  const reader = new FileReader();
                  reader.onload = () => { setImage(reader.result as string); setViewMode('screenshot'); };
                  reader.readAsDataURL(file);
                }
                break;
              }
            }
          }}
          tabIndex={0}
          className="focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset rounded-lg"
        >
          {!image ? (
            <div className="flex flex-col items-center gap-4 py-8 border-2 border-dashed border-gray-300 rounded-lg mx-2">
              <p className="text-sm text-gray-500 text-center">
                스크린샷을 업로드하거나<br />복사 후 여기에 붙여넣기 하세요.
              </p>
              <button onClick={() => fileRef.current?.click()}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium active:bg-blue-700">
                파일 선택
              </button>
              <p className="text-xs text-gray-400">또는 Ctrl+V / 길게 눌러 붙여넣기</p>
            </div>
          ) : (
            <div>
              <div className="flex justify-end gap-1.5 mb-2">
                <button onClick={() => fileRef.current?.click()}
                  className="px-2 py-1 text-[11px] bg-gray-100 rounded active:bg-gray-200">교체</button>
                <button onClick={() => setImage(null)}
                  className="px-2 py-1 text-[11px] bg-red-50 text-red-600 rounded active:bg-red-100">삭제</button>
              </div>
              <div className="border border-gray-300 rounded-lg overflow-auto bg-gray-50">
                <img src={image} alt="원본 스케줄" className="w-full" />
              </div>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        </div>
      )}

      {/* Parsed data mode - fixed grid */}
      {viewMode === 'parsed' && (
        <div className="border border-gray-300 rounded-lg overflow-auto">
          {shifts.length > 0 ? renderCalendar(false) : (
            <p className="text-sm text-gray-500 text-center py-8">
              이 달에 파싱된 근무가 없습니다.<br />스케줄 탭에서 먼저 붙여넣기 해주세요.
            </p>
          )}
        </div>
      )}

      {/* Overlay mode - simple: screenshot + parsed calendar stacked */}
      {viewMode === 'overlay' && image && (
        <div>
          <div className="flex items-center gap-3 mb-3 px-2">
            <span className="text-xs text-gray-500 whitespace-nowrap">원본</span>
            <input type="range" min="0" max="1" step="0.05" value={overlayOpacity}
              onChange={e => setOverlayOpacity(Number(e.target.value))} className="flex-1 h-2 accent-blue-600" />
            <span className="text-xs text-gray-500 whitespace-nowrap">파싱</span>
          </div>

          <div className="relative border border-gray-300 rounded-lg overflow-auto select-none" style={{ isolation: 'isolate' }}>
            {/* Screenshot layer */}
            <div style={{ opacity: 1 - overlayOpacity }}>
              <img src={image} alt="원본" className="w-full" draggable={false} />
            </div>
            {/* Parsed calendar layer - identical to 파싱결과 view */}
            <div className="absolute inset-0" style={{ opacity: overlayOpacity, pointerEvents: 'none' }}>
              {renderCalendar(false)}
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400 text-center mt-3">
        {image ? '← → 키보드로 전환 / 겹치기 모드에서 슬라이더로 불투명도 조절' : '스크린샷을 먼저 업로드하세요.'}
      </p>
    </div>
  );
}
