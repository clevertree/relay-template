/* @jsx h */
import type { TMDBMovie } from '../../types'

export function renderMovieView(
  h: typeof import('react').createElement,
  movie: TMDBMovie,
  onBack?: () => void,
  onAddToLibrary?: () => void,
) {
  const posterUrl = movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null
  const backdropUrl = movie.backdrop_path ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}` : null

  return (
    <div className="movie-detail space-y-6">
      <div className="flex gap-2">
        <button onClick={onBack} className="px-4 py-2 bg-gray-600 text-white rounded text-sm font-medium hover:bg-gray-700">← Back</button>
        {onAddToLibrary && (
          <button onClick={onAddToLibrary} className="px-4 py-2 bg-emerald-600 text-white rounded text-sm font-medium hover:bg-emerald-700">➕ Add to Library</button>
        )}
      </div>

      {backdropUrl && (
        <div className="relative w-full h-64 md:h-96 overflow-hidden rounded-lg">
          <img src={backdropUrl} alt={`${movie.title} backdrop`} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-6">
        {posterUrl && (
          <div className="flex-shrink-0">
            <img src={posterUrl} alt={String(movie.title)} className="w-48 md:w-64 rounded-lg shadow-lg" />
          </div>
        )}

        <div className="flex-1 space-y-4">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{movie.title}</h1>
          {movie.tagline && <p className="text-lg italic text-gray-600 dark:text-gray-400">{movie.tagline}</p>}

          <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
            {movie.release_date && <span>📅 {movie.release_date}</span>}
            {movie.runtime && <span>⏱️ {movie.runtime} min</span>}
            {movie.vote_average && <span>⭐ {Number(movie.vote_average).toFixed(1)}/10</span>}
            {movie.status && <span>🎬 {movie.status}</span>}
          </div>

          {movie.genres && movie.genres.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {movie.genres.map((g) => (
                <span key={g.id} className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm">
                  {g.name}
                </span>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Overview</h3>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{movie.overview || 'No overview available.'}</p>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            {movie.budget && movie.budget > 0 && (
              <div>
                <span className="font-semibold text-gray-900 dark:text-white">Budget: </span>
                <span className="text-gray-600 dark:text-gray-400">${Number(movie.budget).toLocaleString()}</span>
              </div>
            )}
            {movie.revenue && movie.revenue > 0 && (
              <div>
                <span className="font-semibold text-gray-900 dark:text-white">Revenue: </span>
                <span className="text-gray-600 dark:text-gray-400">${Number(movie.revenue).toLocaleString()}</span>
              </div>
            )}
            {movie.original_language && (
              <div>
                <span className="font-semibold text-gray-900 dark:text-white">Language: </span>
                <span className="text-gray-600 dark:text-gray-400">{String(movie.original_language).toUpperCase()}</span>
              </div>
            )}
            {movie.production_companies && movie.production_companies.length > 0 && (
              <div className="col-span-2">
                <span className="font-semibold text-gray-900 dark:text-white">Production: </span>
                <span className="text-gray-600 dark:text-gray-400">{movie.production_companies.map((c) => c.name).join(', ')}</span>
              </div>
            )}
          </div>

          <div className="flex gap-4 pt-4">
            {movie.homepage && (
              <a href={movie.homepage} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">🌐 Official Site</a>
            )}
            {movie.imdb_id && (
              <a href={`https://www.imdb.com/title/${movie.imdb_id}`} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-yellow-500 text-black rounded hover:bg-yellow-600">🎬 IMDb</a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
