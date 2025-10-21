"use client"
import React, { useMemo, useState } from 'react'

export interface DccPeer {
  ip: string
  port: number
}

interface DccMessage {
  from: 'self' | 'peer'
  text: string
  ts: number
}

export interface DccChatroomProps {
  peer: DccPeer | null
  onClose: () => void
  onSendFile?: (file: File, startTimeSec?: number) => void
}

export default function DccChatroom({ peer, onClose, onSendFile }: DccChatroomProps) {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<DccMessage[]>([])
  const peerLabel = useMemo(() => (peer ? `${peer.ip}:${peer.port}` : 'No peer'), [peer])

  if (!peer) return null

  function append(text: string, from: 'self' | 'peer' = 'self') {
    setMessages((m) => [...m, { text, from, ts: Date.now() }])
  }

  function handleSend() {
    const trimmed = input.trim()
    if (!trimmed) return

    if (/^\/File\b/i.test(trimmed)) {
      // Parse optional start parameter: /File start=12.5
      const match = trimmed.match(/start\s*=\s*([0-9]+(?:\.[0-9]+)?)/i)
      const startTime = match ? parseFloat(match[1]) : undefined
      append(`Initiated file request ${startTime !== undefined ? `(start=${startTime}s)` : ''}`)
      // Show simple UI hint; real implementation would open file picker
      // In this stub, we just note the action; cypress can assert the line appears.
    } else {
      append(trimmed)
    }
    setInput('')
  }

  return (
    <section id="dcc" className="bg-gray-800 rounded-lg p-6 shadow-lg mt-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-2xl font-semibold">DCC with {peerLabel}</h2>
        <button className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded" onClick={onClose}>Close</button>
      </div>
      <div className="bg-gray-900 rounded p-3 h-48 overflow-y-auto mb-3 space-y-1">
        {messages.length === 0 ? (
          <p className="text-gray-400 text-center py-6">Start chatting or type /File to request a file stream.</p>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`text-sm ${m.from === 'self' ? 'text-blue-200' : 'text-gray-200'}`}>[{new Date(m.ts).toLocaleTimeString()}] {m.from === 'self' ? 'You' : 'Peer'}: {m.text}</div>
          ))
        )}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Type a message or /File start=12.5"
          className="flex-1 px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
        />
        <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded" onClick={handleSend}>Send</button>
      </div>
    </section>
  )
}
