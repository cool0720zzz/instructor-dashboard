import React from 'react';

export default function AddInstructorCta({ instructors = [], layout }) {
  const handleClick = () => {
    if (window.electronAPI?.openSettingsWindow) {
      window.electronAPI.openSettingsWindow();
    }
  };

  // ─── compact: match InstructorCard compact height exactly ───
  if (layout === 'compact') {
    return (
      <button
        onClick={handleClick}
        className="flex items-center gap-3 px-3 py-1.5 bg-gray-800/40 border-2 border-dashed
                   border-gray-600/50 rounded-lg hover:border-blue-500/50 hover:bg-gray-800/60
                   transition-all duration-200 shrink-0 cursor-pointer group"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2" className="text-gray-500 group-hover:text-blue-400 transition-colors">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        <span className="text-xs text-gray-500 group-hover:text-blue-400 transition-colors font-medium whitespace-nowrap">강사 추가</span>
      </button>
    );
  }

  // ─── horizontal / vertical: replicate InstructorCard structure exactly ───
  const widthClass = layout === 'vertical' ? 'w-full' : 'w-[220px]';

  return (
    <div className={`${widthClass} shrink-0`}>
      <div
        className="flex flex-col bg-gray-800/40 border-2 border-dashed border-gray-600/50 rounded-lg
                   hover:border-blue-500/50 hover:bg-gray-800/60 transition-all duration-200 cursor-pointer group"
        onClick={handleClick}
      >
        {/* Header — identical to InstructorCard: px-3 py-2 border-b */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700/20">
          <span className="text-gray-500 group-hover:text-blue-400 text-sm font-semibold transition-colors">강사 추가</span>
          <div className="w-2.5 h-2.5 rounded-full bg-gray-700/40" />
        </div>

        {/* Stats — identical structure: px-3 py-2 space-y-1 with 4 rows of text-xs */}
        <div className="px-3 py-2 space-y-1 text-xs flex flex-col items-center justify-center">
          <div className="w-full h-[18px]" />
          <div className="w-10 h-10 rounded-full bg-gray-700/40 group-hover:bg-blue-600/20
                          flex items-center justify-center transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2" className="text-gray-500 group-hover:text-blue-400 transition-colors">
              <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4-4v2" />
              <circle cx="9" cy="7" r="4" />
              <line x1="19" y1="8" x2="19" y2="14" />
              <line x1="22" y1="11" x2="16" y2="11" />
            </svg>
          </div>
          <span className="text-[10px] text-gray-600 group-hover:text-gray-400 transition-colors">
            관리자 페이지에서 추가
          </span>
          <div className="w-full h-[18px]" />
        </div>

        {/* SEO area — identical structure: px-3 py-2 border-t with badge row + button row */}
        <div className="px-3 py-2 border-t border-gray-700/20">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-gray-600 text-xs invisible">placeholder</span>
          </div>
          <span className="text-xs text-gray-600 invisible">placeholder</span>
        </div>
      </div>
    </div>
  );
}
