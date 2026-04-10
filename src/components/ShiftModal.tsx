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
  { label: '풀타임 (09-24)', start: 9, end: 24 },
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
  const dateLabel = `${dateObj.getFullYear()}년 ${dateObj.getMonth() + 1}월 ${dateObj.getDate()}일 (${dayNames[dateObj.getDay()]})`;

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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <h2 className="text-lg font-bold mb-1">
            {editShift ? '근무 수정' : '근무 추가'}
          </h2>
          <p className="text-sm text-gray-500 mb-4">{dateLabel}</p>

          {/* Doctor select */}
          <label className="block text-sm font-medium text-gray-700 mb-1">의사</label>
          <select
            className="w-full border rounded-lg px-3 py-2 mb-4 text-sm"
            value={doctorId}
            onChange={e => setDoctorId(e.target.value)}
          >
            {state.doctors.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>

          {/* Room select */}
          <label className="block text-sm font-medium text-gray-700 mb-1">진료실</label>
          <div className="flex gap-4 mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" checked={room === 1} onChange={() => setRoom(1)} className="accent-blue-600" />
              <span className="text-sm">1진료실</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" checked={room === 2} onChange={() => setRoom(2)} className="accent-blue-600" />
              <span className="text-sm">2진료실</span>
            </label>
          </div>

          {/* Time presets */}
          <label className="block text-sm font-medium text-gray-700 mb-1">시간 프리셋</label>
          <div className="flex flex-wrap gap-2 mb-4">
            {PRESETS.map(p => (
              <button
                key={p.label}
                className="px-3 py-1 text-xs rounded-full border border-gray-300 hover:bg-gray-100 transition-colors"
                onClick={() => { setStartHour(p.start); setEndHour(p.end); }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Time select */}
          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">시작</label>
              <select
                className="w-full border rounded-lg px-3 py-2 text-sm"
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
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">종료</label>
              <select
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={endHour}
                onChange={e => setEndHour(Number(e.target.value))}
              >
                {HOUR_OPTIONS.filter(h => h > startHour).map(h => (
                  <option key={h} value={h}>{h === 24 ? '24:00' : `${String(h).padStart(2, '0')}:00`}</option>
                ))}
              </select>
            </div>
          </div>

          <p className="text-sm text-gray-500 mb-4">
            실 근무시간: <span className="font-bold text-gray-900">{workHours}시간</span>
            {(startHour <= 13 && endHour > 13) && ' (점심 제외)'}
            {(startHour <= 18 && endHour > 18) && ' (저녁 제외)'}
          </p>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              {editShift ? '수정' : '추가'}
            </button>
            {editShift && (
              <button
                onClick={handleDelete}
                className="px-4 bg-red-50 text-red-600 py-2 rounded-lg font-medium hover:bg-red-100 transition-colors"
              >
                삭제
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 bg-gray-100 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              취소
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
