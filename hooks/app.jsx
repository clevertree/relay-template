// Main application hook - entry point for runtime-transpiled JSX
// Renders the entire app using themed-styler and hook-transpiler

export default function App(ctx) {
    const { React } = ctx || {}
    if (!React) {
        throw new Error('React runtime not provided to hook context')
    }
    const { useState, useEffect } = React
    const [activeTab, setActiveTab] = useState('home')
    const [tabs] = useState([
        { id: 'home', title: 'Home', isHome: true },
        { id: 'settings', title: 'Settings' },
        { id: 'test', title: 'Test' }
    ])

    // Apply theme on mount
    useEffect(() => {
        // Theme will be applied by styler
        console.log('[App Hook] Mounted')
    }, [])

    const handleTabClick = (tabId) => {
        setActiveTab(tabId)
    }

    return (
        <div className="flex flex-col w-screen h-screen bg-primary theme">
            {/* Tab Bar */}
            <div className="border-b overflow-x-auto overflow-y-hidden">
                <div className="flex gap-1 p-0 min-h-11 items-center">
                    <div className="flex gap-1">
                        {tabs.map((tab) => {
                            const isActive = tab.id === activeTab
                            return (
                                <div
                                    key={tab.id}
                                    className={`flex items-center gap-2 px-4 py-2 border border-b-2 rounded-t-lg cursor-pointer transition-all flex-shrink-0 min-w-32 max-w-60 ${isActive
                                            ? 'border-b-blue-500 font-semibold bg-surface'
                                            : 'border-b-transparent'
                                        }`}
                                    onClick={() => handleTabClick(tab.id)}
                                >
                                    <span
                                        className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-sm"
                                        title={tab.title}
                                    >
                                        {tab.title}
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex flex-1 overflow-hidden">
                <main className="flex-1 flex flex-col overflow-hidden">
                    {activeTab === 'home' ? (
                        <div className="p-4">
                            <h1 className="text-2xl font-bold mb-4">Home</h1>
                            <p>Welcome to Relay Web Client</p>
                            <p className="mt-2">This entire UI is rendered via transpiled JSX using hook-transpiler + themed-styler!</p>
                        </div>
                    ) : activeTab === 'settings' ? (
                        <div className="p-4">
                            <h1 className="text-2xl font-bold mb-4">Settings</h1>
                            <p>Settings panel</p>
                        </div>
                    ) : activeTab === 'test' ? (
                        <div className="p-4">
                            <h1 className="text-2xl font-bold mb-4">Test</h1>
                            <p>Test panel</p>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-full w-full">
                            <div className="text-center">
                                <h2 className="mb-2 text-2xl font-semibold">No content</h2>
                                <p className="text-base">Select a tab</p>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    )
}
