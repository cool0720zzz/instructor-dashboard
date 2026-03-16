import React, { useState } from 'react';

export default function SeoChecklist({ items = [] }) {
  const [expanded, setExpanded] = useState(false);

  const displayItems = expanded ? items : items.slice(0, 5);
  const passedCount = items.filter((item) => item.passed).length;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400 font-medium">
          체크리스트 ({passedCount}/{items.length})
        </span>
        {items.length > 5 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-blue-400 hover:text-blue-300"
          >
            {expanded ? '접기' : '전체 보기'}
          </button>
        )}
      </div>

      <div className="space-y-0.5">
        {displayItems.map((item, idx) => (
          <div key={idx} className="flex items-center gap-2 text-xs">
            <span className={item.passed ? 'text-green-400' : 'text-red-400'}>
              {item.passed ? '✓' : '✗'}
            </span>
            <span className={item.passed ? 'text-gray-300' : 'text-gray-500'}>
              {item.label}
            </span>
            <span className="ml-auto text-gray-600">
              {item.score}/{item.max}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
