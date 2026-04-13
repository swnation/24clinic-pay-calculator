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
    isGoogleSignedIn, googleSignOut,
    saveToCloud, loadFromCloud, cloudSyncStatus,
  } = useAppStore();
  const [showMenu, setShowMenu] = useState(false);

  if (!isGoogleSignedIn) return null;

  const isBusy = cloudSyncStatus === 'saving' || cloudSyncStatus === 'loading';

  return (
    <div className="flex items-center gap-1.5">
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

      <button
        onClick={saveToCloud}
        disabled={isBusy}
        className={`text-[10px] sm:text-xs px-2.5 py-1 rounded font-medium ${
          isBusy ? 'bg-gray-600 text-gray-400' : 'bg-green-600 text-white active:bg-green-700'
        }`}
      >
        저장
      </button>

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

function LoginScreen() {
  const { googleSignIn, cloudSyncStatus } = useAppStore();
  const isLoading = cloudSyncStatus === 'loading';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">24시 열린의원</h1>
            <p className="text-sm text-gray-400 mb-8">급여 계산기</p>

            {isLoading ? (
              <div className="py-4">
                <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-gray-500">데이터 불러오는 중...</p>
              </div>
            ) : (
              <button
                onClick={googleSignIn}
                className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 rounded-lg px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Google 계정으로 로그인
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  const { state, isGoogleSignedIn, cloudSyncStatus } = useAppStore();
  const now = new Date();
  const [tab, setTab] = useState<Tab>('schedule');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const handleMonthChange = (y: number, m: number) => {
    setYear(y);
    setMonth(m);
  };

  // Show login screen if not signed in (allow loading state to show login screen too)
  if (!isGoogleSignedIn && cloudSyncStatus !== 'loading') {
    return <LoginScreen />;
  }

  // Show loading screen while data is being loaded after sign-in
  if (cloudSyncStatus === 'loading') {
    return <LoginScreen />;
  }

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
