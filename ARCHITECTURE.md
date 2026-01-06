# Relay Template Architecture

## Overview

The relay-template is a self-contained, decoupled repository hook system. Each repository manages its own internal state, routing, and UI lifecycle **independently** of the host client.

## Repository Configuration

Repository behavior is managed via `.relay.yaml` at the root. This file defines:
- **client**: JSX hook entry points for rendering.
- **server**: Node.js hook entry points for commit validation.
- **git**: Infrastructure rules for branch protection and P2P synchronization.

See [README.md](README.md) for more details on the configuration schema.

## Server-Side Implementation

The repository includes server-side hooks that run within the Relay environment:
- `pre-commit.mjs`: Runs on `PUT` requests to validate files before committing.
- `pre-receive.mjs`: Runs on `git push` to validate entire commits.
- `.relay/validation.mjs`: Centralized validation logic used by both hooks.
- `lib/utils.mjs`: Shared library for Git and environment interaction.

Infrastructure features like **Signature Verification** and **Auto-Push** are handled natively by the Rust dispatcher based on settings in `.relay.yaml`.

## JSX and React Imports

**CRITICAL:** JSX files in the template do NOT need `import React from 'react'`.

The hook-transpiler uses **automatic JSX runtime** (`Runtime::Automatic` in SWC), which:
- Auto-generates imports from `react/jsx-runtime` (converted to `globalThis.__hook_jsx_runtime`)
- Transforms JSX to `_jsx()` and `_jsxs()` calls instead of `React.createElement()`
- Does NOT require React to be in scope

**Do NOT add React imports** unless you're directly calling React APIs (useState, useEffect, etc.).

**KNOWN ISSUE - Return Statement Formatting:**
The SWC transpiler may incorrectly wrap `return (` statements with parentheses in array brackets. To avoid this:
- ✅ Use: `return <div>...</div>` (opening tag on same line as return)
- ❌ Avoid: `return (\n  <div>...</div>\n)` (parentheses on separate lines)

## Key Principles

### 1. **No Host State Tracking**
- The host client (RepoBrowser/HookRenderer) does **not** track the internal path or parameters of the repo.
- The repo receives a minimal context with only React, FileRenderer, Layout, and theme helpers.
- **Removed**: `params`, `helpers.navigate`, branch tracking from context.

### 2. **Self-Contained Routing**
- `get-client.jsx` manages its own routing state using React `useState()`.
- Navigation is handled internally via `setPath()` — **no History API, no window object manipulation**.
- The repo routing system is completely decoupled from browser history or the host.

### 3. **No Window API Usage**
- Repo hooks should **avoid** direct `window` or `globalThis` access.
- No `window.location`, `window.history`, or `window.dispatchEvent` for navigation.
- This ensures the hook system can be embedded in various contexts (web, RN future, Node.js SSR).

### 4. **Minimal Context Surface**

The hook context now provides:

```typescript
{
  React: React,                              // React module for JSX
  createElement: React.createElement,        // For plugins using h()
  FileRenderer: (props) => {...},           // Render static files
  Layout: undefined,                        // Optional layout fallback
  helpers: {
    buildPeerUrl: (path) => string,         // Construct absolute URLs
    loadModule: (modulePath, fromPath?) => Promise<any>,  // Load other modules
    registerThemeStyles?: (name, defs) => void,
    registerThemesFromYaml?: (path) => Promise<void>,
    buildRepoHeaders?: () => Record<string, string>,
    setBranch?: (branch) => void,
  }
}
```

**No longer provided**:
- `params`: Use internal state instead
- `helpers.navigate`: Use React state and internal routing
- Branch/path/internal repo state: Managed internally by each repo

## Component Structure

### get-client.jsx

Main entry point for the hook system.

```jsx
const [path, setPath] = React.useState('/')  // Internal routing state

const navigate = (to) => {
  const dest = to.startsWith('/') ? to : `/${to}`
  setPath(dest)  // Internal state update only
}
```

- Routes requests based on internal `path` state.
- Loads plugins, components, and query handlers dynamically.
- Passes `path` and `onNavigate` to Layout.

### Layout.jsx

UI shell for the repo (path input, search form, results container).

**Props**:
- `path: string` — Current internal path state
- `onNavigate: (to: string) => void` — Callback to update internal path
- `options: Record<string, any>` — Display options, branches, etc.
- `children: React.ReactNode` — Rendered content

No longer receives `params` or `helpers`. Navigation is callback-driven.

### Plugins (tmdb.mjs, yts.mjs)

**GET Handler**: Receives `(path, ctx)` where `ctx` contains React, FileRenderer, Layout.

```javascript
export async function handleGetRequest(path, ctx) {
  const { React, createElement, FileRenderer, Layout } = ctx
  // No helpers.navigate; return a React element
}
```

**QUERY Handler**: Receives `(query, options, ctx)` with the same minimal context.

```javascript
export async function handleQuery(query, options, ctx) {
  // Return { items, total, page, source }
}
```

## Navigation Flow

1. User interacts with Layout (path input, search, back button).
2. Layout calls `onNavigate(newPath)`.
3. `get-client.jsx` updates `setPath(newPath)`.
4. Component re-renders with new path; route handlers execute.
5. Result is rendered via Layout.

**No host interaction, no browser history, no window API**.

## Styling & Themes

Themes are loaded via `helpers.registerThemesFromYaml()` at hook initialization:

```javascript
await registerTemplateThemeStyles(helpers)
```

This loads `theme.yaml` via the shared bridge and registers styles with the themed-styler WASM. No client-side theme state exported to host.

## Benefits

- **Decoupling**: Repos are independent micro-frontends; can be embedded anywhere.
- **Testability**: No global state or browser APIs; easier to test in isolation.
- **Portability**: Same hook code works on web, Android/iOS Native, Node.js SSR without modification.
- **Modularity**: Each repo decides its own routing, state management, and UI architecture.

## Migration from Old Architecture

### Old
```jsx
const { params, helpers } = ctx
const path = params.path
helpers.navigate(newPath)  // Updates host state
```

### New
```jsx
const [path, setPath] = React.useState('/')
const navigate = (to) => setPath(to)  // Internal state only
```

### Old Layout
```jsx
<LayoutComp params={params} helpers={helpers} />
```

### New Layout
```jsx
<LayoutComp path={path} onNavigate={navigate} />
```

## Future Extensions

- Add optional `parentContext` for nested repos (child repos communicate with parent).
- Extend helpers with additional APIs (WebSocket events, local storage, etc.) as needed.
- Emit events for the host to listen (e.g., "repo-state-changed") without coupling.
