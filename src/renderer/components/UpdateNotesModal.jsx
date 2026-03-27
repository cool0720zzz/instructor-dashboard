import React from 'react';

export default function UpdateNotesModal({ version, notes, onClose }) {
  if (!notes || notes.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-80 max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-green-400 text-xs font-medium">업데이트 완료</span>
          </div>
          <h2 className="text-white text-lg font-bold">v{version}</h2>
        </div>

        {/* Notes */}
        <div className="px-5 pb-4">
          <ul className="space-y-2">
            {notes.map((note, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                <span className="text-blue-400 mt-0.5 shrink-0">+</span>
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5">
          <button
            onClick={onClose}
            className="w-full py-2 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
