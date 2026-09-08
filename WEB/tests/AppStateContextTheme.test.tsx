import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppStateProvider, useAppState } from '../contexts/AppStateContext';

const TestComponent = () => {
    const { theme, setTheme, adminDefaultTheme, setAdminDefaultTheme } = useAppState();
    return (
        <div>
            <span data-testid="theme-value">{theme}</span>
            <span data-testid="admin-default-theme-value">{adminDefaultTheme}</span>
            <button data-testid="set-theme-midnight" onClick={() => setTheme('midnight')}>
                Set Theme Midnight
            </button>
            <button data-testid="set-admin-default-midnight" onClick={() => setAdminDefaultTheme('midnight')}>
                Set Admin Default Midnight
            </button>
            <button data-testid="set-admin-default-yellow" onClick={() => setAdminDefaultTheme('yellow')}>
                Set Admin Default Yellow
            </button>
        </div>
    );
};

describe('AppStateContext - Admin Default Theme', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('initializes theme from localStorage volt_admin_default_theme when volt_theme is absent', () => {
        localStorage.setItem('volt_admin_default_theme', 'midnight');

        render(
            <AppStateProvider>
                <TestComponent />
            </AppStateProvider>
        );

        expect(screen.getByTestId('theme-value').textContent).toBe('midnight');
    });

    it('prefers volt_theme over volt_admin_default_theme when volt_theme is present', () => {
        localStorage.setItem('volt_theme', 'yellow');
        localStorage.setItem('volt_admin_default_theme', 'midnight');

        render(
            <AppStateProvider>
                <TestComponent />
            </AppStateProvider>
        );

        expect(screen.getByTestId('theme-value').textContent).toBe('yellow');
    });

    it('setAdminDefaultTheme updates localStorage volt_admin_default_theme and sets theme if volt_theme is absent', () => {
        render(
            <AppStateProvider>
                <TestComponent />
            </AppStateProvider>
        );

        fireEvent.click(screen.getByTestId('set-admin-default-midnight'));

        expect(localStorage.getItem('volt_admin_default_theme')).toBe('midnight');
        expect(screen.getByTestId('theme-value').textContent).toBe('midnight');
    });
});
