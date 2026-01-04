// ============================================
// CloudGraph - Navbar Component
// ============================================

import React from 'react';

interface NavbarProps {
    theme: 'dark' | 'light';
    onThemeToggle: () => void;
    onReset?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ theme, onThemeToggle, onReset }) => {
    return (
        <nav className="navbar">
            <div className="navbar-brand">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3" fill="url(#gradient)" stroke="none" />
                    <circle cx="4" cy="8" r="2" />
                    <circle cx="20" cy="8" r="2" />
                    <circle cx="4" cy="16" r="2" />
                    <circle cx="20" cy="16" r="2" />
                    <path d="M6 8h4M14 8h4M6 16h4M14 16h4M12 9v-3M12 15v3" strokeOpacity="0.5" />
                    <defs>
                        <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#06b6d4" />
                            <stop offset="100%" stopColor="#3b82f6" />
                        </linearGradient>
                    </defs>
                </svg>
                <span className="gradient-text">CloudGraph</span>
            </div>

            <div className="navbar-actions">
                {onReset && (
                    <button className="btn btn-secondary" onClick={onReset}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                            <path d="M3 3v5h5" />
                        </svg>
                        New Analysis
                    </button>
                )}

                <button
                    className="theme-toggle"
                    onClick={onThemeToggle}
                    aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                >
                    {theme === 'dark' ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="5" />
                            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                        </svg>
                    ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                        </svg>
                    )}
                </button>
            </div>
        </nav>
    );
};
