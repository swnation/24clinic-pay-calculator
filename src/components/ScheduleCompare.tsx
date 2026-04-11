import { useState, useRef, useMemo } from 'react';
import type { Shift } from '../types';
import { useAppStore } from '../store';
import { isHolidayOrSunday, isSaturday, getHolidayName } from '../utils/holidays';

interface Props {
  year: number;
  month: number;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

export default function ScheduleCompare({ year, month }: Props) {
  const { state, getShiftsForMonth } = useAppStore();
  const [image, setImage] = useState<string | null>(null);
  const [filterDoctor, setFilterDoctor] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'original' | 'parsed'>('original');
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
    reader.onload = () => setImage(reader.result as string);
    reader.readAsDataURL(file);
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
          <div
            key={name}
            className={`text-center text-xs font-bold py-1.5 border-b border-r border-gray-400 ${
              i === 0 ? 'bg-gray-700 text-red-300' : i === 6 ? 'bg-gray-700 text-blue-300' : 'bg-gray-700 text-white'
            }`}
          >
            {name}
          </div>
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
                <span className={`font-bold text-xs ${
                  isHolSun ? 'text-red-500' : isSat ? 'text-blue-500' : 'text-gray-800'
                }`}>{day}</span>
                {holiday && <span className="text-[8px] text-red-500 font-medium">{holiday}</span>}
              </div>
              <div className="flex gap-0.5">
                <div className="flex-1 space-y-0.5">
                  {room1.map(s => (
                    <div
                      key={s.id}
                      className={`text-[10px] sm:text-[11px] leading-snug px-1 py-[3px] rounded-sm whitespace-nowrap overflow-hidden ${
                        filterDoctor !== 'all' && s.doctorId !== filterDoctor ? 'opacity-15' : ''
                      }`}
                      style={{ backgroundColor: getDoctorColor(s.doctorId) }}
                    >
                      <span className="font-medium">{getDoctorName(s.doctorId)}</span>
                      <span className="text-gray-700 ml-0.5">({pad(s.startHour)}-{pad(s.endHour)})</span>
                    </div>
                  ))}
                </div>
                {room2.length > 0 && (
                  <div className="flex-1 space-y-0.5">
                    {room2.map(s => (
                      <div
                        key={s.id}
                        className={`text-[10px] sm:text-[11px] leading-snug px-1 py-[3px] rounded-sm whitespace-nowrap overflow-hidden ${
                          filterDoctor !== 'all' && s.doctorId !== filterDoctor ? 'opacity-15' : ''
                        }`}
                        style={{ backgroundColor: getDoctorColor(s.doctorId) }}
                      >
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
      {!image ? (
        <div className="flex flex-col items-center gap-4 py-12">
          <p className="text-sm text-gray-600 text-center px-4">
            24clinic.kr 스케줄 페이지를 캡처해서 업로드하면<br />
            파싱된 데이터와 전환하면서 비교할 수 있습니다.
          </p>
          <button
            onClick={() => fileRef.current?.click()}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium active:bg-blue-700"
          >
            스크린샷 업로드
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        </div>
      ) : (
        <div>
          {/* Toggle: 원본 / 파싱결과 */}
          <div className="flex items-center gap-1 mb-3 bg-gray-100 rounded-lg p-1 max-w-xs mx-auto">
            <button
              onClick={() => setViewMode('original')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                viewMode === 'original' ? 'bg-white shadow text-gray-900' : 'text-gray-500'
              }`}
            >
              원본
            </button>
            <button
              onClick={() => setViewMode('parsed')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                viewMode === 'parsed' ? 'bg-white shadow text-gray-900' : 'text-gray-500'
              }`}
            >
              파싱결과 ({shifts.length})
            </button>
          </div>

          {/* Doctor filter + controls */}
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setFilterDoctor('all')}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${
                  filterDoctor === 'all' ? 'border-gray-700 bg-white shadow-sm' : 'border-gray-200 opacity-50'
                }`}
              >
                전체
              </button>
              {state.doctors.map(d => {
                const hasShifts = shifts.some(s => s.doctorId === d.id);
                if (!hasShifts) return null;
                return (
                  <button
                    key={d.id}
                    onClick={() => setFilterDoctor(filterDoctor === d.id ? 'all' : d.id)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${
                      filterDoctor === d.id ? 'border-gray-700 shadow-sm' : 'border-gray-200 opacity-50'
                    }`}
                    style={{ backgroundColor: d.color }}
                  >
                    {d.name}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-1.5 ml-2">
              <button
                onClick={() => fileRef.current?.click()}
                className="px-2 py-1 text-[11px] bg-gray-100 rounded active:bg-gray-200"
              >
                교체
              </button>
              <button
                onClick={() => setImage(null)}
                className="px-2 py-1 text-[11px] bg-red-50 text-red-600 rounded active:bg-red-100"
              >
                닫기
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
            </div>
          </div>

          {/* Content area - same size, toggled */}
          {viewMode === 'original' ? (
            <div className="border border-gray-300 rounded-lg overflow-auto bg-gray-50">
              <img src={image} alt="원본 스케줄" className="w-full" />
            </div>
          ) : (
            <div className="border border-gray-300 rounded-lg overflow-auto">
              {shifts.length > 0 ? fullCalendar : (
                <p className="text-sm text-gray-500 text-center py-8">
                  이 달에 파싱된 근무가 없습니다.<br />스케줄 탭에서 먼저 붙여넣기 해주세요.
                </p>
              )}
            </div>
          )}

          <p className="text-xs text-gray-400 text-center mt-3">
            원본 ↔ 파싱결과를 전환하면서 비교하세요.
            {filterDoctor !== 'all' && ` (${getDoctorName(filterDoctor)} ${filteredCount}건)`}
          </p>
        </div>
      )}
    </div>
  );
}
