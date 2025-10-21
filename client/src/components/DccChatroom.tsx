"use client"
import React, { useMemo, useRef, useState } from 'react'

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
  onPlayback?: (url: string) => void
}

export default function DccChatroom({ peer, onClose, onSendFile, onPlayback }: DccChatroomProps) {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<DccMessage[]>([])
  const [logs, setLogs] = useState<string[]>([])
  const [incomingFile, setIncomingFile] = useState<{ name: string; url: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const peerLabel = useMemo(() => (peer ? `${peer.ip}:${peer.port}` : 'No peer'), [peer])

  if (!peer) return null

  function append(text: string, from: 'self' | 'peer' = 'self') {
    setMessages((m) => [...m, { text, from, ts: Date.now() }])
  }
  function log(line: string) {
    setLogs((l) => [...l, `[${new Date().toLocaleTimeString()}] ${line}`])
  }

  function handleSend() {
    const trimmed = input.trim()
    if (!trimmed) return

    if (/^\/File\b/i.test(trimmed)) {
      const match = trimmed.match(/start\s*=\s*([0-9]+(?:\.[0-9]+)?)/i)
      const startTime = match ? parseFloat(match[1]) : undefined
      append(`Initiated file request ${startTime !== undefined ? `(start=${startTime}s)` : ''}`)
      log(`File request started${startTime !== undefined ? ` at ${startTime}s` : ''}. Select a file to send.`)
      setTimeout(() => fileInputRef.current?.click(), 0)
    } else {
      append(trimmed)
    }
    setInput('')
  }

  function onFileChosen(file: File) {
    log(`Selected file: ${file.name} (${file.size} bytes)`)
    onSendFile?.(file)
    // In a real app, this would signal the receiver. For demo, also create an incoming offer locally.
    const url = URL.createObjectURL(file)
    setIncomingFile({ name: file.name, url })
  }

  function handleOpenWithOS(url: string) {
    window.open(url, '_blank')
    log('Opened file with OS default handler (browser context).')
  }
  function handleSaveToOS(url: string, name: string) {
    const a = document.createElement('a')
    a.href = url
    a.download = name
    document.body.appendChild(a)
    a.click()
    a.remove()
    log('Saved file via browser download.')
  }
  function handlePlayback(url: string) {
    onPlayback?.(url)
    log('Playback started in video player.')
  }

  return (
    <section id="dcc" className="bg-gray-800 rounded-lg p-6 shadow-lg mt-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-2xl font-semibold">DCC with {peerLabel}</h2>
        <button className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded" onClick={onClose}>Close</button>
      </div>

      {/* Chat / Logs */}
      <div className="bg-gray-900 rounded p-3 h-48 overflow-y-auto mb-3 space-y-1">
        {messages.length === 0 ? (
          <p className="text-gray-400 text-center py-6">Start chatting or type /File to request a file stream.</p>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`text-sm ${m.from === 'self' ? 'text-blue-200' : 'text-gray-200'}`}>[{new Date(m.ts).toLocaleTimeString()}] {m.from === 'self' ? 'You' : 'Peer'}: {m.text}</div>
          ))
        )}
      </div>

      {/* Incoming file offer UI */}
      {incomingFile && (
        <div className="bg-gray-700/60 border border-gray-600 rounded p-3 mb-3">
          <div className="mb-2 text-sm">Incoming file: <span className="font-mono text-blue-200">{incomingFile.name}</span></div>
          <div className="flex gap-2 flex-wrap">
            <button className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded" onClick={() => handleOpenWithOS(incomingFile.url)}>Open with OS</button>
            <button className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded" onClick={() => handleSaveToOS(incomingFile.url, incomingFile.name)}>Save to OS</button>
            <button className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 rounded" onClick={() => handlePlayback(incomingFile.url)}>Playback</button>
            <button className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded" onClick={() => { setIncomingFile(null); log('Dismissed incoming file offer.') }}>Dismiss</button>
          </div>
        </div>
      )}

      {/* Logs section */}
      <div className="bg-gray-900 rounded p-3 h-28 overflow-y-auto mb-3">
        <div className="text-xs text-gray-400 mb-1">Logs</div>
        {logs.length === 0 ? (
          <div className="text-xs text-gray-500">No logs yet.</div>
        ) : (
          logs.map((l, i) => (
            <div key={i} className="text-xs text-gray-300 font-mono whitespace-pre-wrap">{l}</div>
          ))
        )}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Type a message or /File start=12.5"
          className="flex-1 px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
        />
        <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded" onClick={handleSend}>Send</button>
      </div>

      {/* Hidden file input for /File */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onFileChosen(f)
          // reset input
          if (fileInputRef.current) fileInputRef.current.value = ''
        }}
      />
    </section>
  )
}
