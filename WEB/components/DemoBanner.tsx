import React from 'react';

const IS_DEMO = (import.meta as any).env?.VITE_USE_MOCK_API === 'true';

export default function DemoBanner() {
  if (!IS_DEMO) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-black text-xs font-semibold text-center py-1.5 px-4 flex items-center justify-center gap-2">
      <span className="material-symbols-outlined text-sm" style={{ fontSize: '14px' }}>info</span>
      <span>Modo Demo — dados fictícios. Login: CPF <strong>11111111111</strong> / Senha <strong>1234</strong></span>
    </div>
  );
}
