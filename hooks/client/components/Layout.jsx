/** @jsx h */
/**
 * Repo UI Layout component (JSX)
 * - Path input + Go button
 * - Branch dropdown selector
 * - Search form to /search/[query]
 *
 * IMPORTANT: This module is transpiled in the browser via @babel/standalone.
 * There is no "react" module available to import at runtime. JSX compiles to the provided `h`.
 *
 * Loaded via: helpers.loadModule('./lib/components/Layout.jsx')
 */

export default function Layout(props) {
  const { h, params = {}, helpers = {}, options = {}, children } = props || {}
  const branches = (options && options.branches) || ['main']
  const currentBranch = (params && params.branch) || (options && options.repository && options.repository.currentBranch) || branches[0] || 'main'
  const path = (params && params.path) || '/README.md'

  function onSubmitPath(ev) {
    ev.preventDefault()
    const form = ev.currentTarget
    const input = form.elements.namedItem('path')
    const value = String((input && input.value) || '')
    if (!helpers || !helpers.navigate) return
    const normalized = value.startsWith('/') ? value : `/${value}`
    helpers.navigate(normalized)
  }

  function onSubmitSearch(ev) {
    ev.preventDefault()
    const form = ev.currentTarget
    const input = form.elements.namedItem('q')
    const q = String((input && input.value) || '')
    if (!q.trim() || !helpers || !helpers.navigate) return
    // Reset to page 1 when starting a new search
    helpers.navigate(`/search/${encodeURIComponent(q.trim())}?page=1`)
  }

  function onChangeBranch(ev) {
    const next = (ev && ev.target && ev.target.value) || 'main'
    if (helpers && helpers.setBranch) helpers.setBranch(next)
    if (helpers && helpers.navigate) helpers.navigate(path || '/README.md')
  }

  return (
    <div className="flex flex-col h-full" id="layout">
      <div className="flex flex-col gap-3 p-0 border-b border-gray-300 dark:border-gray-700 flex-shrink-0">
        <form className="flex gap-2 p-2" onSubmit={onSubmitPath}>
          <input type="text" name="path" defaultValue={path} placeholder="Enter path... (/README.md)" className="flex-1 px-2 py-2 border border-gray-300 rounded font-mono text-sm" />
          <button type="submit" className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white border-none rounded cursor-pointer text-sm font-medium">Go</button>
        </form>
        <div className="flex gap-4 p-2 items-center">
          {branches && branches.length > 0 ? (
            <label className="flex items-center gap-2 text-sm">
              <span>Branch:</span>
              <select value={currentBranch} onChange={onChangeBranch} className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-800 dark:text-white cursor-pointer">
                {branches.map((b) => (
                  <option value={b} key={b}>{b}</option>
                ))}
              </select>
            </label>
          ) : null}
          <form className="flex items-center gap-2 ml-auto" onSubmit={onSubmitSearch}>
            <input type="search" name="q" placeholder="Search…" className="px-2 py-1 border border-gray-300 rounded text-sm" />
            <button type="submit" className="px-3 py-1 bg-gray-700 hover:bg-gray-800 text-white rounded text-sm">Search</button>
            <button 
              type="button" 
              onClick={() => {
                if (helpers && helpers.navigate) helpers.navigate('/')
              }}
              className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm"
            >
              ← Back
            </button>
          </form>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2">{children}</div>
    </div>
  )
}
