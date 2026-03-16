'use strict';

const { extractBlogContent, countKeywords } = require('./parser');
const { SEO_GRADES } = require('../../../shared/constants');

/**
 * Analyze a blog post for SEO quality.
 *
 * Scoring rules (100 points total, 17 criteria in 8 categories):
 *
 * TITLE (20pts):
 *   - Title length 20-60 chars: 5pts
 *   - Title contains keyword: 10pts
 *   - Title has click expression: 5pts
 *
 * BODY (20pts):
 *   - Body length >=1500:10, >=800:5, else 0
 *   - Subtitles H2/H3 >=2: 5pts
 *   - Avg paragraph <=300 chars: 5pts
 *
 * KEYWORD (15pts):
 *   - Keyword density 3-8:10, 1-2:5, >8:3(warning)
 *   - Keyword spread (all 3 thirds): 5pts
 *
 * IMAGE (15pts):
 *   - Image 1+: 8pts
 *   - Image 3+: 7pts
 *
 * INTERNAL LINK (10pts):
 *   - Internal link 1+: 5pts
 *   - Internal link 3+: 5pts
 *
 * TAG (5pts):
 *   - Tags 3+: 5pts
 *
 * CYCLE (5pts):
 *   - Custom category: 5pts (moved here for grouping)
 *   - Actually: Posting cycle 3-14days:5, 15-30:3, 30+:0
 *
 * QUALITY (5pts):
 *   - List usage: 3pts
 *   - Bold/emphasis: 2pts
 *
 * @param {object} post - Blog post data { id, post_url, post_title, published_at }
 * @param {object} instructor - Instructor data { id, name, keywords: string[] }
 * @param {object} options - Optional: { html, previousPostDate, content }
 *   - html: raw HTML of the post (if already fetched)
 *   - previousPostDate: ISO date string of instructor's previous post
 *   - content: pre-extracted content object from parser.extractBlogContent
 * @returns {{ totalScore: number, grade: string, scores: object, checklist: Array, detail: object }}
 */
function analyzeSeoPost(post, instructor, options = {}) {
  // Extract content from HTML if not pre-extracted
  const content = options.content || (options.html ? extractBlogContent(options.html) : null);

  if (!content) {
    return _emptyResult();
  }

  const title = post.post_title || content.title || '';
  const bodyText = content.text || '';
  const keywords = instructor.keywords || [];
  const allSearchTerms = [instructor.name, ...keywords].filter(Boolean);

  const checklist = [];
  const detail = {};

  // ─── 1. TITLE LENGTH (5pts) ──────────────────────────────────────────────
  const titleLen = title.length;
  let scoreTitleLength = 0;
  if (titleLen >= 20 && titleLen <= 60) {
    scoreTitleLength = 5;
  }
  detail.titleLength = { value: titleLen, score: scoreTitleLength, max: 5 };
  checklist.push({
    category: 'title',
    item: 'title_length',
    label: '제목 길이 20~60자',
    passed: scoreTitleLength > 0,
    value: `${titleLen}자`,
    score: scoreTitleLength,
    maxScore: 5,
  });

  // ─── 2. TITLE KEYWORD (10pts) ────────────────────────────────────────────
  let scoreTitleKeyword = 0;
  const titleLower = title.toLowerCase();
  const titleHasKeyword = allSearchTerms.some((kw) => titleLower.includes(kw.toLowerCase()));
  if (titleHasKeyword) {
    scoreTitleKeyword = 10;
  }
  detail.titleKeyword = { hasKeyword: titleHasKeyword, score: scoreTitleKeyword, max: 10 };
  checklist.push({
    category: 'title',
    item: 'title_keyword',
    label: '제목에 키워드 포함',
    passed: titleHasKeyword,
    value: titleHasKeyword ? '포함' : '미포함',
    score: scoreTitleKeyword,
    maxScore: 10,
  });

  // ─── 3. TITLE CLICK EXPRESSION (5pts) ────────────────────────────────────
  let scoreTitleClick = 0;
  const clickRegex = /\d+가지|방법|완벽|총정리|가이드|추천/;
  const hasClickExpr = clickRegex.test(title);
  if (hasClickExpr) {
    scoreTitleClick = 5;
  }
  detail.titleClick = { hasClickExpr, score: scoreTitleClick, max: 5 };
  checklist.push({
    category: 'title',
    item: 'title_click_expression',
    label: '제목 클릭 유도 표현',
    passed: hasClickExpr,
    value: hasClickExpr ? '있음' : '없음',
    score: scoreTitleClick,
    maxScore: 5,
  });

  // ─── 4. BODY LENGTH (10pts) ──────────────────────────────────────────────
  const bodyLen = bodyText.length;
  let scoreBodyLength = 0;
  if (bodyLen >= 1500) scoreBodyLength = 10;
  else if (bodyLen >= 800) scoreBodyLength = 5;
  detail.bodyLength = { value: bodyLen, score: scoreBodyLength, max: 10 };
  checklist.push({
    category: 'body',
    item: 'body_length',
    label: '본문 분량 (1500자 이상 권장)',
    passed: bodyLen >= 1500,
    value: `${bodyLen}자`,
    score: scoreBodyLength,
    maxScore: 10,
  });

  // ─── 5. SUBTITLES H2/H3 (5pts) ──────────────────────────────────────────
  const headingCount = content.headings || 0;
  let scoreSubtitles = 0;
  if (headingCount >= 2) scoreSubtitles = 5;
  detail.subtitles = { count: headingCount, score: scoreSubtitles, max: 5 };
  checklist.push({
    category: 'body',
    item: 'subtitles',
    label: '소제목 H2/H3 2개 이상',
    passed: headingCount >= 2,
    value: `${headingCount}개`,
    score: scoreSubtitles,
    maxScore: 5,
  });

  // ─── 6. PARAGRAPH SPLIT (5pts) ──────────────────────────────────────────
  const paragraphs = content.paragraphs || [];
  let avgParagraphLen = 0;
  if (paragraphs.length > 0) {
    const totalPLen = paragraphs.reduce((sum, p) => sum + p.length, 0);
    avgParagraphLen = Math.round(totalPLen / paragraphs.length);
  }
  let scoreParagraph = 0;
  if (paragraphs.length > 0 && avgParagraphLen <= 300) {
    scoreParagraph = 5;
  }
  detail.paragraphSplit = { avgLength: avgParagraphLen, count: paragraphs.length, score: scoreParagraph, max: 5 };
  checklist.push({
    category: 'body',
    item: 'paragraph_split',
    label: '단락 분리 (평균 300자 이하)',
    passed: scoreParagraph > 0,
    value: `평균 ${avgParagraphLen}자 (${paragraphs.length}단락)`,
    score: scoreParagraph,
    maxScore: 5,
  });

  // ─── 7. KEYWORD DENSITY (10pts) ─────────────────────────────────────────
  const kwResult = countKeywords(bodyText, allSearchTerms);
  const kwCount = kwResult.total;
  let scoreKwDensity = 0;
  let kwWarning = null;
  if (kwCount >= 3 && kwCount <= 8) {
    scoreKwDensity = 10;
  } else if (kwCount >= 1 && kwCount <= 2) {
    scoreKwDensity = 5;
  } else if (kwCount > 8) {
    scoreKwDensity = 3;
    kwWarning = '키워드 과다 사용';
  }
  detail.keywordDensity = { count: kwCount, score: scoreKwDensity, max: 10, warning: kwWarning };
  checklist.push({
    category: 'keyword',
    item: 'keyword_density',
    label: '키워드 밀도 (3~8회 권장)',
    passed: kwCount >= 3 && kwCount <= 8,
    value: `${kwCount}회${kwWarning ? ' (' + kwWarning + ')' : ''}`,
    score: scoreKwDensity,
    maxScore: 10,
  });

  // ─── 8. KEYWORD SPREAD (5pts) ──────────────────────────────────────────
  let scoreKwSpread = 0;
  if (bodyText.length > 0 && kwResult.positions.length > 0) {
    const thirdLen = Math.floor(bodyText.length / 3);
    const hasFirst = kwResult.positions.some((p) => p < thirdLen);
    const hasSecond = kwResult.positions.some((p) => p >= thirdLen && p < thirdLen * 2);
    const hasThird = kwResult.positions.some((p) => p >= thirdLen * 2);
    if (hasFirst && hasSecond && hasThird) {
      scoreKwSpread = 5;
    }
    detail.keywordSpread = { first: hasFirst, second: hasSecond, third: hasThird, score: scoreKwSpread, max: 5 };
  } else {
    detail.keywordSpread = { first: false, second: false, third: false, score: 0, max: 5 };
  }
  checklist.push({
    category: 'keyword',
    item: 'keyword_spread',
    label: '키워드 분산 (본문 3등분 모두 포함)',
    passed: scoreKwSpread > 0,
    value: scoreKwSpread > 0 ? '고른 분포' : '편중됨',
    score: scoreKwSpread,
    maxScore: 5,
  });

  // ─── 9. IMAGE 1+ (8pts) ─────────────────────────────────────────────────
  const imageCount = content.images || 0;
  let scoreImage1 = imageCount >= 1 ? 8 : 0;
  detail.image1 = { count: imageCount, score: scoreImage1, max: 8 };
  checklist.push({
    category: 'image',
    item: 'image_one',
    label: '이미지 1개 이상',
    passed: imageCount >= 1,
    value: `${imageCount}개`,
    score: scoreImage1,
    maxScore: 8,
  });

  // ─── 10. IMAGE 3+ (7pts) ────────────────────────────────────────────────
  let scoreImage3 = imageCount >= 3 ? 7 : 0;
  detail.image3 = { count: imageCount, score: scoreImage3, max: 7 };
  checklist.push({
    category: 'image',
    item: 'image_three',
    label: '이미지 3개 이상',
    passed: imageCount >= 3,
    value: `${imageCount}개`,
    score: scoreImage3,
    maxScore: 7,
  });

  // ─── 11. INTERNAL LINK 1+ (5pts) ────────────────────────────────────────
  const linkCount = content.internalLinks || 0;
  let scoreLink1 = linkCount >= 1 ? 5 : 0;
  detail.internalLink1 = { count: linkCount, score: scoreLink1, max: 5 };
  checklist.push({
    category: 'internal_link',
    item: 'internal_link_one',
    label: '내부링크 1개 이상',
    passed: linkCount >= 1,
    value: `${linkCount}개`,
    score: scoreLink1,
    maxScore: 5,
  });

  // ─── 12. INTERNAL LINK 3+ (5pts) ────────────────────────────────────────
  let scoreLink3 = linkCount >= 3 ? 5 : 0;
  detail.internalLink3 = { count: linkCount, score: scoreLink3, max: 5 };
  checklist.push({
    category: 'internal_link',
    item: 'internal_link_three',
    label: '내부링크 3개 이상',
    passed: linkCount >= 3,
    value: `${linkCount}개`,
    score: scoreLink3,
    maxScore: 5,
  });

  // ─── 13. TAGS 3+ (5pts) ─────────────────────────────────────────────────
  const tagCount = (content.tags || []).length;
  let scoreTags = tagCount >= 3 ? 5 : 0;
  detail.tags = { count: tagCount, tags: content.tags, score: scoreTags, max: 5 };
  checklist.push({
    category: 'tag',
    item: 'tags_three',
    label: '태그 3개 이상',
    passed: tagCount >= 3,
    value: `${tagCount}개`,
    score: scoreTags,
    maxScore: 5,
  });

  // ─── 14. CUSTOM CATEGORY (5pts) ─────────────────────────────────────────
  const hasCategory = content.hasCustomCategory || false;
  let scoreCategory = hasCategory ? 5 : 0;
  detail.customCategory = { hasCategory, score: scoreCategory, max: 5 };
  checklist.push({
    category: 'tag',
    item: 'custom_category',
    label: '커스텀 카테고리 설정',
    passed: hasCategory,
    value: hasCategory ? '설정됨' : '미설정',
    score: scoreCategory,
    maxScore: 5,
  });

  // ─── 15. POSTING CYCLE (5pts) ──────────────────────────────────────────
  let scoreCycle = 0;
  const prevDate = options.previousPostDate;
  let daysSinceLast = null;
  if (prevDate && post.published_at) {
    const current = new Date(post.published_at);
    const previous = new Date(prevDate);
    daysSinceLast = Math.floor((current - previous) / 86400000);
    if (daysSinceLast >= 3 && daysSinceLast <= 14) {
      scoreCycle = 5;
    } else if (daysSinceLast >= 15 && daysSinceLast <= 30) {
      scoreCycle = 3;
    }
    // 30+ days: 0
  }
  detail.postingCycle = { daysSinceLast, score: scoreCycle, max: 5 };
  checklist.push({
    category: 'cycle',
    item: 'posting_cycle',
    label: '포스팅 주기 (3~14일 권장)',
    passed: scoreCycle === 5,
    value: daysSinceLast != null ? `${daysSinceLast}일` : '이전 글 없음',
    score: scoreCycle,
    maxScore: 5,
  });

  // ─── 16. LIST USAGE (3pts) ──────────────────────────────────────────────
  const hasLists = content.hasLists || false;
  let scoreList = hasLists ? 3 : 0;
  detail.listUsage = { hasLists, score: scoreList, max: 3 };
  checklist.push({
    category: 'quality',
    item: 'list_usage',
    label: '리스트 사용',
    passed: hasLists,
    value: hasLists ? '사용' : '미사용',
    score: scoreList,
    maxScore: 3,
  });

  // ─── 17. BOLD/EMPHASIS (2pts) ───────────────────────────────────────────
  const hasBold = content.hasBold || false;
  let scoreBold = hasBold ? 2 : 0;
  detail.boldUsage = { hasBold, score: scoreBold, max: 2 };
  checklist.push({
    category: 'quality',
    item: 'bold_usage',
    label: '강조 (Bold/Italic) 사용',
    passed: hasBold,
    value: hasBold ? '사용' : '미사용',
    score: scoreBold,
    maxScore: 2,
  });

  // ─── AGGREGATE SCORES BY CATEGORY ───────────────────────────────────────
  const score_title = scoreTitleLength + scoreTitleKeyword + scoreTitleClick;    // max 20
  const score_body = scoreBodyLength + scoreSubtitles + scoreParagraph;         // max 20
  const score_keyword = scoreKwDensity + scoreKwSpread;                         // max 15
  const score_image = scoreImage1 + scoreImage3;                                // max 15
  const score_internal_link = scoreLink1 + scoreLink3;                          // max 10
  const score_tag = scoreTags + scoreCategory;                                  // max 10
  const score_cycle = scoreCycle;                                               // max 5
  const score_quality = scoreList + scoreBold;                                  // max 5

  const totalScore = score_title + score_body + score_keyword + score_image +
    score_internal_link + score_tag + score_cycle + score_quality;

  // Determine grade
  const grade = _calculateGrade(totalScore);

  return {
    totalScore,
    grade,
    scores: {
      score_title,
      score_body,
      score_keyword,
      score_image,
      score_internal_link,
      score_tag,
      score_cycle,
      score_quality,
    },
    checklist,
    detail,
  };
}

/**
 * Calculate SEO grade based on total score.
 * S: >=85, A: >=70, B: >=50, C: >=30, D: <30
 *
 * @param {number} score
 * @returns {string}
 */
function _calculateGrade(score) {
  if (score >= SEO_GRADES.S.min) return 'S';
  if (score >= SEO_GRADES.A.min) return 'A';
  if (score >= SEO_GRADES.B.min) return 'B';
  if (score >= SEO_GRADES.C.min) return 'C';
  return 'D';
}

/**
 * Return an empty SEO result (for when content is unavailable).
 */
function _emptyResult() {
  return {
    totalScore: 0,
    grade: 'D',
    scores: {
      score_title: 0,
      score_body: 0,
      score_keyword: 0,
      score_image: 0,
      score_internal_link: 0,
      score_tag: 0,
      score_cycle: 0,
      score_quality: 0,
    },
    checklist: [],
    detail: {},
  };
}

module.exports = {
  analyzeSeoPost,
  _calculateGrade,
};
