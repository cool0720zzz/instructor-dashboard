import React, { useState, useEffect } from 'react';

const SNAP_LAYOUT_MAP = {
  top: 'horizontal',
  right: 'vertical',
  bottom: 'compact',
};

const isVertical = (l) => l === 'vertical';

function formatCollectionTime(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

export default function TitleBar({ opacity, onOpacityChange, onRefresh, onSettingsClick, alertCount, layout, onLayoutChange }) {
  const [collecting, setCollecting] = useState(false);
  const [lastCollection, setLastCollection] = useState('');

  useEffect(() => {
    // Get initial status
    if (window.electronAPI?.getCollectionStatus) {
      window.electronAPI.getCollectionStatus().then((s) => {
        setCollecting(s.collecting);
        if (s.lastCollection) setLastCollection(s.lastCollection);
      });
    }

    // Listen for status updates
    if (window.electronAPI?.onCollectionStatus) {
      const unsub = window.electronAPI.onCollectionStatus((s) => {
        setCollecting(s.collecting);
        if (s.completedAt) setLastCollection(s.completedAt);
      });
      return unsub;
    }
  }, []);

  const handleSnap = async (position) => {
    onLayoutChange(SNAP_LAYOUT_MAP[position]);
    if (window.electronAPI) {
      await window.electronAPI.snapWindow(position);
    }
  };

  const handleRefresh = async () => {
    if (collecting) return;
    setCollecting(true);
    try {
      await onRefresh();
      // Status will be updated via the event listener
    } catch {
      setCollecting(false);
    }
  };

  const activeSnap = Object.entries(SNAP_LAYOUT_MAP).find(([, l]) => l === layout)?.[0] || null;

  const snapButtons = [
    { pos: 'top', label: '상단' },
    { pos: 'right', label: '우측' },
    { pos: 'bottom', label: '하단' },
  ];

  const vertical = isVertical(layout);

  return (
    <div className={`drag-region flex items-center ${vertical ? 'flex-wrap gap-1 px-2 py-1.5' : 'justify-between px-3 py-2'} bg-gray-800/60 border-b border-gray-700/50 select-none shrink-0`}>
      {/* Left: Traffic lights + Title */}
      <div className="flex items-center gap-3">
        <div className="no-drag flex items-center gap-1.5">
          <button
            onClick={() => {
              if (window.electronAPI?.closeWindow) {
                window.electronAPI.closeWindow();
              } else {
                window.close?.();
              }
            }}
            className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-400 transition-colors flex items-center justify-center group/dot"
            title="닫기"
          >
            <span className="opacity-0 group-hover/dot:opacity-100 transition-opacity" style={{ fontSize: '8px', fontWeight: 'bold', color: 'rgba(0,0,0,0.5)', lineHeight: 1 }}>×</span>
          </button>
          <button
            onClick={() => {
              if (window.electronAPI?.minimizeWindow) {
                window.electronAPI.minimizeWindow();
              }
            }}
            className="w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-400 transition-colors flex items-center justify-center group/dot"
            title="최소화"
          >
            <span className="opacity-0 group-hover/dot:opacity-100 transition-opacity" style={{ fontSize: '8px', fontWeight: 'bold', color: 'rgba(0,0,0,0.5)', lineHeight: 1 }}>−</span>
          </button>
          <button
            onClick={() => {
              if (window.electronAPI?.maximizeWindow) {
                window.electronAPI.maximizeWindow();
              }
            }}
            className="w-3 h-3 rounded-full bg-green-500 hover:bg-green-400 transition-colors flex items-center justify-center group/dot"
            title="최대화"
          >
            <span className="opacity-0 group-hover/dot:opacity-100 transition-opacity" style={{ fontSize: '8px', fontWeight: 'bold', color: 'rgba(0,0,0,0.5)', lineHeight: 1 }}>+</span>
          </button>
        </div>
        {!vertical && <span className="text-gray-300 text-sm font-medium">강사 활동 대시보드</span>}
        {alertCount > 0 && (
          <span className="flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
            {alertCount}
          </span>
        )}
        {lastCollection && !vertical && (
          <span className="text-gray-500 text-xs">
            마지막 수집 {formatCollectionTime(lastCollection)}
          </span>
        )}
      </div>

      {/* Right: Snap buttons + Opacity slider + Refresh + Settings */}
      <div className="no-drag flex items-center gap-3">
        {/* Snap buttons */}
        <div className="flex items-center gap-1">
          {snapButtons.map(({ pos, label }) => (
            <button
              key={pos}
              onClick={() => handleSnap(pos)}
              className={`px-2 py-0.5 text-xs rounded transition-colors ${
                activeSnap === pos
                  ? 'text-white bg-blue-600/70'
                  : 'text-gray-400 hover:text-white bg-gray-700/50 hover:bg-gray-600/50'
              }`}
              title={`${label} 스냅`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="w-px h-4 bg-gray-600" />

        {/* Opacity slider: float 0.2–1.0 */}
        <div className="flex items-center gap-2">
          {!vertical && <span className="text-gray-500 text-xs">투명도</span>}
          <input
            type="range"
            min="0.2"
            max="1.0"
            step="0.01"
            value={opacity}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              onOpacityChange(val);
              window.electronAPI?.setOpacity(val);
            }}
            className="w-20 h-1 cursor-pointer"
          />
          <span className="text-gray-400 text-xs w-8 text-right">{Math.round(opacity * 100)}%</span>
        </div>

        <div className="w-px h-4 bg-gray-600" />

        {/* Refresh with spinner */}
        <button
          onClick={handleRefresh}
          disabled={collecting}
          className={`transition-colors p-1 ${collecting ? 'text-blue-400' : 'text-gray-400 hover:text-white'}`}
          title={collecting ? '수집 중...' : '새로고침'}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={collecting ? 'animate-spin' : ''}
          >
            <path d="M23 4v6h-6" />
            <path d="M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
          </svg>
        </button>

        {/* Settings */}
        <button
          onClick={onSettingsClick}
          className="text-gray-400 hover:text-white transition-colors p-1"
          title="설정"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          </svg>
        </button>
      </div>
    </div>
  );
}
