
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
    theme = null,
) {
    // Use provided theme or fallback to default dark theme colors
    const defaultDarkTheme = {
        colors: {
            textSecondary: '#d1d5db',
            border: '#374151',
            bgTertiary: '#374151',
            bgSecondary: '#1f2937',
            textPrimary: '#f3f4f6',
            primary: '#2563eb',
            buttonSecondary: '#374151',
            buttonSecondaryHover: '#1f2937'
        }
    }
    const themeColors = (theme && theme.colors) ? theme.colors : defaultDarkTheme.colors
    const movie = prefillData || {}

    const FormField = (label, name, value, type = 'text', options = {}) => {
        const {multiline, readonly, placeholder} = options
        return (
            <div className="space-y-1">
                <label className="block text-sm font-medium" htmlFor={name}
                       style={{color: themeColors.textSecondary}}>{label}</label>
                {multiline ? (
                    <textarea id={name} name={name} defaultValue={(value || '')} placeholder={placeholder || ''}
                              readOnly={readonly} rows={4}
                              className="w-full px-3 py-2 rounded-md shadow-sm focus:ring-2 transition" style={{
                        borderColor: themeColors.border,
                        backgroundColor: readonly ? themeColors.bgTertiary : themeColors.bgSecondary,
                        color: themeColors.textPrimary,
                        focusRing: themeColors.primary,
                        cursor: readonly ? 'not-allowed' : 'auto'
                    }}/>
                ) : (
                    <input type={type} id={name} name={name} defaultValue={(value || '')}
                           placeholder={placeholder || ''} readOnly={readonly}
                           className="w-full px-3 py-2 rounded-md shadow-sm focus:ring-2 transition" style={{
                        borderColor: themeColors.border,
                        backgroundColor: readonly ? themeColors.bgTertiary : themeColors.bgSecondary,
                        color: themeColors.textPrimary,
                        focusRing: themeColors.primary,
                        cursor: readonly ? 'not-allowed' : 'auto'
                    }}/>
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
                <button type="button"
                        onClick={onBack}
                        className="px-4 py-2 text-white rounded text-sm font-medium transition"
                        style={{
                            backgroundColor: themeColors.buttonSecondary
                        }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = themeColors.buttonSecondaryHover}
                        onMouseLeave={(e) => e.target.style.backgroundColor = themeColors.buttonSecondary}>
                    ← Back
                </button>
                <h1 className="text-2xl font-bold"
                    style={{color: themeColors.textPrimary}}>{movie.id ? 'Add Movie to Library' : 'Create New Movie'}</h1>
                <div className="w-20"/>
            </div>

            {movie.id && (
                <div
                    className="bg-[var(--bg-info)] border border-[var(--border)] rounded-lg p-4">
                    <p className="text-sm text-[var(--text-info)]">Pre-filled from TMDB ID: {movie.id}. You can
                        edit any field before saving.</p>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="flex flex-col md:flex-row gap-6">
                    {posterUrl && (
                        <div className="flex-shrink-0">
                            <img src={posterUrl} alt={movie.title || 'Movie poster'}
                                 className="w-32 md:w-48 rounded-lg shadow-lg"/>
                            <input type="hidden" name="poster_path" value={movie.poster_path || ''}/>
                            <input type="hidden" name="backdrop_path" value={movie.backdrop_path || ''}/>
                        </div>
                    )}
                    <div className="flex-1 space-y-4">
                        {FormField('Title', 'title', movie.title, 'text', {placeholder: 'Movie title'})}
                        {FormField('Original Title', 'original_title', movie.original_title, 'text')}
                        {FormField('Tagline', 'tagline', movie.tagline, 'text', {placeholder: 'Movie tagline'})}
                        {FormField('Release Date', 'release_date', movie.release_date, 'date')}
                    </div>
                </div>

                {FormField('Overview', 'overview', movie.overview, 'text', {
                    multiline: true,
                    placeholder: 'Movie synopsis/description'
                })}

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
                    {placeholder: 'Action, Drama, Sci-Fi'}
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {FormField('TMDB ID', 'tmdb_id', movie.id, 'text', {readonly: !!movie.id})}
                    {FormField('IMDb ID', 'imdb_id', movie.imdb_id, 'text')}
                </div>

                {FormField('Homepage URL', 'homepage', movie.homepage, 'url', {placeholder: 'https://...'})}
                {FormField('Production Companies', 'production_companies', (movie.production_companies || []).map((c) => c.name).join(', '), 'text', {placeholder: 'Company 1, Company 2'})}

                <input type="hidden" name="source" value={movie.id ? 'tmdb' : 'manual'}/>

                <div className="flex gap-4 pt-4 border-t border-[var(--border)]">
                    <button type="submit"
                            className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors">💾
                        Save to Library
                    </button>
                    <button type="button" onClick={onBack}
                            className="px-6 py-3 bg-[var(--bg-secondary)] text-[var(--text)] rounded-lg font-medium transition-colors">Cancel
                    </button>
                </div>
            </form>
        </div>
    )
}
