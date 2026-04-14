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
  const [overlayScaleX, setOverlayScaleX] = useState(1);
  const [overlayScaleY, setOverlayScaleY] = useState(1);
  const [lockAspect, setLockAspect] = useState(true);
  const [overlayOffset, setOverlayOffset] = useState({ x: 0, y: 0 });
  const [diffMode, setDiffMode] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgDims, setImgDims] = useState<{ w: number; h: number } | null>(null);
  const autoFitDone = useRef(false);

  // Alignment wizard: 4 clicks (screenshot1, parsed1, screenshot2, parsed2)
  type AlignStep = null | 's1' | 'p1' | 's2' | 'p2';
  const [alignStep, setAlignStep] = useState<AlignStep>(null);
  const alignPoints = useRef({ sx1: 0, sy1: 0, px1: 0, py1: 0, sx2: 0, sy2: 0, py2: 0 });

  const alignInstructions: Record<Exclude<AlignStep, null>, string> = {
    s1: '1/4: 스크린샷에서 기준점 1을 클릭하세요 (예: 1일 셀의 왼쪽 위 모서리)',
    p1: '2/4: 파싱 캘린더에서 같은 위치를 클릭하세요',
    s2: '3/4: 스크린샷에서 기준점 2를 클릭하세요 (기준점 1과 멀리)',
    p2: '4/4: 파싱 캘린더에서 같은 위치를 클릭하세요',
  };

  const handleAlignClick = (e: React.MouseEvent, type: 'screenshot' | 'parsed') => {
    if (!alignStep) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left + (e.currentTarget as HTMLElement).scrollLeft;
    const y = e.clientY - rect.top + (e.currentTarget as HTMLElement).scrollTop;
    const ap = alignPoints.current;

    if (alignStep === 's1' && type === 'screenshot') {
      ap.sx1 = x; ap.sy1 = y; setAlignStep('p1');
    } else if (alignStep === 'p1' && type === 'parsed') {
      ap.px1 = x; ap.py1 = y; setAlignStep('s2');
    } else if (alignStep === 's2' && type === 'screenshot') {
      ap.sx2 = x; ap.sy2 = y; setAlignStep('p2');
    } else if (alignStep === 'p2' && type === 'parsed') {
      // Calculate transform
      const px2 = x; const py2 = y;
      const dsx = ap.sx2 - ap.sx1;
      const dsy = ap.sy2 - ap.sy1;
      const dpx = px2 - ap.px1;
      const dpy = py2 - ap.py1;
      if (Math.abs(dpx) > 1 && Math.abs(dpy) > 1) {
        const sx = dsx / dpx;
        const sy = dsy / dpy;
        const ox = ap.sx1 - ap.px1 * sx;
        const oy = ap.sy1 - ap.py1 * sy;
        setOverlayScaleX(Math.round(sx * 100) / 100);
        setOverlayScaleY(Math.round(sy * 100) / 100);
        setOverlayOffset({ x: Math.round(ox), y: Math.round(oy) });
        setLockAspect(false);
      }
      setAlignStep(null);
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

  // Parsed calendar dimensions (min-width 840px, header ~30px + rows * 110px)
  const calRows = Math.ceil(calendarDays.length / 7);
  const CAL_WIDTH = 840;
  const CAL_HEIGHT = 30 + calRows * 110;

  // Auto-fit overlay to screenshot dimensions
  const autoFitToImage = () => {
    if (!imgDims) return;
    const sx = imgDims.w / CAL_WIDTH;
    const sy = imgDims.h / CAL_HEIGHT;
    setOverlayScaleX(Math.round(sx * 1000) / 1000);
    setOverlayScaleY(Math.round(sy * 1000) / 1000);
    setOverlayOffset({ x: 0, y: 0 });
    setLockAspect(false);
  };

  // Auto-fit when first entering overlay mode
  useEffect(() => {
    if (viewMode === 'overlay' && imgDims && !autoFitDone.current) {
      autoFitToImage();
      autoFitDone.current = true;
    }
  }, [viewMode, imgDims]);

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

  const renderShiftBadge = (s: Shift, transparent = false) => {
    const dimmed = filterDoctor !== 'all' && s.doctorId !== filterDoctor;
    return (
      <div
        key={s.id}
        className={`text-[10px] sm:text-[11px] leading-snug px-1 py-[2px] rounded-sm whitespace-nowrap overflow-hidden ${dimmed ? 'opacity-15' : ''}`}
        style={{ backgroundColor: getDoctorColor(s.doctorId) }}
      >
        <span className={`font-medium ${transparent ? 'text-transparent' : ''}`}>{getDoctorName(s.doctorId)}</span>
        <span className={`ml-0.5 ${transparent ? 'text-transparent' : 'text-gray-700'}`}>({pad(s.startHour)}-{pad(s.endHour)})</span>
      </div>
    );
  };

  const renderCalendar = (transparent = false) => (
    <div className="overflow-x-auto">
      <div className={`grid grid-cols-7 min-w-[840px] ${transparent ? '' : 'border-t border-l border-gray-400'}`}>
        {/* Day headers */}
        {dayNames.map((name, i) => (
          <div key={name} className={`text-center text-xs font-bold py-1.5 ${transparent
            ? 'text-transparent select-none'
            : `border-b border-r border-gray-400 ${
              i === 0 ? 'bg-gray-700 text-red-300' : i === 6 ? 'bg-gray-700 text-blue-300' : 'bg-gray-700 text-white'
            }`
          }`}>{name}</div>
        ))}

        {/* Day cells with fixed 3-row × 2-column grid */}
        {calendarDays.map((day, idx) => {
          if (day === null) {
            return <div key={`e-${idx}`} className={`h-[110px] ${transparent ? '' : 'border-b border-r border-gray-300 bg-white'}`} />;
          }
          const dateStr = `${year}-${pad(month)}-${pad(day)}`;
          const isHolSun = isHolidayOrSunday(dateStr, state.customHolidays);
          const isSat = isSaturday(dateStr);
          const holiday = getHolidayName(dateStr);
          const dayData = structuredShifts.get(dateStr);
          const hasRoom2 = monthHasRoom2;

          return (
            <div key={dateStr} className={`h-[110px] p-0.5 ${transparent ? '' : 'border-b border-r border-gray-300 bg-white'}`}>
              {/* Date number */}
              <div className={`flex items-baseline gap-0.5 mb-0.5 ${transparent ? 'invisible' : ''}`}>
                <span className={`font-bold text-[11px] ${isHolSun ? 'text-red-500' : isSat ? 'text-blue-500' : 'text-gray-800'}`}>{day}</span>
                {holiday && <span className="text-[7px] text-red-500">{holiday}</span>}
              </div>

              {/* Fixed 3 rows: morning / afternoon / evening with dotted lines */}
              <div className="flex flex-col">
                {timeSlots.map((slot, slotIdx) => {
                  const r1 = dayData?.[slot]?.room1 || [];
                  const r2 = dayData?.[slot]?.room2 || [];
                  return (
                    <div key={slot} className={`flex min-h-[24px] ${!transparent && slotIdx > 0 ? 'border-t border-dashed border-gray-300' : ''}`}>
                      <div className="flex-1 py-0.5 px-0.5">
                        {r1.map(s => renderShiftBadge(s, transparent))}
                      </div>
                      {hasRoom2 && (
                        <div className={`flex-1 py-0.5 px-0.5 ${!transparent ? 'border-l border-dashed border-gray-300' : ''}`}>
                          {r2.map(s => renderShiftBadge(s, transparent))}
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

  const hasOffsetOrScale = overlayScaleX !== 1 || overlayScaleY !== 1 || overlayOffset.x !== 0 || overlayOffset.y !== 0;

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
                <img
                  ref={imgRef}
                  src={image} alt="원본 스케줄" className="w-full"
                  onLoad={e => {
                    const el = e.currentTarget;
                    setImgDims({ w: el.clientWidth, h: el.clientHeight });
                  }}
                />
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

      {/* Overlay mode - screenshot + parsed layered */}
      {viewMode === 'overlay' && image && (
        <div>
          <div className="space-y-2 mb-3 px-2">
            {/* Opacity slider */}
            <div className={`flex items-center gap-3 ${diffMode ? 'opacity-30 pointer-events-none' : ''}`}>
              <span className="text-xs text-gray-500 whitespace-nowrap w-8">원본</span>
              <input
                type="range" min="0" max="1" step="0.05"
                value={overlayOpacity}
                onChange={e => setOverlayOpacity(Number(e.target.value))}
                className="flex-1 h-2 accent-blue-600"
              />
              <span className="text-xs text-gray-500 whitespace-nowrap w-8">파싱</span>
            </div>

            {/* Scale sliders */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500 whitespace-nowrap w-8">{lockAspect ? '크기' : '가로'}</span>
              <input
                type="range" min="0.3" max="2.5" step="0.01"
                value={overlayScaleX}
                onChange={e => {
                  const v = Number(e.target.value);
                  setOverlayScaleX(v);
                  if (lockAspect) setOverlayScaleY(v);
                }}
                className="flex-1 h-2 accent-purple-600"
              />
              <span className="text-xs text-gray-500 whitespace-nowrap w-8 text-right">{Math.round(overlayScaleX * 100)}%</span>
            </div>
            {!lockAspect && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500 whitespace-nowrap w-8">세로</span>
                <input
                  type="range" min="0.3" max="2.5" step="0.01"
                  value={overlayScaleY}
                  onChange={e => setOverlayScaleY(Number(e.target.value))}
                  className="flex-1 h-2 accent-pink-500"
                />
                <span className="text-xs text-gray-500 whitespace-nowrap w-8 text-right">{Math.round(overlayScaleY * 100)}%</span>
              </div>
            )}
            <div className="flex items-center gap-2 pl-10">
              <button
                onClick={() => setLockAspect(!lockAspect)}
                className={`text-[10px] px-2 py-0.5 rounded border ${lockAspect ? 'bg-purple-50 border-purple-300 text-purple-700' : 'bg-gray-50 border-gray-200 text-gray-500'}`}
              >
                {lockAspect ? '비율 고정' : '비율 자유'}
              </button>
            </div>

            {/* Position sliders (shown in diff mode or when offset is non-zero) */}
            {(diffMode || hasOffsetOrScale) && (
              <>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 whitespace-nowrap w-8">좌우</span>
                  <input
                    type="range" min="-300" max="300" step="1"
                    value={overlayOffset.x}
                    onChange={e => setOverlayOffset(o => ({ ...o, x: Number(e.target.value) }))}
                    className="flex-1 h-2 accent-green-600"
                  />
                  <span className="text-xs text-gray-500 w-8 text-right">{overlayOffset.x}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 whitespace-nowrap w-8">상하</span>
                  <input
                    type="range" min="-300" max="300" step="1"
                    value={overlayOffset.y}
                    onChange={e => setOverlayOffset(o => ({ ...o, y: Number(e.target.value) }))}
                    className="flex-1 h-2 accent-green-600"
                  />
                  <span className="text-xs text-gray-500 w-8 text-right">{overlayOffset.y}</span>
                </div>
              </>
            )}

            {/* Diff mode + auto-align + help + reset */}
            <div className="flex items-center justify-between flex-wrap gap-1">
              <div className="flex gap-1">
                <button
                  onClick={() => setDiffMode(!diffMode)}
                  className={`px-3 py-1.5 text-[11px] font-medium rounded-md border transition-all ${
                    diffMode
                      ? 'bg-red-50 border-red-300 text-red-700'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  차이점 보기
                </button>
                <button
                  onClick={autoFitToImage}
                  disabled={!imgDims}
                  className="px-3 py-1.5 text-[11px] font-medium rounded-md border bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-30"
                >
                  원본에 맞추기
                </button>
                <button
                  onClick={() => { setAlignStep('s1'); }}
                  className={`px-3 py-1.5 text-[11px] font-medium rounded-md border transition-all ${
                    alignStep
                      ? 'bg-blue-50 border-blue-300 text-blue-700'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {alignStep ? '맞추는 중...' : '기준점 맞추기'}
                </button>
                <button
                  onClick={() => setShowHelp(!showHelp)}
                  className="px-2 py-1.5 text-[11px] text-gray-400 hover:text-gray-600 border border-gray-200 rounded-md"
                >
                  ?
                </button>
              </div>
              <div className="flex gap-1">
                {alignStep && (
                  <button
                    onClick={() => setAlignStep(null)}
                    className="px-2 py-1 text-[11px] text-red-500 hover:bg-red-50 rounded"
                  >
                    취소
                  </button>
                )}
                {hasOffsetOrScale && (
                  <button
                    onClick={() => { setOverlayScaleX(1); setOverlayScaleY(1); setOverlayOffset({ x: 0, y: 0 }); }}
                    className="px-2 py-1 text-[11px] text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                  >
                    위치/크기 초기화
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Help guide */}
          {showHelp && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-3 text-xs text-gray-600 space-y-2">
              <p className="font-bold text-sm text-gray-800">겹치기 사용법</p>
              <div className="space-y-1.5">
                <p><span className="font-medium text-green-700">원본에 맞추기</span>: 스크린샷 크기에 파싱 캘린더를 자동 맞춤. 겹치기 진입 시 자동 실행됩니다.</p>
                <p><span className="font-medium text-purple-700">기준점 맞추기</span>: 스크린샷과 파싱 캘린더에서 같은 위치를 2번씩 클릭하면 정밀하게 맞춰줍니다.</p>
                <p><span className="font-medium">원본↔파싱 슬라이더</span>: 겹침 투명도 조절. 원본쪽으로 밀면 스크린샷이, 파싱쪽으로 밀면 파싱 결과가 더 보입니다.</p>
                <p><span className="font-medium">크기/가로/세로</span>: 파싱 캘린더의 비율을 수동 조절. "비율 자유"로 가로세로 따로 조절 가능.</p>
                <p><span className="font-medium">좌우/상하</span>: 파싱 캘린더의 위치를 미세 조정.</p>
                <p><span className="font-medium text-red-600">차이점 보기</span>: 색상 비교 모드. 같은 색끼리 겹치면 검정, 다르면 밝은 색으로 표시됩니다.</p>
              </div>
            </div>
          )}

          {/* Alignment wizard instruction */}
          {alignStep && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3 text-center">
              <p className="text-sm text-blue-800 font-medium">{alignInstructions[alignStep]}</p>
              <p className="text-xs text-blue-500 mt-1">
                {(alignStep === 's1' || alignStep === 's2') ? '아래 스크린샷을 클릭하세요' : '아래 파싱 캘린더를 클릭하세요'}
              </p>
            </div>
          )}

          {/* Alignment mode: show screenshot or parsed separately for clicking */}
          {alignStep && (alignStep === 's1' || alignStep === 's2') && (
            <div
              className="border border-blue-300 rounded-lg overflow-auto cursor-crosshair mb-3"
              onClick={e => handleAlignClick(e, 'screenshot')}
            >
              <img src={image!} alt="스크린샷" className="w-full" draggable={false} />
            </div>
          )}
          {alignStep && (alignStep === 'p1' || alignStep === 'p2') && (
            <div
              className="border border-blue-300 rounded-lg overflow-auto cursor-crosshair mb-3"
              onClick={e => handleAlignClick(e, 'parsed')}
            >
              {renderCalendar(false)}
            </div>
          )}

          {/* Overlay container - hidden during alignment */}
          {!alignStep && (
            <>
              <div
                className="relative border border-gray-300 rounded-lg overflow-auto select-none"
                style={{ isolation: 'isolate' }}
              >
                <div style={{ opacity: diffMode ? 1 : (1 - overlayOpacity) }}>
                  <img src={image} alt="원본" className="w-full" draggable={false} />
                </div>
                <div
                  className="absolute inset-0"
                  style={{
                    opacity: diffMode ? 1 : overlayOpacity,
                    mixBlendMode: diffMode ? 'difference' : 'normal',
                    transform: `translate(${overlayOffset.x}px, ${overlayOffset.y}px) scale(${overlayScaleX}, ${overlayScaleY})`,
                    transformOrigin: 'top left',
                    pointerEvents: 'none',
                  }}
                >
                  {renderCalendar(diffMode)}
                </div>
              </div>

              {diffMode && (
                <p className="text-xs text-gray-400 text-center mt-2">
                  같은 색 = 검정(일치) / 밝은 색 = 차이 | 크기와 위치를 맞춘 뒤 비교하세요
                </p>
              )}
            </>
          )}
        </div>
      )}

      <p className="text-xs text-gray-400 text-center mt-3">
        {image ? '← → 키보드로 전환 / 겹치기 모드에서 슬라이더로 불투명도 조절' : '스크린샷을 먼저 업로드하세요.'}
      </p>
    </div>
  );
}
