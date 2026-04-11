import { useState } from 'react';
import type { Tab } from './types';
import Calendar from './components/Calendar';
import WageSummary from './components/WageSummary';
import CalendarExport from './components/CalendarExport';
import ScheduleCompare from './components/ScheduleCompare';
import Settings from './components/Settings';
import { useAppStore } from './store';

const TABS: { key: Tab; label: string }[] = [
  { key: 'schedule', label: '스케줄' },
  { key: 'wage', label: '급여계산' },
  { key: 'compare', label: '비교' },
  { key: 'export', label: '캘린더' },
  { key: 'settings', label: '설정' },
];

function App() {
  const { state } = useAppStore();
  const now = new Date();
  const [tab, setTab] = useState<Tab>('schedule');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const handleMonthChange = (y: number, m: number) => {
    setYear(y);
    setMonth(m);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gray-900 text-white safe-top">
        <div className="max-w-6xl mx-auto px-4 py-2.5 sm:py-3 flex items-center justify-between">
          <h1 className="text-sm sm:text-lg font-bold">24시 열린의원</h1>
          <span className="text-xs sm:text-sm text-gray-400">{state.branchName}점</span>
        </div>
      </header>

      {/* Tab navigation - fixed at top on mobile */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto flex">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 sm:flex-none px-3 sm:px-5 py-3 text-xs sm:text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                tab === t.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-400 active:text-gray-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-4 sm:py-6 pb-8">
        {tab === 'schedule' && (
          <Calendar year={year} month={month} onMonthChange={handleMonthChange} />
        )}
        {tab === 'wage' && (
          <WageSummary year={year} month={month} onMonthChange={handleMonthChange} />
        )}
        {tab === 'compare' && (
          <ScheduleCompare year={year} month={month} />
        )}
        {tab === 'export' && (
          <CalendarExport year={year} month={month} onMonthChange={handleMonthChange} />
        )}
        {tab === 'settings' && <Settings />}
      </main>
    </div>
  );
}

export default App;
