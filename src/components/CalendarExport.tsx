import { useState, useMemo } from 'react';
import { useAppStore } from '../store';
import { generateCalendarEvents, generateICS, downloadICS } from '../utils/calendarExport';

interface Props {
  year: number;
  month: number;
  onMonthChange: (year: number, month: number) => void;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

const GOOGLE_COLORS: { id: string; hex: string; name: string }[] = [
  { id: '1', hex: '#a4bdfc', name: '라벤더' },
  { id: '2', hex: '#7ae7bf', name: '세이지' },
  { id: '3', hex: '#dbadff', name: '포도' },
  { id: '4', hex: '#ff887c', name: '플라밍고' },
  { id: '5', hex: '#fbd75b', name: '바나나' },
  { id: '6', hex: '#ffb878', name: '귤' },
  { id: '7', hex: '#46d6db', name: '공작' },
  { id: '8', hex: '#e1e1e1', name: '흑연' },
  { id: '9', hex: '#5484ed', name: '블루베리' },
  { id: '10', hex: '#51b749', name: '바질' },
  { id: '11', hex: '#dc2127', name: '토마토' },
];

export default function CalendarExport({ year, month, onMonthChange }: Props) {
  const { state, getShiftsForDoctor } = useAppStore();
  const [selectedDoctor, setSelectedDoctor] = useState(state.doctors[0]?.id || '');
  const [selectedColor, setSelectedColor] = useState<string | null>(null); // null = auto (doctor color)

  const monthStr = `${year}-${pad(month)}`;
  const doctor = state.doctors.find(d => d.id === selectedDoctor);

  const doctorShifts = useMemo(() =>
    getShiftsForDoctor(selectedDoctor, monthStr),
    [selectedDoctor, monthStr, state.shifts]
  );

  const events = useMemo(() => {
    if (!doctor) return [];
    const evts = generateCalendarEvents(doctorShifts, doctor, state.branchName);
    if (selectedColor) {
      return evts.map(e => ({ ...e, color: selectedColor }));
    }
    return evts;
  }, [doctorShifts, doctor, state.branchName, selectedColor]);

  const handleExport = () => {
    if (!doctor || events.length === 0) return;
    const ics = generateICS(events);
    const filename = `${state.branchName}_${doctor.name}_${year}년${month}월.ics`;
    downloadICS(ics, filename);
  };

  const prevMonth = () => {
    if (month === 1) onMonthChange(year - 1, 12);
    else onMonthChange(year, month - 1);
  };
  const nextMonth = () => {
    if (month === 12) onMonthChange(year + 1, 1);
    else onMonthChange(year, month + 1);
  };

  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

  return (
    <div className="max-w-2xl mx-auto">
      {/* Month navigation */}
      <div className="flex items-center justify-center gap-4 mb-4">
        <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-lg text-xl">&lt;</button>
        <h2 className="text-xl font-bold">{year}년 {month}월</h2>
        <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-lg text-xl">&gt;</button>
      </div>

      {/* Doctor selector */}
      <div className="flex flex-wrap gap-2 mb-6 justify-center">
        {state.doctors.map(d => (
          <button
            key={d.id}
            onClick={() => setSelectedDoctor(d.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border-2 transition-all ${
              selectedDoctor === d.id
                ? 'border-gray-700 shadow-md scale-105'
                : 'border-transparent opacity-60 hover:opacity-80'
            }`}
            style={{ backgroundColor: d.color }}
          >
            {d.name}
          </button>
        ))}
      </div>

      {/* Color picker */}
      <div className="mb-6">
        <p className="text-xs text-gray-500 mb-2 text-center">캘린더 색상</p>
        <div className="flex flex-wrap gap-2 justify-center">
          <button
            onClick={() => setSelectedColor(null)}
            className={`w-7 h-7 rounded-full border-2 ${!selectedColor ? 'border-gray-700 ring-2 ring-gray-400' : 'border-gray-300'}`}
            style={{ backgroundColor: doctor?.color || '#E0E0E0' }}
            title="자동 (의사 색상)"
          />
          {GOOGLE_COLORS.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedColor(c.hex)}
              className={`w-7 h-7 rounded-full border-2 ${selectedColor === c.hex ? 'border-gray-700 ring-2 ring-gray-400' : 'border-gray-300'}`}
              style={{ backgroundColor: c.hex }}
              title={c.name}
            />
          ))}
        </div>
      </div>

      {/* Info */}
      <div className="bg-blue-50 rounded-lg p-4 mb-6 text-sm">
        <p className="font-medium text-blue-900 mb-2">구글 캘린더 내보내기 안내</p>
        <ul className="text-blue-700 space-y-1 list-disc list-inside">
          <li>다운로드한 .ics 파일을 구글 캘린더에서 가져오기하세요</li>
          <li>캘린더 <strong>"24시 열린의원 근무"</strong>에 추가됩니다</li>
          <li>풀근무: "{state.branchName}" / 파트: "{state.branchName}1(시작-종료)"</li>
        </ul>
      </div>

      {/* Event preview */}
      {doctor && events.length > 0 ? (
        <>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
            <div className="bg-gray-50 px-4 py-3 border-b flex justify-between items-center">
              <h3 className="font-bold text-sm">
                {doctor.name} - 내보낼 일정 ({events.length}건)
              </h3>
              <button
                onClick={handleExport}
                className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                .ics 다운로드
              </button>
            </div>
            <div className="divide-y">
              {events.map((event, idx) => {
                const dateObj = new Date(event.date + 'T00:00:00');
                const dayName = dayNames[dateObj.getDay()];
                const dateLabel = `${dateObj.getMonth() + 1}/${dateObj.getDate()} (${dayName})`;
                return (
                  <div key={idx} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50">
                    <div>
                      <span className={`text-sm font-medium ${
                        dateObj.getDay() === 0 ? 'text-red-500' : dateObj.getDay() === 6 ? 'text-blue-500' : ''
                      }`}>
                        {dateLabel}
                      </span>
                      <span className="text-sm text-gray-500 ml-3">
                        {pad(event.startHour)}:00 - {event.endHour === 24 ? '24:00' : `${pad(event.endHour)}:00`}
                      </span>
                    </div>
                    <span className="text-sm font-medium bg-gray-100 px-3 py-1 rounded-full">
                      {event.title}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            onClick={handleExport}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium text-lg hover:bg-blue-700 transition-colors"
          >
            .ics 파일 다운로드 ({events.length}개 일정)
          </button>
        </>
      ) : (
        <p className="text-center text-gray-500 mt-8">
          {doctor ? '이번 달 등록된 근무가 없습니다.' : '의사를 선택해주세요.'}
        </p>
      )}
    </div>
  );
}
