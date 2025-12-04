/**
 * MovieView component — Renders a single movie detail page
 * Used by router.mjs for /view/tmdb/[id] routes
 */

export function renderMovieView(h, movie, onBack, onAddToLibrary) {
  const posterUrl = movie.poster_path
    ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
    : null;
  const backdropUrl = movie.backdrop_path
    ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}`
    : null;

  return h('div', { className: 'movie-detail space-y-6' },
    // Back button and Add to Library button
    h('div', { className: 'flex gap-2' },
      h('button', {
        onClick: onBack,
        className: 'px-4 py-2 bg-gray-600 text-white rounded text-sm font-medium hover:bg-gray-700',
      }, '← Back'),
      onAddToLibrary && h('button', {
        onClick: onAddToLibrary,
        className: 'px-4 py-2 bg-emerald-600 text-white rounded text-sm font-medium hover:bg-emerald-700',
      }, '➕ Add to Library'),
    ),

    // Backdrop
    backdropUrl && h('div', { className: 'relative w-full h-64 md:h-96 overflow-hidden rounded-lg' },
      h('img', {
        src: backdropUrl,
        alt: `${movie.title} backdrop`,
        className: 'w-full h-full object-cover',
      }),
      h('div', { className: 'absolute inset-0 bg-gradient-to-t from-black/60 to-transparent' }),
    ),

    // Main content
    h('div', { className: 'flex flex-col md:flex-row gap-6' },
      // Poster
      posterUrl && h('div', { className: 'flex-shrink-0' },
        h('img', {
          src: posterUrl,
          alt: movie.title,
          className: 'w-48 md:w-64 rounded-lg shadow-lg',
        }),
      ),

      // Info
      h('div', { className: 'flex-1 space-y-4' },
        h('h1', { className: 'text-3xl font-bold text-gray-900 dark:text-white' }, movie.title),
        movie.tagline && h('p', { className: 'text-lg italic text-gray-600 dark:text-gray-400' }, movie.tagline),

        h('div', { className: 'flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400' },
          movie.release_date && h('span', null, `📅 ${movie.release_date}`),
          movie.runtime && h('span', null, `⏱️ ${movie.runtime} min`),
          movie.vote_average && h('span', null, `⭐ ${movie.vote_average.toFixed(1)}/10`),
          movie.status && h('span', null, `🎬 ${movie.status}`),
        ),

        movie.genres && movie.genres.length > 0 && h('div', { className: 'flex flex-wrap gap-2' },
          movie.genres.map((g) =>
            h('span', {
              key: g.id,
              className: 'px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm',
            }, g.name)
          )
        ),

        h('div', { className: 'space-y-2' },
          h('h3', { className: 'text-lg font-semibold text-gray-900 dark:text-white' }, 'Overview'),
          h('p', { className: 'text-gray-700 dark:text-gray-300 leading-relaxed' }, movie.overview || 'No overview available.'),
        ),

        // Additional details
        h('div', { className: 'grid grid-cols-2 gap-4 text-sm' },
          movie.budget > 0 && h('div', null,
            h('span', { className: 'font-semibold text-gray-900 dark:text-white' }, 'Budget: '),
            h('span', { className: 'text-gray-600 dark:text-gray-400' }, `$${movie.budget.toLocaleString()}`),
          ),
          movie.revenue > 0 && h('div', null,
            h('span', { className: 'font-semibold text-gray-900 dark:text-white' }, 'Revenue: '),
            h('span', { className: 'text-gray-600 dark:text-gray-400' }, `$${movie.revenue.toLocaleString()}`),
          ),
          movie.original_language && h('div', null,
            h('span', { className: 'font-semibold text-gray-900 dark:text-white' }, 'Language: '),
            h('span', { className: 'text-gray-600 dark:text-gray-400' }, movie.original_language.toUpperCase()),
          ),
          movie.production_companies && movie.production_companies.length > 0 && h('div', { className: 'col-span-2' },
            h('span', { className: 'font-semibold text-gray-900 dark:text-white' }, 'Production: '),
            h('span', { className: 'text-gray-600 dark:text-gray-400' }, movie.production_companies.map((c) => c.name).join(', ')),
          ),
        ),

        // External links
        h('div', { className: 'flex gap-4 pt-4' },
          movie.homepage && h('a', {
            href: movie.homepage,
            target: '_blank',
            rel: 'noopener noreferrer',
            className: 'px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700',
          }, '🌐 Official Site'),
          movie.imdb_id && h('a', {
            href: `https://www.imdb.com/title/${movie.imdb_id}`,
            target: '_blank',
            rel: 'noopener noreferrer',
            className: 'px-4 py-2 bg-yellow-500 text-black rounded hover:bg-yellow-600',
          }, '🎬 IMDb'),
        ),
      ),
    ),
  );
}
