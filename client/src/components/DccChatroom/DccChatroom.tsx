import {invoke as tauriInvoke} from "@tauri-apps/api/core";
import React, {useMemo, useRef, useState} from "react";

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
    incomingOffer?: { name: string; size: number } | null
    invokeFn?: (cmd: string, args?: any) => Promise<any>
}

export default function DccChatroom({
                                        peer,
                                        onClose,
                                        onSendFile,
                                        onPlayback,
                                        incomingOffer,
                                        invokeFn = tauriInvoke
                                    }: DccChatroomProps) {
    const [input, setInput] = useState('')
    const [messages, setMessages] = useState<DccMessage[]>([])
    const [logs, setLogs] = useState<string[]>([])
    const [incomingFile, setIncomingFile] = useState<{ name: string; url: string } | null>(null)
    const [pendingAction, setPendingAction] = useState<null | 'open' | 'save' | 'play'>(null)
    const fileInputRef = useRef<HTMLInputElement | null>(null)
    const peerLabel = useMemo(() => (peer ? `${peer.ip}:${peer.port}` : 'No peer'), [peer])

    // Reflect incoming offers from props (receiver side)
    React.useEffect(() => {
        if (incomingOffer) {
            setIncomingFile({name: incomingOffer.name, url: ''})
            log(`Incoming file offer: ${incomingOffer.name} (${incomingOffer.size} bytes)`)
        }
    }, [incomingOffer])

    // Listen for local broadcasted stream URLs from the sender (same-origin demo transport)
    React.useEffect(() => {
        if (!peer) return
        const bc = new BroadcastChannel('dcc-stream')
        const onMsg = (ev: MessageEvent) => {
            const data = ev.data || {}
            if (data && data.from_ip === peer.ip && data.from_port === peer.port && data.url && data.name) {
                setIncomingFile({ name: data.name, url: data.url })
                log(`Stream URL received from sender for ${data.name}`)
                // Execute any pending action
                if (pendingAction === 'open') {
                    handleOpenWithOS(data.url)
                    setPendingAction(null)
                } else if (pendingAction === 'save') {
                    handleSaveToOS(data.url, data.name)
                    setPendingAction(null)
                } else if (pendingAction === 'play') {
                    handlePlayback(data.url)
                    setPendingAction(null)
                }
            }
        }
        bc.addEventListener('message', onMsg as any)
        return () => {
            bc.removeEventListener('message', onMsg as any)
            bc.close()
        }
    }, [peer, pendingAction])

    if (!peer) return null

    function append(text: string, from: 'self' | 'peer' = 'self') {
        setMessages((m) => [...m, {text, from, ts: Date.now()}])
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
        // Notify remote via server relay that a file is offered
        invokeFn('dcc_file_offer', {
            toIp: peer!.ip,
            toPort: peer!.port,
            name: file.name,
            size: file.size
        }).catch((e: any) => {
            log(`Failed to send file offer: ${e}`)
        })
        // Sender should NOT see receiver options; simulate sending an offer to the peer only.
        const url = URL.createObjectURL(file)
        log(`Sent file offer to ${peerLabel}`)
        // Do not set incomingFile here to avoid showing receiver UI on sender
    }

    const isTauri = typeof window !== 'undefined' && (('__TAURI_INTERNALS__' in window) || (window as any).__TAURI__)

    async function handleOpenWithOS(url: string) {
        // Use Tauri shell plugin in desktop builds; avoid browser fallback when Tauri is present
        const tauriDetected = isTauri
        try {
            const shell = await import('@tauri-apps/plugin-shell')
            if (shell && typeof shell.open === 'function') {
                await shell.open(url)
                log('Opened file with OS default handler.')
                return
            }
            throw new Error('tauri plugin-shell open() not available')
        } catch (e) {
            if (tauriDetected) {
                log(`Failed to open with OS via Tauri: ${e}`)
                return
            }
            // Browser-only dev fallback (non-Tauri)
            try {
                window.open(url, '_blank', 'noopener,noreferrer')
                log('Opened file in browser (web mode).')
            } catch (e2) {
                log(`Failed to open file in browser: ${e2}`)
            }
        }
    }

    async function handleSaveToOS(url: string, name: string) {
        // Use Tauri dialog + fs; only fall back to browser when NOT running under Tauri
        const tauriDetected = isTauri
        try {
            const [{ save }, fs] = await Promise.all([
                import('@tauri-apps/plugin-dialog'),
                import('@tauri-apps/plugin-fs'),
            ])
            const suggested = name || 'download.bin'
            const targetPath = await save({ defaultPath: suggested })
            if (targetPath) {
                const resp = await fetch(url)
                const buf = await resp.arrayBuffer()
                await fs.writeFile(targetPath, new Uint8Array(buf))
                log(`Saved file to: ${targetPath}`)
                return
            } else {
                log('Save canceled by user.')
                return
            }
        } catch (e) {
            if (tauriDetected) {
                log(`Failed to save via Tauri FS/Dialog: ${e}`)
                return
            }
            // Web fallback (non-Tauri)
            try {
                const a = document.createElement('a')
                a.href = url
                a.download = name
                document.body.appendChild(a)
                a.click()
                a.remove()
                log('Saved file via browser download (web mode).')
                return
            } catch (e2) {
                log(`Failed browser download: ${e2}`)
            }
        }
    }

    function handlePlayback(url: string) {
        onPlayback?.(url)
        log('Playback started in video player.')
    }

    return (
        <section id="dcc" className="bg-gray-800 rounded-lg p-6 shadow-lg mt-8">
            <div className="flex items-center justify-between mb-3">
                <h2 className="text-2xl font-semibold">DCC with {peerLabel}</h2>
                <button className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded" onClick={onClose}>Close
                </button>
            </div>

            {/* Chat / Logs */}
            <div className="bg-gray-900 rounded p-3 h-48 overflow-y-auto mb-3 space-y-1">
                {messages.length === 0 ? (
                    <p className="text-gray-400 text-center py-6">Start chatting or type /File to request a file
                        stream.</p>
                ) : (
                    messages.map((m, i) => (
                        <div key={i}
                             className={`text-sm ${m.from === 'self' ? 'text-blue-200' : 'text-gray-200'}`}>[{new Date(m.ts).toLocaleTimeString()}] {m.from === 'self' ? 'You' : 'Peer'}: {m.text}</div>
                    ))
                )}
            </div>

            {/* Incoming file offer UI */}
            {incomingFile && (
                <div className="bg-gray-700/60 border border-gray-600 rounded p-3 mb-3">
                    <div className="mb-2 text-sm">Incoming file: <span
                        className="font-mono text-blue-200">{incomingFile.name}</span></div>
                    {(!incomingFile.url || incomingFile.url.length === 0) && (
                        <div className="text-xs text-yellow-300 mb-2">Waiting for stream/data from sender…</div>
                    )}
                    <div className="flex gap-2 flex-wrap">
                        <button
                                className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded"
                                onClick={async () => {
                                    if (!incomingFile.url) {
                                        setPendingAction('open')
                                        log('Accepting file (Open with OS)… waiting for sender stream…')
                                        try {
                                            await invokeFn('dcc_file_accept', { toIp: peer!.ip, toPort: peer!.port, name: incomingFile.name, action: 'open' })
                                        } catch (e: any) {
                                            log(`Failed to send accept: ${e}`)
                                        }
                                        return
                                    } else {
                                        handleOpenWithOS(incomingFile.url)
                                    }
                                }}>Open with OS
                        </button>
                        <button
                                className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded"
                                onClick={async () => {
                                    if (!incomingFile.url) {
                                        setPendingAction('save')
                                        log('Accepting file (Save to OS)… waiting for sender stream…')
                                        try {
                                            await invokeFn('dcc_file_accept', { toIp: peer!.ip, toPort: peer!.port, name: incomingFile.name, action: 'save' })
                                        } catch (e: any) {
                                            log(`Failed to send accept: ${e}`)
                                        }
                                        return
                                    } else {
                                        handleSaveToOS(incomingFile.url, incomingFile.name)
                                    }
                                }}>Save to OS
                        </button>
                        <button
                                className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 rounded"
                                onClick={async () => {
                                    if (!incomingFile.url) {
                                        setPendingAction('play')
                                        log('Accepting file (Playback)… waiting for sender stream…')
                                        try {
                                            await invokeFn('dcc_file_accept', { toIp: peer!.ip, toPort: peer!.port, name: incomingFile.name, action: 'play' })
                                        } catch (e: any) {
                                            log(`Failed to send accept: ${e}`)
                                        }
                                        return
                                    } else {
                                        handlePlayback(incomingFile.url)
                                    }
                                }}>Playback
                        </button>
                        <button className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded" onClick={() => {
                            setIncomingFile(null);
                            setPendingAction(null);
                            log('Dismissed incoming file offer.')
                        }}>Dismiss
                        </button>
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
                    if (fileInputRef.current) fileInputRef.current.value = ''
                }}
            />
        </section>
    )
}