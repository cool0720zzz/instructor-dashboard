import React, { useState, useEffect } from 'react';
import TitleBar from './components/TitleBar';
import InstructorCard from './components/InstructorCard';
import UiSettingsModal from './components/UiSettingsModal';
import SeoPanel from './components/SeoPanel';
import { useInstructors } from './hooks/useInstructors';
import { useAlerts } from './hooks/useAlerts';

function getRoute() {
  const hash = window.location.hash.replace('#', '');
  if (hash === '/settings') return { page: 'settings' };
  const seoMatch = hash.match(/^\/seo\/(\d+)(?:\/(\d+))?$/);
  if (seoMatch) return { page: 'seo', instructorId: parseInt(seoMatch[1], 10), seoResultId: seoMatch[2] ? parseInt(seoMatch[2], 10) : null };
  return { page: 'dashboard' };
}

export default function App() {
  const route = getRoute();
  if (route.page === 'settings') return <SettingsApp />;
  if (route.page === 'seo') return <SeoFloatingApp instructorId={route.instructorId} seoResultId={route.seoResultId} />;
  return <DashboardApp />;
}

// ═══ SEO Floating Window ═══
function SeoFloatingApp({ instructorId, seoResultId }) {
  return (
    <div className="h-screen bg-transparent overflow-auto">
      <div className="bg-gray-800/95 border border-gray-700/60 rounded-lg overflow-hidden shadow-2xl">
        <SeoPanel instructorId={instructorId} seoResultId={seoResultId} />
      </div>
    </div>
  );
}

// ═══ Settings Window ═══
function SettingsApp() {
  const [opacity, setOpacity] = useState(1.0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        if (window.electronAPI) {
          const s = await window.electronAPI.getUiSettings();
          setOpacity(s.opacity ?? 1.0);
        }
      } catch {}
      setLoaded(true);
    }
    load();
  }, []);

  const handleOpacityChange = async (val) => {
    setOpacity(val);
    if (window.electronAPI) await window.electronAPI.setOpacity(val);
  };

  const handleClose = () => {
    if (window.electronAPI?.closeSettingsWindow) window.electronAPI.closeSettingsWindow();
  };

  if (!loaded) {
    return <div className="h-screen bg-gray-800 flex items-center justify-center">
      <span className="text-gray-400 text-sm">로딩 중...</span>
    </div>;
  }

  return (
    <div className="h-screen bg-gray-800">
      <UiSettingsModal onClose={handleClose} opacity={opacity} onOpacityChange={handleOpacityChange} />
    </div>
  );
}

// ═══ Dashboard (Main Window) ═══
function DashboardApp() {
  const [licensed, setLicensed] = useState(false);
  const [checkingLicense, setCheckingLicense] = useState(true);
  const [opacity, setOpacity] = useState(1.0);
  const [layout, setLayout] = useState('horizontal');

  const { instructors, loading, refresh } = useInstructors(licensed);
  const { alerts } = useAlerts(instructors);

  useEffect(() => {
    async function init() {
      try {
        if (window.electronAPI) {
          const s = await window.electronAPI.getUiSettings();
          if (s.licenseKey) setLicensed(true);
          setOpacity(s.opacity ?? 1.0);
        } else {
          setLicensed(true);
        }
      } catch {}
      finally { setCheckingLicense(false); }
    }
    init();
  }, []);

  // Listen for license activation from settings window
  useEffect(() => {
    if (window.electronAPI?.onLicenseActivated) {
      const unsub = window.electronAPI.onLicenseActivated(() => {
        setLicensed(true);
      });
      return unsub;
    }
  }, []);

  useEffect(() => {
    if (window.electronAPI?.onLayoutChange) {
      const unsub = window.electronAPI.onLayoutChange((l) => {
        setLayout(l);
      });
      return unsub;
    }
  }, []);

  const handleOpacityChange = async (val) => {
    setOpacity(val);
    if (window.electronAPI) await window.electronAPI.setOpacity(val);
  };

  const handleSettingsClick = () => {
    if (window.electronAPI?.openSettingsWindow) window.electronAPI.openSettingsWindow();
  };

  if (checkingLicense) {
    return <div className="flex items-center justify-center h-screen bg-gray-900">
      <div className="text-gray-400 text-sm">로딩 중...</div>
    </div>;
  }

  // No license — show empty state with settings prompt
  if (!licensed) {
    return (
      <div className="flex flex-col h-screen overflow-hidden bg-gray-900">
        <TitleBar
          opacity={opacity}
          onOpacityChange={handleOpacityChange}
          onRefresh={() => {}}
          onSettingsClick={handleSettingsClick}
          alertCount={0}
          layout={layout}
          onLayoutChange={setLayout}
        />
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="text-gray-500 text-sm">설정에서 라이선스 키를 입력해주세요</div>
          <button
            onClick={handleSettingsClick}
            className="p-3 rounded-full bg-gray-800 hover:bg-gray-700 transition-colors group"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                 className="text-gray-500 group-hover:text-blue-400 transition-colors">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  const containerClasses =
    layout === 'vertical'   ? 'flex flex-col gap-3'
    : layout === 'compact'  ? 'flex flex-row items-center gap-2 flex-nowrap'
    : 'flex flex-row items-start gap-3 flex-nowrap';

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-900">
      <TitleBar
        opacity={opacity}
        onOpacityChange={handleOpacityChange}
        onRefresh={refresh}
        onSettingsClick={handleSettingsClick}
        alertCount={alerts.length}
        layout={layout}
        onLayoutChange={setLayout}
      />

      <div className="flex-1 overflow-auto px-3 pb-3">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-400 text-sm">데이터 로딩 중...</div>
          </div>
        ) : instructors.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-500 text-sm">등록된 강사가 없습니다</div>
          </div>
        ) : (
          <div className={`py-1 ${containerClasses}`}>
            {instructors.map((inst) => (
              <InstructorCard
                key={inst.id}
                instructor={inst}
                layout={layout}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
