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
  const [overlayOpacity, setOverlayOpacity] = useState(0.7);
  const fileRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calibration: cell + badge size
  type CalibStep = null | 'topLeft' | 'bottomRight' | 'enterDay' | 'badgeTop' | 'badgeBottom';
  const [calibStep, setCalibStep] = useState<CalibStep>(null);
  const [calibPt1, setCalibPt1] = useState({ x: 0, y: 0 });
  const [calibPt2, setCalibPt2] = useState({ x: 0, y: 0 });
  const [calibBadgeY1, setCalibBadgeY1] = useState(0);
  const [calibDayInput, setCalibDayInput] = useState('');
  const [grid, setGrid] = useState<{ cellW: number; cellH: number; originX: number; originY: number; headerH: number; badgeH: number } | null>(null);

  const handleCalibClick = (e: React.MouseEvent) => {
    if (!calibStep || calibStep === 'enterDay') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left + (e.currentTarget as HTMLElement).scrollLeft;
    const y = e.clientY - rect.top + (e.currentTarget as HTMLElement).scrollTop;
    if (calibStep === 'topLeft') { setCalibPt1({ x, y }); setCalibStep('bottomRight'); }
    else if (calibStep === 'bottomRight') { setCalibPt2({ x, y }); setCalibStep('enterDay'); }
    else if (calibStep === 'badgeTop') { setCalibBadgeY1(y); setCalibStep('badgeBottom'); }
    else if (calibStep === 'badgeBottom') {
      const bh = Math.round(Math.abs(y - calibBadgeY1));
      if (bh >= 3 && grid) setGrid({ ...grid, badgeH: bh });
      setCalibStep(null);
    }
  };

  const applyCalib = () => {
    const dayNum = parseInt(calibDayInput);
    const dayIdx = calendarDays.indexOf(dayNum);
    if (isNaN(dayNum) || dayIdx < 0) return;
    const cellW = Math.abs(calibPt2.x - calibPt1.x);
    const cellH = Math.abs(calibPt2.y - calibPt1.y);
    if (cellW < 5 || cellH < 5) return;
    const col = dayIdx % 7;
    const row = Math.floor(dayIdx / 7);
    const headerH = Math.round(cellH * 0.25);
    const originX = Math.round(Math.min(calibPt1.x, calibPt2.x) - col * cellW);
    const originY = Math.round(Math.min(calibPt1.y, calibPt2.y) - headerH - row * cellH);
    const badgeH = Math.round(cellH / 6); // default
    setGrid({ cellW: Math.round(cellW), cellH: Math.round(cellH), originX, originY, headerH, badgeH });
    setCalibStep('badgeTop'); // proceed to badge measurement
    setCalibDayInput('');
  };

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

      {/* Overlay mode - screenshot as grid + parsed badges on top */}
      {viewMode === 'overlay' && image && (
        <div>
          <div className="space-y-2 mb-3 px-2">
            {grid && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500 whitespace-nowrap">투명도</span>
                <input type="range" min="0" max="1" step="0.05" value={overlayOpacity}
                  onChange={e => setOverlayOpacity(Number(e.target.value))} className="flex-1 h-2 accent-blue-600" />
              </div>
            )}
            <div className="flex items-center justify-between flex-wrap gap-1">
              <div className="flex gap-1">
                <button onClick={() => setCalibStep('topLeft')}
                  className={`px-3 py-1.5 text-[11px] font-medium rounded-md border transition-all ${
                    calibStep ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : grid ? 'bg-green-50 border-green-300 text-green-700'
                    : 'bg-blue-600 border-blue-600 text-white'
                  }`}
                >{calibStep ? '측정 중...' : grid ? '재측정' : '셀 위치 측정'}</button>
              </div>
              {grid && (
                <button onClick={() => setGrid(null)}
                  className="px-2 py-1 text-[11px] text-gray-500 hover:bg-gray-100 rounded">초기화</button>
              )}
            </div>
          </div>

          {/* Calibration wizard */}
          {calibStep && (
            <div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3 text-center">
                {calibStep === 'topLeft' && <p className="text-sm text-blue-800 font-medium">1/5: 일자 셀의 <b>왼쪽 위</b> 모서리를 클릭</p>}
                {calibStep === 'bottomRight' && <p className="text-sm text-blue-800 font-medium">2/5: 같은 셀의 <b>오른쪽 아래</b> 모서리를 클릭</p>}
                {calibStep === 'enterDay' && (
                  <div>
                    <p className="text-sm text-blue-800 font-medium mb-2">3/5: 그 셀의 날짜</p>
                    <div className="flex items-center justify-center gap-2">
                      <input type="number" min="1" max="31" value={calibDayInput}
                        onChange={e => setCalibDayInput(e.target.value)} placeholder="예: 5"
                        className="w-20 border rounded px-3 py-2 text-sm text-center" autoFocus />
                      <button onClick={applyCalib} className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium">다음</button>
                    </div>
                  </div>
                )}
                {calibStep === 'badgeTop' && (
                  <div>
                    <p className="text-sm text-blue-800 font-medium">4/5: 색깔 블록 하나의 <b>윗쪽</b> 경계를 클릭</p>
                    <button onClick={() => setCalibStep(null)} className="text-xs text-gray-400 mt-1">건너뛰기</button>
                  </div>
                )}
                {calibStep === 'badgeBottom' && <p className="text-sm text-blue-800 font-medium">5/5: 같은 블록의 <b>아랫쪽</b> 경계를 클릭</p>}
              </div>
              {calibStep !== 'enterDay' && (
                <div className="border-2 border-blue-400 rounded-lg overflow-auto cursor-crosshair" onClick={handleCalibClick}>
                  <img src={image} alt="스크린샷" className="w-full" draggable={false} />
                </div>
              )}
            </div>
          )}

          {/* Screenshot + floating parsed badges */}
          {!calibStep && (
            <div className="relative border border-gray-300 rounded-lg overflow-auto select-none">
              <img src={image} alt="원본" className="w-full" draggable={false} />

              {/* Parsed badges placed at calculated grid positions */}
              {grid && calendarDays.map((day, idx) => {
                if (day === null) return null;
                const dateStr = `${year}-${pad(month)}-${pad(day)}`;
                const dayData = structuredShifts.get(dateStr);
                if (!dayData) return null;
                const col = idx % 7;
                const row = Math.floor(idx / 7);
                const x = grid.originX + col * grid.cellW;
                const y = grid.originY + grid.headerH + row * grid.cellH;
                const hasRoom2 = monthHasRoom2;

                // Collect room1 and room2 shifts by slot
                const r1Shifts: Shift[] = [];
                const r2Shifts: Shift[] = [];
                for (const slot of timeSlots) {
                  r1Shifts.push(...(dayData[slot]?.room1 || []));
                  r2Shifts.push(...(dayData[slot]?.room2 || []));
                }
                if (r1Shifts.length === 0 && r2Shifts.length === 0) return null;

                const dateRowH = Math.round(grid.cellH * 0.14);
                const badgeH = grid.badgeH;
                const fontSize = Math.max(7, Math.min(11, Math.round(badgeH * 0.7)));
                const roomW = hasRoom2 ? Math.floor((grid.cellW - 2) / 2) : grid.cellW - 2;

                const renderBadges = (shifts: Shift[], leftOffset: number) =>
                  shifts.map(s => {
                    const dimmed = filterDoctor !== 'all' && s.doctorId !== filterDoctor;
                    return (
                      <div key={s.id}
                        className={`absolute whitespace-nowrap overflow-hidden rounded-sm ${dimmed ? 'opacity-15' : ''}`}
                        style={{
                          left: leftOffset,
                          width: roomW,
                          backgroundColor: getDoctorColor(s.doctorId),
                          fontSize: `${fontSize}px`,
                          lineHeight: 1.2,
                          padding: '0 2px',
                          height: badgeH,
                          top: dateRowH + shifts.indexOf(s) * badgeH,
                        }}
                      >
                        <span className="font-medium">{getDoctorName(s.doctorId)}</span>
                        <span className="text-gray-700 ml-0.5">({pad(s.startHour)}-{pad(s.endHour)})</span>
                      </div>
                    );
                  });

                return (
                  <div key={dateStr} className="absolute" style={{
                    left: x + 1, top: y,
                    width: grid.cellW - 2, height: grid.cellH,
                    opacity: overlayOpacity,
                    pointerEvents: 'none',
                  }}>
                    {renderBadges(r1Shifts, 0)}
                    {hasRoom2 && renderBadges(r2Shifts, roomW)}
                  </div>
                );
              })}

              {!grid && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                  <p className="bg-white px-4 py-2 rounded-lg shadow text-sm text-gray-600">
                    "셀 위치 측정" 버튼을 눌러 셀 하나를 측정하세요
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-gray-400 text-center mt-3">
        {image ? '← → 키보드로 전환 / 겹치기 모드에서 슬라이더로 불투명도 조절' : '스크린샷을 먼저 업로드하세요.'}
      </p>
    </div>
  );
}
