/** @jsx h */
/**
 * MovieResults component - Display search results as a list of movies with pagination
 * Shows poster, title, year, rating, genres, and description
 *
 * Loaded via: helpers.loadModule('./lib/components/MovieResults.jsx')
 * Exported as: renderMovieResults function
 */

export function renderMovieResults(h, results, source = 'tmdb', onPageChange = null, onViewMovie = null) {
  if (!Array.isArray(results) || results.length === 0) {
    return <div className="p-4">No results found</div>
  }

  return (
    <div className="space-y-3">
      {results.map((item) => {
        const id = item.id ?? item.tmdb_id
        const title = item.title ?? item.name ?? `#${id}`
        const year = item.release_date ? new Date(item.release_date).getFullYear() : null
        const rating = item.vote_average ? `⭐ ${(item.vote_average / 2).toFixed(1)}/5` : null
        const img = item.poster_path ? `https://image.tmdb.org/t/p/w154${item.poster_path}` : null
        const genres = item.genre_names && Array.isArray(item.genre_names) ? item.genre_names.slice(0, 3).join(', ') : null
        const overview = item.overview || 'No description available.'
        
        return (
          <div key={String(id)} className="p-3 rounded border transition flex gap-3" style={{ borderColor: 'var(--color-border-dark)', backgroundColor: 'var(--color-bg-dark)' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-light)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-dark)'}>
            {img && (
              <div className="flex-shrink-0">
                <img src={img} alt={title} className="w-12 h-16 object-cover rounded" />
              </div>
            )}
            <div className="flex-1 min-w-0 flex flex-col justify-between">
              <div>
                <div className="font-medium text-white">{title}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {year && <span>{year}</span>}
                  {year && rating && <span> • </span>}
                  {rating && <span>{rating}</span>}
                </div>
                {genres && <div className="text-xs text-gray-400 mt-1">{genres}</div>}
                <div className="text-xs text-gray-400 mt-2 line-clamp-2">{overview}</div>
              </div>
              <button 
                onClick={() => onViewMovie && onViewMovie(id, source)}
                className="mt-2 px-3 py-1 text-white text-xs rounded transition w-fit"
                style={{ backgroundColor: 'var(--color-primary)' }}
                onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--color-primary-dark)'}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'var(--color-primary)'}
              >
                View
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function renderPagination(h, currentPage, totalPages, onPrevious, onNext, onPageChange) {
  if (totalPages <= 1) {
    return null
  }

  return (
    <div className="mt-6 flex items-center justify-center gap-2">
      <button
        onClick={onPrevious}
        disabled={currentPage <= 1}
        className="px-3 py-1 text-white text-xs rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ backgroundColor: currentPage <= 1 ? 'var(--color-bg-light)' : 'var(--color-button-secondary)' }}
        onMouseEnter={(e) => !e.target.disabled && (e.target.style.backgroundColor = 'var(--color-button-secondary-hover)')}
        onMouseLeave={(e) => !e.target.disabled && (e.target.style.backgroundColor = 'var(--color-button-secondary)')}
      >
        ← Previous
      </button>
      
      <div className="flex items-center gap-1">
        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
          const pageNum = currentPage > 3 ? currentPage - 2 + i : i + 1
          if (pageNum > totalPages) return null
          const isCurrentPage = pageNum === currentPage
          return (
            <button
              key={pageNum}
              onClick={() => pageNum !== currentPage && onPageChange && onPageChange(pageNum)}
              className="px-2 py-1 text-xs rounded transition"
              style={{ 
                backgroundColor: isCurrentPage ? 'var(--color-primary)' : 'var(--color-button-secondary)',
                color: isCurrentPage ? 'var(--color-text-white)' : 'var(--color-text-muted)'
              }}
              onMouseEnter={(e) => !isCurrentPage && (e.target.style.backgroundColor = 'var(--color-button-secondary-hover)')}
              onMouseLeave={(e) => !isCurrentPage && (e.target.style.backgroundColor = 'var(--color-button-secondary)')}
            >
              {pageNum}
            </button>
          )
        })}
      </div>
      
      <button
        onClick={onNext}
        disabled={currentPage >= totalPages}
        className="px-3 py-1 text-white text-xs rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ backgroundColor: currentPage >= totalPages ? 'var(--color-bg-light)' : 'var(--color-button-secondary)' }}
        onMouseEnter={(e) => !e.target.disabled && (e.target.style.backgroundColor = 'var(--color-button-secondary-hover)')}
        onMouseLeave={(e) => !e.target.disabled && (e.target.style.backgroundColor = 'var(--color-button-secondary)')}
      >
        Next →
      </button>
      
      <span className="ml-2 text-xs text-gray-400">
        Page {currentPage} of {totalPages}
      </span>
    </div>
  )
}
