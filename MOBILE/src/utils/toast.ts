export const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    if (typeof window !== 'undefined') {
        const event = new CustomEvent('app-toast', { detail: { message, type } });
        window.dispatchEvent(event);
    }
};
