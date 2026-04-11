import { useState, useRef, useMemo } from 'react';
import type { Shift } from '../types';
import { useAppStore } from '../store';
import { isHolidayOrSunday, isSaturday, getHolidayName } from '../utils/holidays';
import { parseScheduleText } from '../utils/scheduleParser';
import type { ParsedShift } from '../utils/scheduleParser';

interface Props {
  year: number;
  month: number;
  onMonthChange: (year: number, month: number) => void;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

// Normalize shift to comparable string key
function shiftKey(name: string, date: string, start: number, end: number, room: number): string {
  return `${date}|${name}|${pad(start)}-${pad(end)}|R${room}`;
}

interface DiffResult {
  matching: number;
  onlyInPasted: { date: string; name: string; start: number; end: number; room: number }[];
  onlyInStored: { date: string; name: string; start: number; end: number; room: number }[];
}

function computeDiff(
  pastedShifts: ParsedShift[],
  storedShifts: Shift[],
  getDoctorName: (id: string) => string,
): DiffResult {
  const pastedKeys = new Set(pastedShifts.map(s => shiftKey(s.doctorName, s.date, s.startHour, s.endHour, s.room)));
  const storedKeys = new Set(storedShifts.map(s => shiftKey(getDoctorName(s.doctorId), s.date, s.startHour, s.endHour, s.room)));

  let matching = 0;
  const onlyInPasted: DiffResult['onlyInPasted'] = [];
  const onlyInStored: DiffResult['onlyInStored'] = [];

  for (const s of pastedShifts) {
    const key = shiftKey(s.doctorName, s.date, s.startHour, s.endHour, s.room);
    if (storedKeys.has(key)) {
      matching++;
    } else {
      onlyInPasted.push({ date: s.date, name: s.doctorName, start: s.startHour, end: s.endHour, room: s.room });
    }
  }

  for (const s of storedShifts) {
    const key = shiftKey(getDoctorName(s.doctorId), s.date, s.startHour, s.endHour, s.room);
    if (!pastedKeys.has(key)) {
      onlyInStored.push({ date: s.date, name: getDoctorName(s.doctorId), start: s.startHour, end: s.endHour, room: s.room });
    }
  }

  return { matching, onlyInPasted, onlyInStored };
}

export default function ScheduleCompare({ year, month, onMonthChange }: Props) {
  const { state, getShiftsForMonth } = useAppStore();
  const [image, setImage] = useState<string | null>(null);
  const [filterDoctor, setFilterDoctor] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'original' | 'parsed' | 'diff'>('diff');
  const [diffText, setDiffText] = useState('');
  const [diffResult, setDiffResult] = useState<{ parsed: ParsedShift[]; diff: DiffResult } | null>(null);
  const [diffError, setDiffError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const monthStr = `${year}-${pad(month)}`;
  const shifts = getShiftsForMonth(monthStr);
  const filteredCount = filterDoctor === 'all' ? shifts.length : shifts.filter(s => s.doctorId === filterDoctor).length;

  const getDoctorName = (id: string) => state.doctors.find(d => d.id === id)?.name || '?';
  const getDoctorColor = (id: string) => state.doctors.find(d => d.id === id)?.color || '#E0E0E0';

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { setImage(reader.result as string); setViewMode('original'); };
    reader.readAsDataURL(file);
  };

  const handleDiff = () => {
    try {
      const result = parseScheduleText(diffText);
      if (result.shifts.length === 0) {
        setDiffError('파싱된 근무가 없습니다.');
        setDiffResult(null);
        return;
      }
      // Auto-navigate to the parsed month
      if (result.year !== year || result.month !== month) {
        onMonthChange(result.year, result.month);
      }
      const targetMonth = `${result.year}-${pad(result.month)}`;
      const storedForMonth = state.shifts.filter(s => s.date.startsWith(targetMonth));
      const diff = computeDiff(result.shifts, storedForMonth, getDoctorName);
      setDiffResult({ parsed: result.shifts, diff });
      setDiffError('');
    } catch (e) {
      setDiffError(e instanceof Error ? e.message : '파싱 오류');
      setDiffResult(null);
    }
  };

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

  const shiftsByDate = useMemo(() => {
    const map = new Map<string, Shift[]>();
    for (const s of shifts) {
      if (!map.has(s.date)) map.set(s.date, []);
      map.get(s.date)!.push(s);
    }
    return map;
  }, [shifts]);

  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

  const fullCalendar = (
    <div className="overflow-x-auto">
      <div className="grid grid-cols-7 border-t border-l border-gray-400 min-w-[600px]">
        {dayNames.map((name, i) => (
          <div key={name} className={`text-center text-xs font-bold py-1.5 border-b border-r border-gray-400 ${
            i === 0 ? 'bg-gray-700 text-red-300' : i === 6 ? 'bg-gray-700 text-blue-300' : 'bg-gray-700 text-white'
          }`}>{name}</div>
        ))}
        {calendarDays.map((day, idx) => {
          if (day === null) {
            return <div key={`e-${idx}`} className="border-b border-r border-gray-300 bg-white min-h-[80px] sm:min-h-[100px]" />;
          }
          const dateStr = `${year}-${pad(month)}-${pad(day)}`;
          const isHolSun = isHolidayOrSunday(dateStr, state.customHolidays);
          const isSat = isSaturday(dateStr);
          const holiday = getHolidayName(dateStr);
          const dayShifts = shiftsByDate.get(dateStr) || [];
          const room1 = dayShifts.filter(s => s.room === 1).sort((a, b) => a.startHour - b.startHour);
          const room2 = dayShifts.filter(s => s.room === 2).sort((a, b) => a.startHour - b.startHour);

          return (
            <div key={dateStr} className="border-b border-r border-gray-300 bg-white min-h-[80px] sm:min-h-[100px] p-1">
              <div className="flex items-baseline gap-1 mb-0.5">
                <span className={`font-bold text-xs ${isHolSun ? 'text-red-500' : isSat ? 'text-blue-500' : 'text-gray-800'}`}>{day}</span>
                {holiday && <span className="text-[8px] text-red-500 font-medium">{holiday}</span>}
              </div>
              <div className="flex gap-0.5">
                <div className="flex-1 space-y-0.5">
                  {room1.map(s => (
                    <div key={s.id} className={`text-[10px] sm:text-[11px] leading-snug px-1 py-[3px] rounded-sm whitespace-nowrap overflow-hidden ${
                      filterDoctor !== 'all' && s.doctorId !== filterDoctor ? 'opacity-15' : ''
                    }`} style={{ backgroundColor: getDoctorColor(s.doctorId) }}>
                      <span className="font-medium">{getDoctorName(s.doctorId)}</span>
                      <span className="text-gray-700 ml-0.5">({pad(s.startHour)}-{pad(s.endHour)})</span>
                    </div>
                  ))}
                </div>
                {room2.length > 0 && (
                  <div className="flex-1 space-y-0.5">
                    {room2.map(s => (
                      <div key={s.id} className={`text-[10px] sm:text-[11px] leading-snug px-1 py-[3px] rounded-sm whitespace-nowrap overflow-hidden ${
                        filterDoctor !== 'all' && s.doctorId !== filterDoctor ? 'opacity-15' : ''
                      }`} style={{ backgroundColor: getDoctorColor(s.doctorId) }}>
                        <span className="font-medium">{getDoctorName(s.doctorId)}</span>
                        <span className="text-gray-700 ml-0.5">({pad(s.startHour)}-{pad(s.endHour)})</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div>
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
        <button onClick={() => setViewMode('diff')}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${viewMode === 'diff' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
          텍스트비교
        </button>
        <button onClick={() => setViewMode('original')}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${viewMode === 'original' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
          원본
        </button>
        <button onClick={() => setViewMode('parsed')}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${viewMode === 'parsed' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
          파싱결과
        </button>
      </div>

      {/* Text diff mode */}
      {viewMode === 'diff' && (
        <div>
          {!diffResult ? (
            <div>
              <p className="text-sm text-gray-500 mb-3 text-center">
                24clinic.kr에서 스케줄 텍스트를 복사해서 붙여넣으면<br />저장된 데이터와 자동으로 비교합니다.
              </p>
              <textarea
                className="w-full border rounded-lg px-3 py-3 text-sm h-40 resize-none focus:ring-2 focus:ring-blue-500"
                placeholder="스케줄 텍스트 붙여넣기..."
                value={diffText}
                onChange={e => { setDiffText(e.target.value); setDiffError(''); }}
              />
              {diffError && <p className="text-sm text-red-500 mt-2">{diffError}</p>}
              <button
                onClick={handleDiff}
                disabled={!diffText.trim()}
                className="w-full mt-3 bg-blue-600 text-white py-3 rounded-lg font-medium active:bg-blue-700 disabled:opacity-40"
              >
                비교하기
              </button>
            </div>
          ) : (
            <div>
              {/* Diff summary */}
              {diffResult.diff.onlyInPasted.length === 0 && diffResult.diff.onlyInStored.length === 0 ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4 text-center">
                  <p className="text-lg font-bold text-green-700">일치</p>
                  <p className="text-sm text-green-600">{diffResult.diff.matching}건 모두 동일합니다.</p>
                </div>
              ) : (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                  <p className="text-sm font-bold text-red-700 mb-1">
                    차이 발견 (일치 {diffResult.diff.matching}건)
                  </p>

                  {diffResult.diff.onlyInPasted.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-bold text-orange-700 mb-1">
                        사이트에만 있음 ({diffResult.diff.onlyInPasted.length}건) - 앱에 누락
                      </p>
                      <div className="space-y-1">
                        {diffResult.diff.onlyInPasted.map((s, i) => (
                          <div key={i} className="text-xs bg-orange-100 rounded px-2 py-1">
                            {s.date.slice(5)} | {s.name} ({pad(s.start)}-{pad(s.end)}) R{s.room}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {diffResult.diff.onlyInStored.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-bold text-purple-700 mb-1">
                        앱에만 있음 ({diffResult.diff.onlyInStored.length}건) - 사이트에 없음
                      </p>
                      <div className="space-y-1">
                        {diffResult.diff.onlyInStored.map((s, i) => (
                          <div key={i} className="text-xs bg-purple-100 rounded px-2 py-1">
                            {s.date.slice(5)} | {s.name} ({pad(s.start)}-{pad(s.end)}) R{s.room}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <button onClick={() => setDiffResult(null)}
                className="w-full bg-gray-100 text-gray-700 py-2 rounded-lg text-sm font-medium active:bg-gray-200">
                다시 비교
              </button>
            </div>
          )}
        </div>
      )}

      {/* Original screenshot mode */}
      {viewMode === 'original' && (
        <div>
          {!image ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <p className="text-sm text-gray-500">스크린샷을 업로드하세요.</p>
              <button onClick={() => fileRef.current?.click()}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium active:bg-blue-700">
                스크린샷 업로드
              </button>
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

      {/* Parsed data mode */}
      {viewMode === 'parsed' && (
        <div>
          {/* Doctor filter */}
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

          <div className="border border-gray-300 rounded-lg overflow-auto">
            {shifts.length > 0 ? fullCalendar : (
              <p className="text-sm text-gray-500 text-center py-8">
                이 달에 파싱된 근무가 없습니다.<br />스케줄 탭에서 먼저 붙여넣기 해주세요.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
