/**
 * Template Color Configuration
 * Centralized color definitions for all template components
 */

export const COLORS = {
  // Primary
  primary: '#2563eb',        // bg-blue-600
  primaryLight: '#3b82f6',   // bg-blue-500
  primaryDark: '#1d4ed8',    // bg-blue-700

  // Backgrounds
  bgDark: '#111827',         // bg-gray-900
  bgDarker: '#0f172a',       // bg-slate-900
  bgLight: '#1f2937',        // bg-gray-800

  // Text
  textWhite: '#ffffff',
  textLight: '#f3f4f6',      // text-gray-100
  textMuted: '#d1d5db',      // text-gray-300
  textDim: '#9ca3af',        // text-gray-400
  textSubtle: '#6b7280',     // text-gray-500

  // Borders
  borderDark: '#374151',     // border-gray-700
  borderLight: '#4b5563',    // border-gray-600

  // Accents
  accentBlueDark: '#1e3a8a', // bg-blue-900
  accentBlueLightText: '#93c5fd', // text-blue-200
  success: '#10b981',        // bg-emerald-600
  successDark: '#059669',    // bg-emerald-700
  error: '#ef4444',          // text-red-500
  errorDark: '#dc2626',      // text-red-600

  // Secondary button
  buttonSecondary: '#374151', // bg-gray-700
  buttonSecondaryHover: '#1f2937', // hover:bg-gray-800
};

// Tailwind class mappings for reference
export const COLOR_CLASSES = {
  // Backgrounds
  bgPrimary: 'bg-blue-600',
  bgPrimaryLight: 'bg-blue-500',
  bgPrimaryDark: 'bg-blue-700',
  bgDark: 'bg-gray-900',
  bgLight: 'bg-gray-800',
  bgButtonSecondary: 'bg-gray-700',
  bgButtonSecondaryHover: 'hover:bg-gray-800',
  bgSuccess: 'bg-emerald-600',
  bgSuccessHover: 'hover:bg-emerald-700',
  bgAccentBlueDark: 'bg-blue-900',
  bgAccentBlueHover: 'hover:bg-blue-800',

  // Text
  textWhite: 'text-white',
  textMuted: 'text-gray-300',
  textDim: 'text-gray-400',
  textSubtle: 'text-gray-500',
  textError: 'text-red-500',
  textErrorDark: 'text-red-600',
  textAccentBlue: 'text-blue-200',

  // Borders
  borderDark: 'border-gray-700',
  borderLight: 'border-gray-600',
};
