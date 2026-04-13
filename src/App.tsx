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

function CloudSyncButton() {
  const {
    isGoogleSignedIn, googleSignIn, googleSignOut,
    saveToCloud, loadFromCloud, cloudSyncStatus,
  } = useAppStore();
  const [showMenu, setShowMenu] = useState(false);

  if (!isGoogleSignedIn) {
    return (
      <button
        onClick={googleSignIn}
        className="text-[10px] sm:text-xs bg-blue-600 text-white px-2 py-1 rounded active:bg-blue-700"
      >
        Google 로그인
      </button>
    );
  }

  const isBusy = cloudSyncStatus === 'saving' || cloudSyncStatus === 'loading';

  return (
    <div className="flex items-center gap-1.5">
      {/* Status indicator */}
      {cloudSyncStatus !== 'idle' && (
        <span className={`text-[10px] ${
          cloudSyncStatus === 'success' ? 'text-green-400'
          : cloudSyncStatus === 'error' ? 'text-red-400'
          : 'text-gray-400'
        }`}>
          {cloudSyncStatus === 'saving' ? '저장중...'
            : cloudSyncStatus === 'loading' ? '불러오는중...'
            : cloudSyncStatus === 'success' ? '저장됨'
            : '오류'}
        </span>
      )}

      {/* Manual save button */}
      <button
        onClick={saveToCloud}
        disabled={isBusy}
        className={`text-[10px] sm:text-xs px-2.5 py-1 rounded font-medium ${
          isBusy ? 'bg-gray-600 text-gray-400' : 'bg-green-600 text-white active:bg-green-700'
        }`}
      >
        저장
      </button>

      {/* Menu */}
      <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="text-[10px] sm:text-xs px-1.5 py-1 rounded bg-gray-700 text-gray-300 active:bg-gray-600"
        >
          ⋮
        </button>
        {showMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
            <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border z-50 py-1 min-w-[140px]">
              <button
                onClick={() => { loadFromCloud(); setShowMenu(false); }}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 active:bg-gray-100"
              >
                Drive에서 불러오기
              </button>
              <hr className="my-1" />
              <button
                onClick={() => { googleSignOut(); setShowMenu(false); }}
                className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-gray-50 active:bg-gray-100"
              >
                로그아웃
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function App() {
  const { state, isGoogleSignedIn, googleSignIn } = useAppStore();
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
          <div className="flex items-center gap-2">
            <CloudSyncButton />
            <span className="text-xs sm:text-sm text-gray-400">{state.branchName}점</span>
          </div>
        </div>
      </header>

      {/* Sign-in prompt when not logged in */}
      {!isGoogleSignedIn && (
        <div className="bg-yellow-50 border-b border-yellow-200">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-sm text-yellow-800">
              Google 로그인 후 저장된 데이터를 불러올 수 있습니다.
            </p>
            <button
              onClick={googleSignIn}
              className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm font-medium whitespace-nowrap active:bg-blue-700"
            >
              로그인
            </button>
          </div>
        </div>
      )}

      {/* Tab navigation */}
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
          <ScheduleCompare year={year} month={month} onMonthChange={handleMonthChange} />
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
