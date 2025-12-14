/**
 * Template Theme Configuration
 * Pure data layer that defines color palettes, spacing, and typography for light and dark themes.
 * Themes can now describe class-level styles for both web CSS and React Native without forcing the
 * exact same value across platforms.
 */

const baseSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
};

const baseTypography = {
  fontFamily: 'System',
  h1: { fontSize: 32, fontWeight: '700' },
  h2: { fontSize: 24, fontWeight: '700' },
  h3: { fontSize: 20, fontWeight: '700' },
  p: { fontSize: 16, fontWeight: '400' },
  small: { fontSize: 12, fontWeight: '400' },
};

const createTheme = (palette) => ({
  colors: palette,
  spacing: baseSpacing,
  typography: baseTypography,
});

const lightPalette = {
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
};

const darkPalette = {
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
};

export const light = createTheme(lightPalette);
export const dark = createTheme(darkPalette);

export const THEMES = { light, dark };
export const defaultTheme = 'dark';

const evaluateTarget = (target, theme) => {
  if (!target) return undefined;
  return typeof target === 'function' ? target(theme) : target;
};

const resolveEntry = (entry, theme) => {
  const shared = evaluateTarget(entry.both, theme);
  const web = evaluateTarget(entry.web, theme) ?? shared;
  const native = evaluateTarget(entry.native, theme) ?? shared;
  if (!web && !native) return undefined;
  return { web, native };
};

const makeEvaluator = (entries) => (theme) =>
  Object.fromEntries(
    Object.entries(entries)
      .map(([className, definition]) => [className, resolveEntry(definition, theme)])
      .filter(([, resolved]) => resolved),
  );

const sharedClassDefinitions = {
  rounded: {
    both: { borderRadius: 6 },
  },
  'rounded-full': {
    both: { borderRadius: 999 },
  },
  border: {
    both: { borderWidth: 1, borderColor: '#d1d5db' },
  },
  'shadow-soft': {
    web: { boxShadow: '0 10px 15px -3px rgba(15, 23, 42, 0.1)' },
    native: { shadowColor: '#0f172a', shadowOpacity: 0.12, shadowRadius: 12, elevation: 2 },
  },
  'text-label': {
    web: { fontSize: '12px', letterSpacing: '0.05em', textTransform: 'uppercase' },
    native: { fontSize: 12, letterSpacing: 0.05, textTransform: 'uppercase' },
  },
};

const themeSpecificDefinitions = {
  light: {
    'bg-surface': {
      both: (theme) => ({ backgroundColor: theme.colors.bgPrimary }),
    },
    'bg-surface-secondary': {
      both: (theme) => ({ backgroundColor: theme.colors.bgSecondary }),
    },
    'text-primary': {
      both: (theme) => ({ color: theme.colors.textPrimary }),
    },
    'text-secondary': {
      both: (theme) => ({ color: theme.colors.textSecondary }),
    },
    'text-muted': {
      both: (theme) => ({ color: theme.colors.textMuted }),
    },
  },
  dark: {
    'bg-surface': {
      both: (theme) => ({ backgroundColor: theme.colors.bgPrimary }),
    },
    'bg-surface-secondary': {
      both: (theme) => ({ backgroundColor: theme.colors.bgSecondary }),
    },
    'text-primary': {
      both: (theme) => ({ color: theme.colors.textPrimary }),
    },
    'text-secondary': {
      both: (theme) => ({ color: theme.colors.textSecondary }),
    },
    'text-muted': {
      both: (theme) => ({ color: theme.colors.textMuted }),
    },
    'border-muted': {
      both: (theme) => ({ borderColor: theme.colors.borderAlt }),
    },
  },
};

export const classStyleDefinitions = {
  shared: sharedClassDefinitions,
  themes: themeSpecificDefinitions,
};

export const buildClassStyles = (themeName = defaultTheme) => {
  const theme = THEMES[themeName] || THEMES[defaultTheme];
  const evaluateShared = makeEvaluator(classStyleDefinitions.shared);
  const evaluateTheme = makeEvaluator(classStyleDefinitions.themes[themeName] || {});
  return {
    ...evaluateShared(theme),
    ...evaluateTheme(theme),
  };
};

export const joinPlatforms = (definition) => ({
  web: definition,
  native: definition,
});
