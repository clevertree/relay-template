# Test Movie Repository
`v. 1.0.1`

Welcome! This is a sample content repository used to exercise the Relay server, client, and commit hooks.

## What lives here

- Movie entries under /data/{release_year}/{movie_title}/
- Allowed files per movie:
    - meta.json — metadata that mirrors the database entry
    - index.md — markdown description page for the movie
    - assets/** — images and other static assets for the movie

## Hooks

The `hooks/` folder contains executable scripts that customize repository behavior. Hooks are divided into **client-side
** and **server-side** categories, with plugin architecture for extensibility.

### Client-Side Hooks

These run in the browser or client application when users interact with the repository:

| Hook             | Purpose                                                                                                                                                |
|------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------|
| `get-client.jsx` | Main router handling all GET requests: file serving, search, and detail views. Routes through plugins before falling back to file serving or 404 page. |
| `missing.mjs`    | 404 fallback page rendered when a file or route is not found                                                                                           |

**Router Routes:**

- `/[path]` — Fetch and render file (e.g., `/README.md`, `/data/movies.json`)
- `/search/[query]` — Execute search query and render results (e.g., `/search/batman`)
- `/view/[source]/[id]` — Display single item detail view (e.g., `/view/tmdb/550`)
- `/create/[source]/[id]` — Create entry with pre-filled data from a source

### Plugin System

Plugins extend the GET and QUERY functionality without modifying core hooks:

**Available Plugins:**

- `plugin/tmdb.mjs` — TMDB movie data integration
    - Handles: `/view/tmdb/[id]`, `/create/tmdb/[id]`
    - Provides: Movie detail views, create forms, search results

**Plugin Interface:**

```javascript
// GET hook handler
async function handleGetRequest(path, ctx)

Returns: JSX
element
or
null
if path doesn
't match

// QUERY hook handler  
async function handleQuery(query, options, ctx)

Returns: {
    items, total, page, source
}
or
null
```

Plugins are loaded on-demand by `get-client.jsx` and can delegate to component libraries.

### Component Libraries

Reusable UI components located in `components/`:

| Component          | Purpose                                                       |
|--------------------|---------------------------------------------------------------|
| `Layout.jsx`       | Main layout with path input, branch selector, and search form |
| `MovieView.jsx`    | Detailed movie display with ratings, overview, and metadata   |
| `CreateView.jsx`   | Movie creation/edit form with validation                      |
| `MovieResults.jsx` | Search results list with pagination                           |

### Server-Side Hooks

These run on the server during git operations:

| Hook              | Purpose                                                                   |
|-------------------|---------------------------------------------------------------------------|
| `pre-commit.mjs`  | Validates changes before a commit is created (executed on PUT)            |
| `pre-receive.mjs` | Validates incoming commits before accepting a push (executed on git push) |

### Supporting Files

- `lib/utils.mjs` — Shared utility functions for server hooks
- `lib/validation-util.mjs` — Validation helper functions
- `*.yaml` — Configuration files for git rules, sources, schemas, etc.

## Configuration Files

### `.relay.yaml`

Defines repository metadata, hook configuration, and Git-level infrastructure rules:

```yaml
name: "Movie Repository"
version: "1.0.0"

# JSX Hook mapping
client:
  hooks:
    get: { path: "hooks/client/get-client.jsx" }

# Node.js Server Hook mapping
server:
  hooks:
    pre-commit: { path: "hooks/server/pre-commit.mjs" }
    pre-receive: { path: "hooks/server/pre-receive.mjs" }

git:
  # P2P Peer synchronization
  autoPush:
    branches: ["main"]
    originList: ["node-dfw1.relaynet.online"]

  # Native Branch Protection
  branchRules:
    default:
      requireSigned: true
    branches:
      - name: main
        rule: { requireSigned: true, allowedKeys: [".ssh/admin.pub"] }
```

## Testing Hooks

### Server Hooks Integration Test
You can test the validation logic in isolation without executing a full Git push:

```bash
node tests/test_hooks.mjs
```

This script simulates the `pre-receive` execution by mocking the `stdin` context and environment variables.

```yaml
name: "Movie Repository"
version: "1.0.0"
client:
  hooks:
    get:
      path: /hooks/client/get-client.jsx
server:
  hooks:
    pre-commit:
      path: /hooks/server/pre-commit.mjs
    pre-receive:
      path: /hooks/server/pre-receive.mjs
```

### `rules.yaml`

Defines whitelist, validation schemas, and business rules.

## Styling System

The template uses **Tailwind CSS** with **NativeWind** for cross-platform styling (Web + Android/iOS Native).

### Color Variables

Colors are defined in `colors.js` with light and dark theme support:

```javascript
import {getColor, initTheme, setTheme, COLORS} from './colors.js';

// Get a color value
const primary = getColor('primary');

// Switch theme (light/dark)
setTheme('dark');

// Access theme objects
console.log(COLORS.light);  // Light theme
console.log(COLORS.dark);   // Dark theme
```

**Available Colors:**

- `primary`, `primaryLight`, `primaryDark` — Primary brand colors
- `bgPrimary`, `bgSecondary`, `bgTertiary` — Background colors
- `textPrimary`, `textSecondary`, `textMuted`, `textInverse` — Text colors
- `success`, `error`, `warning`, `info` — Status colors
- `buttonPrimary`, `buttonSecondary`, etc. — Button colors

## Rules

- See relay.yaml in this folder. It defines:
    - Where new files may be inserted (whitelist)
    - The allowed file names and subpaths
    - The schema for meta.json, including required fields
    - Uniqueness constraints across a branch
    - Optional indexFile for clients (defaults to index.md)

## Important notes

- Rules are enforced only for new commits. Existing files are not retroactively validated.
- The database for queries is not stored in the repo and is created separately by infrastructure.
- Plugins are loaded on-demand and can be extended by adding new `.mjs` files to the `plugin/` directory.
- Component styling uses Tailwind classes for consistency across web and native platforms.

<VideoPlayer src='torrent://abadsfasdfas' />
