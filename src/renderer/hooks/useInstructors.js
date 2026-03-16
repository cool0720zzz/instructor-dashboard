import { useState, useEffect, useCallback } from 'react';

// Mock data for development (server/db not ready)
const MOCK_INSTRUCTORS = [
  {
    id: 1,
    name: '김지수',
    displayColor: '#60a5fa',
    blogWeek: 3,
    blogMonth: 11,
    reviewWeek: 2,
    reviewMonth: 8,
    status: 'ok',
    seoResults: [
      { id: 1, total_score: 88, grade: 'S' },
      { id: 2, total_score: 91, grade: 'S' },
      { id: 3, total_score: 72, grade: 'A' },
    ],
  },
  {
    id: 2,
    name: '박민준',
    displayColor: '#fb923c',
    blogWeek: 1,
    blogMonth: 5,
    reviewWeek: 0,
    reviewMonth: 3,
    status: 'caution',
    seoResults: [
      { id: 4, total_score: 78, grade: 'A' },
      { id: 5, total_score: 55, grade: 'B' },
      { id: 6, total_score: 62, grade: 'B' },
    ],
  },
  {
    id: 3,
    name: '이서연',
    displayColor: '#e879f9',
    blogWeek: 0,
    blogMonth: 1,
    reviewWeek: 0,
    reviewMonth: 0,
    status: 'danger',
    seoResults: [
      { id: 7, total_score: 45, grade: 'C' },
      { id: 8, total_score: 38, grade: 'C' },
      { id: 9, total_score: 22, grade: 'D' },
    ],
  },
];

export function useInstructors(licensed = true) {
  const [instructors, setInstructors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (window.electronAPI) {
        const data = await window.electronAPI.getDashboardData();
        setInstructors(data || []);
      } else {
        // Running in browser without Electron — use mock
        setInstructors(MOCK_INSTRUCTORS);
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
      setError(err.message);
      setInstructors([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Only fetch when licensed — re-fetch when licensed changes to true
  useEffect(() => {
    if (licensed) {
      fetchData();
    }
  }, [licensed, fetchData]);

  // Auto-refresh when collection completes
  useEffect(() => {
    if (!licensed || !window.electronAPI?.onCollectionStatus) return;
    const unsub = window.electronAPI.onCollectionStatus((status) => {
      if (!status.collecting && status.completedAt) {
        fetchData();
      }
    });
    return unsub;
  }, [licensed, fetchData]);

  // Also refresh when weekly check completes
  useEffect(() => {
    if (!licensed || !window.electronAPI?.onWeeklyCheckDone) return;
    const unsub = window.electronAPI.onWeeklyCheckDone(() => {
      fetchData();
    });
    return unsub;
  }, [licensed, fetchData]);

  const refresh = useCallback(async () => {
    if (window.electronAPI) {
      await window.electronAPI.triggerRssRefresh();
    }
    // Data will auto-refresh via collection-status event
  }, []);

  return { instructors, loading, error, refresh };
}
