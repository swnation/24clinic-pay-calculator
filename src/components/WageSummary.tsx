import { useState, useMemo } from 'react';
import { DAY_TYPE_LABELS, TIME_SLOT_LABELS } from '../types';
import { useAppStore } from '../store';
import { getEffectiveRates, calculateMonthlyWage, calculateWeeklyHours } from '../utils/wageCalculator';

interface Props {
  year: number;
  month: number;
  onMonthChange: (year: number, month: number) => void;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

export default function WageSummary({ year, month, onMonthChange }: Props) {
  const { state, getShiftsForDoctor } = useAppStore();
  const [selectedDoctor, setSelectedDoctor] = useState(state.doctors[0]?.id || '');

  const monthStr = `${year}-${pad(month)}`;

  const rates = useMemo(() =>
    getEffectiveRates(monthStr, state.defaultRates, state.branchMonthlyRates),
    [monthStr, state.defaultRates, state.branchMonthlyRates]
  );

  const doctorShifts = useMemo(() =>
    getShiftsForDoctor(selectedDoctor, monthStr),
    [selectedDoctor, monthStr, state.shifts]
  );

  const breakdown = useMemo(() =>
    calculateMonthlyWage(doctorShifts, rates, state.customHolidays, state.specialRatePeriods),
    [doctorShifts, rates, state.customHolidays, state.specialRatePeriods]
  );

  const weekly = useMemo(() =>
    calculateWeeklyHours(doctorShifts, year, month),
    [doctorShifts, year, month]
  );

  const doctor = state.doctors.find(d => d.id === selectedDoctor);

  const prevMonth = () => {
    if (month === 1) onMonthChange(year - 1, 12);
    else onMonthChange(year, month - 1);
  };
  const nextMonth = () => {
    if (month === 12) onMonthChange(year + 1, 1);
    else onMonthChange(year, month + 1);
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Month navigation */}
      <div className="flex items-center justify-center gap-6 mb-3">
        <button onClick={prevMonth} className="p-3 active:bg-gray-200 hover:bg-gray-100 rounded-lg text-2xl select-none">&lt;</button>
        <h2 className="text-xl font-bold">{year}년 {month}월</h2>
        <button onClick={nextMonth} className="p-3 active:bg-gray-200 hover:bg-gray-100 rounded-lg text-2xl select-none">&gt;</button>
      </div>

      {/* Doctor selector */}
      <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-5 justify-center">
        {state.doctors.map(d => (
          <button
            key={d.id}
            onClick={() => setSelectedDoctor(d.id)}
            className={`px-3 py-2 rounded-lg text-xs sm:text-sm font-medium border-2 transition-all ${
              selectedDoctor === d.id
                ? 'border-gray-700 shadow-md scale-105'
                : 'border-transparent opacity-50'
            }`}
            style={{ backgroundColor: d.color }}
          >
            {d.name}
          </button>
        ))}
      </div>

      {doctor && (
        <>
          {/* Wage Breakdown Table */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
            <div className="bg-gray-50 px-4 py-3 border-b">
              <h3 className="font-bold text-sm">
                {doctor.name} - {year}년 {month}월 급여 내역
              </h3>
            </div>
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-2 sm:px-4 py-2">구분</th>
                  <th className="text-right px-2 sm:px-4 py-2">시간</th>
                  <th className="text-right px-2 sm:px-4 py-2">시급</th>
                  <th className="text-right px-2 sm:px-4 py-2">소계(만원)</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.rows.map((row, i) => (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    <td className="px-2 sm:px-4 py-2">
                      {row.specialPeriodName
                        ? <><span className="text-purple-600">{row.specialPeriodName}</span> {TIME_SLOT_LABELS[row.timeSlot]}</>
                        : <>{DAY_TYPE_LABELS[row.dayType]} {TIME_SLOT_LABELS[row.timeSlot]}</>
                      }
                    </td>
                    <td className="text-right px-2 sm:px-4 py-2">{row.hours}h</td>
                    <td className="text-right px-2 sm:px-4 py-2">{row.rate}</td>
                    <td className="text-right px-2 sm:px-4 py-2 font-medium">
                      {row.wage.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-blue-50 font-bold">
                  <td className="px-2 sm:px-4 py-3">합계</td>
                  <td className="text-right px-2 sm:px-4 py-3">{breakdown.totalHours}h</td>
                  <td className="text-right px-2 sm:px-4 py-3">-</td>
                  <td className="text-right px-2 sm:px-4 py-3 text-blue-700">
                    {breakdown.totalWage.toLocaleString()} 만원
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg border p-4 text-center">
              <div className="text-2xl font-bold text-gray-900">{breakdown.workDays}</div>
              <div className="text-xs text-gray-500">근무일수</div>
            </div>
            <div className="bg-white rounded-lg border p-4 text-center">
              <div className="text-2xl font-bold text-gray-900">{breakdown.totalHours}</div>
              <div className="text-xs text-gray-500">총 근무시간</div>
            </div>
            <div className="bg-white rounded-lg border p-4 text-center">
              <div className="text-2xl font-bold text-blue-700">{(breakdown.totalWage * 10000).toLocaleString()}</div>
              <div className="text-xs text-gray-500">총 급여 (원)</div>
            </div>
          </div>

          {/* Weekly breakdown */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b">
              <h3 className="font-bold text-sm">주별 근무시간</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-4 py-2">주차</th>
                  <th className="text-left px-4 py-2">기간</th>
                  <th className="text-right px-4 py-2">근무 횟수</th>
                  <th className="text-right px-4 py-2">근무시간</th>
                </tr>
              </thead>
              <tbody>
                {weekly.map(w => (
                  <tr key={w.weekNumber} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-2">{w.weekNumber}주차</td>
                    <td className="px-4 py-2 text-gray-500">{w.weekLabel}</td>
                    <td className="text-right px-4 py-2">{w.shifts}회</td>
                    <td className="text-right px-4 py-2 font-medium">{w.hours}h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {state.doctors.length === 0 && (
        <p className="text-center text-gray-500 mt-8">
          설정에서 의사를 먼저 등록해주세요.
        </p>
      )}
    </div>
  );
}
