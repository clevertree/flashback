import React from "react";

export interface ConnectionFormProps {
    serverIp: string
    serverPort: string
    clientIp: string
    clientPort: string
    connected: boolean
    status: string
    error: string
    setServerIp: (v: string) => void
    setServerPort: (v: string) => void
    setClientIp: (v: string) => void
    setClientPort: (v: string) => void
    onConnect: () => void
}

export default function ConnectionForm(props: ConnectionFormProps) {
    const {
        serverIp,
        serverPort,
        clientIp,
        clientPort,
        connected,
        status,
        error,
        setServerIp,
        setServerPort,
        setClientIp,
        setClientPort,
        onConnect,
    } = props

    return (
        <section id="connection" className="bg-gray-800 rounded-lg p-6 mb-8 shadow-lg">
            <h2 className="text-2xl font-semibold mb-4 text-white">Connection Settings</h2>

            <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                    <label className="block text-sm font-medium mb-2 text-gray-200">Server Hostname</label>
                    <input
                        type="text"
                        value={serverIp}
                        onChange={(e) => setServerIp(e.target.value)}
                        disabled={connected}
                        className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none disabled:opacity-50 placeholder-gray-400"
                        placeholder="server.flashbackrepository.org"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-2 text-gray-200">Server Port</label>
                    <input
                        type="text"
                        value={serverPort}
                        onChange={(e) => setServerPort(e.target.value)}
                        disabled={connected}
                        className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none disabled:opacity-50 placeholder-gray-400"
                        placeholder="51111"
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                    <label className="block text-sm font-medium mb-2 text-gray-200">Your IP Address</label>
                    <input
                        type="text"
                        value={clientIp}
                        onChange={(e) => setClientIp(e.target.value)}
                        disabled={connected}
                        className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none disabled:opacity-50 placeholder-gray-400"
                        placeholder="127.0.0.1"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-2 text-gray-200">Your Port</label>
                    <input
                        type="text"
                        value={clientPort}
                        onChange={(e) => setClientPort(e.target.value)}
                        disabled={connected}
                        className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none disabled:opacity-50 placeholder-gray-400"
                        placeholder="Random port"
                    />
                </div>
            </div>

            <button
                onClick={onConnect}
                disabled={connected}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded font-semibold transition-colors text-white"
            >
                {connected ? 'Connected' : 'Connect to Server'}
            </button>

            {status && (
                <div
                    className={`mt-4 p-3 rounded ${connected ? 'bg-green-900/50 text-green-200' : 'bg-yellow-900/50 text-yellow-200'}`}>
                    {status}
                </div>
            )}

            {error && (
                <div className="mt-4 p-3 rounded bg-red-900/50 text-red-200">{error}</div>
            )}
        </section>
    )
}