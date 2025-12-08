/**
 * Template Theme Configuration
 * Pure data layer - defines color palettes, spacing, and typography for light and dark themes
 * Default theme is dark.
 *
 * NO RUNTIME LOGIC HERE
 */

export const light = {
  colors: {
    primary: '#2563eb',
    primaryLight: '#3b82f6',
    primaryDark: '#1d4ed8',
    bgPrimary: '#ffffff',
    bgSecondary: '#f9fafb',
    bgTertiary: '#f3f4f6',
    textPrimary: '#1f2937',
    textSecondary: '#4b5563',
    textMuted: '#9ca3af',
    textInverse: '#ffffff',
    border: '#e5e7eb',
    borderAlt: '#d1d5db',
    success: '#10b981',
    successDark: '#059669',
    error: '#ef4444',
    errorDark: '#dc2626',
    warning: '#f59e0b',
    info: '#3b82f6',
    buttonPrimary: '#2563eb',
    buttonPrimaryHover: '#1d4ed8',
    buttonSecondary: '#e5e7eb',
    buttonSecondaryText: '#1f2937',
    buttonSecondaryHover: '#d1d5db',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    '2xl': 32,
  },
  typography: {
    fontFamily: 'System',
    h1: { fontSize: 32, fontWeight: '700' },
    h2: { fontSize: 24, fontWeight: '700' },
    h3: { fontSize: 20, fontWeight: '700' },
    p: { fontSize: 16, fontWeight: '400' },
    small: { fontSize: 12, fontWeight: '400' },
  },
};

export const dark = {
  colors: {
    primary: '#2563eb',
    primaryLight: '#3b82f6',
    primaryDark: '#1d4ed8',
    bgPrimary: '#111827',
    bgSecondary: '#1f2937',
    bgTertiary: '#374151',
    textPrimary: '#f3f4f6',
    textSecondary: '#d1d5db',
    textMuted: '#9ca3af',
    textInverse: '#111827',
    border: '#374151',
    borderAlt: '#4b5563',
    success: '#10b981',
    successDark: '#059669',
    error: '#ef4444',
    errorDark: '#dc2626',
    warning: '#f59e0b',
    info: '#3b82f6',
    buttonPrimary: '#2563eb',
    buttonPrimaryHover: '#1d4ed8',
    buttonSecondary: '#374151',
    buttonSecondaryText: '#f3f4f6',
    buttonSecondaryHover: '#1f2937',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    '2xl': 32,
  },
  typography: {
    fontFamily: 'System',
    h1: { fontSize: 32, fontWeight: '700' },
    h2: { fontSize: 24, fontWeight: '700' },
    h3: { fontSize: 20, fontWeight: '700' },
    p: { fontSize: 16, fontWeight: '400' },
    small: { fontSize: 12, fontWeight: '400' },
  },
};

export const THEMES = { light, dark };
export const defaultTheme = 'dark';
