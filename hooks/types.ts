// Shared types for client-side repository hooks

export type HookKind = 'get' | 'query' | 'put'

export interface HookParams {
  socket?: string
  path: string
  branch?: string
  repo?: string
  kind?: HookKind
  q?: string
  source?: string
  [key: string]: unknown
}

export interface Helpers {
  buildRepoHeaders?: (branch?: string, repo?: string) => Record<string, string>
  buildPeerUrl: (p: string) => string
  navigate: (path: string) => void
  setBranch?: (branch: string) => void
  loadModule: (modulePath: string) => Promise<Record<string, unknown>>
}

export interface HookContext {
  React: typeof import('react')
  createElement: typeof import('react').createElement
  FileRenderer: React.ComponentType<{ path: string }>
  Layout?: React.ComponentType<any>
  params: HookParams
  helpers: Helpers
}

export interface TMDBCompany { id?: number; name?: string }
export interface TMDBGenre { id?: number; name?: string }
export interface TMDBMovie {
  id?: number
  tmdb_id?: number
  title?: string
  name?: string
  tagline?: string
  overview?: string
  poster_path?: string
  backdrop_path?: string
  release_date?: string
  runtime?: number
  vote_average?: number
  status?: string
  original_language?: string
  production_companies?: TMDBCompany[]
  budget?: number
  revenue?: number
  homepage?: string
  imdb_id?: string
  genres?: TMDBGenre[]
  [key: string]: unknown
}
