'use strict';

const { analyzeSeoPost, _calculateGrade } = require('../src/main/data/seoAnalyzer');

// ─── Helper: build a content object for analyzeSeoPost ──────────────────────
function makeContent(overrides = {}) {
  return {
    text: overrides.text ?? 'a'.repeat(1500),
    title: overrides.title ?? '',
    images: overrides.images ?? 0,
    internalLinks: overrides.internalLinks ?? 0,
    hasCustomCategory: overrides.hasCustomCategory ?? false,
    tags: overrides.tags ?? [],
    hasLists: overrides.hasLists ?? false,
    hasBold: overrides.hasBold ?? false,
    headings: overrides.headings ?? 0,
    paragraphs: overrides.paragraphs ?? [],
  };
}

function makePost(overrides = {}) {
  return {
    id: 1,
    post_url: 'https://blog.naver.com/test/123',
    post_title: overrides.post_title ?? '테스트 포스트',
    published_at: overrides.published_at ?? '2026-03-10T09:00:00Z',
  };
}

function makeInstructor(overrides = {}) {
  return {
    id: 1,
    name: overrides.name ?? '김지수',
    keywords: overrides.keywords ?? ['김지수', '지수쌤'],
  };
}

// ─── _calculateGrade ────────────────────────────────────────────────────────
describe('_calculateGrade', () => {
  test('returns S for score >= 85', () => {
    expect(_calculateGrade(85)).toBe('S');
    expect(_calculateGrade(100)).toBe('S');
    expect(_calculateGrade(90)).toBe('S');
  });

  test('returns A for score 70-84', () => {
    expect(_calculateGrade(70)).toBe('A');
    expect(_calculateGrade(84)).toBe('A');
  });

  test('returns B for score 50-69', () => {
    expect(_calculateGrade(50)).toBe('B');
    expect(_calculateGrade(69)).toBe('B');
  });

  test('returns C for score 30-49', () => {
    expect(_calculateGrade(30)).toBe('C');
    expect(_calculateGrade(49)).toBe('C');
  });

  test('returns D for score < 30', () => {
    expect(_calculateGrade(0)).toBe('D');
    expect(_calculateGrade(29)).toBe('D');
  });

  test('returns S for boundary value 85', () => {
    expect(_calculateGrade(85)).toBe('S');
  });

  test('returns A for boundary value just below S', () => {
    expect(_calculateGrade(84)).toBe('A');
  });
});

// ─── analyzeSeoPost ─────────────────────────────────────────────────────────
describe('analyzeSeoPost', () => {
  describe('empty / no content', () => {
    test('returns empty result when no content or html provided', () => {
      const result = analyzeSeoPost(makePost(), makeInstructor());
      expect(result.totalScore).toBe(0);
      expect(result.grade).toBe('D');
      expect(result.checklist).toEqual([]);
      expect(result.detail).toEqual({});
    });

    test('returns empty result when html is null', () => {
      const result = analyzeSeoPost(makePost(), makeInstructor(), { html: null });
      expect(result.totalScore).toBe(0);
      expect(result.grade).toBe('D');
    });
  });

  describe('minimal post (all zeros)', () => {
    test('scores 0 with empty content', () => {
      const content = makeContent({
        text: '',
        title: '',
        images: 0,
        internalLinks: 0,
        tags: [],
        headings: 0,
        paragraphs: [],
      });
      const post = makePost({ post_title: '' });
      const instructor = makeInstructor({ name: 'NoMatch', keywords: [] });

      const result = analyzeSeoPost(post, instructor, { content });
      expect(result.totalScore).toBe(0);
      expect(result.grade).toBe('D');
      expect(result.checklist.length).toBe(17);
      expect(result.checklist.every((c) => c.score === 0)).toBe(true);
    });
  });

  describe('perfect score post', () => {
    test('achieves score of 100 with all criteria met', () => {
      // Build text with keyword spread across all three thirds
      const kw = '김지수';
      const segment = 'a'.repeat(490);
      // 3 segments with keyword in each ~500 chars * 3 = 1500+ chars, 3-8 keyword count
      const bodyText = `${segment} ${kw} ${segment} ${kw} end ${segment} ${kw} padding${segment}`;

      const content = makeContent({
        text: bodyText,
        images: 5,
        internalLinks: 4,
        hasCustomCategory: true,
        tags: ['태그1', '태그2', '태그3', '태그4'],
        hasLists: true,
        hasBold: true,
        headings: 3,
        paragraphs: ['단락1'.repeat(20), '단락2'.repeat(20), '단락3'.repeat(20), '단락4'.repeat(20)],
      });

      const post = makePost({
        post_title: '김지수 강사의 완벽 가이드 총정리 추천 방법',
        published_at: '2026-03-10T09:00:00Z',
      });
      const instructor = makeInstructor();

      const result = analyzeSeoPost(post, instructor, {
        content,
        previousPostDate: '2026-03-03T09:00:00Z', // 7 days prior
      });

      expect(result.totalScore).toBe(100);
      expect(result.grade).toBe('S');
      expect(result.scores.score_title).toBe(20);
      expect(result.scores.score_body).toBe(20);
      expect(result.scores.score_keyword).toBe(15);
      expect(result.scores.score_image).toBe(15);
      expect(result.scores.score_internal_link).toBe(10);
      expect(result.scores.score_tag).toBe(10);
      expect(result.scores.score_cycle).toBe(5);
      expect(result.scores.score_quality).toBe(5);
    });
  });

  // ─── Individual scoring categories ──────────────────────────────────────
  describe('title scoring', () => {
    test('title length: 5pts when 20-60 chars', () => {
      const post = makePost({ post_title: '이것은 적절한 길이의 테스트 제목입니다 스물자 넘기기' });
      const result = analyzeSeoPost(post, makeInstructor({ keywords: [] }), {
        content: makeContent(),
      });
      expect(result.detail.titleLength.score).toBe(5);
    });

    test('title length: 0pts when too short', () => {
      const post = makePost({ post_title: '짧은 제목' });
      const result = analyzeSeoPost(post, makeInstructor({ keywords: [] }), {
        content: makeContent(),
      });
      expect(result.detail.titleLength.score).toBe(0);
    });

    test('title length: 0pts when too long (>60)', () => {
      const post = makePost({ post_title: 'a'.repeat(61) });
      const result = analyzeSeoPost(post, makeInstructor({ keywords: [] }), {
        content: makeContent(),
      });
      expect(result.detail.titleLength.score).toBe(0);
    });

    test('title keyword: 10pts when keyword found in title', () => {
      const post = makePost({ post_title: '김지수 강사의 블로그' });
      const result = analyzeSeoPost(post, makeInstructor(), {
        content: makeContent(),
      });
      expect(result.detail.titleKeyword.score).toBe(10);
    });

    test('title keyword: 0pts when no keyword in title', () => {
      const post = makePost({ post_title: '일반적인 제목입니다' });
      const result = analyzeSeoPost(post, makeInstructor({ name: 'NoMatch', keywords: ['없는키워드'] }), {
        content: makeContent(),
      });
      expect(result.detail.titleKeyword.score).toBe(0);
    });

    test('title click expression: 5pts for click expressions', () => {
      const expressions = ['5가지 방법', '완벽 가이드', '총정리', '추천'];
      for (const expr of expressions) {
        const post = makePost({ post_title: `테스트 ${expr} 제목` });
        const result = analyzeSeoPost(post, makeInstructor({ keywords: [] }), {
          content: makeContent(),
        });
        expect(result.detail.titleClick.score).toBe(5);
      }
    });

    test('title click expression: 0pts without click expression', () => {
      const post = makePost({ post_title: '평범한 일상 이야기' });
      const result = analyzeSeoPost(post, makeInstructor({ keywords: [] }), {
        content: makeContent(),
      });
      expect(result.detail.titleClick.score).toBe(0);
    });
  });

  describe('body scoring', () => {
    test('body length: 10pts for >=1500 chars', () => {
      const result = analyzeSeoPost(makePost(), makeInstructor({ keywords: [] }), {
        content: makeContent({ text: 'a'.repeat(1500) }),
      });
      expect(result.detail.bodyLength.score).toBe(10);
    });

    test('body length: 5pts for 800-1499 chars', () => {
      const result = analyzeSeoPost(makePost(), makeInstructor({ keywords: [] }), {
        content: makeContent({ text: 'a'.repeat(800) }),
      });
      expect(result.detail.bodyLength.score).toBe(5);
    });

    test('body length: 0pts for <800 chars', () => {
      const result = analyzeSeoPost(makePost(), makeInstructor({ keywords: [] }), {
        content: makeContent({ text: 'a'.repeat(100) }),
      });
      expect(result.detail.bodyLength.score).toBe(0);
    });

    test('subtitles: 5pts for 2+ headings', () => {
      const result = analyzeSeoPost(makePost(), makeInstructor({ keywords: [] }), {
        content: makeContent({ headings: 2 }),
      });
      expect(result.detail.subtitles.score).toBe(5);
    });

    test('subtitles: 0pts for <2 headings', () => {
      const result = analyzeSeoPost(makePost(), makeInstructor({ keywords: [] }), {
        content: makeContent({ headings: 1 }),
      });
      expect(result.detail.subtitles.score).toBe(0);
    });

    test('paragraph split: 5pts when avg paragraph <=300 chars', () => {
      const result = analyzeSeoPost(makePost(), makeInstructor({ keywords: [] }), {
        content: makeContent({ paragraphs: ['a'.repeat(200), 'b'.repeat(250)] }),
      });
      expect(result.detail.paragraphSplit.score).toBe(5);
    });

    test('paragraph split: 0pts when avg paragraph >300 chars', () => {
      const result = analyzeSeoPost(makePost(), makeInstructor({ keywords: [] }), {
        content: makeContent({ paragraphs: ['a'.repeat(400), 'b'.repeat(500)] }),
      });
      expect(result.detail.paragraphSplit.score).toBe(0);
    });
  });

  describe('keyword scoring', () => {
    test('keyword density: 10pts for 3-8 occurrences', () => {
      const text = '김지수 소개합니다. 김지수 강사는 최고입니다. 김지수 추천합니다.';
      const result = analyzeSeoPost(makePost(), makeInstructor(), {
        content: makeContent({ text }),
      });
      expect(result.detail.keywordDensity.score).toBe(10);
      expect(result.detail.keywordDensity.warning).toBeNull();
    });

    test('keyword density: 5pts for 1-2 occurrences', () => {
      const text = '오늘 김지수 강사님을 만났습니다. 좋은 하루였습니다.';
      const result = analyzeSeoPost(makePost(), makeInstructor({ name: 'unique_unique_name', keywords: [] }), {
        content: makeContent({ text: '오늘 unique_unique_name 강사님을 만났습니다. 좋은 하루였습니다.' }),
      });
      expect(result.detail.keywordDensity.score).toBe(5);
    });

    test('keyword density: 3pts and warning for >8 occurrences', () => {
      const repeated = ('김지수 ').repeat(10);
      const result = analyzeSeoPost(makePost(), makeInstructor({ name: '김지수', keywords: [] }), {
        content: makeContent({ text: repeated }),
      });
      expect(result.detail.keywordDensity.score).toBe(3);
      expect(result.detail.keywordDensity.warning).toBe('키워드 과다 사용');
    });

    test('keyword density: 0pts for zero occurrences', () => {
      const result = analyzeSeoPost(makePost(), makeInstructor({ name: 'NoMatch', keywords: [] }), {
        content: makeContent({ text: '키워드가 전혀 없는 글입니다.' }),
      });
      expect(result.detail.keywordDensity.score).toBe(0);
    });

    test('keyword spread: 5pts when keyword in all three thirds of body', () => {
      const segment = 'a'.repeat(500);
      const text = `김지수${segment}김지수${segment}김지수`;
      const result = analyzeSeoPost(makePost(), makeInstructor({ name: '김지수', keywords: [] }), {
        content: makeContent({ text }),
      });
      expect(result.detail.keywordSpread.score).toBe(5);
    });

    test('keyword spread: 0pts when keyword only in first third', () => {
      const text = '김지수 김지수 김지수' + 'a'.repeat(2000);
      const result = analyzeSeoPost(makePost(), makeInstructor({ name: '김지수', keywords: [] }), {
        content: makeContent({ text }),
      });
      expect(result.detail.keywordSpread.score).toBe(0);
    });
  });

  describe('image scoring', () => {
    test('image 1+: 8pts, image 3+: 7pts for 3+ images', () => {
      const result = analyzeSeoPost(makePost(), makeInstructor({ keywords: [] }), {
        content: makeContent({ images: 3 }),
      });
      expect(result.detail.image1.score).toBe(8);
      expect(result.detail.image3.score).toBe(7);
    });

    test('image 1+: 8pts, image 3+: 0pts for 1-2 images', () => {
      const result = analyzeSeoPost(makePost(), makeInstructor({ keywords: [] }), {
        content: makeContent({ images: 2 }),
      });
      expect(result.detail.image1.score).toBe(8);
      expect(result.detail.image3.score).toBe(0);
    });

    test('image: 0pts for no images', () => {
      const result = analyzeSeoPost(makePost(), makeInstructor({ keywords: [] }), {
        content: makeContent({ images: 0 }),
      });
      expect(result.detail.image1.score).toBe(0);
      expect(result.detail.image3.score).toBe(0);
    });
  });

  describe('internal link scoring', () => {
    test('link 1+ and 3+: full 10pts for 3+ links', () => {
      const result = analyzeSeoPost(makePost(), makeInstructor({ keywords: [] }), {
        content: makeContent({ internalLinks: 3 }),
      });
      expect(result.detail.internalLink1.score).toBe(5);
      expect(result.detail.internalLink3.score).toBe(5);
    });

    test('link 1+: 5pts, link 3+: 0pts for 1-2 links', () => {
      const result = analyzeSeoPost(makePost(), makeInstructor({ keywords: [] }), {
        content: makeContent({ internalLinks: 1 }),
      });
      expect(result.detail.internalLink1.score).toBe(5);
      expect(result.detail.internalLink3.score).toBe(0);
    });

    test('link: 0pts for no links', () => {
      const result = analyzeSeoPost(makePost(), makeInstructor({ keywords: [] }), {
        content: makeContent({ internalLinks: 0 }),
      });
      expect(result.detail.internalLink1.score).toBe(0);
      expect(result.detail.internalLink3.score).toBe(0);
    });
  });

  describe('tag scoring', () => {
    test('tags: 5pts for 3+ tags', () => {
      const result = analyzeSeoPost(makePost(), makeInstructor({ keywords: [] }), {
        content: makeContent({ tags: ['a', 'b', 'c'] }),
      });
      expect(result.detail.tags.score).toBe(5);
    });

    test('tags: 0pts for <3 tags', () => {
      const result = analyzeSeoPost(makePost(), makeInstructor({ keywords: [] }), {
        content: makeContent({ tags: ['a', 'b'] }),
      });
      expect(result.detail.tags.score).toBe(0);
    });

    test('custom category: 5pts when present', () => {
      const result = analyzeSeoPost(makePost(), makeInstructor({ keywords: [] }), {
        content: makeContent({ hasCustomCategory: true }),
      });
      expect(result.detail.customCategory.score).toBe(5);
    });

    test('custom category: 0pts when absent', () => {
      const result = analyzeSeoPost(makePost(), makeInstructor({ keywords: [] }), {
        content: makeContent({ hasCustomCategory: false }),
      });
      expect(result.detail.customCategory.score).toBe(0);
    });
  });

  describe('posting cycle scoring', () => {
    test('cycle: 5pts for 3-14 days since last post', () => {
      const result = analyzeSeoPost(
        makePost({ published_at: '2026-03-10T09:00:00Z' }),
        makeInstructor({ keywords: [] }),
        {
          content: makeContent(),
          previousPostDate: '2026-03-03T09:00:00Z', // 7 days
        }
      );
      expect(result.detail.postingCycle.score).toBe(5);
      expect(result.detail.postingCycle.daysSinceLast).toBe(7);
    });

    test('cycle: 3pts for 15-30 days since last post', () => {
      const result = analyzeSeoPost(
        makePost({ published_at: '2026-03-30T09:00:00Z' }),
        makeInstructor({ keywords: [] }),
        {
          content: makeContent(),
          previousPostDate: '2026-03-10T09:00:00Z', // 20 days
        }
      );
      expect(result.detail.postingCycle.score).toBe(3);
    });

    test('cycle: 0pts for 30+ days since last post', () => {
      const result = analyzeSeoPost(
        makePost({ published_at: '2026-03-10T09:00:00Z' }),
        makeInstructor({ keywords: [] }),
        {
          content: makeContent(),
          previousPostDate: '2026-01-01T09:00:00Z', // ~68 days
        }
      );
      expect(result.detail.postingCycle.score).toBe(0);
    });

    test('cycle: 0pts when no previous post date', () => {
      const result = analyzeSeoPost(makePost(), makeInstructor({ keywords: [] }), {
        content: makeContent(),
      });
      expect(result.detail.postingCycle.score).toBe(0);
      expect(result.detail.postingCycle.daysSinceLast).toBeNull();
    });
  });

  describe('quality scoring', () => {
    test('list usage: 3pts when lists present', () => {
      const result = analyzeSeoPost(makePost(), makeInstructor({ keywords: [] }), {
        content: makeContent({ hasLists: true }),
      });
      expect(result.detail.listUsage.score).toBe(3);
    });

    test('list usage: 0pts when no lists', () => {
      const result = analyzeSeoPost(makePost(), makeInstructor({ keywords: [] }), {
        content: makeContent({ hasLists: false }),
      });
      expect(result.detail.listUsage.score).toBe(0);
    });

    test('bold usage: 2pts when bold/emphasis present', () => {
      const result = analyzeSeoPost(makePost(), makeInstructor({ keywords: [] }), {
        content: makeContent({ hasBold: true }),
      });
      expect(result.detail.boldUsage.score).toBe(2);
    });

    test('bold usage: 0pts when no bold/emphasis', () => {
      const result = analyzeSeoPost(makePost(), makeInstructor({ keywords: [] }), {
        content: makeContent({ hasBold: false }),
      });
      expect(result.detail.boldUsage.score).toBe(0);
    });
  });

  describe('result structure', () => {
    test('returns all expected properties', () => {
      const result = analyzeSeoPost(makePost(), makeInstructor(), {
        content: makeContent(),
      });
      expect(result).toHaveProperty('totalScore');
      expect(result).toHaveProperty('grade');
      expect(result).toHaveProperty('scores');
      expect(result).toHaveProperty('checklist');
      expect(result).toHaveProperty('detail');
    });

    test('scores object has all 8 category keys', () => {
      const result = analyzeSeoPost(makePost(), makeInstructor(), {
        content: makeContent(),
      });
      expect(result.scores).toHaveProperty('score_title');
      expect(result.scores).toHaveProperty('score_body');
      expect(result.scores).toHaveProperty('score_keyword');
      expect(result.scores).toHaveProperty('score_image');
      expect(result.scores).toHaveProperty('score_internal_link');
      expect(result.scores).toHaveProperty('score_tag');
      expect(result.scores).toHaveProperty('score_cycle');
      expect(result.scores).toHaveProperty('score_quality');
    });

    test('checklist contains exactly 17 items', () => {
      const result = analyzeSeoPost(makePost(), makeInstructor(), {
        content: makeContent(),
      });
      expect(result.checklist).toHaveLength(17);
    });

    test('each checklist item has required fields', () => {
      const result = analyzeSeoPost(makePost(), makeInstructor(), {
        content: makeContent(),
      });
      for (const item of result.checklist) {
        expect(item).toHaveProperty('category');
        expect(item).toHaveProperty('item');
        expect(item).toHaveProperty('label');
        expect(item).toHaveProperty('passed');
        expect(item).toHaveProperty('value');
        expect(item).toHaveProperty('score');
        expect(item).toHaveProperty('maxScore');
      }
    });

    test('totalScore equals sum of all category scores', () => {
      const result = analyzeSeoPost(makePost(), makeInstructor(), {
        content: makeContent({ images: 2, internalLinks: 1, tags: ['a', 'b', 'c'] }),
      });
      const { scores } = result;
      const sum =
        scores.score_title +
        scores.score_body +
        scores.score_keyword +
        scores.score_image +
        scores.score_internal_link +
        scores.score_tag +
        scores.score_cycle +
        scores.score_quality;
      expect(result.totalScore).toBe(sum);
    });

    test('totalScore never exceeds 100', () => {
      const segment = 'a'.repeat(500);
      const text = `김지수${segment}김지수${segment}김지수`;
      const content = makeContent({
        text,
        images: 10,
        internalLinks: 10,
        hasCustomCategory: true,
        tags: ['a', 'b', 'c', 'd'],
        hasLists: true,
        hasBold: true,
        headings: 5,
        paragraphs: ['a'.repeat(100), 'b'.repeat(100)],
      });
      const result = analyzeSeoPost(
        makePost({ post_title: '김지수 강사의 완벽 가이드 총정리 추천 방법' }),
        makeInstructor(),
        { content, previousPostDate: '2026-03-03T09:00:00Z' }
      );
      expect(result.totalScore).toBeLessThanOrEqual(100);
    });
  });
});
