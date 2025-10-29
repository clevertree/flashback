import {invoke as tauriInvoke} from "@tauri-apps/api/core";
import React, {useMemo, useRef, useState} from "react";
import { getConfig } from "@app/config";

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
    const [incomingFile, setIncomingFile] = useState<{ name: string; url?: string; file?: File } | null>(null)
    const [pendingAction, setPendingAction] = useState<null | 'open' | 'save' | 'play'>(null)
    // Per-transfer save targets (stream directly to disk using temp file)
    const saveTargetsRef = useRef<Record<string, { tmpPath: string; finalPath: string; bytesWritten: number }>>({})
    const fileInputRef = useRef<HTMLInputElement | null>(null)
    const peerLabel = useMemo(() => (peer ? `${peer.ip}:${peer.port}` : 'No peer'), [peer])
    // Scroll into view and animate when this window appears
    const sectionRef = useRef<HTMLDivElement | null>(null)
    const [justAppeared, setJustAppeared] = useState(true)
    React.useEffect(() => {
        if (sectionRef.current) {
            try { sectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' } as any) } catch {}
        }
        const t = setTimeout(() => setJustAppeared(false), 1500)
        return () => clearTimeout(t)
    }, [])

    // Transfers state: key = `${peer.ip}:${peer.port}|${name}`
    type TransferStatus = 'pending' | 'in_progress' | 'complete' | 'canceled'
    type TransferRole = 'sender' | 'receiver'
    const [transfers, setTransfers] = useState<Record<string, { name: string; role: TransferRole; status: TransferStatus; bytesSent: number; bytesTotal: number }>>({})
    const [outgoingFile, setOutgoingFile] = useState<File | null>(null)
    const cancelKeysRef = useRef<Set<string>>(new Set())
    const assemblyRef = useRef<Record<string, { chunks: ArrayBuffer[]; bytesTotal: number }>>({})
    // Refs to avoid effect re-subscribe churn during active transfers
    const outgoingFileRef = useRef<File | null>(null)
    React.useEffect(() => { outgoingFileRef.current = outgoingFile }, [outgoingFile])
    const pendingActionRef = useRef<null | 'open' | 'save' | 'play'>(null)
    React.useEffect(() => { pendingActionRef.current = pendingAction }, [pendingAction])

    // Reflect incoming offers from props (receiver side)
    React.useEffect(() => {
        if (incomingOffer && peer) {
            setIncomingFile({name: incomingOffer.name, url: ''})
            const key = `${peer.ip}:${peer.port}|${incomingOffer.name}`
            setTransfers(t => ({ ...t, [key]: { name: incomingOffer.name, role: 'receiver', status: 'pending', bytesSent: 0, bytesTotal: incomingOffer.size } }))
            log(`Incoming file offer: ${incomingOffer.name} (${incomingOffer.size} bytes)`) 
        }
    }, [incomingOffer, peer])

    // Listen for local broadcasted streams from the sender (same-origin demo transport)
    React.useEffect(() => {
        if (!peer) return
        const bc = new BroadcastChannel('dcc-stream')
        const onMsg = (ev: MessageEvent) => {
            const data = ev.data || {}
            if (data && data.from_ip === peer.ip && data.from_port === peer.port && data.name && (data.file || data.url)) {
                let url: string | undefined = data.url
                let file: File | undefined = data.file
                if (!url && file) {
                    try {
                        url = URL.createObjectURL(file)
                    } catch (e) {
                        log(`Failed to create object URL for received file: ${e}`)
                    }
                }
                setIncomingFile({ name: data.name, url, file })
                log(`Stream received from sender for ${data.name}${url ? ' (URL ready)' : ''}`)
                // Execute any pending action
                if (pendingAction === 'open') {
                    if (file) {
                        handleOpenWithOS_UsingFile(file, data.name)
                    } else if (url) {
                        handleOpenWithOS(url)
                    } else {
                        log('Error: No stream available to open.')
                    }
                    setPendingAction(null)
                } else if (pendingAction === 'save') {
                    if (file) {
                        handleSaveToOS_UsingFile(file, data.name)
                    } else if (url) {
                        handleSaveToOS(url, data.name)
                    } else {
                        log('Error: No stream available to save.')
                    }
                    setPendingAction(null)
                } else if (pendingAction === 'play') {
                    if (url) {
                        handlePlayback(url)
                    } else if (file) {
                        const localUrl = URL.createObjectURL(file)
                        handlePlayback(localUrl)
                    } else {
                        log('Error: No stream available to play.')
                    }
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
            // Send DCC chat to peer directly (not via server)
            if (peer) {
                invokeFn('peer_send_dcc_chat', { toIp: peer.ip, toPort: peer.port, text: trimmed })
                    .catch((e: any) => log(`Failed to send DCC chat: ${e}`))
            } else {
                log('No peer connected for DCC chat.')
            }
        }
        setInput('')
    }

    function onFileChosen(file: File) {
        log(`Selected file: ${file.name} (${file.size} bytes)`)
        setOutgoingFile(file)
        onSendFile?.(file)
        // Create/ensure transfer row (sender side)
        const key = `${peer!.ip}:${peer!.port}|${file.name}`
        setTransfers(t => ({ ...t, [key]: { name: file.name, role: 'sender', status: 'pending', bytesSent: 0, bytesTotal: file.size } }))
        // Notify remote via server relay that a file is offered
        invokeFn('peer_send_file_offer', {
            toIp: peer!.ip,
            toPort: peer!.port,
            name: file.name,
            size: file.size
        }).catch((e: any) => {
            log(`Failed to send file offer: ${e}`)
        })
        log(`Sent file offer to ${peerLabel}`)
        // Do not set incomingFile here to avoid showing receiver UI on sender
    }

    const isTauri = typeof window !== 'undefined' && (('__TAURI_INTERNALS__' in window) || (window as any).__TAURI__)

    function getPlatform(): 'windows' | 'mac' | 'linux' {
        const ua = navigator.userAgent
        if (/Windows/i.test(ua)) return 'windows'
        if (/Mac/i.test(ua)) return 'mac'
        return 'linux'
    }

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

    async function handleOpenWithOS_UsingFile(file: File, name: string) {
        const tauriDetected = isTauri
        try {
            const [{ save }, fs, shell] = await Promise.all([
                import('@tauri-apps/plugin-dialog'),
                import('@tauri-apps/plugin-fs'),
                import('@tauri-apps/plugin-shell')
            ])
            const suggested = name || file.name || 'download.bin'
            const targetPath = await save({ defaultPath: suggested })
            if (!targetPath) {
                log('Open canceled by user (no path selected).')
                return
            }
            const buf = new Uint8Array(await file.arrayBuffer())
            await fs.writeFile(targetPath, buf)
            log(`Saved file to: ${targetPath}`)
            try {
                await shell.open(targetPath)
                log('Opened saved file with OS default handler.')
            } catch (e2) {
                log(`Failed to open saved file with OS (ACL or scope?): ${e2}. You can open it manually at: ${targetPath}`)
            }
        } catch (e) {
            if (tauriDetected) {
                log(`Failed to save+open via Tauri plugins: ${e}`)
                return
            }
            try {
                const localUrl = URL.createObjectURL(file)
                window.open(localUrl, '_blank', 'noopener,noreferrer')
                log('Opened file in browser (web mode).')
            } catch (e2) {
                log(`Failed to open in browser: ${e2}`)
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
                if (!resp.ok) {
                    log(`Error: Failed to fetch stream for saving (status ${resp.status}).`)
                    return
                }
                const buf = await resp.arrayBuffer()
                if (!buf || (buf as ArrayBuffer).byteLength === 0) {
                    log('Error: Received 0 bytes when saving; aborting write.')
                    return
                }
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

    async function handleSaveToOS_UsingFile(file: File, name: string) {
        const tauriDetected = isTauri
        try {
            const [{ save }, fs] = await Promise.all([
                import('@tauri-apps/plugin-dialog'),
                import('@tauri-apps/plugin-fs'),
            ])
            const suggested = name || file.name || 'download.bin'
            const targetPath = await save({ defaultPath: suggested })
            if (!targetPath) {
                log('Save canceled by user.')
                return
            }
            const buf = new Uint8Array(await file.arrayBuffer())
            if (buf.byteLength === 0) {
                log('Error: File had 0 bytes; aborting write.')
                return
            }
            await fs.writeFile(targetPath, buf)
            log(`Saved file to: ${targetPath}`)
        } catch (e) {
            if (tauriDetected) {
                log(`Failed to save via Tauri FS/Dialog: ${e}`)
                return
            }
            try {
                const a = document.createElement('a')
                a.href = URL.createObjectURL(file)
                a.download = name || file.name || 'download.bin'
                document.body.appendChild(a)
                a.click()
                a.remove()
                log('Saved file via browser download (web mode).')
            } catch (e2) {
                log(`Failed browser download: ${e2}`)
            }
        }
    }

    // Helpers for streaming-to-disk on receiver save/open
    async function ensureSaveTarget(key: string, name: string): Promise<{ tmpPath: string; finalPath: string } | null> {
        try {
            const [{ save }, fs] = await Promise.all([
                import('@tauri-apps/plugin-dialog'),
                import('@tauri-apps/plugin-fs'),
            ])
            const suggested = name || 'download.bin'
            const finalPath = await save({ defaultPath: suggested })
            if (!finalPath) {
                log('Save canceled by user.')
                return null
            }
            // Place temp file in configured temp directory (or OS temp) to avoid forbidden path errors
            let tmpPath: string
            try {
                const { tempDir, join } = await import('@tauri-apps/api/path')
                const baseTmp = await tempDir()
                tmpPath = await join(baseTmp, `${suggested}.part`)
            } catch {
                // Fallback: same directory as final (may be restricted by Tauri scope)
                tmpPath = `${finalPath}.part`
            }
            try {
                // best-effort cleanup of old temp
                const anyFs: any = fs as any
                if (typeof anyFs.removeFile === 'function') {
                    await anyFs.removeFile(tmpPath).catch(() => {})
                }
            } catch {}
            saveTargetsRef.current[key] = { tmpPath, finalPath, bytesWritten: 0 }
            log(`Saving to temp: ${tmpPath}`)
            return { tmpPath, finalPath }
        } catch (e) {
            log(`Failed to select save target: ${e}`)
            return null
        }
    }

    async function appendChunkToTarget(key: string, buf: Uint8Array) {
        try {
            const fs: any = await import('@tauri-apps/plugin-fs')
            const target = saveTargetsRef.current[key]
            if (!target) return
            const { tmpPath } = target
            if (typeof fs.appendFile === 'function') {
                await fs.appendFile(tmpPath, buf)
            } else if (typeof fs.writeFile === 'function') {
                // try an append option if supported
                try {
                    await fs.writeFile(tmpPath, buf, { append: true })
                } catch {
                    // fallback: read-then-write (may be heavy, but last resort)
                    if (typeof fs.readFile === 'function') {
                        const prev: Uint8Array = await fs.readFile(tmpPath).catch(() => new Uint8Array())
                        const merged = new Uint8Array(prev.length + buf.length)
                        merged.set(prev, 0); merged.set(buf, prev.length)
                        await fs.writeFile(tmpPath, merged)
                    } else {
                        // write or create if not exists
                        await fs.writeFile(tmpPath, buf)
                    }
                }
            }
            target.bytesWritten += buf.length
        } catch (e) {
            log(`Failed to append chunk to disk: ${e}`)
        }
    }

    async function finalizeSaveTarget(key: string, action: 'save' | 'open') {
        try {
            const fs: any = await import('@tauri-apps/plugin-fs')
            const shell: any = await import('@tauri-apps/plugin-shell')
            const target = saveTargetsRef.current[key]
            if (!target) return
            const { tmpPath, finalPath } = target
            // Move/rename tmp -> final
            let moved = false
            if (typeof fs.rename === 'function') {
                await fs.rename(tmpPath, finalPath)
                moved = true
            } else if (typeof fs.moveFile === 'function') {
                await fs.moveFile(tmpPath, finalPath)
                moved = true
            } else if (typeof fs.copyFile === 'function' && typeof fs.removeFile === 'function') {
                await fs.copyFile(tmpPath, finalPath)
                await fs.removeFile(tmpPath)
                moved = true
            }
            if (!moved) {
                log(`Warning: Could not move temp file automatically. Temp remains at: ${tmpPath}`)
                return
            }
            log(`Saved file to: ${finalPath}`)
            if (action === 'open') {
                try {
                    const platform = getPlatform()
                    if (platform === 'windows') {
                        const child = await shell.spawn('cmd', ['/C', 'start', '', finalPath])
                        await child.wait()
                    } else if (platform === 'mac') {
                        const child = await shell.spawn('open', [finalPath])
                        await child.wait()
                    } else {
                        const child = await shell.spawn('xdg-open', [finalPath])
                        await child.wait()
                    }
                    log('Opened saved file with OS default handler.')
                } catch (e) {
                    log(`Failed to open saved file with OS: ${e}. You can open it manually at: ${finalPath}`)
                }
            }
        } catch (e) {
            log(`Failed to finalize saved file: ${e}`)
        } finally {
            delete saveTargetsRef.current[key]
        }
    }

    function handlePlayback(url: string) {
        onPlayback?.(url)
        log('Playback started in video player.')
    }

    // Helpers for streaming
    function u8ToBase64(u8: Uint8Array): string {
        let binary = ''
        const len = u8.byteLength
        for (let i = 0; i < len; i += 0x8000) {
            const sub = u8.subarray(i, Math.min(i + 0x8000, len))
            binary += String.fromCharCode.apply(null, Array.from(sub) as unknown as number[])
        }
        return btoa(binary)
    }

    async function streamFileToPeer(file: File, to_ip: string, to_port: number) {
        const key = `${to_ip}:${to_port}|${file.name}`
        cancelKeysRef.current.delete(key)
        setTransfers(t => ({ ...t, [key]: { name: file.name, role: 'sender', status: 'in_progress', bytesSent: 0, bytesTotal: file.size } }))
        const chunkSize = 64 * 1024
        let offset = 0
        while (offset < file.size) {
            if (cancelKeysRef.current.has(key)) {
                log(`Streaming canceled for ${file.name}`)
                break
            }
            const end = Math.min(offset + chunkSize, file.size)
            const slice = file.slice(offset, end)
            const buf = new Uint8Array(await slice.arrayBuffer())
            const data_base64 = u8ToBase64(buf)
            try {
                await invokeFn('peer_send_file_chunk', { toIp: to_ip, toPort: to_port, name: file.name, offset, bytesTotal: file.size, dataBase64: data_base64 })
            } catch (e: any) {
                log(`Failed to send chunk at ${offset}: ${e}`)
                break
            }
            offset = end
            const sent = offset
            setTransfers(t => ({ ...t, [key]: { ...(t[key] || { name: file.name, role: 'sender', status: 'in_progress', bytesSent: 0, bytesTotal: file.size }), bytesSent: sent } }))
            // small yield to UI
            await new Promise(res => setTimeout(res, 0))
        }
        if (!cancelKeysRef.current.has(key) && (transfers[key]?.bytesSent ?? 0) >= file.size) {
            setTransfers(t => ({ ...t, [key]: { ...(t[key] || { name: file.name, role: 'sender', status: 'in_progress', bytesSent: file.size, bytesTotal: file.size }), status: 'complete', bytesSent: file.size } }))
            log(`Completed send: ${file.name}`)
        }
    }

    // Listen for control/progress/cancel (Tauri events in desktop, BroadcastChannel in web dev)
    React.useEffect(() => {
        if (!peer) return
        let unsubscribes: Array<() => void> = []
        let control: BroadcastChannel | null = null
        let chunk: BroadcastChannel | null = null
        let cancel: BroadcastChannel | null = null

        ;(async () => {
            if (isTauri) {
                try {
                    const { listen } = await import('@tauri-apps/api/event')
                    // Remote accepted our offer -> start sending file (sender side)
                    const unAccept = await listen('dcc-file-accept', (ev: any) => {
                        const d: any = ev.payload || {}
                        const of = outgoingFileRef.current
                        if (d && d.from_ip === peer.ip && d.from_port === peer.port && of && d.name === of.name) {
                            streamFileToPeer(of, peer.ip, peer.port).catch(e => log(`Stream error: ${e}`))
                        }
                    })
                    unsubscribes.push(unAccept)

                    // Receiver progress: incoming chunks from peer
                    const unChunk = await listen('dcc-file-chunk', async (ev: any) => {
                        const d: any = ev.payload || {}
                        if (d && d.from_ip === peer.ip && d.from_port === peer.port) {
                            const key = `${peer.ip}:${peer.port}|${d.name}`
                            // Determine total size with fallbacks (server may omit bytes_total)
                            let bytes_total: number = (typeof d.bytes_total === 'number' && d.bytes_total > 0) ? d.bytes_total
                                : (typeof d.size === 'number' && d.size > 0) ? d.size
                                : (typeof d.total === 'number' && d.total > 0) ? d.total
                                : (assemblyRef.current[key]?.bytesTotal ?? 0)
                            const bstr = atob(d.data_base64)
                            const arr = new Uint8Array(bstr.length)
                            for (let i = 0; i < bstr.length; i++) arr[i] = bstr.charCodeAt(i)
                            if (!assemblyRef.current[key]) assemblyRef.current[key] = { chunks: [], bytesTotal: bytes_total }
                            if (saveTargetsRef.current[key]) {
                                appendChunkToTarget(key, arr).catch(e => log(`Append error: ${e}`))
                            } else {
                                const ab = arr.buffer.slice(arr.byteOffset, arr.byteOffset + arr.byteLength)
                                assemblyRef.current[key].chunks.push(ab)
                            }
                            const sent = saveTargetsRef.current[key]
                                ? (saveTargetsRef.current[key].bytesWritten)
                                : (assemblyRef.current[key].chunks.reduce((a, c) => a + c.byteLength, 0))
                            setTransfers(t => ({ ...t, [key]: { name: d.name, role: 'receiver', status: 'in_progress', bytesSent: sent, bytesTotal: bytes_total } }))
                            if (sent >= bytes_total) {
                                if (saveTargetsRef.current[key]) {
                                    const action: 'save' | 'open' = (pendingActionRef.current === 'open') ? 'open' : 'save'
                                    await finalizeSaveTarget(key, action)
                                    setTransfers(t => ({ ...t, [key]: { ...(t[key] || { name: d.name, role: 'receiver', status: 'in_progress', bytesSent: bytes_total, bytesTotal: bytes_total }), status: 'complete', bytesSent: bytes_total } }))
                                    log(`Completed receive: ${d.name}`)
                                    setPendingAction(null)
                                } else {
                                    const blob = new Blob(assemblyRef.current[key].chunks, { type: 'application/octet-stream' })
                                    const url = URL.createObjectURL(blob)
                                    setIncomingFile({ name: d.name, url })
                                    setTransfers(t => ({ ...t, [key]: { ...(t[key] || { name: d.name, role: 'receiver', status: 'in_progress', bytesSent: bytes_total, bytesTotal: bytes_total }), status: 'complete', bytesSent: bytes_total } }))
                                    log(`Completed receive: ${d.name}`)
                                    if (pendingActionRef.current === 'play') handlePlayback(url)
                                    else if (pendingActionRef.current === 'open') handleOpenWithOS(url)
                                    else if (pendingActionRef.current === 'save') handleSaveToOS(url, d.name)
                                    setPendingAction(null)
                                }
                            }
                        }
                    })
                    unsubscribes.push(unChunk)

                    const unCancel = await listen('dcc-file-cancel', (ev: any) => {
                        const d: any = ev.payload || {}
                        if (d && d.from_ip === peer.ip && d.from_port === peer.port) {
                            const key = `${peer.ip}:${peer.port}|${d.name}`
                            cancelKeysRef.current.add(key)
                            setTransfers((prev) => {
                                const existing = prev[key]
                                const base = existing ?? { name: d.name, role: 'receiver', status: 'in_progress', bytesSent: 0, bytesTotal: 0 }
                                return { ...prev, [key]: { ...base, status: 'canceled' } }
                            })
                            log(`Transfer canceled: ${d.name}`)
                        }
                    })
                    unsubscribes.push(unCancel)
                } catch (e) {
                    log(`Failed to listen for DCC file events: ${e}`)
                }
            } else {
                // Web/dev fallback using BroadcastChannels
                control = new BroadcastChannel('dcc-control')
                const onCtrl = (ev: MessageEvent) => {
                    const d: any = ev.data
                    const of = outgoingFileRef.current
                    if (d && d.type === 'start-send' && d.to_ip === peer.ip && d.to_port === peer.port && of && d.name === of.name) {
                        streamFileToPeer(of, peer.ip, peer.port)
                            .catch(e => log(`Stream error: ${e}`))
                    }
                }
                control.addEventListener('message', onCtrl as any)

                chunk = new BroadcastChannel('dcc-chunk')
                const onChunk = async (ev: MessageEvent) => {
                    const d: any = ev.data
                    if (d && d.type === 'chunk' && d.from_ip === peer.ip && d.from_port === peer.port) {
                        const key = `${peer.ip}:${peer.port}|${d.name}`
                        // Determine total size with fallbacks (dev transport may omit)
                        let bytes_total: number = (typeof d.bytes_total === 'number' && d.bytes_total > 0) ? d.bytes_total
                            : (typeof d.size === 'number' && d.size > 0) ? d.size
                            : (typeof d.total === 'number' && d.total > 0) ? d.total
                            : (assemblyRef.current[key]?.bytesTotal ?? 0)
                        const bstr = atob(d.data_base64)
                        const arr = new Uint8Array(bstr.length)
                        for (let i = 0; i < bstr.length; i++) arr[i] = bstr.charCodeAt(i)
                        if (!assemblyRef.current[key]) assemblyRef.current[key] = { chunks: [], bytesTotal: bytes_total }
                        if (saveTargetsRef.current[key]) {
                            appendChunkToTarget(key, arr)
                                .catch(e => log(`Append error: ${e}`))
                        } else {
                            const ab = arr.buffer.slice(arr.byteOffset, arr.byteOffset + arr.byteLength)
                            assemblyRef.current[key].chunks.push(ab)
                        }
                        const sent = saveTargetsRef.current[key]
                            ? (saveTargetsRef.current[key].bytesWritten)
                            : (assemblyRef.current[key].chunks.reduce((a, c) => a + c.byteLength, 0))
                        setTransfers(t => ({ ...t, [key]: { name: d.name, role: 'receiver', status: 'in_progress', bytesSent: sent, bytesTotal: bytes_total } }))
                        if (sent >= bytes_total) {
                            if (saveTargetsRef.current[key]) {
                                const action: 'save' | 'open' = (pendingActionRef.current === 'open') ? 'open' : 'save'
                                await finalizeSaveTarget(key, action)
                                setTransfers(t => ({ ...t, [key]: { ...(t[key] || { name: d.name, role: 'receiver', status: 'in_progress', bytesSent: bytes_total, bytesTotal: bytes_total }), status: 'complete', bytesSent: bytes_total } }))
                                log(`Completed receive: ${d.name}`)
                                setPendingAction(null)
                            } else {
                                const blob = new Blob(assemblyRef.current[key].chunks, { type: 'application/octet-stream' })
                                const url = URL.createObjectURL(blob)
                                setIncomingFile({ name: d.name, url })
                                setTransfers(t => ({ ...t, [key]: { ...(t[key] || { name: d.name, role: 'receiver', status: 'in_progress', bytesSent: bytes_total, bytesTotal: bytes_total }), status: 'complete', bytesSent: bytes_total } }))
                                log(`Completed receive: ${d.name}`)
                                if (pendingActionRef.current === 'play') handlePlayback(url)
                                else if (pendingActionRef.current === 'open') handleOpenWithOS(url)
                                else if (pendingActionRef.current === 'save') handleSaveToOS(url, d.name)
                                setPendingAction(null)
                            }
                        }
                    }
                }
                chunk.addEventListener('message', onChunk as any)

                cancel = new BroadcastChannel('dcc-cancel')
                const onCancel = (ev: MessageEvent) => {
                    const d: any = ev.data
                    if (d && d.type === 'cancel' && d.from_ip === peer.ip && d.from_port === peer.port) {
                        const key = `${peer.ip}:${peer.port}|${d.name}`
                        cancelKeysRef.current.add(key)
                        setTransfers((prev) => {
                            const existing = prev[key]
                            const base = existing ?? { name: d.name, role: 'receiver', status: 'in_progress', bytesSent: 0, bytesTotal: 0 }
                            return { ...prev, [key]: { ...base, status: 'canceled' } }
                        })
                        log(`Transfer canceled: ${d.name}`)
                    }
                }
                cancel.addEventListener('message', onCancel as any)

                // Store cleanup closures for BCs
                unsubscribes.push(() => control && control.removeEventListener('message', onCtrl as any))
                unsubscribes.push(() => chunk && chunk.removeEventListener('message', onChunk as any))
                unsubscribes.push(() => cancel && cancel.removeEventListener('message', onCancel as any))
            }
        })()

        return () => {
            // Tauri unlisteners
            for (const u of unsubscribes) {
                try { u() } catch {}
            }
            // Close BCs if created
            try { control && control.close() } catch {}
            try { chunk && chunk.close() } catch {}
            try { cancel && cancel.close() } catch {}
        }
    }, [peer, isTauri])

    // Listen for DCC chat messages from peer (peer-to-peer via Tauri event)
    React.useEffect(() => {
        if (!peer) return
        let unlisten: (() => void) | null = null
        let bc: BroadcastChannel | null = null
        ;(async () => {
            if (isTauri) {
                try {
                    const { listen } = await import('@tauri-apps/api/event')
                    unlisten = await listen('dcc-chat', (ev: any) => {
                        const p = ev.payload || {}
                        if (p && p.from_ip === peer.ip && p.from_port === peer.port && p.text) {
                            append(p.text, 'peer')
                        }
                    })
                } catch (e) {
                    log(`Failed to listen for DCC chat: ${e}`)
                }
            } else {
                // Web/dev fallback: listen on a local broadcast channel if used by tests/dev tools
                try {
                    bc = new BroadcastChannel('dcc-chat')
                    const onMsg = (ev: MessageEvent) => {
                        const d: any = ev.data
                        if (d && d.from_ip === peer.ip && d.from_port === peer.port && d.text) {
                            append(d.text, 'peer')
                        }
                    }
                    bc.addEventListener('message', onMsg as any)
                } catch {}
            }
        })()
        return () => {
            try { if (unlisten) unlisten() } catch {}
            try { if (bc) bc.close() } catch {}
        }
    }, [peer, isTauri])

    async function handleCancelTransfer(name: string) {
        if (!peer) return
        const key = `${peer.ip}:${peer.port}|${name}`
        cancelKeysRef.current.add(key)
        try {
            await invokeFn('peer_send_file_cancel', { toIp: peer.ip, toPort: peer.port, name })
        } catch (e: any) {
            log(`Failed to send cancel: ${e}`)
        }
        setTransfers((prev) => {
            const existing = prev[key]
            const base = existing ?? { name, role: 'sender', status: 'in_progress', bytesSent: 0, bytesTotal: 0 }
            return { ...prev, [key]: { ...base, status: 'canceled' } }
        })
    }

    return (peer ? (
        <section id="dcc" ref={sectionRef as any} className={`bg-gray-800 rounded-lg p-6 shadow-lg mt-8 ${justAppeared ? 'ring-2 ring-blue-500 animate-pulse' : ''}`}>
            <div className="flex items-center justify-between mb-3">
                <h2 className="text-2xl font-semibold">DCC with {peerLabel}</h2>
                <div className="flex items-center gap-2">
                    <button className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 rounded" onClick={async () => {
                        log('Reconnect: direct DCC signaling is not relayed via server. Opened local DCC window.')
                    }}>Reconnect</button>
                    <button className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded" onClick={onClose}>Close</button>
                </div>
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

            {/* Active Transfers */}
            {(() => {
                const prefix = `${peer!.ip}:${peer!.port}|`
                const entries = Object.entries(transfers).filter(([k]) => k.startsWith(prefix))
                if (entries.length === 0) return null
                return (
                    <div className="bg-gray-900 rounded p-3 mb-3">
                        <div className="text-sm font-semibold mb-2">Active Transfers</div>
                        <div className="space-y-2">
                            {entries.map(([k, t]) => {
                                const pct = t.bytesTotal > 0 ? Math.floor((t.bytesSent / t.bytesTotal) * 100) : 0
                                return (
                                    <div key={k} className="text-sm">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="font-mono text-blue-200">{t.name}</span>
                                            <span className="text-gray-300">{pct}% • {t.status}</span>
                                        </div>
                                        <div className="w-full bg-gray-700 rounded h-2 overflow-hidden mb-2">
                                            <div className="bg-blue-600 h-2" style={{ width: `${Math.min(100, pct)}%` } as any}></div>
                                        </div>
                                        <div className="flex justify-end">
                                            {t.status === 'in_progress' && (
                                                <button className="px-2 py-0.5 text-xs bg-red-600 hover:bg-red-700 rounded" onClick={() => handleCancelTransfer(t.name)}>Cancel</button>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )
            })()}

            {/* Incoming file offer UI */}
            {incomingFile && (
                <div className="bg-gray-700/60 border border-gray-600 rounded p-3 mb-3">
                    <div className="mb-2 text-sm">Incoming file: <span
                        className="font-mono text-blue-200">{incomingFile.name}</span></div>
                    {((!incomingFile.url || incomingFile.url.length === 0) && !incomingFile.file) && (
                        <div className="text-xs text-yellow-300 mb-2">Waiting for stream/data from sender…</div>
                    )}
                    <div className="flex gap-2 flex-wrap">
                        <button
                                className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded"
                                onClick={async () => {
                                    const key = `${peer!.ip}:${peer!.port}|${incomingFile.name}`
                                    if (!incomingFile.url) {
                                        setPendingAction('open')
                                        // Prepare save target immediately to stream directly to disk
                                        const target = await ensureSaveTarget(key, incomingFile.name)
                                        if (!target) return
                                        log('Accepting file (Open with OS)… waiting for sender stream…')
                                        try {
                                            await invokeFn('peer_send_file_accept', { toIp: peer!.ip, toPort: peer!.port, name: incomingFile.name, action: 'open' })
                                            setTransfers((prev) => {
                                                const existing = prev[key]
                                                const base = existing ?? { name: incomingFile.name, role: 'receiver', status: 'pending', bytesSent: 0, bytesTotal: 0 }
                                                return { ...prev, [key]: { ...base, status: 'in_progress' } }
                                            })
                                        } catch (e: any) {
                                            log(`Failed to send accept: ${e}`)
                                        }
                                        return
                                    } else {
                                        if (incomingFile.file) {
                                            handleOpenWithOS_UsingFile(incomingFile.file, incomingFile.name)
                                        } else if (incomingFile.url) {
                                            handleOpenWithOS(incomingFile.url)
                                        } else {
                                            log('Error: No stream available to open.')
                                        }
                                    }
                                }}>Open with OS
                        </button>
                        <button
                                className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded"
                                onClick={async () => {
                                    const key = `${peer!.ip}:${peer!.port}|${incomingFile.name}`
                                    if (!incomingFile.url) {
                                        setPendingAction('save')
                                        // Prepare save target immediately
                                        const target = await ensureSaveTarget(key, incomingFile.name)
                                        if (!target) return
                                        log('Accepting file (Save to OS)… waiting for sender stream…')
                                        try {
                                            await invokeFn('peer_send_file_accept', { toIp: peer!.ip, toPort: peer!.port, name: incomingFile.name, action: 'save' })
                                            setTransfers((prev) => {
                                                const existing = prev[key]
                                                const base = existing ?? { name: incomingFile.name, role: 'receiver', status: 'pending', bytesSent: 0, bytesTotal: 0 }
                                                return { ...prev, [key]: { ...base, status: 'in_progress' } }
                                            })
                                        } catch (e: any) {
                                            log(`Failed to send accept: ${e}`)
                                        }
                                        return
                                    } else {
                                        if (incomingFile.file) {
                                            handleSaveToOS_UsingFile(incomingFile.file, incomingFile.name)
                                        } else if (incomingFile.url) {
                                            handleSaveToOS(incomingFile.url, incomingFile.name)
                                        } else {
                                            log('Error: No stream available to save.')
                                        }
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
                                            await invokeFn('peer_send_file_accept', { toIp: peer!.ip, toPort: peer!.port, name: incomingFile.name, action: 'play' })
                                            const key = `${peer!.ip}:${peer!.port}|${incomingFile.name}`
                                            setTransfers((prev) => {
                                                const existing = prev[key]
                                                const base = existing ?? { name: incomingFile.name, role: 'receiver', status: 'pending', bytesSent: 0, bytesTotal: 0 }
                                                return { ...prev, [key]: { ...base, status: 'in_progress' } }
                                            })
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
    ) : null)
}