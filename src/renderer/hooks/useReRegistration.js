import { useState, useEffect, useCallback, useMemo } from 'react';

// ─── Utility: date helpers ───

function parseDate(val) {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val) ? null : val;
  const s = String(val).trim();
  // Handle Excel serial dates (numbers like 45678)
  if (/^\d{5}$/.test(s)) {
    const d = new Date((parseInt(s, 10) - 25569) * 86400000);
    return isNaN(d) ? null : d;
  }
  // Try common formats
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function isSameMonth(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function addMonths(date, n) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

function monthLabel(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

// ─── Core calculation functions (client-side) ───

/**
 * Compute expiry date for a record.
 * If sessionCount is available, estimate ~2 sessions/week => weeks = sessions/2.
 * Otherwise default to 3 months from registration.
 */
function computeExpiryDate(record) {
  const regDate = parseDate(record.registrationDate);
  if (!regDate) return null;
  if (record.sessionCount && record.sessionCount > 0) {
    const weeks = Math.ceil(record.sessionCount / 2);
    const expiry = new Date(regDate);
    expiry.setDate(expiry.getDate() + weeks * 7);
    return expiry;
  }
  // Default: 3 months
  return addMonths(regDate, 3);
}

/**
 * Determine if a member re-registered.
 * Looks for a later record with type containing '재등록' or 'renewal'.
 */
function isReRegistration(record) {
  const type = (record.registrationType || '').toLowerCase();
  return type.includes('재등록') || type.includes('renewal') || type.includes('재') || type.includes('연장');
}

function isNewRegistration(record) {
  const type = (record.registrationType || '').toLowerCase();
  return type.includes('신규') || type.includes('new') || type.includes('등록');
}

/**
 * Build cohort-based expiry targets.
 * Groups records by member name + instructor, finds initial registration,
 * then checks if a re-registration follows before expiry.
 */
export function computeExpiryTargets(records) {
  // Group by member name
  const byMember = {};
  for (const r of records) {
    const key = `${r.memberName}__${r.instructor || ''}`;
    if (!byMember[key]) byMember[key] = [];
    byMember[key].push(r);
  }

  const targets = [];

  for (const key of Object.keys(byMember)) {
    const memberRecords = byMember[key].sort((a, b) => {
      const da = parseDate(a.registrationDate);
      const db = parseDate(b.registrationDate);
      return (da?.getTime() || 0) - (db?.getTime() || 0);
    });

    for (let i = 0; i < memberRecords.length; i++) {
      const rec = memberRecords[i];
      const regDate = parseDate(rec.registrationDate);
      if (!regDate) continue;

      const expiryDate = computeExpiryDate(rec);
      if (!expiryDate) continue;

      // Check if the next record is a re-registration
      const nextRec = memberRecords[i + 1];
      let status = 'waiting'; // waiting | reregistered | departed
      if (nextRec) {
        const nextDate = parseDate(nextRec.registrationDate);
        if (nextDate && isReRegistration(nextRec)) {
          status = 'reregistered';
        } else if (nextDate && nextDate > expiryDate) {
          status = 'departed';
        } else if (nextRec) {
          status = 'reregistered';
        }
      } else {
        // No next record
        const now = new Date();
        if (expiryDate < now) {
          status = 'departed';
        } else {
          status = 'waiting';
        }
      }

      targets.push({
        memberName: rec.memberName,
        instructor: rec.instructor || '',
        registrationDate: regDate,
        expiryDate,
        sessionCount: rec.sessionCount || null,
        registrationType: rec.registrationType || '',
        status,
        nextRegistrationDate: nextRec ? parseDate(nextRec.registrationDate) : null,
      });
    }
  }

  return targets;
}

/**
 * Verify cohort re-registrations: for each expiry target in a given month,
 * check if there is a matching re-registration record.
 */
export function verifyCohortReRegistrations(targets, records, month) {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);

  return targets.filter((t) => t.expiryDate >= monthStart && t.expiryDate <= monthEnd);
}

/**
 * Calculate overall stats from expiry targets.
 */
export function calculateStats(targets, filterInstructor) {
  let filtered = targets;
  if (filterInstructor) {
    filtered = targets.filter((t) => t.instructor === filterInstructor);
  }

  const now = new Date();
  const currentMonth = startOfMonth(now);
  const currentMonthEnd = endOfMonth(now);

  // Overall (all expired targets)
  const expired = filtered.filter((t) => t.expiryDate < now);
  const reregistered = expired.filter((t) => t.status === 'reregistered');
  const departed = expired.filter((t) => t.status === 'departed');

  const overallRate = expired.length > 0
    ? Math.round((reregistered.length / expired.length) * 100)
    : 0;

  // This month
  const thisMonthTargets = filtered.filter(
    (t) => t.expiryDate >= currentMonth && t.expiryDate <= currentMonthEnd,
  );
  const thisMonthExpired = thisMonthTargets.filter((t) => t.expiryDate < now);
  const thisMonthRereg = thisMonthTargets.filter((t) => t.status === 'reregistered');
  const thisMonthRate = thisMonthTargets.length > 0
    ? Math.round((thisMonthRereg.length / thisMonthTargets.length) * 100)
    : 0;

  return {
    totalExpired: expired.length,
    totalReregistered: reregistered.length,
    totalDeparted: departed.length,
    overallRate,
    thisMonthTargets: thisMonthTargets.length,
    thisMonthReregistered: thisMonthRereg.length,
    thisMonthRate,
    departedCount: departed.length,
  };
}

/**
 * Calculate per-instructor expiry stats for a specific month.
 */
export function calculateExpiryStats(targets, instructor, month) {
  const m = month || new Date();
  const mStart = startOfMonth(m);
  const mEnd = endOfMonth(m);

  let filtered = targets;
  if (instructor) {
    filtered = targets.filter((t) => t.instructor === instructor);
  }

  const monthTargets = filtered.filter(
    (t) => t.expiryDate >= mStart && t.expiryDate <= mEnd,
  );

  const reregistered = monthTargets.filter((t) => t.status === 'reregistered');
  const departed = monthTargets.filter((t) => t.status === 'departed');
  const waiting = monthTargets.filter((t) => t.status === 'waiting');

  return {
    total: monthTargets.length,
    reregistered: reregistered.length,
    departed: departed.length,
    waiting: waiting.length,
    rate: monthTargets.length > 0
      ? Math.round((reregistered.length / monthTargets.length) * 100)
      : 0,
    targets: monthTargets,
  };
}

/**
 * Extract unique instructor names from records.
 */
export function getInstructorsFromRecords(records) {
  const set = new Set();
  for (const r of records) {
    if (r.instructor) set.add(r.instructor);
  }
  return Array.from(set).sort();
}

// ─── Hook ───

export function useReRegistration() {
  const [records, setRecords] = useState([]);
  const [config, setConfigState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const configured = !!(config && (config.filePath || config.googleSheetUrl));

  // Load config on mount
  useEffect(() => {
    async function init() {
      try {
        if (window.electronAPI?.getReregConfig) {
          const cfg = await window.electronAPI.getReregConfig();
          setConfigState(cfg || null);
        } else {
          setConfigState(null);
        }
      } catch (err) {
        console.error('Failed to load rereg config:', err);
        setConfigState(null);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  // Load data when config is available
  const loadData = useCallback(async (cfg) => {
    const useConfig = cfg || config;
    if (!useConfig) return;

    setLoading(true);
    setError(null);
    try {
      if (window.electronAPI?.parseReregData) {
        const parsed = await window.electronAPI.parseReregData(useConfig);
        setRecords(parsed || []);
      } else {
        // Dev fallback: empty
        setRecords([]);
      }
    } catch (err) {
      console.error('Failed to parse rereg data:', err);
      setError(err.message || '데이터를 불러올 수 없습니다');
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [config]);

  // Auto-load when configured
  useEffect(() => {
    if (configured) {
      loadData();
    }
  }, [configured, loadData]);

  const setConfig = useCallback(async (newConfig) => {
    try {
      if (window.electronAPI?.setReregConfig) {
        await window.electronAPI.setReregConfig(newConfig);
      }
      setConfigState(newConfig);
      await loadData(newConfig);
    } catch (err) {
      console.error('Failed to save rereg config:', err);
      setError(err.message || '설정 저장에 실패했습니다');
    }
  }, [loadData]);

  // Computed: expiry targets
  const expiryTargets = useMemo(() => computeExpiryTargets(records), [records]);

  const getStats = useCallback(
    (filterInstructor) => calculateStats(expiryTargets, filterInstructor),
    [expiryTargets],
  );

  const getExpiryStats = useCallback(
    (instructor, month) => calculateExpiryStats(expiryTargets, instructor, month),
    [expiryTargets],
  );

  const getInstructors = useCallback(
    () => getInstructorsFromRecords(records),
    [records],
  );

  return {
    records,
    config,
    loading,
    error,
    configured,
    expiryTargets,
    loadData,
    setConfig,
    getStats,
    getExpiryStats,
    getInstructors,
  };
}
