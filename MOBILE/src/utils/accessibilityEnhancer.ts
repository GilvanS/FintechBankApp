/**
 * Accessibility Enhancer for Appium Selectors
 * 
 * This utility ensures that all interactive elements have proper
 * accessibility attributes that map to Android contentDescription,
 * making them easily locatable in Appium.
 */

export const enhanceAccessibility = () => {
  if (typeof window === 'undefined') return;

  // Function to set contentDescription for elements
  const setContentDescription = (element: HTMLElement, value: string) => {
    // Set aria-label (maps to contentDescription in Android)
    if (!element.getAttribute('aria-label')) {
      element.setAttribute('aria-label', value);
    }
    
    // Ensure data-testid matches
    if (!element.getAttribute('data-testid')) {
      element.setAttribute('data-testid', value);
    }
  };

  // Process all elements with id or data-testid
  const processElements = () => {
    // Process elements with id
    document.querySelectorAll('[id]').forEach((element) => {
      const htmlElement = element as HTMLElement;
      const id = htmlElement.id;
      
      // Skip if already has aria-label
      if (htmlElement.getAttribute('aria-label')) return;
      
      // Set aria-label based on id
      if (id && !id.startsWith('react-')) {
        setContentDescription(htmlElement, id);
      }
    });

    // Process elements with data-testid
    document.querySelectorAll('[data-testid]').forEach((element) => {
      const htmlElement = element as HTMLElement;
      const testId = htmlElement.getAttribute('data-testid');
      
      if (testId && !htmlElement.getAttribute('aria-label')) {
        setContentDescription(htmlElement, testId);
      }
    });

    // Process input elements - ensure placeholder is accessible
    document.querySelectorAll('input, textarea').forEach((element) => {
      const htmlElement = element as HTMLElement;
      const placeholder = htmlElement.getAttribute('placeholder');
      
      if (placeholder && !htmlElement.getAttribute('aria-label')) {
        // Use data-testid if available, otherwise use placeholder
        const testId = htmlElement.getAttribute('data-testid');
        if (testId) {
          setContentDescription(htmlElement, testId);
        }
      }
    });

    // Process button elements
    document.querySelectorAll('button, [role="button"]').forEach((element) => {
      const htmlElement = element as HTMLElement;
      const testId = htmlElement.getAttribute('data-testid');
      
      if (testId && !htmlElement.getAttribute('aria-label')) {
        setContentDescription(htmlElement, testId);
      }
    });
  };

  // Run on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', processElements);
  } else {
    processElements();
  }

  // Also run after a short delay to catch dynamically added elements
  setTimeout(processElements, 100);
  setTimeout(processElements, 500);
};

// Auto-enhance on module load
if (typeof window !== 'undefined') {
  enhanceAccessibility();
}

