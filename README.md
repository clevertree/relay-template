# Test Movie Repository

Welcome! This is a sample content repository used to exercise the Relay server, client, and commit hooks.

## What lives here
- Movie entries under /data/{release_year}/{movie_title}/
- Allowed files per movie:
  - meta.json — metadata that mirrors the database entry
  - index.md — markdown description page for the movie
  - assets/** — images and other static assets for the movie

## Hooks

The `hooks/` folder contains executable scripts that customize repository behavior. Hooks are divided into **client-side** and **server-side** categories:

### Client-Side Hooks
These run in the browser or client application when users interact with the repository:

| Hook             | Purpose |
|------------------|---------|
| `get-client.tsx` | Handles all client-side routing: file serving (`/path`), search results (`/search/[query]`), and detail views (`/view/[source]/[id]`) |
| `put.mjs`        | Handles file uploads and modifications |

**Router Routes:**
- `/[path]` — Fetch and render file (e.g., `/README.md`, `/data/movies.json`)
- `/search/[query]` — Execute search query and render results (e.g., `/search/batman`)
- `/view/[source]/[id]` — Display single item detail view (e.g., `/view/tmdb/550`)

### Server-Side Hooks
These run on the server during git operations:

| Hook | Purpose |
|------|---------|
| `pre-commit.mjs` | Validates changes before a commit is created (executed on PUT) |
| `pre-receive.mjs` | Validates incoming commits before accepting a push (executed on git push) |

### Supporting Files
- `options.mjs` — Returns repository capabilities and configuration
- `validation.mjs` — Shared validation logic used by hooks
- `lib/` — Utility modules shared across hooks
- `*.yaml` — Configuration files for git rules, sources, schemas, etc.

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

<video id="video" controls preload="metadata">
  <source src="/media/cc0-videos/flower.mp4" type="video/mp4" />
  <track
    label="English"
    kind="subtitles"
    srclang="en"
    src="/media/cc0-videos/flower.vtt"
    default />
</video>