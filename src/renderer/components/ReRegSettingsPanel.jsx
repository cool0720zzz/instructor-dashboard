import React, { useState, useEffect, useCallback } from 'react';

const COLUMN_LETTERS = ['', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P'];

function ColumnSelect({ label, value, onChange, required, columns }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label className="text-xs text-gray-400 shrink-0">
        {label}
        {!required && <span className="text-gray-600 ml-1">(선택)</span>}
      </label>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="w-28 px-2 py-1.5 bg-gray-700/80 border border-gray-600/50 rounded-lg text-white text-xs
                   focus:outline-none focus:border-blue-500 transition-colors"
      >
        <option value="">선택 안함</option>
        {columns.map((col) => (
          <option key={col} value={col}>{col}열</option>
        ))}
      </select>
    </div>
  );
}

export default function ReRegSettingsPanel({ onClose, onSave }) {
  const [sourceType, setSourceType] = useState('excel'); // 'excel' | 'googleSheet'
  const [filePath, setFilePath] = useState('');
  const [sheetName, setSheetName] = useState('');
  const [sheetNames, setSheetNames] = useState([]);
  const [googleUrl, setGoogleUrl] = useState('');
  const [startRow, setStartRow] = useState(2);
  const [connecting, setConnecting] = useState(false);

  // Column mapping
  const [colMember, setColMember] = useState('A');
  const [colInstructor, setColInstructor] = useState('B');
  const [colDate, setColDate] = useState('C');
  const [colType, setColType] = useState('D');
  const [colSessions, setColSessions] = useState('');

  // Preview
  const [previewRows, setPreviewRows] = useState([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Load existing config
  useEffect(() => {
    async function loadConfig() {
      try {
        if (window.electronAPI?.getReregConfig) {
          const cfg = await window.electronAPI.getReregConfig();
          if (cfg) {
            setSourceType(cfg.sourceType || 'excel');
            setFilePath(cfg.filePath || '');
            setSheetName(cfg.sheetName || '');
            setGoogleUrl(cfg.googleSheetUrl || '');
            setStartRow(cfg.startRow || 2);
            if (cfg.columns) {
              setColMember(cfg.columns.memberName || 'A');
              setColInstructor(cfg.columns.instructor || 'B');
              setColDate(cfg.columns.registrationDate || 'C');
              setColType(cfg.columns.registrationType || 'D');
              setColSessions(cfg.columns.sessionCount || '');
            }
          }
        }
      } catch { /* use defaults */ }
    }
    loadConfig();
  }, []);

  // Escape key
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // File picker
  const handleSelectFile = useCallback(async () => {
    try {
      if (window.electronAPI?.selectReregFile) {
        const result = await window.electronAPI.selectReregFile();
        if (result?.filePath) {
          setFilePath(result.filePath);
          // Load sheet names
          if (window.electronAPI?.getReregSheetNames) {
            const names = await window.electronAPI.getReregSheetNames(result.filePath);
            setSheetNames(names || []);
            if (names?.length > 0 && !sheetName) {
              setSheetName(names[0]);
            }
          }
        }
      }
    } catch (err) {
      setError('파일을 열 수 없습니다');
    }
  }, [sheetName]);

  // Load sheet names when filePath changes
  useEffect(() => {
    async function loadSheets() {
      if (!filePath || sourceType !== 'excel') return;
      try {
        if (window.electronAPI?.getReregSheetNames) {
          const names = await window.electronAPI.getReregSheetNames(filePath);
          setSheetNames(names || []);
          if (names?.length > 0 && !sheetName) {
            setSheetName(names[0]);
          }
        }
      } catch { /* ignore */ }
    }
    loadSheets();
  }, [filePath, sourceType]);

  // Google Sheet connect
  const handleConnectGoogle = useCallback(async () => {
    if (!googleUrl.trim()) {
      setError('구글 스프레드시트 URL을 입력해주세요');
      return;
    }
    setConnecting(true);
    setError('');
    try {
      if (window.electronAPI?.fetchGoogleSheet) {
        const result = await window.electronAPI.fetchGoogleSheet(googleUrl.trim());
        if (result?.sheetNames) {
          setSheetNames(result.sheetNames);
          if (result.sheetNames.length > 0) {
            setSheetName(result.sheetNames[0]);
          }
        }
      }
    } catch (err) {
      setError('구글 시트에 연결할 수 없습니다. 공유 설정을 확인해주세요.');
    } finally {
      setConnecting(false);
    }
  }, [googleUrl]);

  // Load preview
  const loadPreview = useCallback(async () => {
    setPreviewLoading(true);
    setError('');
    try {
      const cfg = {
        sourceType,
        filePath: sourceType === 'excel' ? filePath : undefined,
        googleSheetUrl: sourceType === 'googleSheet' ? googleUrl : undefined,
        sheetName,
        startRow,
        columns: {
          memberName: colMember,
          instructor: colInstructor,
          registrationDate: colDate,
          registrationType: colType,
          sessionCount: colSessions || undefined,
        },
      };
      if (window.electronAPI?.previewReregData) {
        const rows = await window.electronAPI.previewReregData(cfg);
        setPreviewRows(rows || []);
      }
    } catch (err) {
      setError('미리보기를 불러올 수 없습니다');
      setPreviewRows([]);
    } finally {
      setPreviewLoading(false);
    }
  }, [sourceType, filePath, googleUrl, sheetName, startRow, colMember, colInstructor, colDate, colType, colSessions]);

  // Auto-preview when mapping changes and we have a source
  useEffect(() => {
    const hasSource = (sourceType === 'excel' && filePath) || (sourceType === 'googleSheet' && googleUrl);
    if (hasSource && colMember && colDate) {
      const timer = setTimeout(loadPreview, 500);
      return () => clearTimeout(timer);
    }
  }, [sourceType, filePath, googleUrl, sheetName, startRow, colMember, colInstructor, colDate, colType, colSessions, loadPreview]);

  // Save
  const handleSave = async () => {
    if (sourceType === 'excel' && !filePath) {
      setError('엑셀 파일을 선택해주세요');
      return;
    }
    if (sourceType === 'googleSheet' && !googleUrl) {
      setError('구글 스프레드시트 URL을 입력해주세요');
      return;
    }
    if (!colMember || !colDate) {
      setError('회원명과 등록일 컬럼은 필수입니다');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const cfg = {
        sourceType,
        filePath: sourceType === 'excel' ? filePath : undefined,
        googleSheetUrl: sourceType === 'googleSheet' ? googleUrl : undefined,
        sheetName,
        startRow,
        columns: {
          memberName: colMember,
          instructor: colInstructor,
          registrationDate: colDate,
          registrationType: colType,
          sessionCount: colSessions || undefined,
        },
      };
      await onSave(cfg);
    } catch (err) {
      setError('설정 저장에 실패했습니다');
    } finally {
      setSaving(false);
    }
  };

  const availableColumns = COLUMN_LETTERS.slice(1); // A-P
  const displayFileName = filePath ? filePath.split(/[/\\]/).pop() : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-gray-800 border border-gray-700/60 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-700/50 shrink-0">
          <h2 className="text-white font-semibold text-sm">재등록 데이터 설정</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-0.5 rounded hover:bg-gray-700/50"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Source type toggle */}
          <div className="space-y-2">
            <label className="text-xs text-gray-400 font-medium">데이터 소스</label>
            <div className="flex gap-2">
              <button
                onClick={() => setSourceType('excel')}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors border ${
                  sourceType === 'excel'
                    ? 'bg-blue-600/20 border-blue-500/50 text-blue-400'
                    : 'bg-gray-700/40 border-gray-600/30 text-gray-400 hover:text-gray-300'
                }`}
              >
                엑셀 파일
              </button>
              <button
                onClick={() => setSourceType('googleSheet')}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors border ${
                  sourceType === 'googleSheet'
                    ? 'bg-blue-600/20 border-blue-500/50 text-blue-400'
                    : 'bg-gray-700/40 border-gray-600/30 text-gray-400 hover:text-gray-300'
                }`}
              >
                구글 스프레드시트
              </button>
            </div>
          </div>

          {/* Source-specific fields */}
          {sourceType === 'excel' ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs text-gray-400">파일</label>
                <div className="flex gap-2">
                  <div className="flex-1 px-3 py-2 bg-gray-900/80 border border-gray-600/50 rounded-lg text-xs text-gray-300 truncate">
                    {displayFileName || '파일을 선택해주세요'}
                  </div>
                  <button
                    onClick={handleSelectFile}
                    className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs font-medium rounded-lg transition-colors shrink-0"
                  >
                    찾기
                  </button>
                </div>
              </div>
              {sheetNames.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-xs text-gray-400">시트</label>
                  <select
                    value={sheetName}
                    onChange={(e) => setSheetName(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700/80 border border-gray-600/50 rounded-lg text-white text-xs
                               focus:outline-none focus:border-blue-500 transition-colors"
                  >
                    {sheetNames.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-xs text-gray-400">구글 스프레드시트 URL</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={googleUrl}
                  onChange={(e) => setGoogleUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  className="flex-1 px-3 py-2 bg-gray-900/80 border border-gray-600/50 rounded-lg text-white text-xs
                             placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
                />
                <button
                  onClick={handleConnectGoogle}
                  disabled={connecting}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white text-xs font-medium rounded-lg transition-colors shrink-0"
                >
                  {connecting ? '...' : '연결'}
                </button>
              </div>
              {sheetNames.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  <label className="text-xs text-gray-400">시트</label>
                  <select
                    value={sheetName}
                    onChange={(e) => setSheetName(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700/80 border border-gray-600/50 rounded-lg text-white text-xs
                               focus:outline-none focus:border-blue-500 transition-colors"
                  >
                    {sheetNames.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Start row */}
          <div className="flex items-center justify-between">
            <label className="text-xs text-gray-400">데이터 시작 행</label>
            <select
              value={startRow}
              onChange={(e) => setStartRow(parseInt(e.target.value, 10))}
              className="w-20 px-2 py-1.5 bg-gray-700/80 border border-gray-600/50 rounded-lg text-white text-xs
                         focus:outline-none focus:border-blue-500 transition-colors"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          <div className="border-t border-gray-700/50" />

          {/* Column mapping */}
          <div className="space-y-3">
            <label className="text-xs text-gray-400 font-medium">컬럼 매핑</label>
            <div className="space-y-2.5">
              <ColumnSelect label="회원명" value={colMember} onChange={setColMember} required columns={availableColumns} />
              <ColumnSelect label="담당강사" value={colInstructor} onChange={setColInstructor} required columns={availableColumns} />
              <ColumnSelect label="등록일" value={colDate} onChange={setColDate} required columns={availableColumns} />
              <ColumnSelect label="등록구분" value={colType} onChange={setColType} required columns={availableColumns} />
              <ColumnSelect label="세션수" value={colSessions} onChange={setColSessions} required={false} columns={availableColumns} />
            </div>
          </div>

          <div className="border-t border-gray-700/50" />

          {/* Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-400 font-medium">미리보기 (처음 5행)</label>
              {previewLoading && (
                <svg className="animate-spin w-3 h-3 text-blue-400" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                  <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
              )}
            </div>

            {previewRows.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-gray-700/40">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-700/40 text-gray-400">
                      <th className="px-2 py-1.5 text-left font-medium">이름</th>
                      <th className="px-2 py-1.5 text-left font-medium">강사</th>
                      <th className="px-2 py-1.5 text-left font-medium">날짜</th>
                      <th className="px-2 py-1.5 text-left font-medium">구분</th>
                      {colSessions && <th className="px-2 py-1.5 text-left font-medium">세션</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.slice(0, 5).map((row, i) => (
                      <tr key={i} className="border-t border-gray-700/30 text-gray-300">
                        <td className="px-2 py-1.5">{row.memberName || '-'}</td>
                        <td className="px-2 py-1.5">{row.instructor || '-'}</td>
                        <td className="px-2 py-1.5">{row.registrationDate || '-'}</td>
                        <td className="px-2 py-1.5">{row.registrationType || '-'}</td>
                        {colSessions && <td className="px-2 py-1.5">{row.sessionCount || '-'}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-3 text-gray-600 text-[10px]">
                데이터 소스를 설정하면 미리보기가 표시됩니다
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="text-xs text-red-400 bg-red-900/20 border border-red-800/30 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-700/50 flex justify-end shrink-0">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800
                       text-white text-sm font-medium rounded-lg transition-colors"
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
