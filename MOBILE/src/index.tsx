
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './ErrorBoundary';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}
const root = ReactDOM.createRoot(rootElement);

// CRÍTICO PARA PERFORMANCE APK: Remover StrictMode em produção
// StrictMode causa renderizações duplas que bloqueiam o thread principal
const isDevelopment = import.meta.env.DEV;

const AppWithBoundary = (
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

// CRÍTICO: Aguardar fontes Material Symbols carregarem antes de renderizar
// Isso evita texto aparecer em vez de ícones (swap_horiz, barcode_scanner, etc)
const waitForFonts = () => {
  return new Promise<void>((resolve) => {
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        document.body.classList.add('fonts-loaded');
        resolve();
      }).catch(() => {
        // Se falhar, aguardar 500ms e continuar
        setTimeout(() => {
          document.body.classList.add('fonts-loaded');
          resolve();
        }, 500);
      });
    } else {
      // Fallback: aguardar 500ms e então mostrar
      setTimeout(() => {
        document.body.classList.add('fonts-loaded');
        resolve();
      }, 500);
    }
  });
};

// Renderizar após fontes carregarem (não bloqueia - apenas adia renderização inicial)
waitForFonts().then(() => {
  root.render(
    isDevelopment ? (
      <React.StrictMode>
        {AppWithBoundary}
      </React.StrictMode>
    ) : (
      AppWithBoundary
    )
  );
  // Rodar accessibility enhancer logo apos primeiro render (todas as telas terao id/aria para Appium)
  if (typeof window !== 'undefined') {
    setTimeout(() => {
      import('./utils/accessibilityEnhancer').then((m) => {
        if (typeof m.enhanceAccessibility === 'function') m.enhanceAccessibility();
      }).catch(() => {});
    }, 400);
  }
});

// Também carregar enhancer na primeira interação (para telas carregadas depois)
if (typeof window !== 'undefined') {
  let accessibilityLoaded = false;
  const loadAccessibilityEnhancer = () => {
    if (accessibilityLoaded) return;
    accessibilityLoaded = true;
    import('./utils/accessibilityEnhancer').then((m) => {
      if (typeof m.enhanceAccessibility === 'function') m.enhanceAccessibility();
    }).catch(() => {});
  };
  ['click', 'touchstart', 'scroll', 'keydown'].forEach(ev =>
    document.addEventListener(ev, loadAccessibilityEnhancer, { once: true, passive: true })
  );
}