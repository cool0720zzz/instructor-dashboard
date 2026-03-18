import React, { useState } from 'react';

export default function LicenseGate({ onValid }) {
  const [licenseKey, setLicenseKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!licenseKey.trim()) {
      setError('라이선스 키를 입력해 주세요');
      return;
    }

    setLoading(true);
    setError('');

    try {
      let result;
      if (window.electronAPI) {
        result = await window.electronAPI.validateLicense(licenseKey.trim());
      } else {
        // Browser dev mode — mock success
        result = { valid: true, plan: 'standard', maxInstructors: 10 };
      }

      if (result.valid) {
        onValid();
      } else {
        setError(result.error || '유효하지 않은 라이선스 키입니다');
      }
    } catch (err) {
      setError('서버 연결에 실패했습니다. 네트워크를 확인해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gray-900/95 rounded-lg">
      <div className="w-full max-w-sm mx-auto px-6">
        <div className="text-center mb-8">
          <h1 className="text-xl font-bold text-white mb-2">LINO매니저</h1>
          <p className="text-gray-400 text-sm">라이선스 키를 입력하여 활성화하세요</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value)}
              placeholder="PRO-XXXX-XXXX-XXXX"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white
                         placeholder-gray-500 text-center text-lg tracking-wider
                         focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500
                         transition-colors"
              disabled={loading}
              autoFocus
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800
                       disabled:cursor-not-allowed text-white font-medium rounded-lg
                       transition-colors"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                확인 중...
              </span>
            ) : (
              '활성화'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
