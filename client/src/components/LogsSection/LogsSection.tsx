import React, { useEffect, useRef } from 'react'

export interface LogsSectionProps {
  logs: string[]
}

export default function LogsSection({ logs }: LogsSectionProps) {
  const endRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    // Auto-scroll to bottom on new log
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs.length])

  return (
    <section id="logs" className="bg-gray-800 rounded-lg p-6 shadow-lg mb-8">
      <h2 className="text-2xl font-semibold mb-4">Logs</h2>
      <div className="h-56 overflow-auto bg-black/50 rounded p-3 text-xs font-mono whitespace-pre-wrap">
        {logs.length === 0 && (
          <div className="text-gray-400">No logs yet. Actions and backend events will appear here in real-time.</div>
        )}
        {logs.map((line, idx) => (
          <div key={idx} className="text-gray-200">{line}</div>
        ))}
        <div ref={endRef} />
      </div>
    </section>
  )
}
