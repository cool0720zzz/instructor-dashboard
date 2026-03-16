import React from 'react';

const STATUS_COLORS = {
  ok: '#22c55e',
  caution: '#eab308',
  warning: '#f97316',
  danger: '#ef4444',
};

const STATUS_LABELS = {
  ok: '정상',
  caution: '주의',
  warning: '경고',
  danger: '위험',
};

export default function AlertBadge({ status = 'ok', showLabel = false }) {
  const color = STATUS_COLORS[status] || STATUS_COLORS.ok;
  const label = STATUS_LABELS[status] || STATUS_LABELS.ok;

  return (
    <div className="flex items-center gap-1.5" title={label}>
      <span
        className={`w-2.5 h-2.5 rounded-full inline-block shrink-0 ${
          status === 'danger' ? 'animate-pulse' : ''
        }`}
        style={{ backgroundColor: color }}
      />
      {showLabel && (
        <span className="text-xs" style={{ color }}>
          {label}
        </span>
      )}
    </div>
  );
}
