import { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../store';
import type { AvailabilityData } from '../services/firebase';

interface Props {
  year: number;
  month: number;
  onMonthChange: (year: number, month: number) => void;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

export default function Availability({ year, month, onMonthChange }: Props) {
  const { isAdmin, activeDoctors, submitMyAvailability, loadMyAvailability, loadAllAvailabilityForMonth } = useAppStore();

  // Target: next month by default
  const [available, setAvailable] = useState<Set<string>>(new Set());
  const [unavailable, setUnavailable] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [lastSubmitted, setLastSubmitted] = useState<number | null>(null);
  const [allData, setAllData] = useState<AvailabilityData[]>([]);
  const [viewAll, setViewAll] = useState(false);

  const monthStr = `${year}-${pad(month)}`;

  // Load my availability
  useEffect(() => {
    setAvailable(new Set());
    setUnavailable(new Set());
    setLastSubmitted(null);
    setSaved(false);

    loadMyAvailability(monthStr).then(data => {
      if (data) {
        setAvailable(new Set(data.availableDays));
        setUnavailable(new Set(data.unavailableDays));
        setLastSubmitted(data.submittedAt);
      }
    });
  }, [monthStr, loadMyAvailability]);

  // Load all (admin)
  useEffect(() => {
    if (isAdmin && viewAll) {
      loadAllAvailabilityForMonth(monthStr).then(setAllData);
    }
  }, [isAdmin, viewAll, monthStr, loadAllAvailabilityForMonth]);

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

  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

  const toggleDay = (dateStr: string) => {
    const newAvail = new Set(available);
    const newUnavail = new Set(unavailable);

    if (newAvail.has(dateStr)) {
      newAvail.delete(dateStr);
      newUnavail.add(dateStr);
    } else if (newUnavail.has(dateStr)) {
      newUnavail.delete(dateStr);
    } else {
      newAvail.add(dateStr);
    }

    setAvailable(newAvail);
    setUnavailable(newUnavail);
    setSaved(false);
  };

  const handleSubmit = async () => {
    setSaving(true);
    const ok = await submitMyAvailability(monthStr, [...available], [...unavailable]);
    if (ok) {
      setSaved(true);
      setLastSubmitted(Date.now());
    }
    setSaving(false);
  };

  const prevMonth = () => {
    if (month === 1) onMonthChange(year - 1, 12);
    else onMonthChange(year, month - 1);
  };
  const nextMonth = () => {
    if (month === 12) onMonthChange(year + 1, 1);
    else onMonthChange(year, month + 1);
  };

  return (
    <div className="max-w-lg mx-auto">
      {/* Month nav */}
      <div className="flex items-center justify-center gap-6 mb-3">
        <button onClick={prevMonth} className="p-2 hover:bg-gray-100 active:bg-gray-200 rounded text-lg select-none">&lt;</button>
        <h2 className="text-lg font-bold">{year}년 {month}월</h2>
        <button onClick={nextMonth} className="p-2 hover:bg-gray-100 active:bg-gray-200 rounded text-lg select-none">&gt;</button>
      </div>

      <p className="text-xs text-gray-400 text-center mb-4">
        터치: 가능(초록) → 불가(빨강) → 미정(회색)
      </p>

      {/* Calendar grid */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-4">
        <div className="grid grid-cols-7">
          {dayNames.map((name, i) => (
            <div key={name} className={`text-center text-xs font-bold py-2 ${
              i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-600'
            }`}>{name}</div>
          ))}
          {calendarDays.map((day, idx) => {
            if (day === null) return <div key={`e-${idx}`} className="h-12" />;
            const dateStr = `${year}-${pad(month)}-${pad(day)}`;
            const isAvail = available.has(dateStr);
            const isUnavail = unavailable.has(dateStr);
            const dayOfWeek = new Date(year, month - 1, day).getDay();

            return (
              <button
                key={dateStr}
                onClick={() => toggleDay(dateStr)}
                className={`h-12 text-sm font-medium border-t transition-colors ${
                  isAvail ? 'bg-green-100 text-green-800'
                  : isUnavail ? 'bg-red-100 text-red-800'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
                } ${dayOfWeek === 0 ? 'text-red-500' : dayOfWeek === 6 ? 'text-blue-500' : ''}`}
              >
                {day}
                {isAvail && <div className="text-[8px] text-green-600">가능</div>}
                {isUnavail && <div className="text-[8px] text-red-600">불가</div>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend + stats */}
      <div className="flex items-center justify-between text-xs text-gray-500 mb-4 px-1">
        <div className="flex gap-3">
          <span><span className="inline-block w-3 h-3 bg-green-100 border border-green-300 rounded mr-1" />가능 {available.size}일</span>
          <span><span className="inline-block w-3 h-3 bg-red-100 border border-red-300 rounded mr-1" />불가 {unavailable.size}일</span>
        </div>
        {lastSubmitted && (
          <span className="text-gray-400">
            마지막 제출: {new Date(lastSubmitted).toLocaleDateString('ko-KR')}
          </span>
        )}
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={saving}
        className={`w-full py-3 rounded-lg text-sm font-medium transition-colors ${
          saved ? 'bg-green-600 text-white' :
          saving ? 'bg-gray-300 text-gray-500' :
          'bg-blue-600 text-white active:bg-blue-700'
        }`}
      >
        {saving ? '제출 중...' : saved ? '제출 완료!' : '근무 가능일 제출'}
      </button>

      {/* Admin: view all submissions */}
      {isAdmin && (
        <div className="mt-6">
          <button
            onClick={() => { setViewAll(!viewAll); }}
            className="text-sm text-blue-600 font-medium mb-3"
          >
            {viewAll ? '접기' : '전체 의사 제출 현황 보기'}
          </button>

          {viewAll && (
            <div className="space-y-2">
              {activeDoctors.map(d => {
                const data = allData.find(a => a.doctorId === d.id);
                return (
                  <div key={d.id} className="bg-white rounded-lg border p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium px-2 py-0.5 rounded" style={{ backgroundColor: d.color }}>{d.name}</span>
                      {data ? (
                        <span className="text-[10px] text-green-600">
                          제출 ({new Date(data.submittedAt).toLocaleDateString('ko-KR')})
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-400">미제출</span>
                      )}
                    </div>
                    {data && (
                      <div className="text-xs text-gray-500">
                        가능 {data.availableDays.length}일 / 불가 {data.unavailableDays.length}일
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
