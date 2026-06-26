import { useState, useMemo } from 'react';
import type { Shift } from '../types';
import { useAppStore } from '../store';
import { isHolidayOrSunday, isSaturday, getHolidayName } from '../utils/holidays';
import { pad, DAY_NAMES, shiftMonth, buildCalendarDays, TIME_SLOT_KEYS, buildStructuredShifts, hasRoom2, doctorName, doctorColor } from '../utils/calendar';
import ShiftModal from './ShiftModal';
import ScheduleImport from './ScheduleImport';

interface Props {
  year: number;
  month: number;
  onMonthChange: (year: number, month: number) => void;
}

function ShiftBadge({ shift, doctorName, doctorColor, filtered, onClick }: {
  shift: Shift;
  doctorName: string;
  doctorColor: string;
  filtered: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      className={`text-[10px] sm:text-[11px] leading-snug px-1 py-[3px] rounded-sm cursor-pointer active:opacity-70 transition-opacity whitespace-nowrap overflow-hidden ${
        filtered ? 'opacity-20' : ''
      }`}
      style={{ backgroundColor: doctorColor }}
      onClick={onClick}
    >
      <span className="font-medium">{doctorName}</span>
      <span className="text-gray-700 ml-0.5">({pad(shift.startHour)}-{pad(shift.endHour)})</span>
    </div>
  );
}

export default function Calendar({ year, month, onMonthChange }: Props) {
  const { state, getShiftsForMonth } = useAppStore();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editShift, setEditShift] = useState<Shift | null>(null);
  const [filterDoctors, setFilterDoctors] = useState<Set<string>>(new Set());
  const [showImport, setShowImport] = useState(false);

  const monthStr = `${year}-${pad(month)}`;
  const shifts = getShiftsForMonth(monthStr);

  const calendarDays = useMemo(() => buildCalendarDays(year, month), [year, month]);

  // Build structured data: date -> { morning/afternoon/evening } -> { room1, room2 }
  const structuredShifts = useMemo(() => buildStructuredShifts(shifts), [shifts]);

  // Month-level Room 2 detection for consistent grid
  const monthHasRoom2 = useMemo(() => hasRoom2(shifts), [shifts]);

  const getDoctorName = (id: string) => doctorName(state.doctors, id);
  const getDoctorColor = (id: string) => doctorColor(state.doctors, id);

  const prevMonth = () => { const r = shiftMonth(year, month, -1); onMonthChange(r.year, r.month); };
  const nextMonth = () => { const r = shiftMonth(year, month, 1); onMonthChange(r.year, r.month); };

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

  return (
    <div className="-mx-4 sm:mx-0">
      {/* Month navigation + import button */}
      <div className="flex items-center justify-between px-4 mb-3">
        <div className="flex items-center gap-4 sm:gap-6 flex-1 justify-center">
          <button onClick={prevMonth} className="p-2 hover:bg-gray-100 active:bg-gray-200 rounded text-lg select-none">&lt;</button>
          <h2 className="text-lg sm:text-xl font-bold tracking-wide">{year}.{pad(month)}</h2>
          <button onClick={nextMonth} className="p-2 hover:bg-gray-100 active:bg-gray-200 rounded text-lg select-none">&gt;</button>
        </div>
        <button
          onClick={() => setShowImport(true)}
          className="px-3 py-2 bg-green-600 text-white text-xs sm:text-sm font-medium rounded-lg active:bg-green-700 hover:bg-green-700 whitespace-nowrap"
        >
          붙여넣기
        </button>
      </div>

      {/* Doctor filter */}
      <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-3 px-4 justify-center">
        {state.doctors.map(d => (
          <button
            key={d.id}
            onClick={() => toggleFilter(d.id)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${
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
            className="px-2.5 py-1 rounded-full text-[11px] border border-gray-300 bg-white active:bg-gray-100"
          >
            전체보기
          </button>
        )}
      </div>

      {/* Calendar grid */}
      <div className="overflow-x-auto bg-white">
        <div className="grid grid-cols-7 border-t border-l border-gray-400 min-w-[840px]">
          {/* Day names - match original: dark bg, white text */}
          {DAY_NAMES.map((name, i) => (
            <div
              key={name}
              className={`text-center text-xs font-bold py-1.5 sm:py-2 border-b border-r border-gray-400 ${
                i === 0 ? 'bg-gray-700 text-red-300' : i === 6 ? 'bg-gray-700 text-blue-300' : 'bg-gray-700 text-white'
              }`}
            >
              {name}
            </div>
          ))}

          {/* Day cells */}
          {calendarDays.map((day, idx) => {
            if (day === null) {
              return <div key={`e-${idx}`} className="border-b border-r border-gray-300 bg-white min-h-[80px] sm:min-h-[110px]" />;
            }

            const dateStr = `${year}-${pad(month)}-${pad(day)}`;
            const isHolSun = isHolidayOrSunday(dateStr, state.customHolidays);
            const isSat = isSaturday(dateStr);
            const holiday = getHolidayName(dateStr);
            const isToday = dateStr === todayStr;

            const dayData = structuredShifts.get(dateStr);

            return (
              <div
                key={dateStr}
                className={`border-b border-r border-gray-300 min-h-[80px] sm:min-h-[110px] p-1 cursor-pointer active:bg-blue-50/50 hover:bg-gray-50 transition-colors bg-white`}
                onClick={() => setSelectedDate(dateStr)}
              >
                {/* Date number + holiday */}
                <div className="flex items-baseline gap-1 mb-1">
                  <span className={`text-xs sm:text-sm font-bold leading-none ${
                    isHolSun ? 'text-red-500' : isSat ? 'text-blue-500' : 'text-gray-800'
                  } ${isToday ? 'bg-blue-600 !text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px]' : ''}`}>
                    {day}
                  </span>
                  {holiday && (
                    <span className="text-[9px] sm:text-[10px] text-red-500 font-medium leading-none">{holiday}</span>
                  )}
                </div>

                {/* Fixed 3-row × 2-column grid: morning / afternoon / evening × Room 1 / Room 2 */}
                <div className="flex flex-col">
                  {TIME_SLOT_KEYS.map((slot, slotIdx) => {
                    const r1 = dayData?.[slot]?.room1 || [];
                    const r2 = dayData?.[slot]?.room2 || [];
                    return (
                      <div
                        key={slot}
                        className={`flex min-h-[20px] ${slotIdx > 0 ? 'border-t border-dashed border-gray-300' : ''}`}
                      >
                        {/* Room 1 */}
                        <div className="flex-1 py-[1px]">
                          {r1.map(s => (
                            <ShiftBadge
                              key={s.id}
                              shift={s}
                              doctorName={getDoctorName(s.doctorId)}
                              doctorColor={getDoctorColor(s.doctorId)}
                              filtered={isFiltered(s.doctorId)}
                              onClick={(e) => { e.stopPropagation(); setEditShift(s); }}
                            />
                          ))}
                        </div>
                        {/* Room 2 */}
                        {monthHasRoom2 && (
                          <div className="flex-1 py-[1px] border-l border-dashed border-gray-300">
                            {r2.map(s => (
                              <ShiftBadge
                                key={s.id}
                                shift={s}
                                doctorName={getDoctorName(s.doctorId)}
                                doctorColor={getDoctorColor(s.doctorId)}
                                filtered={isFiltered(s.doctorId)}
                                onClick={(e) => { e.stopPropagation(); setEditShift(s); }}
                              />
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

      {/* Schedule Import Modal */}
      {showImport && (
        <ScheduleImport
          onClose={() => setShowImport(false)}
          onImported={(y, m) => onMonthChange(y, m)}
        />
      )}
    </div>
  );
}
