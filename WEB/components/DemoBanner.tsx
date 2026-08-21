import React from 'react';

const IS_DEMO = (import.meta as any).env?.VITE_USE_MOCK_API === 'true';

export default function DemoBanner() {
  if (!IS_DEMO) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-black text-xs font-semibold text-center py-1.5 px-4 flex items-center justify-center gap-2">
      <span className="material-symbols-outlined text-sm" style={{ fontSize: '14px' }}>info</span>
      <span>Modo Demo — massas fictícias de <strong>demo-data/*.csv</strong>. Login: CPF <strong>34310951783</strong> / Senha <strong>admin999</strong></span>
    </div>
  );
}
