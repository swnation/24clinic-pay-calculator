import { useState, useRef } from 'react';
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

  // Build mini calendar data
  const calendarDays = (() => {
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const startDayOfWeek = firstDay.getDay();
    const totalDays = lastDay.getDate();
    const days: (number | null)[] = [];
    for (let i = 0; i < startDayOfWeek; i++) days.push(null);
    for (let d = 1; d <= totalDays; d++) days.push(d);
    while (days.length % 7 !== 0) days.push(null);
    return days;
  })();

  const shiftsByDate = (() => {
    const map = new Map<string, Shift[]>();
    for (const s of shifts) {
      if (!map.has(s.date)) map.set(s.date, []);
      map.get(s.date)!.push(s);
    }
    return map;
  })();

  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

  const miniCalendar = (
    <div className="grid grid-cols-7 border-t border-l border-gray-400 text-[9px] sm:text-[10px]">
      {dayNames.map((name, i) => (
        <div
          key={name}
          className={`text-center font-bold py-1 border-b border-r border-gray-400 ${
            i === 0 ? 'bg-gray-700 text-red-300' : i === 6 ? 'bg-gray-700 text-blue-300' : 'bg-gray-700 text-white'
          }`}
        >
          {name}
        </div>
      ))}
      {calendarDays.map((day, idx) => {
        if (day === null) {
          return <div key={`e-${idx}`} className="border-b border-r border-gray-300 bg-white min-h-[60px] sm:min-h-[80px]" />;
        }
        const dateStr = `${year}-${pad(month)}-${pad(day)}`;
        const isHolSun = isHolidayOrSunday(dateStr, state.customHolidays);
        const isSat = isSaturday(dateStr);
        const holiday = getHolidayName(dateStr);
        const dayShifts = shiftsByDate.get(dateStr) || [];
        const room1 = dayShifts.filter(s => s.room === 1).sort((a, b) => a.startHour - b.startHour);
        const room2 = dayShifts.filter(s => s.room === 2).sort((a, b) => a.startHour - b.startHour);

        return (
          <div key={dateStr} className="border-b border-r border-gray-300 bg-white min-h-[60px] sm:min-h-[80px] p-0.5">
            <div className="flex items-baseline gap-0.5 mb-0.5">
              <span className={`font-bold text-[10px] ${
                isHolSun ? 'text-red-500' : isSat ? 'text-blue-500' : 'text-gray-800'
              }`}>{day}</span>
              {holiday && <span className="text-[7px] text-red-500 font-medium">{holiday}</span>}
            </div>
            <div className="flex gap-px">
              <div className="flex-1 space-y-px">
                {room1.map(s => (
                  <div
                    key={s.id}
                    className={`text-[8px] sm:text-[9px] leading-tight px-0.5 py-px rounded-sm whitespace-nowrap overflow-hidden ${
                      filterDoctor !== 'all' && s.doctorId !== filterDoctor ? 'opacity-15' : ''
                    }`}
                    style={{ backgroundColor: getDoctorColor(s.doctorId) }}
                  >
                    <span className="font-medium">{getDoctorName(s.doctorId)}</span>
                    <span className="text-gray-700 ml-px">({pad(s.startHour)}-{pad(s.endHour)})</span>
                  </div>
                ))}
              </div>
              {room2.length > 0 && (
                <div className="flex-1 space-y-px">
                  {room2.map(s => (
                    <div
                      key={s.id}
                      className="text-[8px] sm:text-[9px] leading-tight px-0.5 py-px rounded-sm whitespace-nowrap overflow-hidden"
                      style={{ backgroundColor: getDoctorColor(s.doctorId) }}
                    >
                      <span className="font-medium">{getDoctorName(s.doctorId)}</span>
                      <span className="text-gray-700 ml-px">({pad(s.startHour)}-{pad(s.endHour)})</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div>
      {!image ? (
        <div className="flex flex-col items-center gap-4 py-12">
          <p className="text-sm text-gray-600 text-center px-4">
            24clinic.kr 스케줄 페이지를 캡처해서 업로드하면<br />
            파싱된 데이터와 나란히 비교할 수 있습니다.
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
          {/* Doctor filter */}
          <div className="flex flex-wrap gap-1.5 mb-3 px-1">
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

          {/* Controls */}
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="text-sm font-bold">
              {year}.{pad(month)} 비교
              {filterDoctor !== 'all' && (
                <span className="ml-1 text-blue-600">
                  ({getDoctorName(filterDoctor)} {filteredCount}건)
                </span>
              )}
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => fileRef.current?.click()}
                className="px-3 py-1.5 text-xs bg-gray-100 rounded-lg active:bg-gray-200"
              >
                다른 이미지
              </button>
              <button
                onClick={() => setImage(null)}
                className="px-3 py-1.5 text-xs bg-red-50 text-red-600 rounded-lg active:bg-red-100"
              >
                닫기
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
            </div>
          </div>

          {/* Side by side comparison */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Original screenshot */}
            <div>
              <div className="bg-gray-800 text-white text-xs font-bold px-3 py-1.5 rounded-t-lg">
                원본 (스크린샷)
              </div>
              <div className="border border-t-0 border-gray-300 rounded-b-lg overflow-auto max-h-[70vh] bg-gray-50">
                <img src={image} alt="원본 스케줄" className="w-full" />
              </div>
            </div>

            {/* Parsed data calendar */}
            <div>
              <div className="bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-t-lg">
                파싱 결과 ({shifts.length}건)
              </div>
              <div className="border border-t-0 border-gray-300 rounded-b-lg overflow-auto max-h-[70vh]">
                {shifts.length > 0 ? miniCalendar : (
                  <p className="text-sm text-gray-500 text-center py-8">
                    이 달에 파싱된 근무가 없습니다.<br />스케줄 탭에서 먼저 붙여넣기 해주세요.
                  </p>
                )}
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-400 text-center mt-3">
            원본 스크린샷과 파싱 결과를 비교하여 누락이나 오류가 없는지 확인하세요.
          </p>
        </div>
      )}
    </div>
  );
}
