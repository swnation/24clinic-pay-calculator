import { useState, useMemo } from 'react';
import { useAppStore } from '../store';
import { parseScheduleText } from '../utils/scheduleParser';
import type { ParseResult } from '../utils/scheduleParser';
import { DOCTOR_COLORS } from '../types';

interface Props {
  onClose: () => void;
  onImported: (year: number, month: number) => void;
}

export default function ScheduleImport({ onClose, onImported }: Props) {
  const { state, addDoctor, addShift, removeShift } = useAppStore();
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [error, setError] = useState('');
  const [replaceExisting, setReplaceExisting] = useState(true);

  const handleParse = () => {
    try {
      const result = parseScheduleText(text);
      if (result.shifts.length === 0) {
        setError('파싱된 근무가 없습니다. 텍스트를 확인해주세요.');
        setParsed(null);
        return;
      }
      setParsed(result);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '파싱 오류');
      setParsed(null);
    }
  };

  const summary = useMemo(() => {
    if (!parsed) return null;

    const byDoctor = new Map<string, number>();
    const byRoom = { 1: 0, 2: 0 };
    const dates = new Set<string>();

    for (const s of parsed.shifts) {
      byDoctor.set(s.doctorName, (byDoctor.get(s.doctorName) || 0) + 1);
      byRoom[s.room]++;
      dates.add(s.date);
    }

    return { byDoctor, byRoom, totalDays: dates.size, totalShifts: parsed.shifts.length };
  }, [parsed]);

  // Check which doctors are new (not in the system yet)
  const newDoctors = useMemo(() => {
    if (!parsed) return [];
    return parsed.doctorNames.filter(
      name => !state.doctors.some(d => d.name === name)
    );
  }, [parsed, state.doctors]);

  const handleImport = () => {
    if (!parsed) return;

    // Create new doctors first
    const doctorMap = new Map<string, string>(); // name -> id
    for (const d of state.doctors) {
      doctorMap.set(d.name, d.id);
    }
    for (const name of newDoctors) {
      const created = addDoctor(name);
      doctorMap.set(name, created.id);
    }

    // Remove existing shifts for this month if replace mode
    if (replaceExisting) {
      const monthPrefix = `${parsed.year}-${String(parsed.month).padStart(2, '0')}`;
      const existingShifts = state.shifts.filter(s => s.date.startsWith(monthPrefix));
      for (const s of existingShifts) {
        removeShift(s.id);
      }
    }

    // Add parsed shifts
    for (const s of parsed.shifts) {
      const doctorId = doctorMap.get(s.doctorName);
      if (!doctorId) continue;
      addShift({
        doctorId,
        date: s.date,
        startHour: s.startHour,
        endHour: s.endHour,
        room: s.room,
      });
    }

    onImported(parsed.year, parsed.month);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white w-full sm:w-auto sm:min-w-[500px] sm:max-w-lg sm:rounded-lg rounded-t-2xl shadow-xl max-h-[95vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle for mobile */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        <div className="p-5 sm:p-6">
          <h2 className="text-lg font-bold mb-1">스케줄 가져오기</h2>
          <p className="text-sm text-gray-500 mb-4">
            24clinic.kr/schedule.html 에서 텍스트를 복사해서 붙여넣기 하세요.
          </p>

          {!parsed ? (
            <>
              <textarea
                className="w-full border rounded-lg px-3 py-3 text-sm h-48 resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder={"24시열린의원\n일정관리\n지점명\n잠실점\n 2026.04 \n...\n1\n지아영 (09-13)\n지아영 (14-18)\n..."}
                value={text}
                onChange={e => { setText(e.target.value); setError(''); }}
              />

              {error && (
                <p className="text-sm text-red-500 mt-2">{error}</p>
              )}

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
              {/* Parse result summary */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <p className="text-sm font-bold text-green-800 mb-2">
                  {parsed.year}년 {parsed.month}월 {parsed.branchName && `(${parsed.branchName}점)`}
                </p>
                <p className="text-sm text-green-700">
                  {summary!.totalShifts}개 근무 / {summary!.totalDays}일 / 1진료실 {summary!.byRoom[1]}건 + 2진료실 {summary!.byRoom[2]}건
                </p>
              </div>

              {/* Per-doctor breakdown */}
              <div className="bg-white border rounded-lg overflow-hidden mb-4">
                <div className="bg-gray-50 px-3 py-2 border-b">
                  <span className="text-xs font-bold text-gray-600">의사별 근무 수</span>
                </div>
                <div className="divide-y">
                  {[...summary!.byDoctor.entries()].map(([name, count]) => {
                    const existing = state.doctors.find(d => d.name === name);
                    const isNew = !existing;
                    const color = existing?.color || DOCTOR_COLORS[newDoctors.indexOf(name) % DOCTOR_COLORS.length];
                    return (
                      <div key={name} className="px-3 py-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded-full border border-gray-300" style={{ backgroundColor: color }} />
                          <span className="text-sm">{name}</span>
                          {isNew && (
                            <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-medium">
                              새 의사
                            </span>
                          )}
                        </div>
                        <span className="text-sm text-gray-500">{count}건</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Replace option */}
              <label className="flex items-center gap-2 mb-5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={replaceExisting}
                  onChange={e => setReplaceExisting(e.target.checked)}
                  className="accent-blue-600 w-4 h-4"
                />
                <span className="text-sm text-gray-700">
                  {parsed.year}년 {parsed.month}월 기존 근무 삭제 후 교체
                </span>
              </label>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={handleImport}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium active:bg-blue-700 text-base"
                >
                  {summary!.totalShifts}개 근무 적용하기
                </button>
                <button
                  onClick={() => setParsed(null)}
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
