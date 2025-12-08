# DEPRECATED — Color System

This document and the legacy `colors.js` file have been removed.

Use the new theme source of truth:

- `template/hooks/client/theme.js` exports `THEMES` and `defaultTheme`.
- Clients (web and React Native) must consume tokens from `theme.js`:
  - colors: `THEMES.dark.colors` / `THEMES.light.colors`
  - spacing: `THEMES.*.spacing`
  - typography: `THEMES.*.typography`

Default theme is `dark`. No fallbacks or backwards compatibility are retained.

See also:
- `THEMING_ARCHITECTURE.md`
- `apps/client-web/src/utils/themeManager.ts`
- `apps/client-react-native/src/utils/themeManager.ts`
