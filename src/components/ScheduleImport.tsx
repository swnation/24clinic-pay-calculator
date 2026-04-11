import { useState, useMemo } from 'react';
import { useAppStore } from '../store';
import { parseMultiMonthText } from '../utils/scheduleParser';
import type { ParseResult } from '../utils/scheduleParser';
import { DOCTOR_COLORS } from '../types';

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

interface Props {
  onClose: () => void;
  onImported: (year: number, month: number) => void;
}

interface MonthSummary {
  result: ParseResult;
  totalShifts: number;
  totalDays: number;
  room2Count: number;
  byDoctor: Map<string, number>;
}

export default function ScheduleImport({ onClose, onImported }: Props) {
  const { state, addDoctor, addShift, removeShift } = useAppStore();
  const [text, setText] = useState('');
  const [parsedList, setParsedList] = useState<ParseResult[] | null>(null);
  const [error, setError] = useState('');
  const [replaceExisting, setReplaceExisting] = useState(true);

  const handleParse = () => {
    try {
      const results = parseMultiMonthText(text);
      if (results.length === 0 || results.every(r => r.shifts.length === 0)) {
        setError('파싱된 근무가 없습니다. 텍스트를 확인해주세요.');
        setParsedList(null);
        return;
      }
      setParsedList(results);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '파싱 오류');
      setParsedList(null);
    }
  };

  const summaries = useMemo<MonthSummary[]>(() => {
    if (!parsedList) return [];
    return parsedList.map(result => {
      const byDoctor = new Map<string, number>();
      let room2Count = 0;
      const dates = new Set<string>();
      for (const s of result.shifts) {
        byDoctor.set(s.doctorName, (byDoctor.get(s.doctorName) || 0) + 1);
        if (s.room === 2) room2Count++;
        dates.add(s.date);
      }
      return { result, totalShifts: result.shifts.length, totalDays: dates.size, room2Count, byDoctor };
    });
  }, [parsedList]);

  const totalShifts = summaries.reduce((sum, s) => sum + s.totalShifts, 0);
  const totalMonths = summaries.length;

  // All unique new doctors across all months
  const allNewDoctors = useMemo(() => {
    if (!parsedList) return [];
    const allNames = new Set<string>();
    for (const r of parsedList) r.doctorNames.forEach(n => allNames.add(n));
    return [...allNames].filter(name => !state.doctors.some(d => d.name === name));
  }, [parsedList, state.doctors]);

  const handleImport = () => {
    if (!parsedList) return;

    // Create new doctors
    const doctorMap = new Map<string, string>();
    for (const d of state.doctors) doctorMap.set(d.name, d.id);
    for (const name of allNewDoctors) {
      const created = addDoctor(name);
      doctorMap.set(name, created.id);
    }

    // Process each month
    for (const result of parsedList) {
      if (replaceExisting) {
        const monthPrefix = `${result.year}-${pad(result.month)}`;
        const existing = state.shifts.filter(s => s.date.startsWith(monthPrefix));
        for (const s of existing) removeShift(s.id);
      }

      for (const s of result.shifts) {
        const doctorId = doctorMap.get(s.doctorName);
        if (!doctorId) continue;
        addShift({ doctorId, date: s.date, startHour: s.startHour, endHour: s.endHour, room: s.room });
      }
    }

    // Navigate to the last imported month
    const last = parsedList[parsedList.length - 1];
    onImported(last.year, last.month);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white w-full sm:w-auto sm:min-w-[500px] sm:max-w-lg sm:rounded-lg rounded-t-2xl shadow-xl max-h-[95vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        <div className="p-5 sm:p-6">
          <h2 className="text-lg font-bold mb-1">스케줄 가져오기</h2>
          <p className="text-sm text-gray-500 mb-4">
            24clinic.kr에서 텍스트를 복사해서 붙여넣기 하세요.<br />
            <span className="text-blue-600 font-medium">여러 달을 한번에 붙여넣기 할 수 있습니다.</span>
          </p>

          {!parsedList ? (
            <>
              <textarea
                className="w-full border rounded-lg px-3 py-3 text-sm h-48 resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder={"여러 달 텍스트를 이어서 붙여넣기 하세요.\n\n예시:\n잠실점\n 2025.08 \n...(8월 데이터)...\n\n잠실점\n 2025.09 \n...(9월 데이터)..."}
                value={text}
                onChange={e => { setText(e.target.value); setError(''); }}
              />

              {error && <p className="text-sm text-red-500 mt-2">{error}</p>}

              <div className="flex gap-2 mt-4">
                <button
                  onClick={handleParse}
                  disabled={!text.trim()}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium active:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  파싱하기
                </button>
                <button
                  onClick={onClose}
                  className="px-5 bg-gray-100 text-gray-700 py-3 rounded-lg font-medium active:bg-gray-200"
                >
                  취소
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Overall summary */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <p className="text-sm font-bold text-green-800 mb-1">
                  {totalMonths}개월 파싱 완료
                </p>
                <p className="text-sm text-green-700">
                  총 {totalShifts}개 근무
                  {allNewDoctors.length > 0 && ` / 새 의사 ${allNewDoctors.length}명`}
                </p>
              </div>

              {/* Per-month breakdown */}
              <div className="bg-white border rounded-lg overflow-hidden mb-4 max-h-[40vh] overflow-y-auto">
                <div className="bg-gray-50 px-3 py-2 border-b sticky top-0">
                  <span className="text-xs font-bold text-gray-600">월별 상세</span>
                </div>
                <div className="divide-y">
                  {summaries.map(({ result, totalShifts, totalDays, room2Count, byDoctor }) => (
                    <div key={`${result.year}-${result.month}`} className="px-3 py-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-bold text-gray-800">
                          {result.year}.{pad(result.month)}
                        </span>
                        <span className="text-xs text-gray-500">
                          {totalShifts}건 / {totalDays}일
                          {room2Count > 0 && <span className="text-blue-600 ml-1">(2진료실 {room2Count}건)</span>}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {[...byDoctor.entries()].map(([name, count]) => {
                          const doc = state.doctors.find(d => d.name === name);
                          const color = doc?.color || DOCTOR_COLORS[allNewDoctors.indexOf(name) % DOCTOR_COLORS.length] || '#E0E0E0';
                          return (
                            <span
                              key={name}
                              className="text-[10px] px-1.5 py-0.5 rounded-full"
                              style={{ backgroundColor: color }}
                            >
                              {name} {count}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* New doctors notice */}
              {allNewDoctors.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 mb-4">
                  <span className="text-xs text-yellow-800 font-medium">
                    새로 등록될 의사: {allNewDoctors.join(', ')}
                  </span>
                </div>
              )}

              {/* Replace option */}
              <label className="flex items-center gap-2 mb-5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={replaceExisting}
                  onChange={e => setReplaceExisting(e.target.checked)}
                  className="accent-blue-600 w-4 h-4"
                />
                <span className="text-sm text-gray-700">해당 월 기존 근무 삭제 후 교체</span>
              </label>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={handleImport}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium active:bg-blue-700 text-base"
                >
                  {totalMonths}개월 {totalShifts}건 적용하기
                </button>
                <button
                  onClick={() => setParsedList(null)}
                  className="px-4 bg-gray-100 text-gray-700 py-3 rounded-lg font-medium active:bg-gray-200"
                >
                  뒤로
                </button>
                <button
                  onClick={onClose}
                  className="px-4 bg-gray-100 text-gray-700 py-3 rounded-lg font-medium active:bg-gray-200"
                >
                  취소
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
