import { useState, useCallback } from 'react';

export function useSeoResult() {
  const [seoDetail, setSeoDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const fetchSeoResults = useCallback(async (instructorId) => {
    setLoading(true);
    try {
      if (window.electronAPI) {
        const results = await window.electronAPI.getSeoResults(instructorId);
        if (results && results.length > 0) {
          setSeoDetail(results[0]);
        } else {
          setSeoDetail(null);
        }
      } else {
        setSeoDetail(null);
      }
    } catch (err) {
      console.error('Failed to fetch SEO results:', err);
      setSeoDetail(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const triggerAnalysis = useCallback(async (instructorId) => {
    setAnalyzing(true);
    try {
      if (window.electronAPI?.triggerSeoAnalyze) {
        await window.electronAPI.triggerSeoAnalyze(instructorId);
        // Re-fetch results after analysis
        await fetchSeoResults(instructorId);
      }
    } catch (err) {
      console.error('SEO analysis failed:', err);
    } finally {
      setAnalyzing(false);
    }
  }, [fetchSeoResults]);

  const clearSeoDetail = useCallback(() => {
    setSeoDetail(null);
  }, []);

  return { seoDetail, loading, analyzing, fetchSeoResults, triggerAnalysis, clearSeoDetail };
}
