import React from 'react';

const SEO_GRADES = {
  S: { bg: '#1e3a5f', color: '#60a5fa' },
  A: { bg: '#14532d', color: '#4ade80' },
  B: { bg: '#422006', color: '#fb923c' },
  C: { bg: '#450a0a', color: '#f87171' },
  D: { bg: '#3b0764', color: '#e879f9' },
};

function getGrade(score) {
  if (score >= 85) return 'S';
  if (score >= 70) return 'A';
  if (score >= 50) return 'B';
  if (score >= 30) return 'C';
  return 'D';
}

export default function ScoreGauge({ score = 0, grade }) {
  const resolvedGrade = grade || getGrade(score);
  const gradeStyle = SEO_GRADES[resolvedGrade] || SEO_GRADES.D;

  // SVG arc for the gauge
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;

  return (
    <div className="flex items-center gap-3">
      {/* Circular gauge */}
      <div className="relative w-16 h-16 shrink-0">
        <svg width="64" height="64" viewBox="0 0 64 64" className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx="32"
            cy="32"
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="5"
          />
          {/* Progress circle */}
          <circle
            cx="32"
            cy="32"
            r={radius}
            fill="none"
            stroke={gradeStyle.color}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            className="transition-all duration-500"
          />
        </svg>
        {/* Score text */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold" style={{ color: gradeStyle.color }}>
            {score}
          </span>
        </div>
      </div>

      {/* Grade badge */}
      <div className="flex flex-col items-start gap-1">
        <span
          className="px-2.5 py-0.5 rounded text-sm font-bold"
          style={{ backgroundColor: gradeStyle.bg, color: gradeStyle.color }}
        >
          {resolvedGrade}등급
        </span>
        <span className="text-gray-500 text-xs">
          {score >= 85 ? '우수' : score >= 70 ? '양호' : score >= 50 ? '보통' : score >= 30 ? '미흡' : '개선 필요'}
        </span>
      </div>
    </div>
  );
}
