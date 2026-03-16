import { useState, useEffect, useCallback } from 'react';

const STATUS_PRIORITY = { danger: 0, warning: 1, caution: 2, ok: 3 };

export function useAlerts(instructors) {
  const [alerts, setAlerts] = useState([]);
  const [hasNewAlert, setHasNewAlert] = useState(false);

  useEffect(() => {
    if (!instructors || instructors.length === 0) return;

    const alertList = instructors
      .filter((inst) => inst.status !== 'ok')
      .map((inst) => ({
        id: inst.id,
        name: inst.name,
        status: inst.status,
        message: getAlertMessage(inst),
      }))
      .sort((a, b) => STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status]);

    setAlerts(alertList);
    setHasNewAlert(alertList.length > 0);
  }, [instructors]);

  // Listen for weekly check completion events
  useEffect(() => {
    if (!window.electronAPI?.onWeeklyCheckDone) return;

    const unsubscribe = window.electronAPI.onWeeklyCheckDone(() => {
      setHasNewAlert(true);
    });

    return unsubscribe;
  }, []);

  const dismissAlerts = useCallback(() => {
    setHasNewAlert(false);
  }, []);

  return { alerts, hasNewAlert, dismissAlerts };
}

function getAlertMessage(instructor) {
  switch (instructor.status) {
    case 'danger':
      return `${instructor.name} 강사: 2주 연속 활동 없음! 즉시 확인 필요`;
    case 'warning':
      return `${instructor.name} 강사: 이번 주 블로그/리뷰 활동 없음`;
    case 'caution':
      return `${instructor.name} 강사: 블로그 또는 리뷰 중 일부 미달`;
    default:
      return '';
  }
}
