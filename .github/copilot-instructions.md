# relay-template Copilot Instructions

## Project Overview
Template structure for Relay hooks - reference implementation for hook patterns and plugin architecture.

### Structure
```
relay-template/
├── hooks/
│   ├── client/
│   │   ├── get-client.jsx        - Main entry point
│   │   ├── query-client.jsx      - Search/query handler
│   │   ├── components/           - Reusable UI components
│   │   └── plugin/               - Content provider plugins
│   └── [server-side hooks]
└── media/                        - Assets
```

## Hook Architecture

### Main Hook: get-client.jsx
Entry point called by Relay runtime.

**Signature:**
```javascript
export default async function getClient(ctx) {
  // ctx.navigate - routing
  // ctx.MarkdownRenderer - render markdown
  // ctx.env - environment config
  return <JSX />
}
```

**Key Patterns:**
1. Lazy-load query handler: `await import('./query-client.jsx')`
2. Inject metadata: `dirname`, `url` from `@clevertree/meta`
3. Route to plugins based on user navigation

### Query Client: query-client.jsx
Handles search queries, routes to plugins.

**Signature:**
```javascript
export default async function queryClient(query, ctx) {
  const { handleQuery } = await import('./plugin/tmdb.mjs')
  return handleQuery(query, ctx)
}
```

## Plugin Architecture

### Plugin Exports
Each plugin (`tmdb.mjs`, `yts.mjs`) exports:

```javascript
export async function handleGetRequest(path, ctx) {
  // path: '/plugin/tmdb/...' or similar
  // ctx: { navigate, MarkdownRenderer, env }
  return <JSX /> || null
}

export async function handleQuery(query, ctx) {
  // Handle search query
  return <JSX /> || null
}
```

### Plugin: tmdb.mjs (TMDB Integration)
- Fetches movie data from TMDB API
- Renders movie results with images/metadata
- Requires `env.json` with TMDB API key

**Flow:**
1. Load API key from `./env.json` (relative to hook module)
2. Construct TMDB API URL
3. Fetch movie data
4. Render with `MarkdownRenderer` for formatting

### Plugin: yts.mjs (YTS Torrent Integration)
- Queries YTS torrent database
- Renders torrent results with download info
- Public API (no key required)

**Flow:**
1. Construct YTS API URL with query
2. Fetch torrent data
3. Render results with metadata

## Environment Configuration

### env.json Pattern
Located adjacent to hook module:
```json
{
  "tmdb_api_key": "your_key_here",
  "tmdb_base_url": "https://api.themoviedb.org/3"
}
```

### Loading in Plugins
```javascript
import { dirname } from '@clevertree/meta'

const envUrl = new URL('./env.json', dirname)
const resp = await fetch(envUrl)
const { tmdb_api_key } = await resp.json()
```

**Critical:** `dirname` must be properly injected by runtime loader.

## Component Library: components/

### Layout.jsx
Wrapper component for consistent UI.

**Props:**
```typescript
{ children: React.ReactNode }
```

### MovieResults.jsx
Displays grid of movie cards.

**Props:**
```typescript
{ movies: Array<Movie> }
```

### Other Components
Reusable UI elements - follow React patterns.

## JSX Tag Standards
- Use `<span>` for text elements (mapped to `TextView` on Android).
- **NEVER** use `<text>` as it is not a standard HTML tag and causes issues on Web.
- Use `<div>` or `<view>` for containers (mapped to `LinearLayout` on Android).

## Development Workflow

### Testing Hooks (Web)
1. Start relay-clients web server: `npm run dev`
2. Hooks loaded from this template
3. Changes reflect on refresh (or use watch mode)

### Testing Hooks (Android Live Reload)
To iterate quickly on Android without rebuilding the APK:
1. **Setup ADB Reverse**: `adb reverse tcp:8081 tcp:8081` (CRITICAL)
2. **Start Dev Server**: Run `node scripts/dev-server.js` in the `relay-client-android` repo.
3. **Connect App**: Ensure the Android app is running in debug mode. It will log "Dev server detected! Enabling live reload."
4. **Iterate**: Any changes to `.jsx` files in the assets directory will trigger an instant reload in the app.

### Adding New Plugin
1. Create `hooks/client/plugin/myplugin.mjs`
2. Export `handleGetRequest()` and `handleQuery()`
3. Handle navigation via `ctx.navigate(path)`
4. Render JSX elements

### Debugging

**Hook not executing:**
- Check transpiler output: `import` → `const X = globalThis.__`
- Verify WASM loaded: DevTools → `window.__hook_transpile_jsx`
- Check runtime logs: browser console

**Plugin not found:**
- Verify plugin filename matches import in query-client.jsx
- Check dynamic import path: `./plugin/name.mjs`
- Confirm plugin exports correct functions

**env.json not loading:**
- Check URL resolution: `new URL('./env.json', dirname)`
- Verify `dirname` injected (should end with `/client`)
- Check fetch response status in DevTools

## Key Files
- `hooks/client/get-client.jsx` - Main entry point
- `hooks/client/query-client.jsx` - Search router
- `hooks/client/plugin/tmdb.mjs` - TMDB provider
- `hooks/client/plugin/yts.mjs` - YTS provider
- `hooks/client/components/` - UI components

## Runtime Metadata Injection

Runtime injects before hook execution:
```typescript
const filename = "/hooks/client/get-client.jsx"
const dirname = "/hooks/client"
const url = "http://localhost:5173/hooks/client/get-client.jsx"
```

Access via:
```javascript
import { filename, dirname, url } from '@clevertree/meta'
```

## Import Rewriting
Transpiler rewrites imports to globals:
```javascript
// Before transpile:
import React from 'react'
import { MarkdownRenderer } from 'relay-ui'

// After transpile:
const React = globalThis.__hook_react
const { MarkdownRenderer } = globalThis.__hook_helpers
```

All non-special imports passed through (e.g., local relative imports).
