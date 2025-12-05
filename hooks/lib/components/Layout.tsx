/* @jsx h */
/**
 * Repo UI Layout component (TSX)
 * - Path input + Go
 * - Branch dropdown
 * - Search form to /search/[query]
 */
import type { HookParams, Helpers } from '../../types'
import type { ReactNode } from 'react'

interface LayoutProps {
  h: typeof import('react').createElement
  params: HookParams
  helpers: Helpers
  options: { branches?: string[]; repository?: { currentBranch?: string } }
  children: ReactNode
}

export default function Layout({ h, params = {}, helpers = {}, options = {}, children }: LayoutProps) {
  const branches: string[] = options?.branches || ['main']
  const currentBranch = (params.branch as string) || options?.repository?.currentBranch || branches[0] || 'main'
  const path = (params.path as string) || '/README.md'

  function onSubmitPath(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault()
    const form = ev.currentTarget
    const input = form.elements.namedItem('path') as HTMLInputElement | null
    const value = String(input?.value || '')
    if (!helpers.navigate) return
    const normalized = value.startsWith('/') ? value : `/${value}`
    helpers.navigate(normalized)
  }

  function onSubmitSearch(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault()
    const form = ev.currentTarget
    const input = form.elements.namedItem('q') as HTMLInputElement | null
    const q = String(input?.value || '')
    if (!q.trim() || !helpers.navigate) return
    helpers.navigate(`/search/${encodeURIComponent(q.trim())}`)
  }

  function onChangeBranch(ev: React.ChangeEvent<HTMLSelectElement>) {
    const next = ev.target?.value || 'main'
    if (helpers.setBranch) helpers.setBranch(next)
    if (helpers.navigate) helpers.navigate(path || '/README.md')
  }

  return (
    <div className="flex flex-col h-full" name="layout">
      <div className="flex flex-col gap-3 p-0 border-b border-gray-300 dark:border-gray-700 flex-shrink-0">
        <form className="flex gap-2 p-2" onSubmit={onSubmitPath}>
          <input type="text" name="path" defaultValue={path} placeholder="Enter path... (/README.md)" className="flex-1 px-2 py-2 border border-gray-300 rounded font-mono text-sm" />
          <button type="submit" className="px-4 py-2 bg-blue-500 text-white border-none rounded cursor-pointer text-sm font-medium hover:bg-blue-600">Go</button>
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
            <button type="submit" className="px-3 py-1 bg-gray-700 text-white rounded text-sm hover:bg-black">Search</button>
          </form>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-8">{children}</div>
    </div>
  )
}
