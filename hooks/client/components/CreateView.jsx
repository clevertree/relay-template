/** @jsx h */
/**
 * CreateView component - Form for creating/editing movie entries (JSX)
 * Handles form submission with validation, supports pre-filled data from TMDB
 *
 * Loaded via: helpers.loadModule('./lib/components/CreateView.jsx')
 * Exported as: renderCreateView function
 */

export function renderCreateView(
  h,
  prefillData,
  onBack,
  onSubmit,
) {
  const movie = prefillData || {}

  const FormField = (label, name, value, type = 'text', options = {}) => {
    const { multiline, readonly, placeholder } = options
    return (
      <div className="space-y-1">
        <label className="block text-sm font-medium" htmlFor={name} style={{ color: 'var(--color-text-light)' }}>{label}</label>
        {multiline ? (
          <textarea id={name} name={name} defaultValue={(value || '')} placeholder={placeholder || ''} readOnly={readonly} rows={4} className="w-full px-3 py-2 rounded-md shadow-sm focus:ring-2 transition" style={{ borderColor: 'var(--color-border-dark)', backgroundColor: readonly ? 'var(--color-bg-light)' : 'var(--color-bg-dark)', color: 'var(--color-text-white)', focusRing: 'var(--color-primary)', cursor: readonly ? 'not-allowed' : 'auto' }} />
        ) : (
          <input type={type} id={name} name={name} defaultValue={(value || '')} placeholder={placeholder || ''} readOnly={readonly} className="w-full px-3 py-2 rounded-md shadow-sm focus:ring-2 transition" style={{ borderColor: 'var(--color-border-dark)', backgroundColor: readonly ? 'var(--color-bg-light)' : 'var(--color-bg-dark)', color: 'var(--color-text-white)', focusRing: 'var(--color-primary)', cursor: readonly ? 'not-allowed' : 'auto' }} />
        )}
      </div>
    )
  }

  const posterUrl = movie.poster_path ? `https://image.tmdb.org/t/p/w200${movie.poster_path}` : null

  function handleSubmit(e) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const data = Object.fromEntries(formData.entries())

    if (data.runtime) data.runtime = parseInt(String(data.runtime), 10)
    if (data.budget) data.budget = parseInt(String(data.budget), 10)
    if (data.revenue) data.revenue = parseInt(String(data.revenue), 10)
    if (data.vote_average) data.vote_average = parseFloat(String(data.vote_average))

    if (data.genres) {
      data.genres = String(data.genres).split(',').map((g) => g.trim()).filter(Boolean)
    }

    onSubmit(data)
  }

  return (
    <div className="create-movie-form space-y-6 max-w-4xl mx-auto">
    <div className="flex items-center justify-between">
        <button type="button" onClick={onBack} className="px-4 py-2 text-white rounded text-sm font-medium transition" style={{ backgroundColor: 'var(--color-button-secondary)' }} onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--color-button-secondary-hover)'} onMouseLeave={(e) => e.target.style.backgroundColor = 'var(--color-button-secondary)'}>← Back</button>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-white)' }}>{movie.id ? 'Add Movie to Library' : 'Create New Movie'}</h1>
        <div className="w-20" />
      </div>

      {movie.id && (
        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm text-blue-700 dark:text-blue-300">Pre-filled from TMDB ID: {movie.id}. You can edit any field before saving.</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex flex-col md:flex-row gap-6">
          {posterUrl && (
            <div className="flex-shrink-0">
              <img src={posterUrl} alt={movie.title || 'Movie poster'} className="w-32 md:w-48 rounded-lg shadow-lg" />
              <input type="hidden" name="poster_path" value={movie.poster_path || ''} />
              <input type="hidden" name="backdrop_path" value={movie.backdrop_path || ''} />
            </div>
          )}
          <div className="flex-1 space-y-4">
            {FormField('Title', 'title', movie.title, 'text', { placeholder: 'Movie title' })}
            {FormField('Original Title', 'original_title', movie.original_title, 'text')}
            {FormField('Tagline', 'tagline', movie.tagline, 'text', { placeholder: 'Movie tagline' })}
            {FormField('Release Date', 'release_date', movie.release_date, 'date')}
          </div>
        </div>

        {FormField('Overview', 'overview', movie.overview, 'text', { multiline: true, placeholder: 'Movie synopsis/description' })}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {FormField('Runtime (minutes)', 'runtime', movie.runtime, 'number')}
          {FormField('Budget ($)', 'budget', movie.budget, 'number')}
          {FormField('Revenue ($)', 'revenue', movie.revenue, 'number')}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {FormField(
            'Rating (0-10)',
            'vote_average',
            (typeof movie.vote_average === 'number' && Number.isFinite(movie.vote_average))
              ? movie.vote_average.toFixed(1)
              : movie.vote_average,
            'number'
          )}
          {FormField(
            'Language',
            'original_language',
            typeof movie.original_language === 'string'
              ? movie.original_language.toUpperCase()
              : movie.original_language,
            'text'
          )}
          {FormField('Status', 'status', movie.status || 'Released', 'text')}
        </div>

        {FormField(
          'Genres (comma-separated)',
          'genres',
          (movie.genres || [])
            .map((g) => (typeof g === 'object' && g && 'name' in g ? String(g.name || '') : String(g)))
            .filter(Boolean)
            .join(', '),
          'text',
          { placeholder: 'Action, Drama, Sci-Fi' }
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {FormField('TMDB ID', 'tmdb_id', movie.id, 'text', { readonly: !!movie.id })}
          {FormField('IMDb ID', 'imdb_id', movie.imdb_id, 'text')}
        </div>

        {FormField('Homepage URL', 'homepage', movie.homepage, 'url', { placeholder: 'https://...' })}
        {FormField('Production Companies', 'production_companies', (movie.production_companies || []).map((c) => c.name).join(', '), 'text', { placeholder: 'Company 1, Company 2' })}

        <input type="hidden" name="source" value={movie.id ? 'tmdb' : 'manual'} />

        <div className="flex gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button type="submit" className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors">💾 Save to Library</button>
          <button type="button" onClick={onBack} className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">Cancel</button>
        </div>
      </form>
    </div>
  )
}
