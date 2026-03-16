# 강사 활동 추적 대시보드 — Claude Code 병렬 에이전트 마스터 파일 (최종)

## 제품 구조 개요

```
[운영자] → 웹 관리자 페이지 (admin.yourdomain.com)
              강사 RSS/플레이스/플랜 설정
                    ↓ REST API
[고객 앱] → 라이선스 키 입력
           → 서버에서 설정 자동 로드 (강사·플레이스 변경 불가)
           → 고객이 직접 바꿀 수 있는 건: 투명도·스냅·창 위치만
```

## 에이전트 구성 (4개 병렬)

| 에이전트 | 담당 | 디렉토리 |
|----------|------|----------|
| Agent-1 | Electron 쉘 + 클라이언트 UI | `src/main/`, `src/renderer/` |
| Agent-2 | 데이터 수집 파이프라인 + SEO | `src/main/data/` |
| Agent-3 | 스케줄러 + 경고 엔진 | `src/main/scheduler/` |
| Agent-4 | 웹 관리자 페이지 + API 서버 | `admin/` |

## 절대 규칙 (전 에이전트 공통)

1. 자기 디렉토리 외 파일 절대 수정 금지
2. `shared/` 는 읽기 전용 — 수정 필요 시 오케스트레이터에 보고
3. DB 직접 접근 금지 — `src/main/data/db.js` API만 사용
4. IPC 채널 추가 시 `shared/ipc-channels.js` 에 먼저 등록
5. 완료 시 담당 DONE 체크 후 종료

---

## Agent-1: Electron 쉘 + 클라이언트 UI

### 담당 파일
```
src/
├── main/
│   ├── main.js
│   ├── window.js
│   ├── tray.js
│   ├── preload.js
│   └── license.js        # 라이선스 키 검증 + 서버 설정 로드
└── renderer/
    ├── index.html
    ├── App.jsx
    ├── components/
    │   ├── InstructorCard.jsx
    │   ├── SeoPanel.jsx
    │   ├── SeoChecklist.jsx
    │   ├── ScoreGauge.jsx
    │   ├── AlertBadge.jsx
    │   ├── TitleBar.jsx          # 투명도 슬라이더 + 스냅 버튼 포함
    │   ├── LicenseGate.jsx       # 최초 실행 시 라이선스 키 입력 화면
    │   └── UiSettingsModal.jsx   # 고객용 설정 (투명도·스냅만)
    └── hooks/
        ├── useInstructors.js
        ├── useSeoResult.js
        └── useAlerts.js
```

### UI 설계 확정안

#### 타이틀바 레이아웃
```
● ● ●  강사 활동 대시보드   [상단][우측][하단]  투명도 ──●── 85%  [↻][⚙]
```
- 스냅 버튼 3개 + 투명도 슬라이더 → 타이틀바 안에 배치
- 하단 컨트롤바 없음

#### 강사 카드
```
┌─────────────────────┐
│ 김지수 강사      ●  │  ← 상태 도트 (ok/caution/warning/danger)
│─────────────────────│
│ 블로그 이번주   3건  │
│ 블로그 이번달  11건  │
│ 리뷰   이번주   2건  │
│ 리뷰   이번달   8건  │
│─────────────────────│
│ [A 78] [S 91] [A 72]│  ← SEO 등급 배지 최근 3개
│ [SEO 분석 ▼]        │
└─────────────────────┘
```

#### 경고 상태 색상
| 상태 | 카드 테두리 | 도트 |
|------|------------|------|
| ok | rgba(34,197,94,0.45) | #22c55e |
| caution | rgba(234,179,8,0.5) | #eab308 |
| warning | rgba(249,115,22,0.55) | #f97316 |
| danger | rgba(239,68,68,0.7) + pulse 애니메이션 | #ef4444 |

#### SEO 등급 배지 색상
| 등급 | bg | color |
|------|----|-------|
| S | #1e3a5f | #60a5fa |
| A | #14532d | #4ade80 |
| B | #422006 | #fb923c |
| C | #450a0a | #f87171 |
| D | #3b0764 | #e879f9 |

#### 고객용 설정 모달 (UiSettingsModal) — 변경 가능 항목만
```
┌─────────────────────────┐
│ 앱 설정             ✕  │
│─────────────────────────│
│ 투명도   ──────●── 85%  │
│ 기본 스냅  [상단▼]      │
│ 시작프로그램 자동실행 ○  │
│─────────────────────────│
│ 라이선스: PRO-XXXX-XXXX │  ← 표시만, 수정 불가
│ 플랜: 스탠다드 (10명)   │
│─────────────────────────│
│              [저장]     │
└─────────────────────────┘
```
- 강사 정보·RSS·플레이스 URL 항목 없음 (서버에서 관리)

#### 라이선스 게이트 화면 (LicenseGate)
- 최초 실행 또는 라이선스 미등록 시 표시
- 입력창 1개: 라이선스 키
- [활성화] 버튼 → `POST /api/validate-license` 호출
- 성공 시 서버에서 강사 설정 로드 → 대시보드 진입

#### window.js 핵심 구현
```javascript
const win = new BrowserWindow({
  transparent: true, frame: false, alwaysOnTop: false,
  skipTaskbar: false, width: 960, height: 240,
  webPreferences: { nodeIntegration: false, contextIsolation: true,
                    preload: path.join(__dirname, 'preload.js') }
});

ipcMain.handle('snap-window', (_, pos) => {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const presets = {
    top:    { x: 0, y: 0, width, height: 240 },
    right:  { x: width - 380, y: 0, width: 380, height },
    bottom: { x: 0, y: height - 240, width, height: 240 }
  };
  win.setBounds(presets[pos]);
});

ipcMain.handle('set-opacity', (_, val) => win.setOpacity(val / 100));
```

#### license.js — 서버에서 설정 로드
```javascript
// 라이선스 검증 + 강사 설정 수신
async function validateAndLoad(licenseKey) {
  const machineId = getMachineId();
  const res = await fetch(`${API_BASE}/api/validate-license`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ licenseKey, machineId, appVersion: app.getVersion() })
  });
  const data = await res.json();
  // data: { valid, plan, maxInstructors, instructors[], naverPlaceUrl, expiresAt }
  if (data.valid) {
    db.syncInstructors(data.instructors);   // 로컬 DB 동기화 (오프라인 대비)
    db.setSetting('naver_place_url', data.naverPlaceUrl);
    db.setSetting('plan', data.plan);
    db.setSetting('license_key', licenseKey);
  }
  return data;
}

// 앱 시작 시 재검증 (7일마다, 오프라인 30일 유예)
async function revalidateIfNeeded() {
  const lastCheck = db.getSetting('last_license_check');
  const daysSince = (Date.now() - new Date(lastCheck)) / 86400000;
  if (daysSince >= 7) await validateAndLoad(db.getSetting('license_key'));
}
```

### 완료 조건
- [ ] 투명창 실행됨
- [ ] 타이틀바에 투명도·스냅·새로고침·설정 배치
- [ ] 라이선스 게이트 화면 표시 및 활성화 동작
- [ ] 강사 카드 서버 데이터로 렌더링
- [ ] SEO 패널 열기/닫기
- [ ] 경고 상태 색상 및 danger pulse
- [ ] 고객 설정 모달 (UI만, 강사 정보 없음)
- [ ] 트레이 아이콘 상주

---

## Agent-2: 데이터 수집 파이프라인 + SEO 분석

### 담당 파일
```
src/main/data/
├── db.js
├── rss.js           # RSS 수집 + 블로그 URL → RSS 자동 변환
├── crawler.js       # Puppeteer (플레이스 리뷰 + 포스트 본문)
├── parser.js        # 강사명 정규표현식
├── seoAnalyzer.js   # SEO 점수 산출 엔진
└── ipc-data.js
```

### RSS 자동 변환 (rss.js 핵심)

블로그 URL → RSS URL 변환 규칙:
```javascript
function blogUrlToRss(url) {
  // 네이버 블로그
  // https://blog.naver.com/아이디  →  https://rss.blog.naver.com/아이디
  if (url.includes('blog.naver.com')) {
    const id = url.split('blog.naver.com/')[1]?.split('/')[0];
    return `https://rss.blog.naver.com/${id}`;
  }
  // 티스토리
  // https://아이디.tistory.com  →  https://아이디.tistory.com/rss
  if (url.includes('.tistory.com')) {
    return url.replace(/\/$/, '') + '/rss';
  }
  // 워드프레스
  // https://도메인  →  https://도메인/feed
  if (url.includes('wordpress.com') || url.match(/\/wp-content\//)) {
    return url.replace(/\/$/, '') + '/feed';
  }
  // 그 외: /rss 시도 후 실패하면 /feed 시도
  return url.replace(/\/$/, '') + '/rss';
}
```

관리자 페이지에서 강사 등록 시 `blog_url` 저장 → 앱이 로드할 때 `blogUrlToRss()`로 변환해서 수집.

### DB 스키마
```sql
CREATE TABLE IF NOT EXISTS instructors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  blog_url TEXT,           -- 원본 블로그 URL (관리자가 등록)
  blog_rss_url TEXT,       -- 자동 변환된 RSS URL
  keywords TEXT,           -- JSON: ["이름","별명"]
  display_color TEXT,
  is_active INTEGER DEFAULT 1,
  server_id TEXT,          -- 관리자 서버의 강사 ID (동기화용)
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS blog_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  instructor_id INTEGER REFERENCES instructors(id),
  post_url TEXT UNIQUE,
  post_title TEXT,
  published_at TEXT,
  collected_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS seo_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER REFERENCES blog_posts(id),
  instructor_id INTEGER REFERENCES instructors(id),
  analyzed_at TEXT DEFAULT (datetime('now')),
  total_score INTEGER,
  grade TEXT,
  score_title INTEGER, score_body INTEGER, score_keyword INTEGER,
  score_image INTEGER, score_internal_link INTEGER,
  score_tag INTEGER, score_cycle INTEGER, score_quality INTEGER,
  detail_json TEXT,
  checklist_json TEXT
);

CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  review_text TEXT,
  review_date TEXT,
  matched_instructor_id INTEGER REFERENCES instructors(id),
  collected_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS weekly_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  check_date TEXT,
  instructor_id INTEGER REFERENCES instructors(id),
  blog_count INTEGER DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  avg_seo_score INTEGER,
  status TEXT,
  week_start TEXT,
  week_end TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
-- 설정 키: opacity, snap_preset, auto_start,
--          naver_place_url, plan, license_key,
--          last_license_check, machine_id
```

### db.js 공개 API
```javascript
// 강사 (서버 동기화 전용, 클라이언트에서 직접 추가/수정 없음)
syncInstructors(serverInstructors[])  // 서버 데이터로 전체 덮어쓰기
getAllInstructors()
getInstructor(id)

// 블로그
addBlogPost(data)
getBlogCount(instructorId, weekStart, weekEnd)
getBlogCountMonth(instructorId, monthStart, monthEnd)
getUnanalyzedPosts(instructorId, weekStart, weekEnd)

// SEO
saveSeoResult(data)
getSeoResults(instructorId, limit)
getAvgSeoScore(instructorId, weekStart, weekEnd)

// 리뷰
addReview(data)
getReviewCount(instructorId, weekStart, weekEnd)
getReviewCountMonth(instructorId, monthStart, monthEnd)

// 주간 체크
saveWeeklyCheck(data)
getLastWeekStatus(instructorId)
getWeeklyHistory(instructorId, limit)

// 설정
getSetting(key)
setSetting(key, value)
```

### SEO 분석 배점 (seoAnalyzer.js)
총 100점, 8카테고리:

| 항목 | 만점 | 규칙 |
|------|------|------|
| 제목 길이 | 5 | 20~60자 |
| 제목 키워드 포함 | 10 | keywords[] 중 하나 이상 |
| 제목 클릭 표현 | 5 | /\d+가지\|방법\|완벽\|총정리\|가이드\|추천/ |
| 본문 분량 | 10 | ≥1500자:10 / ≥800자:5 / 미만:0 |
| 소제목 H2/H3 | 5 | ≥2개 |
| 단락 분리 | 5 | 평균 단락 ≤300자 |
| 키워드 밀도 | 10 | 3~8회:10 / 1~2회:5 / >8회:3(과다경고) |
| 키워드 분산 | 5 | 본문 3등분 모두 포함 |
| 이미지 1개+ | 8 | ≥1 |
| 이미지 3개+ | 7 | ≥3 |
| 내부링크 1개+ | 5 | ≥1 |
| 내부링크 3개+ | 5 | ≥3 |
| 태그 3개+ | 5 | ≥3 |
| 커스텀 카테고리 | 5 | true |
| 포스팅 주기 | 5 | 3~14일:5 / 15~30일:3 / 30일+:0 |
| 리스트 사용 | 3 | true |
| 강조 사용 | 2 | true |

### 완료 조건
- [ ] blogUrlToRss() 네이버/티스토리/워드프레스 변환 테스트 통과
- [ ] RSS 수집 → blog_posts 저장
- [ ] syncInstructors() 서버 데이터 로컬 동기화
- [ ] Puppeteer 플레이스 리뷰 수집 + 강사명 매칭
- [ ] Puppeteer 포스트 본문 수집 (네이버 iframe 처리)
- [ ] seoAnalyzer 단위 테스트 (jest) 통과
- [ ] 전체 IPC 핸들러 등록

---

## Agent-3: 스케줄러 + 경고 엔진

### 담당 파일
```
src/main/scheduler/
├── scheduler.js
├── alertEngine.js
└── weeklyReport.js
```

### 스케줄
```javascript
// 매주 수요일 오전 9시 자동 실행
cron.schedule('0 9 * * 3', () => runWeeklyCheck());

// 앱 시작 시: 이번 주 체크 미실행이면 즉시 실행
function checkOnStartup() {
  const lastCheck = db.getSetting('last_weekly_check');
  const thisWed = getThisWednesday();
  if (!lastCheck || new Date(lastCheck) < thisWed) runWeeklyCheck();
}
```

### 상태 판정 (alertEngine.js)
```javascript
function determineStatus(instructorId, blogCount, reviewCount) {
  if (blogCount >= 1 && reviewCount >= 1) return 'ok';
  if (blogCount === 0 && reviewCount === 0) {
    const last = db.getLastWeekStatus(instructorId);
    return last?.status === 'warning' ? 'danger' : 'warning';
  }
  return 'caution';
}
```

### 완료 조건
- [ ] 수요일 9시 cron 등록
- [ ] 시작 시 자동 체크 로직
- [ ] determineStatus 4케이스 jest 통과
- [ ] 주간 리포트 전체 플로우 실행
- [ ] weekly-check-done 이벤트 렌더러 전송

---

## Agent-4: 웹 관리자 페이지 + API 서버

### 담당 파일
```
admin/
├── server/
│   ├── index.js           # Express 서버 진입점
│   ├── routes/
│   │   ├── auth.js        # 운영자 로그인
│   │   ├── customers.js   # 고객(라이선스) CRUD
│   │   ├── instructors.js # 강사 CRUD
│   │   └── license.js     # 라이선스 검증 API (앱이 호출)
│   ├── middleware/
│   │   └── authMiddleware.js
│   └── db/
│       └── schema.sql     # 서버 DB 스키마 (PostgreSQL 또는 SQLite)
└── client/
    ├── index.html
    ├── App.jsx
    └── pages/
        ├── Login.jsx
        ├── Dashboard.jsx      # 전체 고객 현황 요약
        ├── CustomerList.jsx   # 고객 목록 + 라이선스 발급
        ├── CustomerDetail.jsx # 고객별 강사 설정
        └── InstructorForm.jsx # 강사 추가/수정 폼
```

### API 엔드포인트

#### 앱 → 서버 (공개 API)
```
POST /api/validate-license
  Body: { licenseKey, machineId, appVersion }
  Response: {
    valid: bool,
    plan: 'free'|'basic'|'standard'|'premium',
    maxInstructors: number,
    expiresAt: string,
    instructors: [
      {
        id, name,
        blog_url,       // 원본 블로그 URL
        blog_rss_url,   // 자동 변환된 RSS URL
        keywords: [],   // ["이름","별명"]
        display_color
      }
    ],
    naverPlaceUrl: string
  }
```

#### 운영자 → 서버 (인증 필요)
```
POST   /admin/auth/login
GET    /admin/customers                    # 전체 고객 목록
POST   /admin/customers                    # 신규 고객 + 라이선스 발급
GET    /admin/customers/:id
PATCH  /admin/customers/:id/plan           # 플랜 변경
DELETE /admin/customers/:id/license        # 라이선스 비활성화

GET    /admin/customers/:id/instructors    # 고객별 강사 목록
POST   /admin/customers/:id/instructors    # 강사 추가
PATCH  /admin/instructors/:id             # 강사 수정
DELETE /admin/instructors/:id             # 강사 삭제

PATCH  /admin/customers/:id/place         # 플레이스 URL 변경
```

### 서버 DB 스키마
```sql
CREATE TABLE customers (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  license_key TEXT UNIQUE NOT NULL,
  plan TEXT DEFAULT 'free',          -- free|basic|standard|premium
  max_instructors INTEGER DEFAULT 3,
  naver_place_url TEXT,
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE instructors (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id),
  name TEXT NOT NULL,
  blog_url TEXT,          -- 운영자가 입력하는 원본 블로그 URL
  blog_rss_url TEXT,      -- 자동 변환 저장 (blog_url 저장 시 자동 계산)
  keywords JSONB,         -- ["이름", "별명"]
  display_color TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 관리자 페이지 UI — CustomerDetail 핵심 화면
```
┌─────────────────────────────────────────────┐
│ 고객 상세: 행복학원 (standard 플랜)           │
│ 라이선스: STD-XXXX-XXXX  [복사] [비활성화]   │
│ 만료: 2026-04-16  플레이스: map.naver.com/…  │
├─────────────────────────────────────────────┤
│ 강사 목록 (3/10명)              [+ 강사 추가] │
├──────┬───────────────┬────────────┬─────────┤
│ 이름  │ 블로그 URL    │ 키워드     │ 액션    │
├──────┼───────────────┼────────────┼─────────┤
│ 김지수│ blog.naver…  │ 김지수,지수쌤│ 편집 삭제│
│ 박민준│ minjun.tisto…│ 박민준,민준쌤│ 편집 삭제│
│ 이서연│ blog.naver…  │ 이서연,서연쌤│ 편집 삭제│
└──────┴───────────────┴────────────┴─────────┘
```

### 강사 추가 폼 (InstructorForm) — 블로그 URL 자동변환 포함
```
이름:       [           ]
블로그 URL: [           ]  →  입력 즉시 RSS URL 미리보기 표시
             예: blog.naver.com/hong → rss.blog.naver.com/hong ✓
키워드:     [           ]  (쉼표 구분)
표시 색상:  [● ● ● ● ●]
```

### 완료 조건
- [ ] Express 서버 실행
- [ ] /api/validate-license 응답 정상 (instructors[] 포함)
- [ ] 운영자 로그인 + JWT 인증
- [ ] 고객 목록/추가/플랜변경
- [ ] 강사 CRUD (blog_url 입력 → rss_url 자동 저장)
- [ ] 관리자 UI 브라우저에서 동작
- [ ] 플레이스 URL 고객별 설정

---

## 공유 인터페이스 (읽기 전용)

### shared/ipc-channels.js
```javascript
module.exports = {
  GET_DASHBOARD_DATA:     'get-dashboard-data',
  TRIGGER_RSS_REFRESH:    'trigger-rss-refresh',
  GET_SEO_RESULTS:        'get-seo-results',
  TRIGGER_SEO_ANALYZE:    'trigger-seo-analyze',
  SNAP_WINDOW:            'snap-window',
  SET_OPACITY:            'set-opacity',
  TRIGGER_WEEKLY_CHECK:   'trigger-weekly-check',
  WEEKLY_CHECK_DONE:      'weekly-check-done',
  VALIDATE_LICENSE:       'validate-license',
  GET_UI_SETTINGS:        'get-ui-settings',
  SET_UI_SETTINGS:        'set-ui-settings',
};
```

### shared/constants.js
```javascript
module.exports = {
  API_BASE: process.env.API_BASE || 'https://api.yourdomain.com',
  PLANS: {
    FREE:     { maxInstructors: 3,  seoHistoryDepth: 1 },
    BASIC:    { maxInstructors: 6,  seoHistoryDepth: 3 },
    STANDARD: { maxInstructors: 10, seoHistoryDepth: 5 },
    PREMIUM:  { maxInstructors: Infinity, seoHistoryDepth: Infinity },
  },
  STATUS_COLORS: {
    ok:      '#22c55e',
    caution: '#eab308',
    warning: '#f97316',
    danger:  '#ef4444',
  },
  SEO_GRADES: {
    S: { min: 85, bg: '#1e3a5f', color: '#60a5fa' },
    A: { min: 70, bg: '#14532d', color: '#4ade80' },
    B: { min: 50, bg: '#422006', color: '#fb923c' },
    C: { min: 30, bg: '#450a0a', color: '#f87171' },
    D: { min: 0,  bg: '#3b0764', color: '#e879f9' },
  },
};
```

---

## 전체 디렉토리 구조

```
instructor-dashboard/
├── CLAUDE.md
├── package.json
├── vite.config.js
├── tailwind.config.js
├── electron-builder.yml
├── shared/
│   ├── ipc-channels.js
│   └── constants.js
├── src/
│   ├── main/
│   │   ├── main.js
│   │   ├── window.js
│   │   ├── tray.js
│   │   ├── preload.js
│   │   ├── license.js          # ★ 서버 설정 로드
│   │   ├── data/               # Agent-2
│   │   │   ├── db.js
│   │   │   ├── rss.js          # ★ blogUrlToRss() 포함
│   │   │   ├── crawler.js
│   │   │   ├── parser.js
│   │   │   ├── seoAnalyzer.js
│   │   │   └── ipc-data.js
│   │   └── scheduler/          # Agent-3
│   │       ├── scheduler.js
│   │       ├── alertEngine.js
│   │       └── weeklyReport.js
│   └── renderer/               # Agent-1
│       ├── App.jsx
│       ├── components/
│       │   ├── LicenseGate.jsx
│       │   ├── TitleBar.jsx
│       │   ├── InstructorCard.jsx
│       │   ├── SeoPanel.jsx
│       │   ├── SeoChecklist.jsx
│       │   ├── ScoreGauge.jsx
│       │   ├── AlertBadge.jsx
│       │   └── UiSettingsModal.jsx
│       └── hooks/
├── admin/                      # Agent-4
│   ├── server/
│   │   ├── index.js
│   │   ├── routes/
│   │   └── db/
│   └── client/
│       ├── App.jsx
│       └── pages/
└── tests/
    ├── rss.test.js
    ├── seoAnalyzer.test.js
    └── alertEngine.test.js
```

---

## 병렬 실행 시 충돌 방지

- Agent-4(API 서버)는 가장 먼저 `/api/validate-license` 엔드포인트를 완성해야 Agent-1이 라이선스 게이트 테스트 가능
- Agent-1은 그 전까지 mock 응답 (`{ valid: true, instructors: [...더미] }`)으로 UI 개발 진행
- Agent-2 db.js 완성 전, Agent-3은 더미 db 객체로 alertEngine 단위 테스트 먼저 작성
- 통합은 Agent-2,4 완료 후 오케스트레이터가 main.js에서 연결

## 터미널 4개 실행 명령

```bash
# 터미널 1
claude "CLAUDE.md를 읽고 Agent-1 역할 수행. 
라이선스 게이트 + 타이틀바 + 강사 카드 UI 구현. 
서버 미완성이면 mock 데이터로 진행."

# 터미널 2
claude "CLAUDE.md를 읽고 Agent-2 역할 수행.
blogUrlToRss() 먼저 구현하고 jest 테스트 작성.
db.js API 완성 후 RSS/크롤러/SEO 순으로 진행."

# 터미널 3
claude "CLAUDE.md를 읽고 Agent-3 역할 수행.
alertEngine 4케이스 jest 먼저 작성.
db.js 없으면 더미 객체로 테스트 통과시킨 후 대기."

# 터미널 4
claude "CLAUDE.md를 읽고 Agent-4 역할 수행.
/api/validate-license 엔드포인트 최우선 완성.
그 다음 관리자 UI + 나머지 CRUD."
```
