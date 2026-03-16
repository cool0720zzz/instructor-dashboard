import React, { useRef, useCallback } from 'react';
import AlertBadge from './AlertBadge';

const STATUS_BORDER_CLASSES = {
  ok: 'border-status-ok',
  caution: 'border-status-caution',
  warning: 'border-status-warning',
  danger: 'border-status-danger danger-pulse',
};

const SEO_GRADES = {
  S: { bg: '#1e3a5f', color: '#60a5fa' },
  A: { bg: '#14532d', color: '#4ade80' },
  B: { bg: '#422006', color: '#fb923c' },
  C: { bg: '#450a0a', color: '#f87171' },
  D: { bg: '#3b0764', color: '#e879f9' },
};

function getGradeFromScore(score) {
  if (score >= 85) return 'S';
  if (score >= 70) return 'A';
  if (score >= 50) return 'B';
  if (score >= 30) return 'C';
  return 'D';
}

export default function InstructorCard({ instructor, layout }) {
  const cardRef = useRef(null);

  const {
    name,
    status = 'ok',
    blogWeek = 0,
    blogMonth = 0,
    reviewWeek = 0,
    reviewMonth = 0,
    seoResults = [],
  } = instructor;

  const borderClass = STATUS_BORDER_CLASSES[status] || STATUS_BORDER_CLASSES.ok;
  const recentSeo = seoResults.slice(0, 3);

  // Open SEO as a floating BrowserWindow positioned below this card
  const handleSeoClick = useCallback(() => {
    if (!window.electronAPI?.openSeoWindow || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    window.electronAPI.openSeoWindow({
      cardBounds: {
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
      instructorId: instructor.id,
    });
  }, [instructor.id]);

  // ─── compact layout ───
  if (layout === 'compact') {
    const topGrade = recentSeo[0]
      ? (recentSeo[0].grade || getGradeFromScore(recentSeo[0].total_score))
      : null;
    const topGradeStyle = topGrade ? (SEO_GRADES[topGrade] || SEO_GRADES.D) : null;

    return (
      <div ref={cardRef} className={`flex items-center gap-3 px-3 py-1.5 bg-gray-800/80 border-2 rounded-lg shrink-0 ${borderClass}`}>
        <AlertBadge status={status} />
        <span className="text-white text-xs font-semibold whitespace-nowrap">{name}</span>
        <span className="text-gray-400 text-[10px] whitespace-nowrap">블로그 {blogWeek}</span>
        <span className="text-gray-400 text-[10px] whitespace-nowrap">리뷰 {reviewWeek}</span>
        {topGrade && topGradeStyle && (
          <span className="seo-badge text-[10px] py-0 px-1.5"
                style={{ backgroundColor: topGradeStyle.bg, color: topGradeStyle.color }}>
            {topGrade} {recentSeo[0].total_score}
          </span>
        )}
      </div>
    );
  }

  // ─── horizontal / vertical: full card ───
  const widthClass = layout === 'vertical' ? 'w-full' : 'w-[220px]';

  return (
    <div ref={cardRef} className={`${widthClass} shrink-0`}>
      <div className={`flex flex-col bg-gray-800/80 border-2 rounded-lg ${borderClass}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700/40">
          <span className="text-white text-sm font-semibold truncate">{name} 강사</span>
          <AlertBadge status={status} />
        </div>

        {/* Stats */}
        <div className="px-3 py-2 space-y-1 text-xs">
          <div className="flex justify-between text-gray-300">
            <span>블로그 이번주</span>
            <span className="font-mono font-semibold text-white">{blogWeek}건</span>
          </div>
          <div className="flex justify-between text-gray-300">
            <span>블로그 이번달</span>
            <span className="font-mono font-semibold text-white">{blogMonth}건</span>
          </div>
          <div className="flex justify-between text-gray-300">
            <span>리뷰 이번주</span>
            <span className="font-mono font-semibold text-white">{reviewWeek}건</span>
          </div>
          <div className="flex justify-between text-gray-300">
            <span>리뷰 이번달</span>
            <span className="font-mono font-semibold text-white">{reviewMonth}건</span>
          </div>
        </div>

        {/* SEO Badges + Toggle */}
        <div className="px-3 py-2 border-t border-gray-700/40">
          <div className="flex items-center gap-1.5 mb-1.5">
            {recentSeo.map((seo, idx) => {
              const grade = seo.grade || getGradeFromScore(seo.total_score);
              const gradeStyle = SEO_GRADES[grade] || SEO_GRADES.D;
              return (
                <span key={seo.id || idx} className="seo-badge"
                      style={{ backgroundColor: gradeStyle.bg, color: gradeStyle.color }}>
                  {grade} {seo.total_score}
                </span>
              );
            })}
            {recentSeo.length === 0 && (
              <span className="text-gray-500 text-xs">SEO 데이터 없음</span>
            )}
          </div>
          <button
            onClick={handleSeoClick}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
          >
            <span>SEO 분석</span>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
              <path d="M2 3h6L5 7z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
