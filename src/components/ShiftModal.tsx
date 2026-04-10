import { useState, useEffect } from 'react';
import type { Shift } from '../types';
import { useAppStore } from '../store';

interface Props {
  date: string;
  editShift?: Shift | null;
  onClose: () => void;
}

const HOUR_OPTIONS = Array.from({ length: 16 }, (_, i) => i + 9); // 9-24

const PRESETS = [
  { label: '오전 (09-13)', start: 9, end: 13 },
  { label: '오후 (14-18)', start: 14, end: 18 },
  { label: '야간 (19-24)', start: 19, end: 24 },
  { label: '풀 (09-24)', start: 9, end: 24 },
];

export default function ShiftModal({ date, editShift, onClose }: Props) {
  const { state, addShift, updateShift, removeShift } = useAppStore();
  const [doctorId, setDoctorId] = useState(editShift?.doctorId || state.doctors[0]?.id || '');
  const [room, setRoom] = useState<1 | 2>(editShift?.room || 1);
  const [startHour, setStartHour] = useState(editShift?.startHour || 9);
  const [endHour, setEndHour] = useState(editShift?.endHour || 13);

  useEffect(() => {
    if (editShift) {
      setDoctorId(editShift.doctorId);
      setRoom(editShift.room);
      setStartHour(editShift.startHour);
      setEndHour(editShift.endHour);
    }
  }, [editShift]);

  const dateObj = new Date(date + 'T00:00:00');
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const dateLabel = `${dateObj.getMonth() + 1}월 ${dateObj.getDate()}일 (${dayNames[dateObj.getDay()]})`;

  const workHours = (() => {
    let h = 0;
    for (let i = startHour; i < endHour; i++) {
      if (i !== 13 && i !== 18) h++;
    }
    return h;
  })();

  const handleSave = () => {
    if (!doctorId || startHour >= endHour) return;
    if (editShift) {
      updateShift({ ...editShift, doctorId, room, startHour, endHour });
    } else {
      addShift({ doctorId, date, room, startHour, endHour });
    }
    onClose();
  };

  const handleDelete = () => {
    if (editShift) {
      removeShift(editShift.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white w-full sm:w-auto sm:min-w-[400px] sm:max-w-md sm:rounded-lg rounded-t-2xl shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle for mobile */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        <div className="p-5 sm:p-6">
          <h2 className="text-lg font-bold mb-0.5">
            {editShift ? '근무 수정' : '근무 추가'}
          </h2>
          <p className="text-sm text-gray-500 mb-4">{dateLabel}</p>

          {/* Doctor select - grid buttons on mobile */}
          <label className="block text-sm font-medium text-gray-700 mb-2">의사</label>
          <div className="flex flex-wrap gap-2 mb-4">
            {state.doctors.map(d => (
              <button
                key={d.id}
                onClick={() => setDoctorId(d.id)}
                className={`px-3 py-2 rounded-lg text-sm font-medium border-2 transition-all ${
                  doctorId === d.id
                    ? 'border-gray-700 shadow-md'
                    : 'border-transparent opacity-50'
                }`}
                style={{ backgroundColor: d.color }}
              >
                {d.name}
              </button>
            ))}
          </div>

          {/* Room select */}
          <label className="block text-sm font-medium text-gray-700 mb-2">진료실</label>
          <div className="flex gap-3 mb-4">
            {([1, 2] as const).map(r => (
              <button
                key={r}
                onClick={() => setRoom(r)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium border-2 transition-all ${
                  room === r
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-gray-200 text-gray-500'
                }`}
              >
                {r}진료실
              </button>
            ))}
          </div>

          {/* Time presets */}
          <label className="block text-sm font-medium text-gray-700 mb-2">시간</label>
          <div className="grid grid-cols-4 gap-2 mb-3">
            {PRESETS.map(p => {
              const isActive = startHour === p.start && endHour === p.end;
              return (
                <button
                  key={p.label}
                  className={`px-2 py-2 text-xs rounded-lg border transition-colors ${
                    isActive
                      ? 'border-blue-600 bg-blue-50 text-blue-700 font-bold'
                      : 'border-gray-200 active:bg-gray-100'
                  }`}
                  onClick={() => { setStartHour(p.start); setEndHour(p.end); }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Time select */}
          <div className="flex gap-3 mb-4">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">시작</label>
              <select
                className="w-full border rounded-lg px-3 py-2.5 text-sm bg-white"
                value={startHour}
                onChange={e => {
                  const v = Number(e.target.value);
                  setStartHour(v);
                  if (v >= endHour) setEndHour(v + 1);
                }}
              >
                {HOUR_OPTIONS.filter(h => h < 24).map(h => (
                  <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                ))}
              </select>
            </div>
            <span className="self-end pb-3 text-gray-400">~</span>
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">종료</label>
              <select
                className="w-full border rounded-lg px-3 py-2.5 text-sm bg-white"
                value={endHour}
                onChange={e => setEndHour(Number(e.target.value))}
              >
                {HOUR_OPTIONS.filter(h => h > startHour).map(h => (
                  <option key={h} value={h}>{h === 24 ? '24:00' : `${String(h).padStart(2, '0')}:00`}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg px-3 py-2 mb-5 text-sm">
            실 근무시간: <span className="font-bold text-gray-900">{workHours}시간</span>
            {(startHour <= 13 && endHour > 13) && <span className="text-gray-400"> (점심 제외)</span>}
            {(startHour <= 18 && endHour > 18) && <span className="text-gray-400"> (저녁 제외)</span>}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium active:bg-blue-700 transition-colors text-base"
            >
              {editShift ? '수정' : '추가'}
            </button>
            {editShift && (
              <button
                onClick={handleDelete}
                className="px-5 bg-red-50 text-red-600 py-3 rounded-lg font-medium active:bg-red-100 transition-colors"
              >
                삭제
              </button>
            )}
            <button
              onClick={onClose}
              className="px-5 bg-gray-100 text-gray-700 py-3 rounded-lg font-medium active:bg-gray-200 transition-colors"
            >
              취소
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
