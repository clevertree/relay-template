/**
 * SearchUI helper (TSX) — Handles search results structure and validation
 * Used by get-client.tsx for /search/[query] routes
 * Returns structured data for RepoBrowser to render
 */
import type { TMDBMovie } from '../../types'

export function createSearchUIResponse(items: ReadonlyArray<unknown | TMDBMovie>, total: number, page: number, query: string, error: string | null = null) {
  return {
    type: 'search-ui',
    items: items || [],
    total: total || 0,
    page: page || 1,
    query: query || '',
    error: error || null,
  } as const;
}

export function createEmptySearchResponse(message: string | null = null) {
  return {
    type: 'search-ui',
    items: [],
    total: 0,
    message: message || 'Enter a search query above',
  } as const;
}

export function createSearchErrorResponse(error: string) {
  return {
    type: 'search-ui',
    items: [],
    total: 0,
    error: error || 'Search failed',
  } as const;
}
