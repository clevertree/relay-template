/**
 * missing.mjs — 404 Fallback Page
 * Rendered when a requested file is not found in the repository
 * 
 * Exported as: render(path) function
 */

export function render(path = '/') {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4">
      <div className="text-center space-y-6 max-w-md">
        <h1 className="text-6xl font-bold text-red-500">404</h1>
        <h2 className="text-2xl font-semibold">Page Not Found</h2>
        <p className="text-gray-400 text-lg">
          The file "{path}" does not exist in this repository.
        </p>
        <div className="space-y-3 pt-6">
          <p className="text-sm text-gray-500">Try one of the following:</p>
          <ul className="text-left text-sm text-gray-400 space-y-2">
            <li>• Navigate to a valid file or directory</li>
            <li>• Use the path input at the top to browse files</li>
            <li>• Return to the home directory</li>
          </ul>
        </div>
        <button
          onClick={() => {
            if (typeof window !== 'undefined') {
              window.history.back()
            }
          }}
          className="mt-8 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition"
        >
          ← Go Back
        </button>
      </div>
    </div>
  )
}

export default { render };
