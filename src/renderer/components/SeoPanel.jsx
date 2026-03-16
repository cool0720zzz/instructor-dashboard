import React, { useEffect } from 'react';
import { useSeoResult } from '../hooks/useSeoResult';
import ScoreGauge from './ScoreGauge';
import SeoChecklist from './SeoChecklist';

export default function SeoPanel({ instructorId, seoResults = [] }) {
  const { seoDetail, loading, analyzing, fetchSeoResults, triggerAnalysis } = useSeoResult();

  useEffect(() => {
    fetchSeoResults(instructorId);
  }, [instructorId, fetchSeoResults]);

  if (loading) {
    return (
      <div className="px-3 py-3 border-t border-gray-700/40 text-gray-500 text-xs">
        분석 결과 로딩 중...
      </div>
    );
  }

  // No SEO data — show empty state with analyze button
  if (!seoDetail) {
    return (
      <div className="px-4 py-4 border-t border-gray-700/40 flex flex-col items-center gap-3">
        <span className="text-gray-500 text-xs">SEO 분석 데이터가 없습니다</span>
        <button
          onClick={() => triggerAnalysis(instructorId)}
          disabled={analyzing}
          className="px-4 py-1.5 text-xs font-medium rounded-md transition-colors
                     bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-wait text-white"
        >
          {analyzing ? (
            <span className="flex items-center gap-1.5">
              <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              분석 중...
            </span>
          ) : '분석 시작'}
        </button>
      </div>
    );
  }

  const scoreBreakdown = [
    { label: '제목', score: seoDetail.score_title || 0, max: 20 },
    { label: '본문', score: seoDetail.score_body || 0, max: 20 },
    { label: '키워드', score: seoDetail.score_keyword || 0, max: 15 },
    { label: '이미지', score: seoDetail.score_image || 0, max: 15 },
    { label: '내부링크', score: seoDetail.score_internal_link || 0, max: 10 },
    { label: '태그', score: seoDetail.score_tag || 0, max: 10 },
    { label: '주기', score: seoDetail.score_cycle || 0, max: 5 },
    { label: '품질', score: seoDetail.score_quality || 0, max: 5 },
  ];

  let checklist = [];
  try {
    checklist = typeof seoDetail.checklist_json === 'string'
      ? JSON.parse(seoDetail.checklist_json)
      : seoDetail.checklist_json || [];
  } catch {
    checklist = [];
  }

  return (
    <div className="px-4 py-3 bg-gray-900/40 space-y-3 overflow-y-auto">
      {/* Total Score Gauge */}
      <ScoreGauge score={seoDetail.total_score} grade={seoDetail.grade} />

      {/* Post info */}
      {seoDetail.post_title && (
        <div className="text-xs text-gray-400 truncate" title={seoDetail.post_title}>
          {seoDetail.post_title}
        </div>
      )}

      {/* Score Breakdown Bars */}
      <div className="space-y-1">
        {scoreBreakdown.map(({ label, score, max }) => (
          <div key={label} className="flex items-center gap-2 text-xs">
            <span className="text-gray-400 w-12 shrink-0">{label}</span>
            <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${(score / max) * 100}%`,
                  backgroundColor: score / max >= 0.7 ? '#4ade80' : score / max >= 0.5 ? '#fb923c' : '#f87171',
                }}
              />
            </div>
            <span className="text-gray-500 w-10 text-right shrink-0">
              {score}/{max}
            </span>
          </div>
        ))}
      </div>

      {/* Checklist */}
      {checklist.length > 0 && <SeoChecklist items={checklist} />}

      {/* Re-analyze button */}
      <button
        onClick={() => triggerAnalysis(instructorId)}
        disabled={analyzing}
        className="w-full py-1.5 text-xs text-gray-400 hover:text-blue-400 transition-colors
                   border border-gray-700/40 rounded-md hover:border-blue-500/40"
      >
        {analyzing ? '분석 중...' : '다시 분석'}
      </button>
    </div>
  );
}
