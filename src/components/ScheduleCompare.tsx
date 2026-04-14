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
  const [overlayOpacity, setOverlayOpacity] = useState(0.3);
  const [diffMode, setDiffMode] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calibration: measure cell + badge size from screenshot
  type CalibStep = null | 'topLeft' | 'bottomRight' | 'enterDay' | 'badgeTop' | 'badgeBottom';
  const [calibStep, setCalibStep] = useState<CalibStep>(null);
  const [calibPt1, setCalibPt1] = useState({ x: 0, y: 0 });
  const [calibPt2, setCalibPt2] = useState({ x: 0, y: 0 });
  const [calibBadgeY1, setCalibBadgeY1] = useState(0);
  const [calibDayInput, setCalibDayInput] = useState('');
  const [calibration, setCalibration] = useState<{
    cellW: number; cellH: number; gridX: number; gridY: number; headerH: number; badgeH: number;
  } | null>(null);

  const handleCalibClick = (e: React.MouseEvent) => {
    if (!calibStep || calibStep === 'enterDay') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left + (e.currentTarget as HTMLElement).scrollLeft;
    const y = e.clientY - rect.top + (e.currentTarget as HTMLElement).scrollTop;
    if (calibStep === 'topLeft') {
      setCalibPt1({ x, y });
      setCalibStep('bottomRight');
    } else if (calibStep === 'bottomRight') {
      setCalibPt2({ x, y });
      setCalibStep('enterDay');
    } else if (calibStep === 'badgeTop') {
      setCalibBadgeY1(y);
      setCalibStep('badgeBottom');
    } else if (calibStep === 'badgeBottom') {
      const badgeH = Math.abs(y - calibBadgeY1);
      if (badgeH >= 2 && calibration) {
        setCalibration({ ...calibration, badgeH: Math.round(badgeH) });
      }
      setCalibStep(null);
    }
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

  const calRows = Math.ceil(calendarDays.length / 7);

  const applyCalibration = () => {
    const dayNum = parseInt(calibDayInput);
    const dayIdx = calendarDays.indexOf(dayNum);
    if (isNaN(dayNum) || dayIdx < 0) return;

    const cellW = Math.abs(calibPt2.x - calibPt1.x);
    const cellH = Math.abs(calibPt2.y - calibPt1.y);
    if (cellW < 5 || cellH < 5) return;

    const col = dayIdx % 7;
    const row = Math.floor(dayIdx / 7);
    const headerH = Math.round(cellH * 0.22);
    const gridX = Math.round(Math.min(calibPt1.x, calibPt2.x) - col * cellW);
    const gridY = Math.round(Math.min(calibPt1.y, calibPt2.y) - headerH - row * cellH);
    // Default badge height: estimate from cell (3 slots, ~3 badges visible = cellH / 7)
    const badgeH = Math.round(cellH / 7);

    setCalibration({ cellW: Math.round(cellW), cellH: Math.round(cellH), gridX, gridY, headerH, badgeH });
    // Move to badge measurement
    setCalibStep('badgeTop');
    setCalibDayInput('');
  };

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

  // cal = calibrated cell dimensions (from screenshot measurement), or null = default
  const renderCalendar = (transparent = false, cal?: { cellW: number; cellH: number; headerH: number; badgeH: number } | null) => {
    const cw = cal?.cellW;
    const ch = cal?.cellH;
    const hh = cal?.headerH;
    const bh = cal?.badgeH;
    // Scale text proportionally to badge height
    const textScale = ch ? Math.max(7, Math.min(11, Math.round(ch / 10))) : 11;
    const badgeFontSize = bh ? Math.max(6, Math.min(11, Math.round(bh * 0.6))) : null;

    return (
      <div className={cal ? '' : 'overflow-x-auto'}>
        <div
          className={`grid grid-cols-7 ${cal ? '' : 'min-w-[840px]'} ${transparent ? '' : 'border-t border-l border-gray-400'}`}
          style={cal ? { gridTemplateColumns: `repeat(7, ${cw}px)`, gridTemplateRows: `${hh}px repeat(${calRows}, ${ch}px)` } : undefined}
        >
          {dayNames.map((name, i) => (
            <div key={name} className={`text-center font-bold flex items-center justify-center ${transparent
              ? 'text-transparent select-none'
              : `border-b border-r border-gray-400 ${
                i === 0 ? 'bg-gray-700 text-red-300' : i === 6 ? 'bg-gray-700 text-blue-300' : 'bg-gray-700 text-white'
              }`
            }`} style={{ fontSize: cal ? `${textScale}px` : undefined, padding: cal ? 0 : '6px 0' }}>{name}</div>
          ))}
          {calendarDays.map((day, idx) => {
            if (day === null) {
              return <div key={`e-${idx}`} className={`${cal ? '' : 'h-[110px]'} ${transparent ? '' : 'border-b border-r border-gray-300 bg-white'}`} />;
            }
            const dateStr = `${year}-${pad(month)}-${pad(day)}`;
            const isHolSun = isHolidayOrSunday(dateStr, state.customHolidays);
            const isSat = isSaturday(dateStr);
            const holiday = getHolidayName(dateStr);
            const dayData = structuredShifts.get(dateStr);
            const hasRoom2 = monthHasRoom2;
            return (
              <div key={dateStr} className={`${cal ? 'overflow-hidden flex flex-col' : 'h-[110px]'} ${cal ? 'p-0' : 'p-0.5'} ${transparent ? '' : 'border-b border-r border-gray-300 bg-white'}`}>
                <div className={`flex items-baseline gap-0.5 shrink-0 ${transparent ? 'invisible' : ''}`}
                  style={cal ? { height: Math.round(ch! * 0.15), overflow: 'hidden', paddingLeft: 2 } : undefined}>
                  <span className={`font-bold ${isHolSun ? 'text-red-500' : isSat ? 'text-blue-500' : 'text-gray-800'}`}
                    style={{ fontSize: cal ? `${textScale}px` : '11px' }}>{day}</span>
                  {holiday && !cal && <span className="text-[7px] text-red-500">{holiday}</span>}
                </div>
                <div className={`flex flex-col flex-1 min-h-0 ${cal ? 'overflow-hidden' : ''}`}>
                  {timeSlots.map((slot, slotIdx) => {
                    const r1 = dayData?.[slot]?.room1 || [];
                    const r2 = dayData?.[slot]?.room2 || [];
                    return (
                      <div key={slot} className={`flex flex-1 min-h-0 overflow-hidden ${!transparent && !cal && slotIdx > 0 ? 'border-t border-dashed border-gray-300' : ''}`}>
                        <div className="flex-1 overflow-hidden" style={cal ? { padding: 0 } : { padding: '2px' }}>
                          {r1.map(s => (
                            <div key={s.id}
                              className={`rounded-sm whitespace-nowrap overflow-hidden ${filterDoctor !== 'all' && s.doctorId !== filterDoctor ? 'opacity-15' : ''}`}
                              style={{ backgroundColor: getDoctorColor(s.doctorId), fontSize: badgeFontSize ? `${badgeFontSize}px` : '10px', lineHeight: cal ? 1.15 : 1.3, padding: cal ? '0 1px' : '1px 2px', margin: 0 }}
                            >
                              <span className={`font-medium ${transparent ? 'text-transparent' : ''}`}>{getDoctorName(s.doctorId)}</span>
                              <span className={`ml-0.5 ${transparent ? 'text-transparent' : 'text-gray-700'}`}>({pad(s.startHour)}-{pad(s.endHour)})</span>
                            </div>
                          ))}
                        </div>
                        {hasRoom2 && (
                          <div className="flex-1 overflow-hidden" style={cal ? { padding: 0 } : { padding: '2px' }}>
                            {r2.map(s => (
                              <div key={s.id}
                                className={`rounded-sm whitespace-nowrap overflow-hidden ${filterDoctor !== 'all' && s.doctorId !== filterDoctor ? 'opacity-15' : ''}`}
                                style={{ backgroundColor: getDoctorColor(s.doctorId), fontSize: badgeFontSize ? `${badgeFontSize}px` : '10px', lineHeight: cal ? 1.15 : 1.3, padding: cal ? '0 1px' : '1px 2px', margin: 0 }}
                              >
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
  };

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

      {/* Overlay mode */}
      {viewMode === 'overlay' && image && (
        <div>
          <div className="space-y-2 mb-3 px-2">
            <div className={`flex items-center gap-3 ${diffMode ? 'opacity-30 pointer-events-none' : ''}`}>
              <span className="text-xs text-gray-500 whitespace-nowrap w-8">원본</span>
              <input type="range" min="0" max="1" step="0.05" value={overlayOpacity}
                onChange={e => setOverlayOpacity(Number(e.target.value))} className="flex-1 h-2 accent-blue-600" />
              <span className="text-xs text-gray-500 whitespace-nowrap w-8">파싱</span>
            </div>

            <div className="flex items-center justify-between flex-wrap gap-1">
              <div className="flex gap-1">
                <button onClick={() => setDiffMode(!diffMode)}
                  className={`px-3 py-1.5 text-[11px] font-medium rounded-md border transition-all ${
                    diffMode ? 'bg-red-50 border-red-300 text-red-700' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}>차이점 보기</button>
                <button
                  onClick={() => setCalibStep('topLeft')}
                  className={`px-3 py-1.5 text-[11px] font-medium rounded-md border transition-all ${
                    calibStep ? 'bg-blue-50 border-blue-300 text-blue-700' : calibration ? 'bg-green-50 border-green-300 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >{calibStep ? '측정 중...' : calibration ? '셀 재측정' : '셀 크기 측정'}</button>
                <button onClick={() => setShowHelp(!showHelp)}
                  className="px-2 py-1.5 text-[11px] text-gray-400 hover:text-gray-600 border border-gray-200 rounded-md">?</button>
              </div>
              <div className="flex gap-1">
                {calibStep && (
                  <button onClick={() => setCalibStep(null)} className="px-2 py-1 text-[11px] text-red-500 hover:bg-red-50 rounded">취소</button>
                )}
                {calibration && !calibStep && (
                  <button onClick={() => setCalibration(null)} className="px-2 py-1 text-[11px] text-gray-500 hover:bg-gray-100 rounded">측정 초기화</button>
                )}
              </div>
            </div>
          </div>

          {showHelp && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-3 text-xs text-gray-600 space-y-2">
              <p className="font-bold text-sm text-gray-800">겹치기 사용법</p>
              <div className="space-y-1.5">
                <p><span className="font-medium text-blue-700">셀 크기 측정</span> (추천): 스크린샷에서 셀 하나의 모서리 2개를 클릭하고 날짜를 입력하면, 캘린더를 원본과 동일한 비율로 다시 그립니다.</p>
                <p><span className="font-medium">원본↔파싱 슬라이더</span>: 투명도 조절.</p>
                <p><span className="font-medium text-red-600">차이점 보기</span>: 같은 색끼리 겹치면 검정, 다르면 밝은 색.</p>
              </div>
            </div>
          )}

          {/* Calibration wizard */}
          {calibStep && (
            <div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3 text-center">
                {calibStep === 'topLeft' && (
                  <p className="text-sm text-blue-800 font-medium">1/5: 일자가 써있는 셀의 <b>왼쪽 위</b> 모서리를 클릭하세요</p>
                )}
                {calibStep === 'bottomRight' && (
                  <p className="text-sm text-blue-800 font-medium">2/5: 같은 셀의 <b>오른쪽 아래</b> 모서리를 클릭하세요</p>
                )}
                {calibStep === 'enterDay' && (
                  <div>
                    <p className="text-sm text-blue-800 font-medium mb-2">3/5: 클릭한 셀의 날짜를 입력하세요</p>
                    <div className="flex items-center justify-center gap-2">
                      <input type="number" min="1" max="31" value={calibDayInput}
                        onChange={e => setCalibDayInput(e.target.value)}
                        placeholder="예: 5"
                        className="w-20 border rounded px-3 py-2 text-sm text-center"
                        autoFocus />
                      <button onClick={applyCalibration}
                        className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium">다음</button>
                    </div>
                  </div>
                )}
                {calibStep === 'badgeTop' && (
                  <div>
                    <p className="text-sm text-blue-800 font-medium">4/5: 아무 색깔 블록(배지)의 <b>위쪽 경계</b>를 클릭하세요</p>
                    <button onClick={() => setCalibStep(null)} className="text-xs text-gray-400 mt-1 hover:text-gray-600">건너뛰기</button>
                  </div>
                )}
                {calibStep === 'badgeBottom' && (
                  <p className="text-sm text-blue-800 font-medium">5/5: 같은 블록의 <b>아래쪽 경계</b>를 클릭하세요</p>
                )}
              </div>
              {(calibStep === 'topLeft' || calibStep === 'bottomRight' || calibStep === 'badgeTop' || calibStep === 'badgeBottom') && (
                <div className="border-2 border-blue-400 rounded-lg overflow-auto cursor-crosshair" onClick={handleCalibClick}>
                  <img src={image} alt="스크린샷" className="w-full" draggable={false} />
                </div>
              )}
            </div>
          )}

          {/* Overlay: screenshot + calibrated calendar */}
          {!calibStep && (
            <div className="relative border border-gray-300 rounded-lg overflow-auto select-none" style={{ isolation: 'isolate' }}>
              <div style={{ opacity: diffMode ? 1 : (1 - overlayOpacity) }}>
                <img src={image} alt="원본" className="w-full" draggable={false} />
              </div>
              <div
                className="absolute"
                style={{
                  opacity: diffMode ? 1 : overlayOpacity,
                  mixBlendMode: diffMode ? 'difference' : 'normal',
                  left: calibration ? calibration.gridX : 0,
                  top: calibration ? calibration.gridY : 0,
                  pointerEvents: 'none',
                }}
              >
                {renderCalendar(diffMode, calibration)}
              </div>
            </div>
          )}

          {diffMode && (
            <p className="text-xs text-gray-400 text-center mt-2">
              같은 색 = 검정(일치) / 밝은 색 = 차이
            </p>
          )}
        </div>
      )}

      <p className="text-xs text-gray-400 text-center mt-3">
        {image ? '← → 키보드로 전환 / 겹치기 모드에서 슬라이더로 불투명도 조절' : '스크린샷을 먼저 업로드하세요.'}
      </p>
    </div>
  );
}
