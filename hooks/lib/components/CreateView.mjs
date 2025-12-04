/**
 * CreateView component — Renders a form to create/insert a new movie
 * Used by router.mjs for /create routes
 * Can be pre-filled with TMDB data via query params or state
 */

/**
 * Render the create movie form
 * @param {Function} h - createElement function
 * @param {Object} prefillData - Optional data to pre-fill the form (from TMDB)
 * @param {Function} onBack - Navigation callback to go back
 * @param {Function} onSubmit - Callback when form is submitted
 */
export function renderCreateView(h, prefillData, onBack, onSubmit) {
  const movie = prefillData || {};
  
  // Form field component
  const FormField = (label, name, value, type = 'text', options = {}) => {
    const { multiline, readonly, placeholder } = options;
    
    return h('div', { className: 'space-y-1' },
      h('label', { 
        className: 'block text-sm font-medium text-gray-700 dark:text-gray-300',
        htmlFor: name,
      }, label),
      multiline 
        ? h('textarea', {
            id: name,
            name,
            defaultValue: value || '',
            placeholder: placeholder || '',
            readOnly: readonly,
            rows: 4,
            className: `w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm 
              focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white
              ${readonly ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed' : ''}`,
          })
        : h('input', {
            type,
            id: name,
            name,
            defaultValue: value || '',
            placeholder: placeholder || '',
            readOnly: readonly,
            className: `w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm 
              focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white
              ${readonly ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed' : ''}`,
          })
    );
  };

  const posterUrl = movie.poster_path
    ? `https://image.tmdb.org/t/p/w200${movie.poster_path}`
    : null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    
    // Convert numeric fields
    if (data.runtime) data.runtime = parseInt(data.runtime, 10);
    if (data.budget) data.budget = parseInt(data.budget, 10);
    if (data.revenue) data.revenue = parseInt(data.revenue, 10);
    if (data.vote_average) data.vote_average = parseFloat(data.vote_average);
    
    // Parse genres from comma-separated string
    if (data.genres) {
      data.genres = data.genres.split(',').map(g => g.trim()).filter(Boolean);
    }
    
    if (onSubmit) {
      onSubmit(data);
    }
  };

  return h('div', { className: 'create-movie-form space-y-6 max-w-4xl mx-auto' },
    // Header with back button
    h('div', { className: 'flex items-center justify-between' },
      h('button', {
        type: 'button',
        onClick: onBack,
        className: 'px-4 py-2 bg-gray-600 text-white rounded text-sm font-medium hover:bg-gray-700',
      }, '← Back'),
      h('h1', { className: 'text-2xl font-bold text-gray-900 dark:text-white' }, 
        movie.id ? 'Add Movie to Library' : 'Create New Movie'
      ),
      h('div', { className: 'w-20' }), // Spacer for centering
    ),

    // TMDB source info if pre-filled
    movie.id && h('div', { className: 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4' },
      h('p', { className: 'text-sm text-blue-700 dark:text-blue-300' },
        `Pre-filled from TMDB ID: ${movie.id}. You can edit any field before saving.`
      ),
    ),

    // Form
    h('form', { 
      onSubmit: handleSubmit,
      className: 'space-y-6',
    },
      // Two-column layout for poster and basic info
      h('div', { className: 'flex flex-col md:flex-row gap-6' },
        // Poster preview
        posterUrl && h('div', { className: 'flex-shrink-0' },
          h('img', {
            src: posterUrl,
            alt: movie.title || 'Movie poster',
            className: 'w-32 md:w-48 rounded-lg shadow-lg',
          }),
          h('input', { type: 'hidden', name: 'poster_path', value: movie.poster_path || '' }),
          h('input', { type: 'hidden', name: 'backdrop_path', value: movie.backdrop_path || '' }),
        ),

        // Basic info column
        h('div', { className: 'flex-1 space-y-4' },
          FormField('Title', 'title', movie.title, 'text', { placeholder: 'Movie title' }),
          FormField('Original Title', 'original_title', movie.original_title, 'text'),
          FormField('Tagline', 'tagline', movie.tagline, 'text', { placeholder: 'Movie tagline' }),
          FormField('Release Date', 'release_date', movie.release_date, 'date'),
        ),
      ),

      // Overview
      FormField('Overview', 'overview', movie.overview, 'text', { 
        multiline: true, 
        placeholder: 'Movie synopsis/description' 
      }),

      // Metadata grid
      h('div', { className: 'grid grid-cols-1 md:grid-cols-3 gap-4' },
        FormField('Runtime (minutes)', 'runtime', movie.runtime, 'number'),
        FormField('Budget ($)', 'budget', movie.budget, 'number'),
        FormField('Revenue ($)', 'revenue', movie.revenue, 'number'),
      ),

      h('div', { className: 'grid grid-cols-1 md:grid-cols-3 gap-4' },
        FormField('Rating (0-10)', 'vote_average', movie.vote_average?.toFixed(1), 'number'),
        FormField('Language', 'original_language', movie.original_language?.toUpperCase(), 'text'),
        FormField('Status', 'status', movie.status || 'Released', 'text'),
      ),

      // Genres
      FormField(
        'Genres (comma-separated)', 
        'genres', 
        movie.genres?.map(g => g.name || g).join(', '), 
        'text',
        { placeholder: 'Action, Drama, Sci-Fi' }
      ),

      // External IDs
      h('div', { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
        FormField('TMDB ID', 'tmdb_id', movie.id, 'text', { readonly: !!movie.id }),
        FormField('IMDb ID', 'imdb_id', movie.imdb_id, 'text'),
      ),

      // Homepage
      FormField('Homepage URL', 'homepage', movie.homepage, 'url', { placeholder: 'https://...' }),

      // Production companies
      FormField(
        'Production Companies', 
        'production_companies', 
        movie.production_companies?.map(c => c.name).join(', '),
        'text',
        { placeholder: 'Company 1, Company 2' }
      ),

      // Hidden field for source tracking
      h('input', { type: 'hidden', name: 'source', value: movie.id ? 'tmdb' : 'manual' }),

      // Submit buttons
      h('div', { className: 'flex gap-4 pt-4 border-t border-gray-200 dark:border-gray-700' },
        h('button', {
          type: 'submit',
          className: 'px-6 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors',
        }, '💾 Save to Library'),
        h('button', {
          type: 'button',
          onClick: onBack,
          className: 'px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors',
        }, 'Cancel'),
      ),
    ),
  );
}
