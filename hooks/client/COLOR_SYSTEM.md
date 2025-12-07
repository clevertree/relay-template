# Template Color System

## Current Color Mapping

All template UI colors have been centralized in `/lib/colors.js` for easy maintenance.

### Color Reference

| Usage | Tailwind Class | CSS Variable | Hex Value |
|-------|----------------|--------------|-----------|
| Primary Button Background | `bg-blue-600` | `--color-primary` | `#2563eb` |
| Primary Button Hover | `bg-blue-700` | `--color-primary-dark` | `#1d4ed8` |
| Primary Button Light (Go) | `bg-blue-500` | `--color-primary-light` | `#3b82f6` |
| Dark Background | `bg-gray-900` | `--color-bg-dark` | `#111827` |
| Light Background | `bg-gray-800` | `--color-bg-light` | `#1f2937` |
| Text White | `text-white` | `--color-text-white` | `#ffffff` |
| Text Muted | `text-gray-300` | `--color-text-muted` | `#d1d5db` |
| Text Dim | `text-gray-400` | `--color-text-dim` | `#9ca3af` |
| Text Subtle | `text-gray-500` | `--color-text-subtle` | `#6b7280` |
| Border Dark | `border-gray-700` | `--color-border-dark` | `#374151` |
| Border Light | `border-gray-600` | `--color-border-light` | `#4b5563` |
| Accent Blue (Background) | `bg-blue-900` | `--color-accent-blue-dark` | `#1e3a8a` |
| Accent Blue (Text) | `text-blue-200` | `--color-accent-blue-light` | `#93c5fd` |
| Success | `bg-emerald-600` | `--color-success` | `#10b981` |
| Success Hover | `bg-emerald-700` | `--color-success-dark` | `#059669` |
| Error | `text-red-500` | `--color-error` | `#ef4444` |
| Error Dark | `text-red-600` | `--color-error-dark` | `#dc2626` |
| Secondary Button | `bg-gray-700` | `--color-button-secondary` | `#374151` |
| Secondary Button Hover | `hover:bg-gray-800` | `--color-button-secondary-hover` | `#1f2937` |

## Files Updated

- ✅ `/lib/colors.js` - Color definitions
- ✅ `/lib/components/Layout.jsx` - Uses Tailwind color classes
- ✅ `/query-client.jsx` - Uses Tailwind color classes
- ⏳ `/lib/components/MovieView.jsx` - (contains consistent colors)
- ⏳ `/lib/components/CreateView.jsx` - (needs review)
- ✅ `/get-client.jsx` - Error colors maintained

## To Use Custom Colors in Components

Import the color configuration:
```jsx
import { COLOR_CLASSES } from './lib/colors.js'
```

Then use in classNames:
```jsx
className={`px-3 py-1 ${COLOR_CLASSES.bgPrimary} ${COLOR_CLASSES.textWhite} rounded`}
```

Or directly use Tailwind classes which map to the defined colors:
```jsx
className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
```

## Adding New Colors

1. Add to `COLORS` object in `/lib/colors.js`
2. Add corresponding `COLOR_CLASSES` entry
4. Update this documentation

## Theme Consistency

- Dark mode is the default theme
- All `text-*` colors are designed for dark backgrounds
- All `bg-*` colors maintain proper contrast with `text-white`
- Hover states provide visual feedback
