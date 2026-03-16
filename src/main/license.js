const { app } = require('electron');
const { machineIdSync } = require('node-machine-id');
const { API_BASE } = require('../../shared/constants');

function getMachineId() {
  try {
    return machineIdSync(true);
  } catch {
    return 'unknown-machine';
  }
}

async function validateAndLoad(licenseKey) {
  const machineId = getMachineId();
  const appVersion = app?.getVersion?.() || '1.0.0';

  console.log(`[License] Validating key: ${licenseKey.slice(0, 8)}... against ${API_BASE}`);

  try {
    const res = await fetch(`${API_BASE}/api/validate-license`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ licenseKey, machineId, appVersion }),
    });

    if (!res.ok) {
      throw new Error(`Server responded with ${res.status}`);
    }

    const data = await res.json();
    console.log('[License] API response valid:', data.valid);

    if (data.valid) {
      try {
        const db = require('./data/db');
        db.syncInstructors(data.instructors || []);
        db.setSetting('naver_place_url', data.naverPlaceUrl || '');
        db.setSetting('plan', data.plan);
        db.setSetting('license_key', licenseKey);
        db.setSetting('last_license_check', new Date().toISOString());
        db.setSetting('machine_id', machineId);
        console.log(`[License] Synced ${(data.instructors || []).length} instructors to local DB`);
      } catch {
        // db module not available yet
      }
    }

    return data;
  } catch (err) {
    console.error('[License] Validation failed:', err.message);
    try {
      const db = require('./data/db');
      const lastCheck = db.getSetting('last_license_check');
      const storedKey = db.getSetting('license_key');

      if (storedKey === licenseKey && lastCheck) {
        const daysSince = (Date.now() - new Date(lastCheck).getTime()) / 86400000;
        if (daysSince <= 30) {
          return {
            valid: true,
            offline: true,
            plan: db.getSetting('plan') || 'free',
            message: `오프라인 모드 (${Math.floor(30 - daysSince)}일 남음)`,
          };
        }
      }
    } catch {
      // db not available
    }

    return {
      valid: false,
      error: err.message || '서버 연결 실패',
    };
  }
}

async function revalidateIfNeeded() {
  try {
    const db = require('./data/db');
    const lastCheck = db.getSetting('last_license_check');
    const licenseKey = db.getSetting('license_key');

    if (!licenseKey) {
      console.log('[License] No saved license key — showing license gate');
      return;
    }

    if (!lastCheck) {
      console.log('[License] First check for saved key');
      await validateAndLoad(licenseKey);
      return;
    }

    const daysSince = (Date.now() - new Date(lastCheck).getTime()) / 86400000;
    if (daysSince >= 7) {
      console.log('[License] Re-validating (last check was', Math.floor(daysSince), 'days ago)');
      await validateAndLoad(licenseKey);
    } else {
      console.log('[License] Key still valid (checked', Math.floor(daysSince), 'days ago)');
    }
  } catch {
    console.log('[License] DB not available — skip revalidation');
  }
}

module.exports = { validateAndLoad, revalidateIfNeeded, getMachineId };
