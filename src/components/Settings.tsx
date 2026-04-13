import { useState, useMemo } from 'react';
import type { RatesBySlot, DayType, TimeSlot, SpecialRatePeriod } from '../types';
import { DAY_TYPE_LABELS, rateKey, DOCTOR_COLORS } from '../types';
import { useAppStore } from '../store';
import { isKoreanHoliday, getHolidayName, getKoreanHolidaysForYear } from '../utils/holidays';

const DAY_TYPES: DayType[] = ['weekday', 'saturday', 'sunday', 'holiday'];
const TIME_SLOTS: TimeSlot[] = ['morning', 'afternoon', 'evening'];

function SpecialPeriodForm({ onAdd }: { onAdd: (p: Omit<SpecialRatePeriod, 'id'>) => void }) {
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [morning, setMorning] = useState('');
  const [afternoon, setAfternoon] = useState('');
  const [evening, setEvening] = useState('');

  const handleAdd = () => {
    if (!name || !startDate || !endDate || !morning || !afternoon || !evening || startDate > endDate) return;
    onAdd({
      name, startDate, endDate,
      morning: Number(morning),
      afternoon: Number(afternoon),
      evening: Number(evening),
    });
    setName(''); setStartDate(''); setEndDate('');
    setMorning(''); setAfternoon(''); setEvening('');
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input type="text" placeholder="이름 (예: 설 연휴)" value={name} onChange={e => setName(e.target.value)}
          className="flex-1 border rounded px-2 py-1.5 text-sm" />
      </div>
      <div className="flex gap-2">
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
          className="flex-1 border rounded px-2 py-1.5 text-sm" />
        <span className="self-center text-gray-400 text-sm">~</span>
        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
          className="flex-1 border rounded px-2 py-1.5 text-sm" />
      </div>
      <div className="flex gap-2 items-center">
        <div className="flex-1">
          <label className="text-[10px] text-gray-400">오전</label>
          <input type="number" min="0" step="0.5" placeholder="만원" value={morning} onChange={e => setMorning(e.target.value)}
            className="w-full border rounded px-2 py-1.5 text-sm text-center" />
        </div>
        <div className="flex-1">
          <label className="text-[10px] text-gray-400">오후</label>
          <input type="number" min="0" step="0.5" placeholder="만원" value={afternoon} onChange={e => setAfternoon(e.target.value)}
            className="w-full border rounded px-2 py-1.5 text-sm text-center" />
        </div>
        <div className="flex-1">
          <label className="text-[10px] text-gray-400">저녁</label>
          <input type="number" min="0" step="0.5" placeholder="만원" value={evening} onChange={e => setEvening(e.target.value)}
            className="w-full border rounded px-2 py-1.5 text-sm text-center" />
        </div>
      </div>
      <button onClick={handleAdd}
        className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
        추가
      </button>
    </div>
  );
}

export default function Settings() {
  const {
    state, addDoctor, updateDoctor, removeDoctor,
    setDefaultRates, addSpecialRatePeriod, removeSpecialRatePeriod,
    toggleHoliday, setBranchName,
    googleClientId, setGoogleClientId,
    importData, resetData,
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

  const holidayList = useMemo(() => {
    const builtInDates = getKoreanHolidaysForYear(holidayYear);
    const customDates = state.customHolidays.filter(d => d.startsWith(`${holidayYear}-`) && !builtInDates.includes(d));
    return [...new Set([...builtInDates, ...customDates])].sort();
  }, [holidayYear, state.customHolidays]);

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
                  <div className="flex gap-1 flex-wrap">
                    {DOCTOR_COLORS.map(c => (
                      <button
                        key={c}
                        className={`w-5 h-5 rounded-full border ${editColor === c ? 'border-gray-800 ring-2 ring-gray-400' : 'border-gray-300'}`}
                        style={{ backgroundColor: c }}
                        onClick={() => setEditColor(c)}
                      />
                    ))}
                  </div>
                  {/* EyeDropper - pick color from screen */}
                  {'EyeDropper' in window && (
                    <button
                      onClick={async () => {
                        try {
                          // @ts-expect-error EyeDropper API
                          const dropper = new window.EyeDropper();
                          const result = await dropper.open();
                          setEditColor(result.sRGBHex);
                        } catch { /* cancelled */ }
                      }}
                      className="text-xs bg-gray-100 px-2 py-1 rounded active:bg-gray-200"
                      title="화면에서 색상 추출"
                    >
                      스포이드
                    </button>
                  )}
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

      {/* Default rates - 4x3 grid */}
      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="font-bold text-lg mb-4">기본 시급 설정</h3>
        <p className="text-sm text-gray-500 mb-4">
          의사별 월간 시급이 설정되지 않은 경우 이 기본급이 적용됩니다. (단위: 만원/시간)
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 pr-2"></th>
                {TIME_SLOTS.map(ts => (
                  <th key={ts} className="text-center py-2 px-2 text-gray-500 font-medium">
                    {ts === 'morning' ? '오전' : ts === 'afternoon' ? '오후' : '저녁'}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAY_TYPES.map(dt => (
                <tr key={dt} className="border-b last:border-b-0">
                  <td className="py-2 pr-2 font-medium text-gray-700 whitespace-nowrap">
                    {DAY_TYPE_LABELS[dt]}
                  </td>
                  {TIME_SLOTS.map(ts => {
                    const key = rateKey(dt, ts);
                    return (
                      <td key={ts} className="py-1.5 px-1">
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={state.defaultRates[key]}
                          onChange={e => handleRateChange(key, e.target.value)}
                          className="w-full border rounded px-2 py-1.5 text-sm text-center min-w-[60px]"
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Special rate periods (설/추석 연휴 등) */}
      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="font-bold text-lg mb-4">특별 시급 기간</h3>
        <p className="text-sm text-gray-500 mb-4">
          설/추석 연휴 등 기본 시급과 다른 시급이 적용되는 기간을 설정합니다.
          이 기간에는 요일과 관계없이 여기에 설정된 시급이 우선 적용됩니다.
        </p>

        {state.specialRatePeriods.length > 0 && (
          <div className="space-y-2 mb-4">
            {state.specialRatePeriods.map(p => (
              <div key={p.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                <div>
                  <span className="text-sm font-medium">{p.name}</span>
                  <span className="text-xs text-gray-500 ml-2">{p.startDate} ~ {p.endDate}</span>
                  <div className="text-xs text-gray-400">
                    오전 {p.morning} / 오후 {p.afternoon} / 저녁 {p.evening} 만원
                  </div>
                </div>
                <button
                  onClick={() => removeSpecialRatePeriod(p.id)}
                  className="text-xs text-red-500 hover:underline ml-2"
                >
                  삭제
                </button>
              </div>
            ))}
          </div>
        )}

        <SpecialPeriodForm onAdd={addSpecialRatePeriod} />
      </section>

      {/* Holiday management */}
      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="font-bold text-lg mb-4">공휴일 관리</h3>
        <p className="text-sm text-gray-500 mb-4">
          공휴일을 터치하면 활성/비활성 전환됩니다. 임시공휴일은 아래에서 추가하세요.
        </p>

        <div className="flex items-center gap-3 mb-4">
          <label className="text-sm font-medium">연도</label>
          <select
            value={holidayYear}
            onChange={e => setHolidayYear(Number(e.target.value))}
            className="border rounded px-2 py-1 text-sm"
          >
            {[2024, 2025, 2026, 2027].map(y => (
              <option key={y} value={y}>{y}년</option>
            ))}
          </select>
        </div>

        <div className="space-y-1 mb-4 max-h-72 overflow-y-auto">
          {holidayList.map(dateStr => {
            const dateObj = new Date(dateStr + 'T00:00:00');
            const dayNamesArr = ['일', '월', '화', '수', '목', '금', '토'];
            const name = getHolidayName(dateStr);
            const isBuiltIn = isKoreanHoliday(dateStr);
            const isActive = state.customHolidays.includes(dateStr);

            return (
              <div
                key={dateStr}
                className={`flex items-center justify-between py-2 px-3 rounded cursor-pointer active:bg-gray-100 ${
                  isActive ? 'hover:bg-gray-50' : 'bg-gray-100 opacity-50'
                }`}
                onClick={() => toggleHoliday(dateStr)}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-4 h-4 rounded border-2 flex items-center justify-center text-[10px] ${
                    isActive ? 'border-red-500 bg-red-500 text-white' : 'border-gray-300'
                  }`}>
                    {isActive ? '✓' : ''}
                  </span>
                  <span className={`text-sm ${dateObj.getDay() === 0 ? 'text-red-500' : dateObj.getDay() === 6 ? 'text-blue-500' : ''}`}>
                    {dateStr.slice(5)} ({dayNamesArr[dateObj.getDay()]})
                  </span>
                  {name && <span className="text-xs text-gray-500">{name}</span>}
                  {isBuiltIn && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 rounded">기본</span>}
                  {!isBuiltIn && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 rounded">추가</span>}
                </div>
              </div>
            );
          })}
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

      {/* Google Drive */}
      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="font-bold text-lg mb-4">Google Drive 연동</h3>
        <p className="text-sm text-gray-500 mb-4">
          Google Drive에 데이터를 저장하면 브라우저 데이터가 지워져도 복구할 수 있습니다.
        </p>
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Client ID</label>
          <input
            type="text"
            value={googleClientId}
            onChange={e => setGoogleClientId(e.target.value)}
            placeholder="xxx.apps.googleusercontent.com"
            className={`flex-1 border rounded-lg px-3 py-2 text-xs sm:text-sm ${
              googleClientId.trim() ? 'border-green-400 bg-green-50' : ''
            }`}
          />
        </div>
        {googleClientId.trim() ? (
          <p className="text-xs text-green-600 mt-2">
            Client ID 저장됨. 상단 헤더의 "Google 로그인" 버튼으로 연동하세요.
          </p>
        ) : (
          <p className="text-xs text-gray-400 mt-2">
            Google Cloud Console에서 OAuth 클라이언트 ID를 생성하여 입력하세요.
          </p>
        )}
      </section>

      {/* Data management */}
      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="font-bold text-lg mb-4">데이터 관리</h3>
        <div className="flex gap-3">
          <button
            onClick={() => {
              const data = JSON.stringify(
                { doctors: state.doctors, shifts: state.shifts, defaultRates: state.defaultRates, branchMonthlyRates: state.branchMonthlyRates, specialRatePeriods: state.specialRatePeriods, customHolidays: state.customHolidays, branchName: state.branchName },
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
                    importData(data);
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
                resetData();
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
