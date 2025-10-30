// Flashback Server - API Documentation
// This page provides basic information about the Flashback server API

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
      <main className="w-full max-w-4xl px-6 py-12">
        <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-8">
          <h1 className="text-4xl font-bold mb-4 text-black dark:text-white">
            Flashback Server
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400 mb-6">
            A distributed client-server application for real-time communication and file transfer.
          </p>

          <div className="space-y-6">
            <section>
              <h2 className="text-2xl font-semibold mb-3 text-black dark:text-white">API Endpoints</h2>
              <ul className="space-y-2 text-zinc-700 dark:text-zinc-300">
                <li><code className="bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">POST /api/register</code> - Register a new client</li>
                <li><code className="bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">POST /api/broadcast/ready</code> - Broadcast client availability</li>
                <li><code className="bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">GET /api/broadcast/lookup</code> - Lookup connected clients</li>
                <li><code className="bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">GET /api/health</code> - Health check endpoint</li>
                <li><code className="bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">POST /api/repository/list</code> - List repository data</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3 text-black dark:text-white">Features</h2>
              <ul className="list-disc list-inside space-y-2 text-zinc-700 dark:text-zinc-300">
                <li>Real-time client discovery and broadcasting</li>
                <li>Group chat messaging between connected clients</li>
                <li>Direct peer-to-peer file transfers (DCC)</li>
                <li>Heartbeat-based connection monitoring</li>
                <li>Configurable via <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">config.toml</code></li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3 text-black dark:text-white">Documentation</h2>
              <p className="text-zinc-700 dark:text-zinc-300 mb-2">
                For more information, see the project README and API documentation.
              </p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Server running on port 51111 (configurable)
              </p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
