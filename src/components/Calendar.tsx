import { useState, useMemo } from 'react';
import type { Shift } from '../types';
import { useAppStore } from '../store';
import { isHolidayOrSunday, isSaturday, getHolidayName } from '../utils/holidays';
import ShiftModal from './ShiftModal';

interface Props {
  year: number;
  month: number;
  onMonthChange: (year: number, month: number) => void;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

export default function Calendar({ year, month, onMonthChange }: Props) {
  const { state, getShiftsForMonth } = useAppStore();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editShift, setEditShift] = useState<Shift | null>(null);
  const [filterDoctors, setFilterDoctors] = useState<Set<string>>(new Set());

  const monthStr = `${year}-${pad(month)}`;
  const shifts = getShiftsForMonth(monthStr);

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
      const key = s.date;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return map;
  }, [shifts]);

  const getDoctorName = (id: string) => state.doctors.find(d => d.id === id)?.name || '?';
  const getDoctorColor = (id: string) => state.doctors.find(d => d.id === id)?.color || '#E0E0E0';

  const prevMonth = () => {
    if (month === 1) onMonthChange(year - 1, 12);
    else onMonthChange(year, month - 1);
  };
  const nextMonth = () => {
    if (month === 12) onMonthChange(year + 1, 1);
    else onMonthChange(year, month + 1);
  };

  const toggleFilter = (doctorId: string) => {
    setFilterDoctors(prev => {
      const next = new Set(prev);
      if (next.has(doctorId)) next.delete(doctorId);
      else next.add(doctorId);
      return next;
    });
  };

  const isFiltered = (doctorId: string) =>
    filterDoctors.size > 0 && !filterDoctors.has(doctorId);

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

  return (
    <div className="-mx-4 sm:mx-0">
      {/* Month navigation */}
      <div className="flex items-center justify-center gap-6 mb-3 px-4">
        <button onClick={prevMonth} className="p-3 hover:bg-gray-100 active:bg-gray-200 rounded-lg text-2xl select-none">&lt;</button>
        <h2 className="text-xl font-bold">{year}년 {month}월</h2>
        <button onClick={nextMonth} className="p-3 hover:bg-gray-100 active:bg-gray-200 rounded-lg text-2xl select-none">&gt;</button>
      </div>

      {/* Doctor filter */}
      <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-3 px-4 justify-center">
        {state.doctors.map(d => (
          <button
            key={d.id}
            onClick={() => toggleFilter(d.id)}
            className={`px-2.5 py-1.5 sm:px-3 sm:py-1 rounded-full text-xs font-medium border transition-all ${
              filterDoctors.size === 0 || filterDoctors.has(d.id)
                ? 'border-gray-400 shadow-sm'
                : 'border-gray-200 opacity-40'
            }`}
            style={{ backgroundColor: d.color }}
          >
            {d.name}
          </button>
        ))}
        {filterDoctors.size > 0 && (
          <button
            onClick={() => setFilterDoctors(new Set())}
            className="px-2.5 py-1.5 sm:px-3 sm:py-1 rounded-full text-xs border border-gray-300 bg-white active:bg-gray-100"
          >
            전체보기
          </button>
        )}
      </div>

      {/* Calendar grid - horizontally scrollable on very small screens */}
      <div className="overflow-x-auto">
        <div className="grid grid-cols-7 border-t border-l border-gray-300 min-w-[350px]">
          {/* Day names */}
          {dayNames.map((name, i) => (
            <div
              key={name}
              className={`text-center text-xs font-bold py-1.5 sm:py-2 border-b border-r border-gray-300 ${
                i === 0 ? 'text-red-500 bg-red-50' : i === 6 ? 'text-blue-500 bg-blue-50' : 'bg-gray-100'
              }`}
            >
              {name}
            </div>
          ))}

          {/* Day cells */}
          {calendarDays.map((day, idx) => {
            if (day === null) {
              return <div key={`e-${idx}`} className="border-b border-r border-gray-200 bg-gray-50 min-h-[70px] sm:min-h-[100px]" />;
            }

            const dateStr = `${year}-${pad(month)}-${pad(day)}`;
            const isHolSun = isHolidayOrSunday(dateStr, state.customHolidays);
            const isSat = isSaturday(dateStr);
            const holiday = getHolidayName(dateStr);
            const isToday = dateStr === todayStr;

            const dayShifts = shiftsByDate.get(dateStr) || [];
            const room1 = dayShifts.filter(s => s.room === 1).sort((a, b) => a.startHour - b.startHour);
            const room2 = dayShifts.filter(s => s.room === 2).sort((a, b) => a.startHour - b.startHour);

            return (
              <div
                key={dateStr}
                className={`border-b border-r border-gray-200 min-h-[70px] sm:min-h-[100px] p-0.5 sm:p-1 cursor-pointer active:bg-blue-50 hover:bg-blue-50/30 transition-colors ${
                  isToday ? 'bg-yellow-50' : ''
                }`}
                onClick={() => setSelectedDate(dateStr)}
              >
                {/* Date number */}
                <div className="flex items-start justify-between mb-0.5">
                  <span className={`text-[11px] sm:text-xs font-bold leading-none ${
                    isHolSun ? 'text-red-500' : isSat ? 'text-blue-500' : 'text-gray-700'
                  } ${isToday ? 'bg-blue-600 text-white! rounded-full w-5 h-5 flex items-center justify-center text-[10px]' : ''}`}>
                    {day}
                  </span>
                  {holiday && (
                    <span className="text-[7px] sm:text-[9px] text-red-400 leading-tight hidden sm:block">{holiday}</span>
                  )}
                </div>

                {/* Shifts display: two columns for rooms */}
                <div className="flex gap-px">
                  <div className="flex-1 space-y-px">
                    {room1.map(s => (
                      <div
                        key={s.id}
                        className={`text-[8px] sm:text-[10px] leading-tight px-0.5 sm:px-1 py-0.5 rounded cursor-pointer active:opacity-70 transition-opacity ${
                          isFiltered(s.doctorId) ? 'opacity-20' : ''
                        }`}
                        style={{ backgroundColor: getDoctorColor(s.doctorId) }}
                        onClick={(e) => { e.stopPropagation(); setEditShift(s); }}
                      >
                        <div className="font-medium truncate">{getDoctorName(s.doctorId)}</div>
                        <div className="text-gray-600 hidden sm:block">({pad(s.startHour)}-{pad(s.endHour)})</div>
                        <div className="text-gray-600 sm:hidden">{s.startHour}-{s.endHour}</div>
                      </div>
                    ))}
                  </div>
                  {room2.length > 0 && (
                    <div className="flex-1 space-y-px">
                      {room2.map(s => (
                        <div
                          key={s.id}
                          className={`text-[8px] sm:text-[10px] leading-tight px-0.5 sm:px-1 py-0.5 rounded cursor-pointer active:opacity-70 transition-opacity ${
                            isFiltered(s.doctorId) ? 'opacity-20' : ''
                          }`}
                          style={{ backgroundColor: getDoctorColor(s.doctorId) }}
                          onClick={(e) => { e.stopPropagation(); setEditShift(s); }}
                        >
                          <div className="font-medium truncate">{getDoctorName(s.doctorId)}</div>
                          <div className="text-gray-600 hidden sm:block">({pad(s.startHour)}-{pad(s.endHour)})</div>
                          <div className="text-gray-600 sm:hidden">{s.startHour}-{s.endHour}</div>
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

      {/* Shift Modal */}
      {selectedDate && !editShift && (
        <ShiftModal date={selectedDate} onClose={() => setSelectedDate(null)} />
      )}
      {editShift && (
        <ShiftModal
          date={editShift.date}
          editShift={editShift}
          onClose={() => { setEditShift(null); setSelectedDate(null); }}
        />
      )}
    </div>
  );
}
