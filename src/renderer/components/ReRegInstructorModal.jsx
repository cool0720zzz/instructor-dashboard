import React, { useState, useMemo, useEffect } from 'react';
import { calculateExpiryStats } from '../hooks/useReRegistration';

function StatusBadge({ status }) {
  const config = {
    reregistered: { label: '재등록', bg: 'bg-green-900/40', text: 'text-green-400', icon: '\u2713' },
    departed:     { label: '이탈',   bg: 'bg-red-900/40',   text: 'text-red-400',   icon: '\u2717' },
    waiting:      { label: '대기',   bg: 'bg-yellow-900/40', text: 'text-yellow-400', icon: '\u23F3' },
  };
  const c = config[status] || config.waiting;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${c.bg} ${c.text}`}>
      {c.icon} {c.label}
    </span>
  );
}

function formatDate(date) {
  if (!date) return '-';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d)) return '-';
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${m}/${day}`;
}

function formatDateFull(date) {
  if (!date) return '-';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d)) return '-';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Generate month list for the past 12 months
function getMonthList() {
  const months = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d);
  }
  return months;
}

function monthShortLabel(date) {
  return `${date.getMonth() + 1}월`;
}

export default function ReRegInstructorModal({ instructor, data, onClose }) {
  const [selectedMonthIdx, setSelectedMonthIdx] = useState(0);
  const monthList = useMemo(() => getMonthList(), []);

  // Escape key
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const selectedMonth = monthList[selectedMonthIdx];

  // Filter targets for this instructor
  const instructorTargets = useMemo(() => {
    if (!data) return [];
    return data.filter((t) => t.instructor === instructor);
  }, [data, instructor]);

  // Overall stats for this instructor
  const overallStats = useMemo(() => {
    const now = new Date();
    const expired = instructorTargets.filter((t) => t.expiryDate < now);
    const rereg = expired.filter((t) => t.status === 'reregistered');
    const departed = expired.filter((t) => t.status === 'departed');
    return {
      total: expired.length,
      reregistered: rereg.length,
      departed: departed.length,
    };
  }, [instructorTargets]);

  // Month-specific stats
  const monthStats = useMemo(() => {
    return calculateExpiryStats(instructorTargets.length > 0 ? instructorTargets : data || [], instructor, selectedMonth);
  }, [instructorTargets, data, instructor, selectedMonth]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-gray-800 border border-gray-700/60 rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-700/50 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors p-0.5 rounded hover:bg-gray-700/50"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className="text-white font-semibold text-sm">{instructor} 강사 재등록 현황</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-0.5 rounded hover:bg-gray-700/50"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Summary stats */}
        <div className="px-5 py-3 flex gap-2 shrink-0">
          <div className="flex-1 bg-gray-700/30 rounded-lg px-3 py-2 text-center">
            <div className="text-[10px] text-gray-500">만기대상</div>
            <div className="text-lg font-bold text-white">{overallStats.total}명</div>
          </div>
          <div className="flex-1 bg-gray-700/30 rounded-lg px-3 py-2 text-center">
            <div className="text-[10px] text-gray-500">재등록</div>
            <div className="text-lg font-bold text-green-400">{overallStats.reregistered}명</div>
          </div>
          <div className="flex-1 bg-gray-700/30 rounded-lg px-3 py-2 text-center">
            <div className="text-[10px] text-gray-500">이탈</div>
            <div className="text-lg font-bold text-red-400">{overallStats.departed}명</div>
          </div>
        </div>

        <div className="border-t border-gray-700/50" />

        {/* Month selector */}
        <div className="px-5 py-2 shrink-0">
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500 mr-2 shrink-0">월별 현황</span>
            <div className="flex gap-1 overflow-x-auto pb-1">
              {monthList.map((m, idx) => {
                const isSelected = idx === selectedMonthIdx;
                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedMonthIdx(idx)}
                    className={`px-2.5 py-1 rounded text-[10px] font-medium transition-colors shrink-0 ${
                      isSelected
                        ? 'bg-blue-600/30 text-blue-400 border border-blue-500/40'
                        : 'text-gray-500 hover:text-gray-300 hover:bg-gray-700/40 border border-transparent'
                    }`}
                  >
                    {monthShortLabel(m)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="border-t border-gray-700/50" />

        {/* Month detail header */}
        <div className="px-5 py-2 flex items-center justify-between shrink-0">
          <span className="text-xs text-gray-400">
            {selectedMonth.getFullYear()}년 {selectedMonth.getMonth() + 1}월 만기 대상자
          </span>
          <div className="flex items-center gap-3 text-[10px]">
            <span className="text-gray-500">
              재등록 <span className="text-green-400 font-mono">{monthStats.reregistered}</span>
            </span>
            <span className="text-gray-500">
              이탈 <span className="text-red-400 font-mono">{monthStats.departed}</span>
            </span>
            <span className="text-gray-500">
              대기 <span className="text-yellow-400 font-mono">{monthStats.waiting}</span>
            </span>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto px-5 pb-4">
          {monthStats.targets.length > 0 ? (
            <div className="rounded-lg border border-gray-700/40 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-700/40 text-gray-400">
                    <th className="px-3 py-2 text-left font-medium">이름</th>
                    <th className="px-3 py-2 text-left font-medium">등록일</th>
                    <th className="px-3 py-2 text-center font-medium">세션</th>
                    <th className="px-3 py-2 text-left font-medium">만기일</th>
                    <th className="px-3 py-2 text-center font-medium">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {monthStats.targets.map((target, i) => (
                    <tr
                      key={`${target.memberName}-${i}`}
                      className="border-t border-gray-700/30 text-gray-300 hover:bg-gray-700/20 transition-colors"
                    >
                      <td className="px-3 py-2 font-medium text-white">{target.memberName}</td>
                      <td className="px-3 py-2 font-mono text-gray-400">{formatDate(target.registrationDate)}</td>
                      <td className="px-3 py-2 text-center font-mono text-gray-400">
                        {target.sessionCount || '-'}
                      </td>
                      <td className="px-3 py-2 font-mono text-gray-400">{formatDate(target.expiryDate)}</td>
                      <td className="px-3 py-2 text-center">
                        <StatusBadge status={target.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex items-center justify-center py-8">
              <span className="text-gray-600 text-xs">해당 월에 만기 대상자가 없습니다</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
