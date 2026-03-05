/**
 * Accessibility Enhancer for Appium Selectors
 * 
 * This utility ensures that all interactive elements have proper
 * accessibility attributes that map to Android contentDescription,
 * making them easily locatable in Appium.
 * 
 * IMPORTANT: In WebView, aria-label maps to hint/contentDescription in Android.
 * Resource-ID is NOT possible in WebView, but content-desc works the same way.
 * 
 * This works by setting aria-label equal to data-testid, which Android
 * automatically maps to contentDescription/content-desc in the accessibility tree.
 */

export const enhanceAccessibility = () => {
  if (typeof window === 'undefined') return;

  // Function to set contentDescription for elements
  const setContentDescription = (element: HTMLElement, value: string) => {
    // Set aria-label (maps to contentDescription/content-desc in Android)
    // This is the KEY attribute for Appium selectors in WebView
    if (!element.getAttribute('aria-label')) {
      element.setAttribute('aria-label', value);
    }
    
    // Set name attribute (also helps with content-desc mapping)
    if (element.tagName === 'INPUT' || element.tagName === 'BUTTON' || element.tagName === 'TEXTAREA') {
      if (!element.getAttribute('name') || element.getAttribute('name') === '') {
        element.setAttribute('name', value);
      }
    }
    
    // Ensure data-testid matches (for consistency)
    if (!element.getAttribute('data-testid')) {
      element.setAttribute('data-testid', value);
    }
    
    // Set id if not present (helps with accessibility tree)
    if (!element.id || element.id === '') {
      element.id = value;
    }
    
    // Try to set contentDescription directly (may not work in all browsers)
    try {
      (element as any).contentDescription = value;
    } catch (e) {
      // Ignore if not supported
    }
  };

  // Process a single element
  const processElement = (element: HTMLElement) => {
    // Skip if already processed
    if (element.hasAttribute('data-accessibility-enhanced')) {
      return;
    }

    // OTIMIZADO: Não processar elementos Material Symbols (evita texto "arrow_back" aparecer)
    // Verifica se o elemento é um span com classe material-symbols-outlined ou contém um
    if (element.classList.contains('material-symbols-outlined') || 
        (element.tagName === 'SPAN' && element.classList.contains('material-symbols-outlined')) ||
        element.querySelector('.material-symbols-outlined')) {
      // Garantir que Material Symbols não exiba texto quando fonte não carregar
      if (element.classList.contains('material-symbols-outlined')) {
        element.style.fontFamily = "'Material Symbols Outlined', sans-serif";
        element.style.textIndent = '0';
        element.style.overflow = 'hidden';
      }
      return; // Não processar ícones Material Symbols
    }

    // Skip elementos que contêm texto de ícones Material Symbols
    const textContent = element.textContent?.trim() || '';
    const iconTexts = ['arrow_back', 'now_back', 'swap_horiz', 'close', 'menu', 'home', 'person', 'settings'];
    if (iconTexts.some(icon => textContent === icon && element.tagName === 'SPAN')) {
      return; // Não processar spans que são ícones Material Symbols
    }

    // Priority 1: Use data-testid if available
    const testId = element.getAttribute('data-testid');
    if (testId) {
      setContentDescription(element, testId);
      element.setAttribute('data-accessibility-enhanced', 'true');
      return;
    }

    // Priority 2: Use id if available (skip React internal IDs e ícones)
    const id = element.id;
    if (id && !id.startsWith('react-') && !id.includes('__') && !id.includes('arrow_back') && !id.includes('now_back')) {
      setContentDescription(element, id);
      element.setAttribute('data-accessibility-enhanced', 'true');
      return;
    }

    // Priority 3: For inputs, use placeholder as fallback
    if ((element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') && !element.getAttribute('aria-label')) {
      const placeholder = element.getAttribute('placeholder');
      if (placeholder) {
        element.setAttribute('aria-label', placeholder);
        element.setAttribute('data-accessibility-enhanced', 'true');
      }
    }
  };

  // Process all elements
  const processElements = () => {
    // Process elements with id
    document.querySelectorAll('[id]').forEach((element) => {
      processElement(element as HTMLElement);
    });

    // Process elements with data-testid
    document.querySelectorAll('[data-testid]').forEach((element) => {
      processElement(element as HTMLElement);
    });

    // Process interactive elements
    document.querySelectorAll('input, textarea, button, [role="button"], [role="link"], a').forEach((element) => {
      processElement(element as HTMLElement);
    });
  };

  // MutationObserver para novas telas (elementos adicionados dinamicamente)
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as HTMLElement;
          processElement(element);
          element.querySelectorAll('[id], [data-testid], input, textarea, button, [role="button"]').forEach((child) => {
            processElement(child as HTMLElement);
          });
        }
      });
    });
  });

  const runNow = () => {
    processElements();
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runNow);
  } else {
    runNow();
  }
};

// CRÍTICO: NÃO auto-executar no carregamento do módulo
// O módulo será importado dinamicamente apenas após primeira interação do usuário
// Isso evita processar milhares de elementos durante a inicialização

