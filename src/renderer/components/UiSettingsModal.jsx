import React, { useState, useEffect } from 'react';

export default function UiSettingsModal({ onClose, opacity, onOpacityChange }) {
  const [localOpacity, setLocalOpacity] = useState(opacity);
  const [snapPreset, setSnapPreset] = useState('top');
  const [autoStart, setAutoStart] = useState(false);
  const [licenseKey, setLicenseKey] = useState('');
  const [plan, setPlan] = useState('');
  const [saving, setSaving] = useState(false);

  // License input state
  const [licenseInput, setLicenseInput] = useState('');
  const [licenseLoading, setLicenseLoading] = useState(false);
  const [licenseError, setLicenseError] = useState('');
  const [showKeyInput, setShowKeyInput] = useState(false);

  // Version & update state
  const [appVersion, setAppVersion] = useState('');
  // updateState: idle | checking | available | downloading | downloaded | error
  const [updateState, setUpdateState] = useState('idle');
  const [updateError, setUpdateError] = useState('');

  useEffect(() => {
    async function loadSettings() {
      try {
        if (window.electronAPI) {
          const settings = await window.electronAPI.getUiSettings();
          setLocalOpacity(settings.opacity ?? 1.0);
          setSnapPreset(settings.snapPreset || 'top');
          setAutoStart(settings.autoStart || false);
          setLicenseKey(settings.licenseKey || '');
          setPlan(settings.plan || '');
          if (window.electronAPI.getAppVersion) {
            const ver = await window.electronAPI.getAppVersion();
            setAppVersion(ver || '');
          }
          if (window.electronAPI.getUpdateStatus) {
            const status = await window.electronAPI.getUpdateStatus();
            setUpdateState(status.state || 'idle');
            setUpdateError(status.error || '');
          }
        }
      } catch { /* defaults */ }
    }
    loadSettings();
  }, []);

  // Listen for update status changes in real-time
  useEffect(() => {
    if (!window.electronAPI?.onUpdateStatusChanged) return;
    const unsub = window.electronAPI.onUpdateStatusChanged(({ state, error }) => {
      setUpdateState(state || 'idle');
      setUpdateError(error || '');
    });
    return () => unsub?.();
  }, []);

  const handleOpacityPreview = (val) => {
    setLocalOpacity(val);
    if (onOpacityChange) onOpacityChange(val);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (window.electronAPI) {
        await window.electronAPI.setUiSettings({
          opacity: localOpacity,
          snapPreset,
          autoStart,
        });
      }
      onClose();
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleLicenseActivate = async () => {
    if (!licenseInput.trim()) {
      setLicenseError('라이선스 키를 입력해 주세요');
      return;
    }
    setLicenseLoading(true);
    setLicenseError('');
    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.validateLicense(licenseInput.trim());
        if (result.valid) {
          setLicenseKey(licenseInput.trim());
          setPlan(result.plan || '');
          setLicenseInput('');
          setShowKeyInput(false);
          setLicenseError('');
        } else {
          setLicenseError(result.error || '유효하지 않은 라이선스 키입니다');
        }
      }
    } catch {
      setLicenseError('서버 연결에 실패했습니다');
    } finally {
      setLicenseLoading(false);
    }
  };

  const handleCheckUpdate = async () => {
    if (!window.electronAPI?.checkForUpdate) return;
    setUpdateState('checking');
    setUpdateError('');
    await window.electronAPI.checkForUpdate();
    // State will be updated via onUpdateStatusChanged listener
  };

  const handleInstallUpdate = () => {
    if (window.electronAPI?.installUpdate) {
      window.electronAPI.installUpdate();
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const SNAP_OPTIONS = [
    { value: 'top', label: '상단' },
    { value: 'right', label: '우측' },
    { value: 'bottom', label: '하단' },
  ];

  const isLicensed = !!licenseKey;

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-700/50 shrink-0" style={{ WebkitAppRegion: 'drag' }}>
        <h2 className="text-white font-semibold text-sm">앱 설정</h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors p-0.5 rounded hover:bg-gray-700/50"
          style={{ WebkitAppRegion: 'no-drag' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className="px-5 py-4 space-y-4 flex-1 overflow-auto">

        {/* ─── License Section ─── */}
        <div className="space-y-3">
          <label className="text-xs text-gray-400 font-medium">라이선스</label>
          <div className="bg-gray-700/30 rounded-lg p-3 space-y-2">
            {isLicensed && !showKeyInput ? (
              // Licensed state
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-gray-300 font-mono text-xs">{maskLicense(licenseKey)}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-900/50 text-green-400 font-medium">인증됨</span>
                </div>
                <button
                  onClick={() => { setShowKeyInput(true); setLicenseInput(''); setLicenseError(''); }}
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  키 변경
                </button>
              </div>
            ) : (
              // Input state
              <>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={licenseInput}
                    onChange={(e) => setLicenseInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleLicenseActivate(); }}
                    placeholder="XXXX-XXXX-XXXX-XXXX"
                    className="flex-1 px-3 py-2 bg-gray-900/80 border border-gray-600/50 rounded-lg text-white text-sm
                               font-mono tracking-wider placeholder-gray-600
                               focus:outline-none focus:border-blue-500 transition-colors"
                    disabled={licenseLoading}
                    autoFocus
                  />
                  <button
                    onClick={handleLicenseActivate}
                    disabled={licenseLoading}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800
                               text-white text-sm font-medium rounded-lg transition-colors shrink-0"
                  >
                    {licenseLoading ? '...' : '인증'}
                  </button>
                </div>
                {isLicensed && showKeyInput && (
                  <button
                    onClick={() => { setShowKeyInput(false); setLicenseError(''); }}
                    className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    취소
                  </button>
                )}
                {licenseError && (
                  <div className="text-xs text-red-400">{licenseError}</div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="border-t border-gray-700/50" />

        {/* ─── Opacity ─── */}
        <div className="space-y-2">
          <label className="text-xs text-gray-400 font-medium">투명도</label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="0.2"
              max="1.0"
              step="0.01"
              value={localOpacity}
              onChange={(e) => handleOpacityPreview(parseFloat(e.target.value))}
              className="flex-1 h-1 cursor-pointer"
            />
            <span className="text-white text-sm font-mono w-10 text-right">
              {Math.round(localOpacity * 100)}%
            </span>
          </div>
        </div>

        {/* ─── Snap ─── */}
        <div className="space-y-2">
          <label className="text-xs text-gray-400 font-medium">기본 스냅</label>
          <select
            value={snapPreset}
            onChange={(e) => setSnapPreset(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700/80 border border-gray-600/50 rounded-lg text-white text-sm
                       focus:outline-none focus:border-blue-500 transition-colors"
          >
            {SNAP_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* ─── Auto Start ─── */}
        <div className="flex items-center justify-between">
          <label className="text-xs text-gray-400 font-medium">시작프로그램 자동실행</label>
          <button
            onClick={() => setAutoStart(!autoStart)}
            className={`w-11 h-6 rounded-full transition-colors relative shrink-0 overflow-hidden ${
              autoStart ? 'bg-blue-600' : 'bg-gray-600'
            }`}
          >
            <span
              className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                autoStart ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <div className="border-t border-gray-700/50" />

        {/* ─── Plan ─── */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">플랜</span>
          <span className="text-xs text-gray-300">무료</span>
        </div>

        {/* ─── Version & Update ─── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">버전</span>
            <span className="text-xs text-gray-400 font-mono">v{appVersion || '...'}</span>
          </div>

          <div className="bg-gray-700/30 rounded-lg p-3">
            {updateState === 'downloaded' ? (
              /* 업데이트 다운로드 완료 → 설치 버튼 */
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-xs text-green-400">새 버전이 준비되었습니다</span>
                </div>
                <button
                  onClick={handleInstallUpdate}
                  className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-medium rounded-lg transition-colors"
                >
                  지금 업데이트
                </button>
              </div>
            ) : updateState === 'checking' ? (
              /* 확인 중 */
              <div className="flex items-center gap-2">
                <svg className="animate-spin w-3 h-3 text-blue-400" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                  <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
                <span className="text-xs text-blue-400">업데이트 확인 중...</span>
              </div>
            ) : updateState === 'available' || updateState === 'downloading' ? (
              /* 다운로드 중 */
              <div className="flex items-center gap-2">
                <svg className="animate-spin w-3 h-3 text-yellow-400" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                  <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
                <span className="text-xs text-yellow-400">업데이트 다운로드 중...</span>
              </div>
            ) : updateState === 'error' ? (
              /* 오류 */
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-400" />
                  <span className="text-xs text-red-400">업데이트 확인 실패</span>
                </div>
                {updateError && <p className="text-[10px] text-gray-500">{updateError}</p>}
                <button
                  onClick={handleCheckUpdate}
                  className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 text-white text-xs font-medium rounded-lg transition-colors"
                >
                  다시 시도
                </button>
              </div>
            ) : (
              /* idle — 최신 버전 or 체크 전 */
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-gray-500" />
                  <span className="text-xs text-gray-400">현재 최신 버전입니다</span>
                </div>
                <button
                  onClick={handleCheckUpdate}
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  업데이트 확인
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ─── Admin Page Link ─── */}
        <div className="space-y-2">
          <label className="text-xs text-gray-400 font-medium">강사 관리</label>
          <p className="text-gray-500 text-xs leading-relaxed">
            강사 추가/수정은 관리자 페이지에서 가능합니다.
          </p>
          <button
            onClick={() => {
              if (window.electronAPI?.openExternal) {
                window.electronAPI.openExternal('https://admin-five-gray.vercel.app');
              } else {
                window.open('https://admin-five-gray.vercel.app', '_blank');
              }
            }}
            className="w-full px-3 py-2 bg-gray-700/60 hover:bg-gray-600/60 text-gray-300 hover:text-white text-xs font-medium rounded-lg transition-colors border border-gray-600/50"
          >
            관리자 페이지 열기 →
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-gray-700/50 flex justify-end shrink-0">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800
                     text-white text-sm font-medium rounded-lg transition-colors"
        >
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>
    </div>
  );
}

function maskLicense(key) {
  if (!key || key.length < 8) return key;
  const parts = key.split('-');
  if (parts.length >= 3) {
    return `${parts[0]}-${'X'.repeat(parts[1]?.length || 4)}-${parts.slice(2).map(() => 'XXXX').join('-')}`;
  }
  return key.slice(0, 4) + '-XXXX-XXXX';
}
