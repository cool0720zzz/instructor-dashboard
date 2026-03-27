'use strict';

const XLSX = require('xlsx');
const fs = require('fs');
const https = require('https');
const http = require('http');

// ─── Excel date helpers ─────────────────────────────────────────────────────

/**
 * Parse an Excel date value that may be a serial number or a string.
 * Returns a Date object or null if unparseable.
 */
function parseExcelDate(value) {
  if (value == null || value === '') return null;

  // Already a Date object
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;

  // Numeric serial number (Excel epoch: 1900-01-01, with the Lotus 1-2-3 bug)
  if (typeof value === 'number') {
    // Excel serial date: days since 1900-01-00 (with bug treating 1900 as leap year)
    const excelEpoch = new Date(1899, 11, 30); // Dec 30, 1899
    const ms = excelEpoch.getTime() + value * 86400000;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }

  // String parsing
  const str = String(value).trim();
  if (!str) return null;

  // Try common Korean/ISO formats
  // YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD
  const isoMatch = str.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (isoMatch) {
    const d = new Date(+isoMatch[1], +isoMatch[2] - 1, +isoMatch[3]);
    return isNaN(d.getTime()) ? null : d;
  }

  // MM/DD/YYYY or MM-DD-YYYY
  const usMatch = str.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})/);
  if (usMatch) {
    const d = new Date(+usMatch[3], +usMatch[1] - 1, +usMatch[2]);
    return isNaN(d.getTime()) ? null : d;
  }

  // Fallback: native Date parse
  const fallback = new Date(str);
  return isNaN(fallback.getTime()) ? null : fallback;
}

/**
 * Normalize a date to midnight local time (strip time component).
 */
function normalizeDate(date) {
  if (!date) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

// ─── Excel functions ────────────────────────────────────────────────────────

/**
 * Get all sheet names from an Excel file.
 * @param {string} filePath - absolute path to the Excel file
 * @returns {string[]}
 */
function getSheetNames(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  const workbook = XLSX.readFile(filePath);
  return workbook.SheetNames;
}

/**
 * Get raw preview rows from a sheet (for column mapping UI).
 * @param {string} filePath
 * @param {string} sheetName
 * @param {number} [limit=10]
 * @returns {Array<Array<any>>} - array of row arrays
 */
function getPreviewRows(filePath, sheetName, limit = 10) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" not found. Available: ${workbook.SheetNames.join(', ')}`);
  }

  // Convert to array of arrays (header: 1 means raw arrays)
  const allRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  return allRows.slice(0, limit);
}

/**
 * Parse an Excel file with user-defined column mapping.
 * @param {string} filePath
 * @param {string} sheetName
 * @param {object} columnMapping - { name, instructor, contractDate, regType, session }
 * @param {number} [startRow=1] - 1-based row index where data starts (after header)
 * @returns {Array<object>} - parsed records
 */
function parseExcelWithMapping(filePath, sheetName, columnMapping, startRow = 1) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" not found. Available: ${workbook.SheetNames.join(', ')}`);
  }

  const allRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true });
  // startRow is 1-based (row 0 = header), so slice from startRow
  const dataRows = allRows.slice(startRow);

  return mapRowsToRecords(dataRows, columnMapping);
}

/**
 * Map raw row arrays to record objects using column mapping.
 */
function mapRowsToRecords(rows, columnMapping) {
  const records = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const nameVal = columnMapping.name != null ? row[columnMapping.name] : null;
    const instructorVal = columnMapping.instructor != null ? row[columnMapping.instructor] : null;
    const dateVal = columnMapping.contractDate != null ? row[columnMapping.contractDate] : null;
    const regTypeVal = columnMapping.regType != null ? row[columnMapping.regType] : null;
    const sessionVal = columnMapping.session != null ? row[columnMapping.session] : null;

    // Skip rows where member name is empty
    const name = nameVal != null ? String(nameVal).trim() : '';
    if (!name) continue;

    const instructor = instructorVal != null ? String(instructorVal).trim() : '';
    const contractDate = parseExcelDate(dateVal);
    const regTypeStr = regTypeVal != null ? String(regTypeVal).trim() : '';
    const isReRegistration = regTypeStr.includes('재등록');

    // Session: use mapped value or default to 10
    let session = 10;
    if (sessionVal != null) {
      const parsed = parseInt(sessionVal, 10);
      if (!isNaN(parsed) && parsed > 0) {
        session = parsed;
      }
    }

    records.push({
      name,
      instructor,
      contractDate: normalizeDate(contractDate),
      contractDateRaw: dateVal,
      regType: regTypeStr,
      isReRegistration,
      session,
      rowIndex: i,
    });
  }

  return records;
}

// ─── Google Sheets functions ────────────────────────────────────────────────

/**
 * Convert a Google Sheets share URL to a CSV export URL.
 * Handles various URL formats:
 *   - https://docs.google.com/spreadsheets/d/{ID}/edit...
 *   - https://docs.google.com/spreadsheets/d/{ID}/
 *   - With or without gid parameter for specific sheets
 * @param {string} shareUrl
 * @returns {string} CSV export URL
 */
function parseGoogleSheetUrl(shareUrl) {
  if (!shareUrl || typeof shareUrl !== 'string') {
    throw new Error('Invalid Google Sheets URL');
  }

  const url = shareUrl.trim();

  // Extract spreadsheet ID
  const idMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (!idMatch) {
    throw new Error('Could not extract spreadsheet ID from URL: ' + url);
  }
  const spreadsheetId = idMatch[1];

  // Extract gid if present
  let gid = '0';
  const gidMatch = url.match(/[#&?]gid=(\d+)/);
  if (gidMatch) {
    gid = gidMatch[1];
  }

  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
}

/**
 * Fetch a Google Sheet as raw CSV rows.
 * The sheet must be publicly shared (anyone with link can view).
 * @param {string} shareUrl - Google Sheets share/edit URL
 * @returns {Promise<Array<Array<string>>>} - raw rows
 */
function fetchGoogleSheet(shareUrl) {
  const csvUrl = parseGoogleSheetUrl(shareUrl);

  return new Promise((resolve, reject) => {
    const doFetch = (fetchUrl, redirectCount) => {
      if (redirectCount > 5) {
        reject(new Error('Too many redirects'));
        return;
      }

      const protocol = fetchUrl.startsWith('https') ? https : http;
      protocol.get(fetchUrl, (res) => {
        // Handle redirects
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          doFetch(res.headers.location, redirectCount + 1);
          return;
        }

        if (res.statusCode !== 200) {
          reject(new Error(`Failed to fetch Google Sheet: HTTP ${res.statusCode}. Make sure the sheet is publicly shared.`));
          return;
        }

        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const csv = Buffer.concat(chunks).toString('utf-8');
          const rows = parseCsv(csv);
          resolve(rows);
        });
        res.on('error', reject);
      }).on('error', reject);
    };

    doFetch(csvUrl, 0);
  });
}

/**
 * Simple CSV parser that handles quoted fields.
 * @param {string} text
 * @returns {Array<Array<string>>}
 */
function parseCsv(text) {
  const rows = [];
  let currentRow = [];
  let currentField = '';
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        // Check for escaped quote
        if (i + 1 < text.length && text[i + 1] === '"') {
          currentField += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        currentField += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === ',') {
        currentRow.push(currentField);
        currentField = '';
        i++;
      } else if (ch === '\n') {
        currentRow.push(currentField);
        currentField = '';
        rows.push(currentRow);
        currentRow = [];
        i++;
      } else if (ch === '\r') {
        // Skip \r, handle \r\n
        i++;
        if (i < text.length && text[i] === '\n') {
          i++;
        }
        currentRow.push(currentField);
        currentField = '';
        rows.push(currentRow);
        currentRow = [];
      } else {
        currentField += ch;
        i++;
      }
    }
  }

  // Last field/row
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows;
}

// ─── Calculation functions ──────────────────────────────────────────────────

/**
 * Default session duration in days (used to estimate contract expiry).
 * Typical: 10 sessions ~ 30 days, but configurable.
 */
const DEFAULT_DAYS_PER_SESSION = 3; // ~3 days per session

/**
 * Estimate the contract expiry date based on contract start + session count.
 * @param {Date} contractDate
 * @param {number} session - number of sessions
 * @returns {Date}
 */
function estimateExpiry(contractDate, session) {
  if (!contractDate) return null;
  const days = session * DEFAULT_DAYS_PER_SESSION;
  const expiry = new Date(contractDate);
  expiry.setDate(expiry.getDate() + days);
  return normalizeDate(expiry);
}

/**
 * Get unique instructor names from the data set.
 * @param {Array<object>} data - parsed records
 * @returns {string[]}
 */
function getInstructors(data) {
  const set = new Set();
  for (const row of data) {
    if (row.instructor) {
      set.add(row.instructor);
    }
  }
  return Array.from(set).sort();
}

/**
 * Get available months from the data (as month numbers 1-12).
 * Extracts unique months from contractDate fields.
 * @param {Array<object>} data
 * @returns {number[]}
 */
function getAvailableMonths(data) {
  const set = new Set();
  for (const row of data) {
    if (row.contractDate) {
      set.add(row.contractDate.getMonth() + 1);
    }
  }
  return Array.from(set).sort((a, b) => a - b);
}

/**
 * Verify cohort re-registrations by cross-referencing:
 * For each member with an initial registration, check if they appear again
 * later as a re-registration. Attach verification info to each record.
 *
 * @param {Array<object>} data - parsed records
 * @returns {Array<object>} - same records with added verification fields
 */
function verifyCohortReRegistrations(data) {
  // Sort by date for chronological processing
  const sorted = [...data].sort((a, b) => {
    if (!a.contractDate && !b.contractDate) return 0;
    if (!a.contractDate) return 1;
    if (!b.contractDate) return -1;
    return a.contractDate.getTime() - b.contractDate.getTime();
  });

  // Group records by member name
  const byMember = {};
  for (const record of sorted) {
    const key = record.name;
    if (!byMember[key]) byMember[key] = [];
    byMember[key].push(record);
  }

  // For each member, link their registrations in sequence
  for (const name of Object.keys(byMember)) {
    const memberRecords = byMember[name];

    for (let i = 0; i < memberRecords.length; i++) {
      const rec = memberRecords[i];
      const estimatedExpiry = estimateExpiry(rec.contractDate, rec.session);

      rec.estimatedExpiry = estimatedExpiry;
      rec.registrationIndex = i; // 0 = first registration
      rec.totalRegistrations = memberRecords.length;

      if (i > 0) {
        // This is a return visit: link to the previous registration
        rec.previousRegistration = memberRecords[i - 1].contractDate;
        rec.verifiedReRegistration = true;
      } else {
        rec.previousRegistration = null;
        rec.verifiedReRegistration = false;
      }

      // Check if this member has a subsequent registration (i.e., they did re-register)
      if (i < memberRecords.length - 1) {
        rec.didReRegisterLater = true;
        rec.nextRegistration = memberRecords[i + 1].contractDate;
      } else {
        rec.didReRegisterLater = false;
        rec.nextRegistration = null;
      }
    }
  }

  return sorted;
}

/**
 * Calculate aggregate statistics from data, with optional filter.
 * @param {Array<object>} data - records (ideally after verifyCohortReRegistrations)
 * @param {object} [filter] - { instructor?, month?, startDate?, endDate? }
 * @returns {object} stats
 */
function calculateStats(data, filter) {
  let filtered = filterData(data, filter);

  const total = filtered.length;
  const newRegistrations = filtered.filter(r => !r.isReRegistration).length;
  const reRegistrations = filtered.filter(r => r.isReRegistration).length;
  const reRegistrationRate = total > 0 ? (reRegistrations / total) * 100 : 0;

  // Group by instructor
  const byInstructor = {};
  for (const row of filtered) {
    const key = row.instructor || '(미배정)';
    if (!byInstructor[key]) {
      byInstructor[key] = { total: 0, new: 0, reReg: 0 };
    }
    byInstructor[key].total++;
    if (row.isReRegistration) {
      byInstructor[key].reReg++;
    } else {
      byInstructor[key].new++;
    }
  }

  // Per-instructor rates
  const instructorStats = {};
  for (const [name, counts] of Object.entries(byInstructor)) {
    instructorStats[name] = {
      ...counts,
      rate: counts.total > 0 ? (counts.reReg / counts.total) * 100 : 0,
    };
  }

  // Monthly breakdown
  const byMonth = {};
  for (const row of filtered) {
    if (!row.contractDate) continue;
    const monthKey = `${row.contractDate.getFullYear()}-${String(row.contractDate.getMonth() + 1).padStart(2, '0')}`;
    if (!byMonth[monthKey]) {
      byMonth[monthKey] = { total: 0, new: 0, reReg: 0 };
    }
    byMonth[monthKey].total++;
    if (row.isReRegistration) {
      byMonth[monthKey].reReg++;
    } else {
      byMonth[monthKey].new++;
    }
  }

  return {
    total,
    newRegistrations,
    reRegistrations,
    reRegistrationRate: Math.round(reRegistrationRate * 10) / 10,
    byInstructor: instructorStats,
    byMonth,
  };
}

/**
 * Compute expiry targets: members whose estimated contract expiry falls
 * within a given timeframe, indicating they should be re-registering soon.
 *
 * @param {Array<object>} data - records after verifyCohortReRegistrations
 * @param {string} [instructor] - filter by instructor (null = all)
 * @returns {Array<object>} - target records with expiry info
 */
function computeExpiryTargets(data, instructor) {
  let filtered = data;
  if (instructor) {
    filtered = filtered.filter(r => r.instructor === instructor);
  }

  // Only consider non-re-registration records (first/new registrations),
  // OR the latest registration for each member.
  // We want the latest registration per member to compute their expiry.
  const latestByMember = {};
  for (const row of filtered) {
    const key = row.name;
    if (!latestByMember[key] || (row.contractDate && latestByMember[key].contractDate &&
        row.contractDate.getTime() > latestByMember[key].contractDate.getTime())) {
      latestByMember[key] = row;
    }
  }

  const targets = Object.values(latestByMember).map(row => ({
    name: row.name,
    instructor: row.instructor,
    contractDate: row.contractDate,
    session: row.session,
    estimatedExpiry: estimateExpiry(row.contractDate, row.session),
    isReRegistration: row.isReRegistration,
    didReRegisterLater: row.didReRegisterLater,
    totalRegistrations: row.totalRegistrations || 1,
  }));

  return targets.sort((a, b) => {
    if (!a.estimatedExpiry && !b.estimatedExpiry) return 0;
    if (!a.estimatedExpiry) return 1;
    if (!b.estimatedExpiry) return -1;
    return a.estimatedExpiry.getTime() - b.estimatedExpiry.getTime();
  });
}

/**
 * Calculate expiry-based re-registration stats for a given instructor and optional month.
 *
 * This determines:
 * - How many members' contracts were expiring in the period (targets)
 * - How many of those actually re-registered
 * - How many departed (did not re-register)
 *
 * @param {Array<object>} data - records after verifyCohortReRegistrations
 * @param {string} [instructor] - filter by instructor (null = all)
 * @param {number} [month] - filter by month (1-12, null = all)
 * @returns {object} { targetCount, reRegCount, departedCount, rate, targets }
 */
function calculateExpiryStats(data, instructor, month) {
  // Get all records, optionally filtered by instructor
  let filtered = data;
  if (instructor) {
    filtered = filtered.filter(r => r.instructor === instructor);
  }

  // Build a map of member registrations
  const byMember = {};
  for (const row of filtered) {
    const key = row.name;
    if (!byMember[key]) byMember[key] = [];
    byMember[key].push(row);
  }

  // Sort each member's registrations by date
  for (const name of Object.keys(byMember)) {
    byMember[name].sort((a, b) => {
      if (!a.contractDate && !b.contractDate) return 0;
      if (!a.contractDate) return 1;
      if (!b.contractDate) return -1;
      return a.contractDate.getTime() - b.contractDate.getTime();
    });
  }

  // For each registration (except the last one per member), check if the member
  // re-registered. The expiry month determines which period this target belongs to.
  const targets = [];

  for (const name of Object.keys(byMember)) {
    const regs = byMember[name];

    for (let i = 0; i < regs.length; i++) {
      const reg = regs[i];
      const expiry = estimateExpiry(reg.contractDate, reg.session);
      if (!expiry) continue;

      // Filter by month if specified
      if (month != null && (expiry.getMonth() + 1) !== month) continue;

      const hasNext = i < regs.length - 1;
      const nextReg = hasNext ? regs[i + 1] : null;

      targets.push({
        name: reg.name,
        instructor: reg.instructor,
        contractDate: reg.contractDate,
        estimatedExpiry: expiry,
        session: reg.session,
        didReRegister: hasNext,
        nextRegistrationDate: nextReg ? nextReg.contractDate : null,
      });
    }
  }

  const targetCount = targets.length;
  const reRegCount = targets.filter(t => t.didReRegister).length;
  const departedCount = targetCount - reRegCount;
  const rate = targetCount > 0 ? Math.round((reRegCount / targetCount) * 1000) / 10 : 0;

  return {
    targetCount,
    reRegCount,
    departedCount,
    rate,
    targets,
  };
}

/**
 * Calculate monthly trend data for re-registration rate.
 * @param {Array<object>} data - records after verifyCohortReRegistrations
 * @param {string} [instructor] - filter by instructor (null = all)
 * @returns {Array<object>} - [ { month, year, monthLabel, targetCount, reRegCount, departedCount, rate } ]
 */
function calculateMonthlyTrend(data, instructor) {
  // Get date range from data
  let minDate = null;
  let maxDate = null;
  for (const row of data) {
    if (!row.contractDate) continue;
    if (!minDate || row.contractDate < minDate) minDate = row.contractDate;
    if (!maxDate || row.contractDate > maxDate) maxDate = row.contractDate;
  }

  if (!minDate || !maxDate) return [];

  // Generate month buckets
  const trend = [];
  const current = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  const end = new Date(maxDate.getFullYear(), maxDate.getMonth() + 2, 1); // extend a bit for expiry

  while (current < end) {
    const month = current.getMonth() + 1;
    const year = current.getFullYear();

    const stats = calculateExpiryStats(data, instructor || null, month);

    // Only include months that have targets
    if (stats.targetCount > 0) {
      trend.push({
        month,
        year,
        monthLabel: `${year}-${String(month).padStart(2, '0')}`,
        targetCount: stats.targetCount,
        reRegCount: stats.reRegCount,
        departedCount: stats.departedCount,
        rate: stats.rate,
      });
    }

    current.setMonth(current.getMonth() + 1);
  }

  return trend;
}

/**
 * Format a revenue/number value with Korean units (만, 억).
 * @param {number} value
 * @returns {string}
 */
function formatRevenue(value) {
  if (value == null || isNaN(value)) return '0';

  const absVal = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (absVal >= 100000000) {
    // 억
    const eok = absVal / 100000000;
    return sign + (eok % 1 === 0 ? eok.toFixed(0) : eok.toFixed(1)) + '억';
  }
  if (absVal >= 10000) {
    // 만
    const man = absVal / 10000;
    return sign + (man % 1 === 0 ? man.toFixed(0) : man.toFixed(1)) + '만';
  }
  return sign + absVal.toLocaleString('ko-KR');
}

// ─── Internal helpers ───────────────────────────────────────────────────────

/**
 * Apply filter to data records.
 * @param {Array<object>} data
 * @param {object} [filter] - { instructor?, month?, startDate?, endDate? }
 * @returns {Array<object>}
 */
function filterData(data, filter) {
  if (!filter) return data;

  let result = data;

  if (filter.instructor) {
    result = result.filter(r => r.instructor === filter.instructor);
  }

  if (filter.month != null) {
    result = result.filter(r => r.contractDate && (r.contractDate.getMonth() + 1) === filter.month);
  }

  if (filter.startDate) {
    const start = normalizeDate(filter.startDate instanceof Date ? filter.startDate : new Date(filter.startDate));
    if (start) {
      result = result.filter(r => r.contractDate && r.contractDate >= start);
    }
  }

  if (filter.endDate) {
    const end = normalizeDate(filter.endDate instanceof Date ? filter.endDate : new Date(filter.endDate));
    if (end) {
      result = result.filter(r => r.contractDate && r.contractDate <= end);
    }
  }

  return result;
}

// ─── Exports ────────────────────────────────────────────────────────────────

module.exports = {
  // Excel
  parseExcelWithMapping,
  getSheetNames,
  getPreviewRows,

  // Google Sheets
  fetchGoogleSheet,
  parseGoogleSheetUrl,

  // Calculation
  verifyCohortReRegistrations,
  calculateStats,
  computeExpiryTargets,
  calculateExpiryStats,
  getInstructors,
  getAvailableMonths,
  calculateMonthlyTrend,
  formatRevenue,

  // Internal helpers (exported for testing)
  parseExcelDate,
  normalizeDate,
  estimateExpiry,
  parseCsv,
  mapRowsToRecords,
  filterData,
};
