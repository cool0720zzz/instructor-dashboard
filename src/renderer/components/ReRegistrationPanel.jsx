import React, { useState, useMemo } from 'react';
import { useReRegistration } from '../hooks/useReRegistration';
import ReRegSettingsPanel from './ReRegSettingsPanel';
import ReRegInstructorModal from './ReRegInstructorModal';

// ─── Circular gauge (small, inline) ───
function MiniGauge({ value, size = 56, strokeWidth = 4, color = '#60a5fa' }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (Math.min(value, 100) / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold text-white">{value}%</span>
      </div>
    </div>
  );
}

// ─── Summary stat card ───
function SummaryCard({ label, value, sub, color }) {
  return (
    <div className="w-[220px] shrink-0 bg-gray-800/80 border border-gray-700/40 rounded-lg px-3 py-2 text-center">
      <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">{label}</div>
      <div className="text-lg font-bold" style={{ color: color || '#fff' }}>{value}</div>
      {sub && <div className="text-[10px] text-gray-500 mt-0.5">{sub}</div>}
    </div>
  );
}

// ─── Instructor mini card ───
function InstructorMiniCard({ name, rate, thisMonthRereg, thisMonthTotal, onClick }) {
  const gaugeColor = rate >= 70 ? '#4ade80' : rate >= 50 ? '#fb923c' : '#f87171';

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 bg-gray-800/80 border border-gray-700/40 rounded-lg px-3 py-2
                 hover:border-gray-600 hover:bg-gray-700/60 transition-all cursor-pointer w-[220px] shrink-0"
    >
      <span className="text-sm font-semibold text-white truncate max-w-[200px]">{name}</span>
      <MiniGauge value={rate} size={48} strokeWidth={3.5} color={gaugeColor} />
      <div className="text-center">
        <div className="text-[10px] text-gray-500">이번달</div>
        <div className="text-xs text-gray-300 font-mono">
          {thisMonthRereg}/{thisMonthTotal}명
        </div>
      </div>
    </button>
  );
}

// ─── Main Panel ───
export default function ReRegistrationPanel() {
  const {
    config,
    loading,
    error,
    configured,
    expiryTargets,
    getStats,
    getExpiryStats,
    getInstructors,
    setConfig,
    loadData,
  } = useReRegistration();

  const [showSettings, setShowSettings] = useState(false);
  const [selectedInstructor, setSelectedInstructor] = useState(null);

  const instructors = useMemo(() => getInstructors(), [getInstructors]);
  const overallStats = useMemo(() => getStats(), [getStats]);

  const instructorStats = useMemo(() => {
    return instructors.map((name) => {
      const stats = getStats(name);
      const monthStats = getExpiryStats(name);
      return {
        name,
        overallRate: stats.overallRate,
        thisMonthRate: monthStats.rate,
        thisMonthRereg: monthStats.reregistered,
        thisMonthTotal: monthStats.total,
      };
    });
  }, [instructors, getStats, getExpiryStats]);

  // ─── Not configured ───
  if (!configured && !loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-8 px-4">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 mx-auto rounded-full bg-gray-800 flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-500">
              <path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-gray-400 text-sm">데이터 소스를 설정해주세요</p>
          <p className="text-gray-600 text-[10px]">엑셀 파일 또는 구글 스프레드시트를 연결합니다</p>
        </div>
        <button
          onClick={() => setShowSettings(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          설정
        </button>

        {showSettings && (
          <ReRegSettingsPanel
            onClose={() => setShowSettings(false)}
            onSave={async (cfg) => {
              await setConfig(cfg);
              setShowSettings(false);
            }}
          />
        )}
      </div>
    );
  }

  // ─── Loading ───
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <svg className="animate-spin w-5 h-5 text-blue-400 mr-2" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
          <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
        <span className="text-gray-400 text-sm">데이터 로딩 중...</span>
      </div>
    );
  }

  // ─── Error ───
  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 px-4">
        <div className="text-red-400 text-sm">{error}</div>
        <button
          onClick={() => loadData()}
          className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded-lg transition-colors"
        >
          다시 시도
        </button>
      </div>
    );
  }

  const overallGaugeColor = overallStats.overallRate >= 70 ? '#4ade80'
    : overallStats.overallRate >= 50 ? '#fb923c' : '#f87171';

  return (
    <div className="space-y-3 py-1 relative">
      {/* Header with settings gear */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">재등록 현황</h3>
        <button
          onClick={() => setShowSettings(true)}
          className="text-gray-500 hover:text-gray-300 transition-colors p-1 rounded hover:bg-gray-700/50"
          title="재등록 데이터 설정"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.32 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
        </button>
      </div>

      {/* Summary cards */}
      <div className="flex flex-row items-start gap-3 flex-nowrap">
        <SummaryCard
          label="전체 재등록율"
          value={`${overallStats.overallRate}%`}
          sub={`${overallStats.totalReregistered}/${overallStats.totalExpired}명`}
          color={overallGaugeColor}
        />
        <SummaryCard
          label="이번달 재등록율"
          value={`${overallStats.thisMonthRate}%`}
          sub={`${overallStats.thisMonthReregistered}/${overallStats.thisMonthTargets}명`}
          color={overallStats.thisMonthRate >= 70 ? '#4ade80' : overallStats.thisMonthRate >= 50 ? '#fb923c' : '#f87171'}
        />
        <SummaryCard
          label="이탈 인원"
          value={`${overallStats.departedCount}명`}
          color="#f87171"
        />
      </div>

      {/* Instructor grid */}
      {instructorStats.length > 0 && (
        <div className="flex flex-row items-start gap-3 flex-nowrap">
          {instructorStats.map((inst) => (
            <InstructorMiniCard
              key={inst.name}
              name={inst.name}
              rate={inst.thisMonthRate}
              thisMonthRereg={inst.thisMonthRereg}
              thisMonthTotal={inst.thisMonthTotal}
              onClick={() => setSelectedInstructor(inst.name)}
            />
          ))}
          {/* Overall card */}
          <InstructorMiniCard
            name="전체"
            rate={overallStats.thisMonthRate}
            thisMonthRereg={overallStats.thisMonthReregistered}
            thisMonthTotal={overallStats.thisMonthTargets}
            onClick={() => setSelectedInstructor(null)}
          />
        </div>
      )}

      {instructors.length === 0 && expiryTargets.length === 0 && (
        <div className="text-center py-4">
          <p className="text-gray-500 text-xs">재등록 데이터가 없습니다</p>
        </div>
      )}

      {/* Instructor detail modal */}
      {selectedInstructor !== undefined && selectedInstructor !== null && (
        <ReRegInstructorModal
          instructor={selectedInstructor}
          data={expiryTargets}
          onClose={() => setSelectedInstructor(null)}
        />
      )}

      {/* Settings overlay */}
      {showSettings && (
        <ReRegSettingsPanel
          onClose={() => setShowSettings(false)}
          onSave={async (cfg) => {
            await setConfig(cfg);
            setShowSettings(false);
          }}
        />
      )}
    </div>
  );
}
