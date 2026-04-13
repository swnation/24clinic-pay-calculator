import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAppStore } from '../store';
import type { AvailabilityData, DaySlotAvailability, SlotStatus } from '../services/firebase';

interface Props {
  year: number;
  month: number;
  onMonthChange: (year: number, month: number) => void;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

type SlotKey = 'morning' | 'afternoon' | 'evening';
const SLOTS: { key: SlotKey; label: string; short: string }[] = [
  { key: 'morning', label: '오전 (09-13)', short: '오전' },
  { key: 'afternoon', label: '오후 (14-18)', short: '오후' },
  { key: 'evening', label: '저녁 (19-24)', short: '저녁' },
];

type DaysMap = Record<string, DaySlotAvailability>;

function cycleStatus(current?: SlotStatus): SlotStatus | undefined {
  if (!current) return 'available';
  if (current === 'available') return 'unavailable';
  return undefined; // undecided
}

function slotBg(status?: SlotStatus): string {
  if (status === 'available') return 'bg-green-200 text-green-800';
  if (status === 'unavailable') return 'bg-red-200 text-red-800';
  return 'bg-gray-100 text-gray-400';
}

function slotChar(status?: SlotStatus): string {
  if (status === 'available') return 'O';
  if (status === 'unavailable') return 'X';
  return '-';
}

export default function Availability({ year, month, onMonthChange }: Props) {
  const { isAdmin, activeDoctors, submitMyAvailability, loadMyAvailability, loadAllAvailabilityForMonth } = useAppStore();

  const [days, setDays] = useState<DaysMap>({});
  const [submitted, setSubmitted] = useState(false);
  const [editing, setEditing] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSubmitted, setLastSubmitted] = useState<number | null>(null);
  const [noteDay, setNoteDay] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [allData, setAllData] = useState<AvailabilityData[]>([]);
  const [viewAll, setViewAll] = useState(false);

  // Undo/Redo
  const [history, setHistory] = useState<DaysMap[]>([{}]);
  const [historyIdx, setHistoryIdx] = useState(0);
  const skipHistory = useRef(false);

  const monthStr = `${year}-${pad(month)}`;

  const pushHistory = useCallback((newDays: DaysMap) => {
    if (skipHistory.current) { skipHistory.current = false; return; }
    setHistory(prev => {
      const trimmed = prev.slice(0, historyIdx + 1);
      return [...trimmed, newDays];
    });
    setHistoryIdx(prev => prev + 1);
  }, [historyIdx]);

  const undo = useCallback(() => {
    if (historyIdx <= 0) return;
    const newIdx = historyIdx - 1;
    setHistoryIdx(newIdx);
    skipHistory.current = true;
    setDays(history[newIdx]);
  }, [historyIdx, history]);

  const redo = useCallback(() => {
    if (historyIdx >= history.length - 1) return;
    const newIdx = historyIdx + 1;
    setHistoryIdx(newIdx);
    skipHistory.current = true;
    setDays(history[newIdx]);
  }, [historyIdx, history]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [undo, redo]);

  // Load
  useEffect(() => {
    setDays({});
    setHistory([{}]);
    setHistoryIdx(0);
    setSubmitted(false);
    setEditing(true);
    setLastSubmitted(null);
    setNoteDay(null);

    loadMyAvailability(monthStr).then(data => {
      if (data) {
        setDays(data.days || {});
        setHistory([data.days || {}]);
        setHistoryIdx(0);
        if (!data.isDraft && data.submittedAt) {
          setSubmitted(true);
          setEditing(false);
          setLastSubmitted(data.submittedAt);
        }
      }
    });
  }, [monthStr, loadMyAvailability]);

  // Admin: load all
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

  const allDateStrs = useMemo(() => {
    const lastDay = new Date(year, month, 0).getDate();
    return Array.from({ length: lastDay }, (_, i) => `${year}-${pad(month)}-${pad(i + 1)}`);
  }, [year, month]);

  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

  const toggleSlot = (dateStr: string, slot: SlotKey) => {
    if (!editing) return;
    const newDays = { ...days };
    const dayData = { ...(newDays[dateStr] || {}) };
    const newStatus = cycleStatus(dayData[slot]);
    if (newStatus) dayData[slot] = newStatus;
    else delete dayData[slot];
    // Clean empty
    if (!dayData.morning && !dayData.afternoon && !dayData.evening && !dayData.note) {
      delete newDays[dateStr];
    } else {
      newDays[dateStr] = dayData;
    }
    setDays(newDays);
    pushHistory(newDays);
  };

  const fillRemaining = (status: SlotStatus | 'undecided') => {
    if (!editing) return;
    const newDays = { ...days };
    for (const dateStr of allDateStrs) {
      const dayData = { ...(newDays[dateStr] || {}) };
      for (const s of SLOTS) {
        if (dayData[s.key] === undefined) {
          if (status === 'undecided') continue; // already undecided
          dayData[s.key] = status;
        }
      }
      if (dayData.morning || dayData.afternoon || dayData.evening || dayData.note) {
        newDays[dateStr] = dayData;
      }
    }
    setDays(newDays);
    pushHistory(newDays);
  };

  const clearUnset = () => {
    if (!editing) return;
    const newDays: DaysMap = {};
    for (const [dateStr, dayData] of Object.entries(days)) {
      const cleaned: DaySlotAvailability = {};
      if (dayData.note) cleaned.note = dayData.note;
      // Remove all slot statuses
      if (cleaned.note) newDays[dateStr] = cleaned;
    }
    // Keep only days with explicit statuses set by user (none after clearing)
    // Actually, clear means set all to undecided
    const cleared: DaysMap = {};
    for (const [dateStr, dayData] of Object.entries(days)) {
      if (dayData.note) cleared[dateStr] = { note: dayData.note };
    }
    setDays(cleared);
    pushHistory(cleared);
  };

  const openNote = (dateStr: string) => {
    setNoteDay(dateStr);
    setNoteText(days[dateStr]?.note || '');
  };

  const saveNote = () => {
    if (!noteDay) return;
    const newDays = { ...days };
    const dayData = { ...(newDays[noteDay] || {}) };
    if (noteText.trim()) dayData.note = noteText.trim();
    else delete dayData.note;
    if (dayData.morning || dayData.afternoon || dayData.evening || dayData.note) {
      newDays[noteDay] = dayData;
    } else {
      delete newDays[noteDay];
    }
    setDays(newDays);
    pushHistory(newDays);
    setNoteDay(null);
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    await submitMyAvailability(monthStr, days, true);
    setSaving(false);
  };

  const handleSubmit = async () => {
    setSaving(true);
    const ok = await submitMyAvailability(monthStr, days, false);
    if (ok) {
      setSubmitted(true);
      setEditing(false);
      setLastSubmitted(Date.now());
    }
    setSaving(false);
  };

  const handleEdit = () => {
    setEditing(true);
  };

  // Stats
  const stats = useMemo(() => {
    let avail = 0, unavail = 0;
    for (const d of Object.values(days)) {
      for (const s of SLOTS) { if (d[s.key] === 'available') avail++; if (d[s.key] === 'unavailable') unavail++; }
    }
    return { avail, unavail };
  }, [days]);

  const prevMonth = () => { if (month === 1) onMonthChange(year - 1, 12); else onMonthChange(year, month - 1); };
  const nextMonth = () => { if (month === 12) onMonthChange(year + 1, 1); else onMonthChange(year, month + 1); };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Month nav */}
      <div className="flex items-center justify-center gap-6 mb-3">
        <button onClick={prevMonth} className="p-2 hover:bg-gray-100 active:bg-gray-200 rounded text-lg select-none">&lt;</button>
        <h2 className="text-lg font-bold">{year}년 {month}월</h2>
        <button onClick={nextMonth} className="p-2 hover:bg-gray-100 active:bg-gray-200 rounded text-lg select-none">&gt;</button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex gap-1">
          <button onClick={undo} disabled={historyIdx <= 0 || !editing}
            className="px-2 py-1 text-xs border rounded disabled:opacity-30 hover:bg-gray-100 active:bg-gray-200">
            ↩ 실행취소
          </button>
          <button onClick={redo} disabled={historyIdx >= history.length - 1 || !editing}
            className="px-2 py-1 text-xs border rounded disabled:opacity-30 hover:bg-gray-100 active:bg-gray-200">
            ↪ 다시실행
          </button>
        </div>
        <div className="text-xs text-gray-400">
          O=가능 X=불가 -=미정 | 터치로 전환
        </div>
      </div>

      {/* Submitted overlay message */}
      {submitted && !editing && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3 flex items-center justify-between">
          <div>
            <span className="text-sm text-green-800 font-medium">제출 완료</span>
            {lastSubmitted && (
              <span className="text-xs text-green-600 ml-2">
                {new Date(lastSubmitted).toLocaleString('ko-KR')}
              </span>
            )}
          </div>
          <button onClick={handleEdit}
            className="px-3 py-1.5 text-xs bg-white border border-green-300 rounded-lg text-green-700 font-medium active:bg-green-50">
            수정하기
          </button>
        </div>
      )}

      {/* Calendar */}
      <div className={`bg-white rounded-lg border border-gray-200 overflow-hidden mb-3 ${!editing ? 'opacity-60 pointer-events-none' : ''}`}>
        <div className="grid grid-cols-7">
          {/* Header row */}
          {dayNames.map((name, i) => (
            <div key={name} className={`text-center text-[10px] font-bold py-1.5 border-b bg-gray-50 ${
              i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-600'
            }`}>{name}</div>
          ))}

          {/* Day cells */}
          {calendarDays.map((day, idx) => {
            if (day === null) return <div key={`e-${idx}`} className="min-h-[72px] border-t" />;
            const dateStr = `${year}-${pad(month)}-${pad(day)}`;
            const dayData = days[dateStr] || {};
            const dayOfWeek = new Date(year, month - 1, day).getDay();
            const hasNote = !!dayData.note;

            return (
              <div key={dateStr} className="border-t min-h-[72px] p-0.5">
                {/* Day number + note button */}
                <div className="flex items-center justify-between px-0.5">
                  <span className={`text-[10px] font-bold ${
                    dayOfWeek === 0 ? 'text-red-500' : dayOfWeek === 6 ? 'text-blue-500' : 'text-gray-500'
                  }`}>{day}</span>
                  <button
                    onClick={() => openNote(dateStr)}
                    className={`text-[8px] px-1 rounded ${hasNote ? 'bg-yellow-200 text-yellow-800' : 'text-gray-300 hover:text-gray-500'}`}
                    title="메모"
                  >
                    {hasNote ? '메모' : '✎'}
                  </button>
                </div>
                {/* 3 slot buttons */}
                <div className="flex flex-col gap-px mt-0.5">
                  {SLOTS.map(s => (
                    <button
                      key={s.key}
                      onClick={() => toggleSlot(dateStr, s.key)}
                      className={`text-[9px] leading-tight py-0.5 rounded-sm font-medium transition-colors ${slotBg(dayData[s.key])}`}
                    >
                      {s.short} {slotChar(dayData[s.key])}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fill remaining */}
      {editing && (
        <div className="flex items-center gap-2 mb-3 px-1">
          <span className="text-xs text-gray-500">나머지 채우기:</span>
          <button onClick={() => fillRemaining('available')}
            className="px-2 py-1 text-[10px] bg-green-100 text-green-700 rounded font-medium active:bg-green-200">
            전부 가능
          </button>
          <button onClick={() => fillRemaining('unavailable')}
            className="px-2 py-1 text-[10px] bg-red-100 text-red-700 rounded font-medium active:bg-red-200">
            전부 불가
          </button>
          <button onClick={clearUnset}
            className="px-2 py-1 text-[10px] bg-gray-100 text-gray-600 rounded font-medium active:bg-gray-200">
            전부 초기화
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="flex items-center justify-between text-xs text-gray-500 mb-4 px-1">
        <div className="flex gap-3">
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-200 rounded" />가능 {stats.avail}칸</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-200 rounded" />불가 {stats.unavail}칸</span>
        </div>
        {lastSubmitted && (
          <span className="text-gray-400">제출: {new Date(lastSubmitted).toLocaleDateString('ko-KR')}</span>
        )}
      </div>

      {/* Action buttons */}
      {editing && (
        <div className="flex gap-2">
          <button onClick={handleSaveDraft} disabled={saving}
            className="flex-1 py-3 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 active:bg-gray-100 disabled:opacity-50">
            {saving ? '저장 중...' : '임시저장'}
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 py-3 rounded-lg text-sm font-medium bg-blue-600 text-white active:bg-blue-700 disabled:opacity-50">
            {saving ? '제출 중...' : '제출'}
          </button>
        </div>
      )}

      {/* Note modal */}
      {noteDay && (
        <>
          <div className="fixed inset-0 bg-black/30 z-50" onClick={() => setNoteDay(null)} />
          <div className="fixed inset-x-4 top-1/3 bg-white rounded-2xl shadow-xl z-50 p-6 max-w-sm mx-auto">
            <h3 className="font-bold text-sm mb-2">{noteDay.slice(5)} 메모</h3>
            <p className="text-xs text-gray-400 mb-3">세부 시간 등을 자유롭게 적으세요.</p>
            <textarea
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              placeholder="예: 14시 이후만 가능, 오전 반차..."
              className="w-full border rounded-lg px-3 py-2 text-sm h-24 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <div className="flex gap-2 mt-3">
              <button onClick={() => setNoteDay(null)}
                className="flex-1 py-2 text-sm border rounded-lg text-gray-600 active:bg-gray-100">취소</button>
              <button onClick={saveNote}
                className="flex-1 py-2 text-sm bg-blue-600 text-white rounded-lg font-medium active:bg-blue-700">저장</button>
            </div>
          </div>
        </>
      )}

      {/* Admin: view all */}
      {isAdmin && (
        <div className="mt-6">
          <button onClick={() => setViewAll(!viewAll)}
            className="text-sm text-blue-600 font-medium mb-3">
            {viewAll ? '접기' : '전체 의사 제출 현황 보기'}
          </button>
          {viewAll && (
            <div className="space-y-2">
              {activeDoctors.map(d => {
                const data = allData.find(a => a.doctorId === d.id);
                const dayCount = data ? Object.keys(data.days || {}).length : 0;
                return (
                  <div key={d.id} className="bg-white rounded-lg border p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium px-2 py-0.5 rounded" style={{ backgroundColor: d.color }}>{d.name}</span>
                      {data ? (
                        <span className={`text-[10px] ${data.isDraft ? 'text-yellow-600' : 'text-green-600'}`}>
                          {data.isDraft ? '임시저장' : `제출 (${new Date(data.submittedAt!).toLocaleDateString('ko-KR')})`}
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-400">미제출</span>
                      )}
                    </div>
                    {data && <div className="text-xs text-gray-500">{dayCount}일 입력</div>}
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
