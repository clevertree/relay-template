/** @jsx h */
/**
 * MovieView component - Display detailed movie information (JSX)
 * Shows poster, backdrop, ratings, overview, budget, revenue, links
 *
 * Loaded via: helpers.loadModule('./lib/components/MovieView.jsx')
 * Exported as: renderMovieView function
 */

export function renderMovieView(
  h,
  movie,
  onBack,
  onAddToLibrary,
) {
  const posterUrl = movie && movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null
  const backdropUrl = movie && movie.backdrop_path ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}` : null

  return (
    <div className="movie-detail space-y-6 max-w-5xl">
      <div className="flex gap-2">
        <button onClick={onBack} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm font-medium transition">← Back</button>
        {onAddToLibrary && (
          <button onClick={onAddToLibrary} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-sm font-medium transition">➕ Add to Library</button>
        )}
      </div>

      {backdropUrl && (
        <div className="relative w-full h-64 md:h-80 overflow-hidden rounded-lg">
          <img src={backdropUrl} alt={`${movie.title} backdrop`} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 via-gray-900/40 to-transparent" />
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-6">
        {posterUrl && (
          <div className="flex-shrink-0">
            <img src={posterUrl} alt={String(movie.title)} className="w-40 md:w-56 rounded-lg shadow-xl" />
          </div>
        )}

        <div className="flex-1 space-y-4">
          <h1 className="text-4xl font-bold text-white">{movie.title}</h1>
          {movie.tagline && <p className="text-lg italic text-gray-400">{movie.tagline}</p>}

          <div className="flex flex-wrap gap-4 text-sm text-gray-300">
            {movie.release_date && <span>📅 {movie.release_date}</span>}
            {movie.runtime && <span>⏱️ {movie.runtime} min</span>}
            {movie.vote_average && <span>⭐ {Number(movie.vote_average).toFixed(1)}/10</span>}
            {movie.status && <span>🎬 {movie.status}</span>}
          </div>

          {movie.genres && movie.genres.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {movie.genres.map((g) => (
                <span key={g.id || g.name} className="px-3 py-1 bg-blue-900 hover:bg-blue-800 text-blue-200 rounded-full text-sm transition">
                  {g.name || String(g)}
                </span>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-white">Overview</h3>
            <p className="text-gray-300 leading-relaxed">{movie.overview || 'No overview available.'}</p>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            {movie.budget && movie.budget > 0 && (
              <div>
                <span className="font-semibold text-gray-200">Budget: </span>
                <span className="text-gray-400">${Number(movie.budget).toLocaleString()}</span>
              </div>
            )}
            {movie.revenue && movie.revenue > 0 && (
              <div>
                <span className="font-semibold text-gray-200">Revenue: </span>
                <span className="text-gray-400">${Number(movie.revenue).toLocaleString()}</span>
              </div>
            )}
            {movie.original_language && (
              <div>
                <span className="font-semibold text-gray-200">Language: </span>
                <span className="text-gray-400">{String(movie.original_language).toUpperCase()}</span>
              </div>
            )}
            {movie.production_companies && movie.production_companies.length > 0 && (
              <div className="col-span-2">
                <span className="font-semibold text-gray-200">Production: </span>
                <span className="text-gray-400">{movie.production_companies.map((c) => c.name).join(', ')}</span>
              </div>
            )}
          </div>

          <div className="flex gap-4 pt-4">
            {movie.homepage && (
              <a href={movie.homepage} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition">🌐 Official Site</a>
            )}
            {movie.imdb_id && (
              <a href={`https://www.imdb.com/title/${movie.imdb_id}`} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded transition">🎬 IMDb</a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
