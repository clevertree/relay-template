/**
 * Template Color Configuration
 * Centralized color definitions with light and dark theme support
 * Use CSS custom properties defined here for consistent theming
 */

// Light theme colors (default)
const lightTheme = {
  // Primary
  primary: '#2563eb',
  primaryLight: '#3b82f6',
  primaryDark: '#1d4ed8',

  // Backgrounds
  bgPrimary: '#ffffff',
  bgSecondary: '#f9fafb',
  bgTertiary: '#f3f4f6',

  // Text
  textPrimary: '#1f2937',
  textSecondary: '#4b5563',
  textMuted: '#9ca3af',
  textInverse: '#ffffff',

  // Borders
  border: '#e5e7eb',
  borderAlt: '#d1d5db',

  // Accents
  success: '#10b981',
  successDark: '#059669',
  error: '#ef4444',
  errorDark: '#dc2626',
  warning: '#f59e0b',
  info: '#3b82f6',

  // Button
  buttonPrimary: '#2563eb',
  buttonPrimaryHover: '#1d4ed8',
  buttonSecondary: '#e5e7eb',
  buttonSecondaryText: '#1f2937',
  buttonSecondaryHover: '#d1d5db',
};

// Dark theme colors
const darkTheme = {
  // Primary (same as light)
  primary: '#2563eb',
  primaryLight: '#3b82f6',
  primaryDark: '#1d4ed8',

  // Backgrounds
  bgPrimary: '#111827',
  bgSecondary: '#1f2937',
  bgTertiary: '#374151',

  // Text
  textPrimary: '#f3f4f6',
  textSecondary: '#d1d5db',
  textMuted: '#9ca3af',
  textInverse: '#111827',

  // Borders
  border: '#374151',
  borderAlt: '#4b5563',

  // Accents
  success: '#10b981',
  successDark: '#059669',
  error: '#ef4444',
  errorDark: '#dc2626',
  warning: '#f59e0b',
  info: '#3b82f6',

  // Button
  buttonPrimary: '#2563eb',
  buttonPrimaryHover: '#1d4ed8',
  buttonSecondary: '#374151',
  buttonSecondaryText: '#f3f4f6',
  buttonSecondaryHover: '#1f2937',
};

/**
 * Get the active theme (light by default)
 * Can be toggled by detecting system preference or user selection
 */
function getActiveTheme() {
  if (typeof window !== 'undefined') {
    // Check for saved preference
    const saved = localStorage.getItem('theme-preference');
    if (saved) return saved === 'dark' ? darkTheme : lightTheme;

    // Check system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return darkTheme;
    }
  }
  return lightTheme;
}

/**
 * Get a color value by name
 */
export function getColor(name) {
  const theme = getActiveTheme();
  return theme[name] || theme.textPrimary;
}

/**
 * Initialize CSS custom properties for the active theme
 */
export function initTheme() {
  const theme = getActiveTheme();
  const root = typeof document !== 'undefined' ? document.documentElement : null;
  
  if (!root) return;

  Object.entries(theme).forEach(([key, value]) => {
    // Convert camelCase to kebab-case
    const cssVar = `--color-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
    root.style.setProperty(cssVar, value);
  });
}

/**
 * Set theme preference
 */
export function setTheme(themeName) {
  const isValid = themeName === 'light' || themeName === 'dark';
  if (!isValid) return false;

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('theme-preference', themeName);
  }

  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', themeName);
  }

  initTheme();
  return true;
}

// Export theme objects for direct access if needed
export const COLORS = {
  light: lightTheme,
  dark: darkTheme,
  active: getActiveTheme(),
};
