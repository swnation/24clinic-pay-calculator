import { useState } from 'react';
import type { RatesBySlot } from '../types';
import { RATE_LABELS, DOCTOR_COLORS } from '../types';
import { useAppStore } from '../store';
import { isKoreanHoliday, getHolidayName } from '../utils/holidays';

export default function Settings() {
  const {
    state, addDoctor, updateDoctor, removeDoctor,
    setDefaultRates, toggleHoliday, setBranchName,
  } = useAppStore();

  const [newDoctorName, setNewDoctorName] = useState('');
  const [editingDoctor, setEditingDoctor] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [holidayInput, setHolidayInput] = useState('');
  const [holidayYear, setHolidayYear] = useState(new Date().getFullYear());

  const handleAddDoctor = () => {
    const name = newDoctorName.trim();
    if (!name) return;
    addDoctor(name);
    setNewDoctorName('');
  };

  const startEditing = (id: string) => {
    const doc = state.doctors.find(d => d.id === id);
    if (!doc) return;
    setEditingDoctor(id);
    setEditName(doc.name);
    setEditColor(doc.color);
  };

  const saveEditing = () => {
    if (!editingDoctor) return;
    updateDoctor({ id: editingDoctor, name: editName.trim(), color: editColor });
    setEditingDoctor(null);
  };

  const handleRateChange = (key: keyof RatesBySlot, value: string) => {
    const num = Number(value);
    if (isNaN(num) || num < 0) return;
    setDefaultRates({ ...state.defaultRates, [key]: num });
  };

  const addCustomHoliday = () => {
    const trimmed = holidayInput.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      if (!state.customHolidays.includes(trimmed)) {
        toggleHoliday(trimmed);
      }
      setHolidayInput('');
    }
  };

  // Show holidays for the selected year
  const yearHolidays = state.customHolidays
    .filter(d => d.startsWith(`${holidayYear}-`))
    .sort();

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Branch name */}
      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="font-bold text-lg mb-4">지점 설정</h3>
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">지점명</label>
          <input
            type="text"
            value={state.branchName}
            onChange={e => setBranchName(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm w-40"
          />
          <span className="text-xs text-gray-500">
            (구글 캘린더 제목에 사용: "{state.branchName}", "{state.branchName}1(09-13)")
          </span>
        </div>
      </section>

      {/* Doctor management */}
      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="font-bold text-lg mb-4">의사 관리</h3>

        <div className="space-y-2 mb-4">
          {state.doctors.map(d => (
            <div key={d.id} className="flex items-center gap-3 py-2 border-b border-gray-100">
              {editingDoctor === d.id ? (
                <>
                  <input
                    type="color"
                    value={editColor}
                    onChange={e => setEditColor(e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="border rounded px-2 py-1 text-sm flex-1"
                    onKeyDown={e => e.key === 'Enter' && saveEditing()}
                  />
                  {/* Quick color palette */}
                  <div className="flex gap-1">
                    {DOCTOR_COLORS.map(c => (
                      <button
                        key={c}
                        className={`w-5 h-5 rounded-full border ${editColor === c ? 'border-gray-800 ring-2 ring-gray-400' : 'border-gray-300'}`}
                        style={{ backgroundColor: c }}
                        onClick={() => setEditColor(c)}
                      />
                    ))}
                  </div>
                  <button onClick={saveEditing} className="text-sm text-blue-600 font-medium">저장</button>
                  <button onClick={() => setEditingDoctor(null)} className="text-sm text-gray-500">취소</button>
                </>
              ) : (
                <>
                  <div className="w-6 h-6 rounded-full border border-gray-300" style={{ backgroundColor: d.color }} />
                  <span className="text-sm font-medium flex-1">{d.name}</span>
                  <button onClick={() => startEditing(d.id)} className="text-xs text-blue-600 hover:underline">수정</button>
                  <button
                    onClick={() => {
                      if (confirm(`${d.name} 의사를 삭제하시겠습니까? 관련 근무 기록도 함께 삭제됩니다.`)) {
                        removeDoctor(d.id);
                      }
                    }}
                    className="text-xs text-red-500 hover:underline"
                  >
                    삭제
                  </button>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="새 의사 이름"
            value={newDoctorName}
            onChange={e => setNewDoctorName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddDoctor()}
            className="flex-1 border rounded-lg px-3 py-2 text-sm"
          />
          <button
            onClick={handleAddDoctor}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            추가
          </button>
        </div>
      </section>

      {/* Default rates */}
      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="font-bold text-lg mb-4">기본 시급 설정</h3>
        <p className="text-sm text-gray-500 mb-4">
          의사별 월간 시급이 설정되지 않은 경우 이 기본급이 적용됩니다. (단위: 만원/시간)
        </p>
        <div className="space-y-3">
          {(Object.keys(RATE_LABELS) as (keyof RatesBySlot)[]).map(key => (
            <div key={key} className="flex items-center gap-3">
              <label className="text-sm text-gray-700 w-44">{RATE_LABELS[key]}</label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={state.defaultRates[key]}
                onChange={e => handleRateChange(key, e.target.value)}
                className="w-24 border rounded px-2 py-1 text-sm text-right"
              />
              <span className="text-xs text-gray-400">만원/h</span>
            </div>
          ))}
        </div>
      </section>

      {/* Holiday management */}
      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="font-bold text-lg mb-4">공휴일 관리</h3>

        <div className="flex items-center gap-3 mb-4">
          <label className="text-sm font-medium">연도</label>
          <select
            value={holidayYear}
            onChange={e => setHolidayYear(Number(e.target.value))}
            className="border rounded px-2 py-1 text-sm"
          >
            {[2025, 2026, 2027].map(y => (
              <option key={y} value={y}>{y}년</option>
            ))}
          </select>
        </div>

        <div className="space-y-1 mb-4 max-h-60 overflow-y-auto">
          {yearHolidays.map(dateStr => {
            const dateObj = new Date(dateStr + 'T00:00:00');
            const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
            const name = getHolidayName(dateStr);
            const isBuiltIn = isKoreanHoliday(dateStr);
            return (
              <div key={dateStr} className="flex items-center justify-between py-1.5 px-3 rounded hover:bg-gray-50">
                <div className="flex items-center gap-2">
                  <span className={`text-sm ${dateObj.getDay() === 0 ? 'text-red-500' : dateObj.getDay() === 6 ? 'text-blue-500' : ''}`}>
                    {dateStr} ({dayNames[dateObj.getDay()]})
                  </span>
                  {name && <span className="text-xs text-gray-500">{name}</span>}
                  {isBuiltIn && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 rounded">기본</span>}
                </div>
                {!isBuiltIn && (
                  <button
                    onClick={() => toggleHoliday(dateStr)}
                    className="text-xs text-red-500 hover:underline"
                  >
                    삭제
                  </button>
                )}
              </div>
            );
          })}
          {yearHolidays.length === 0 && (
            <p className="text-sm text-gray-500 py-2">등록된 공휴일이 없습니다.</p>
          )}
        </div>

        <div className="flex gap-2">
          <input
            type="date"
            value={holidayInput}
            onChange={e => setHolidayInput(e.target.value)}
            className="flex-1 border rounded-lg px-3 py-2 text-sm"
          />
          <button
            onClick={addCustomHoliday}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            추가
          </button>
        </div>
      </section>

      {/* Data management */}
      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="font-bold text-lg mb-4">데이터 관리</h3>
        <div className="flex gap-3">
          <button
            onClick={() => {
              const data = JSON.stringify(
                { doctors: state.doctors, shifts: state.shifts, defaultRates: state.defaultRates, doctorMonthlyRates: state.doctorMonthlyRates, customHolidays: state.customHolidays, branchName: state.branchName },
                null, 2
              );
              const blob = new Blob([data], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `24clinic-data-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-200"
          >
            데이터 내보내기 (JSON)
          </button>
          <label className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-200 cursor-pointer">
            데이터 가져오기
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                  try {
                    const data = JSON.parse(reader.result as string);
                    localStorage.setItem('24clinic-pay-calculator-state', JSON.stringify(data));
                    window.location.reload();
                  } catch {
                    alert('잘못된 파일 형식입니다.');
                  }
                };
                reader.readAsText(file);
              }}
            />
          </label>
          <button
            onClick={() => {
              if (confirm('모든 데이터를 초기화하시겠습니까?')) {
                localStorage.removeItem('24clinic-pay-calculator-state');
                window.location.reload();
              }
            }}
            className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm hover:bg-red-100"
          >
            초기화
          </button>
        </div>
      </section>
    </div>
  );
}
