import React, { useState, useEffect } from 'react';

const COUPANG_LINK = 'https://link.coupang.com/a/d5uPW7';
const DISCLOSURE = '쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다';
const ROTATING_TEXTS = [
  '내일 필요한 물건, 로켓배송',
  '쿠팡 특가 확인',
  '오늘의 추천상품 보기',
];

export default function CoupangBanner() {
  const [textIndex, setTextIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setTextIndex((i) => (i + 1) % ROTATING_TEXTS.length);
    }, 8000);
    return () => clearInterval(timer);
  }, []);

  const handleClick = () => {
    if (window.electronAPI?.openExternal) {
      window.electronAPI.openExternal(COUPANG_LINK);
    } else {
      window.open(COUPANG_LINK, '_blank');
    }
  };

  return (
    <div className="shrink-0">
      <div
        onClick={handleClick}
        className="flex items-center h-8 px-3 cursor-pointer"
        style={{ background: '#0d1b2a', borderTop: '0.5px solid rgba(255,255,255,0.08)' }}
      >
        <div className="flex items-center gap-1.5 shrink-0">
          <span style={{ fontSize: '11px' }}>🛍</span>
          <span style={{ fontSize: '11px', color: '#8899aa' }}>쿠팡 추천상품</span>
        </div>

        <div className="flex-1 text-center">
          <span style={{ fontSize: '11px', color: '#63d2be' }}>
            {ROTATING_TEXTS[textIndex]}
          </span>
        </div>

        <span style={{ fontSize: '11px', color: '#63d2be' }} className="shrink-0">→</span>
      </div>
      <div style={{ background: '#0d1b2a' }} className="px-3 pb-1">
        <span style={{ fontSize: '9px', color: '#445566' }}>{DISCLOSURE}</span>
      </div>
    </div>
  );
}
