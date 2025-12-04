# Test Movie Repository

Welcome! This is a sample content repository used to exercise the Relay server, client, and commit hooks.

## What lives here
- Movie entries under /data/{release_year}/{movie_title}/
- Allowed files per movie:
  - meta.json — metadata that mirrors the database entry
  - index.md — markdown description page for the movie
  - assets/** — images and other static assets for the movie

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