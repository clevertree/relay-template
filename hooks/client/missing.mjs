/**
 * missing.mjs — 404 Fallback Page
 * Rendered when a requested file is not found in the repository
 * 
 * Exported as: render(h, path) function
 */

export function render(h, path = '/') {
  return h('div', {
    className: 'flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4'
  },
    h('div', {className: 'text-center space-y-6 max-w-md'},
      h('h1', {className: 'text-6xl font-bold text-red-500'}, '404'),
      h('h2', {className: 'text-2xl font-semibold'}, 'Page Not Found'),
      h('p', {className: 'text-gray-400 text-lg'},
        `The file "${path}" does not exist in this repository.`
      ),
      h('div', {className: 'space-y-3 pt-6'},
        h('p', {className: 'text-sm text-gray-500'},
          'Try one of the following:'
        ),
        h('ul', {className: 'text-left text-sm text-gray-400 space-y-2'},
          h('li', {}, '• Navigate to a valid file or directory'),
          h('li', {}, '• Use the path input at the top to browse files'),
          h('li', {}, '• Return to the home directory'
          )
        )
      ),
      h('button', {
        onClick: () => {
          if (typeof window !== 'undefined') {
            window.history.back();
          }
        },
        className: 'mt-8 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition'
      }, '← Go Back')
    )
  );
}

export default {render};
