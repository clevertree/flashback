'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { getConfig, setConfig, type NavSide, peerKey } from '@app/config'

import VideoPlayerSection from "@components/VideoPlayerSection/VideoPlayerSection";
import SettingsSection from "@components/SettingsSection/SettingsSection";
import NavMenu from "@components/NavMenu/NavMenu";
import InstructionsSection from "@components/InstructionsSection/InstructionsSection";
import DccChatroom from "@components/DccChatroom/DccChatroom";
import ConnectionForm from "@components/ConnectionForm/ConnectionForm";
import ClientsList, {ClientInfo} from "@components/ClientsList/ClientsList";
import ChatSection, {ChatMessage} from "@components/ChatSection/ChatSection";
import ErrorBoundary from "@components/ErrorBoundary/ErrorBoundary";
import LogsSection from "@components/LogsSection/LogsSection";

export default function Home() {
  const [serverIp, setServerIp] = useState('server.flashbackrepository.org')
  const [serverPort, setServerPort] = useState('51111')
  const [clientIp, setClientIp] = useState('127.0.0.1')
  const [clientPort, setClientPort] = useState('')
  const [connected, setConnected] = useState(false)
  const [clients, setClients] = useState<ClientInfo[]>([])
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [messageInput, setMessageInput] = useState('')
  const [currentChannel, setCurrentChannel] = useState('general')
  const [availableChannels, setAvailableChannels] = useState<string[]>(['general'])
  const [newChannelInput, setNewChannelInput] = useState('')
  const [navSide, setNavSide] = useState<NavSide>(getConfig().navSide)
  const [autoPlayMedia, setAutoPlayMedia] = useState<boolean>(getConfig().autoPlayMedia)
  const [connectOnStartup, setConnectOnStartup] = useState<boolean>(getConfig().connectOnStartup)
  const [autoReconnectPeers, setAutoReconnectPeers] = useState<boolean>(getConfig().autoReconnectPeers)
  const [showHistoricClients, setShowHistoricClients] = useState<boolean>(getConfig().showHistoricClients)
  const [dccPeer, setDccPeer] = useState<{ ip: string; port: number } | null>(null)
  const [winWidth, setWinWidth] = useState<number>(typeof window !== 'undefined' ? window.innerWidth : 1024)
  const isNarrow = winWidth <= 800
  const [pendingDcc, setPendingDcc] = useState<{ ip: string; port: number } | null>(null)
  const [videoSrc, setVideoSrc] = useState<string | undefined>(undefined)
  const [incomingOffer, setIncomingOffer] = useState<{ from_ip: string; from_port: number; name: string; size: number } | null>(null)
  const [showMobileNav, setShowMobileNav] = useState(false)
  const [offeredFiles, setOfferedFiles] = useState<Record<string, File>>({})
  const [onlineClients, setOnlineClients] = useState<ClientInfo[]>([])
  const [onlineKeys, setOnlineKeys] = useState<Set<string>>(new Set())
  const [logs, setLogs] = useState<string[]>([])

  useEffect(() => {
    const randomPort = Math.floor(Math.random() * (65535 - 49152) + 49152)
    setClientPort(randomPort.toString())

    const addLog = (line: string) => setLogs((prev) => [...prev, `${new Date().toLocaleTimeString()}  ${line}`])

    const unlisten = listen<ClientInfo[]>('client-list-updated', (event) => {
      try {
        const incoming = (event.payload || []) as any[]
        setOnlineClients(incoming as any)
      } catch {
        setOnlineClients(event.payload as any)
      }
    })

    const unlistenDisconnect = listen('server-disconnected', () => {
      setConnected(false)
      setStatus('Disconnected from server')
      setError('Server disconnected')
      addLog('Server disconnected')
    })

    const unlistenError = listen<string>('server-error', (event) => {
      setError(`Server error: ${event.payload}`)
      addLog(`Server error: ${event.payload}`)
    })

    const unlistenChat = listen<ChatMessage>('chat-message', (event) => {
      setChatMessages((prev) => [...prev, event.payload])
    })

    const unlistenLog = listen<string>('log', (event) => {
      addLog(event.payload)
    })

    return () => {
      unlisten.then((f) => f())
      unlistenDisconnect.then((f) => f())
      unlistenError.then((f) => f())
      unlistenChat.then((f) => f())
      unlistenLog.then((f) => f())
    }
  }, [])

  // Track known peers separately; visible list combines based on toggle
  useEffect(() => {
    const cfg = getConfig()
    const known = cfg.knownPeers || {}
    // trigger recompute below
    setOnlineClients((prev) => prev)
  }, [])

  // Auto-connect to server on startup if enabled
  useEffect(() => {
    const cfg = getConfig()
    if (cfg.connectOnStartup && !connected && serverIp && serverPort && clientIp && clientPort) {
      const t = setTimeout(() => { handleConnect() }, 0)
      return () => clearTimeout(t)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientPort])

  // Window resize listener for responsive behavior
  useEffect(() => {
    function onResize() {
      setWinWidth(window.innerWidth)
    }
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Listen for DCC request/opened/file-offer events
  useEffect(() => {
    const unlistenReq = listen<{ ip: string; port: number }>('dcc-request', async (event) => {
      const { ip, port } = event.payload
      const cfg = getConfig()
      if (cfg.approvedPeers[peerKey(ip, port)]) {
        setDccPeer({ ip, port })
      } else {
        setPendingDcc({ ip, port })
      }
    })

    const unlistenOpened = listen<{ ip: string; port: number }>('dcc-opened', async (event) => {
      const { ip, port } = event.payload
      // If we initiated, just make sure peer window is open locally
      const cfg = getConfig()
      if (cfg.approvedPeers[peerKey(ip, port)]) {
        setDccPeer({ ip, port })
      }
      // Mark as known peer for future auto-reconnects
      const k = peerKey(ip, port)
      setConfig({ knownPeers: { ...getConfig().knownPeers, [k]: true } })
    })

    const unlistenFileOffer = listen<{ from_ip: string; from_port: number; name: string; size: number }>('dcc-file-offer', async (event) => {
      const { from_ip, from_port, name, size } = event.payload
      setIncomingOffer({ from_ip, from_port, name, size })
      const cfg = getConfig()
      // Ensure the DCC window is visible for this peer
      if (cfg.approvedPeers[peerKey(from_ip, from_port)]) {
        setDccPeer({ ip: from_ip, port: from_port })
      } else {
        setPendingDcc({ ip: from_ip, port: from_port })
      }
    })

    // When the receiver accepts, if we (this tab) offered a file to that peer, broadcast a local stream URL
    const unlistenFileAccept = listen<{ from_ip: string; from_port: number; name: string; action: string }>('dcc-file-accept', async (event) => {
      try {
        const { from_ip, from_port, name } = event.payload
        const key = peerKey(from_ip, from_port) // map is keyed by receiver peer
        const file = offeredFiles[key]
        if (file) {
          const bc = new BroadcastChannel('dcc-control')
          // Instruct the sender-side DccChatroom to begin streaming this file in chunks
          bc.postMessage({ type: 'start-send', to_ip: from_ip, to_port: from_port, name })
          bc.close()
        }
      } catch (e) {
        console.warn('Failed to broadcast start-send on accept:', e)
      }
    })

    const unlistenChunk = listen<{ from_ip: string; from_port: number; name: string; offset: number; bytes_total: number; data_base64: string }>('dcc-file-chunk', async (event) => {
      try {
        const bc = new BroadcastChannel('dcc-chunk')
        bc.postMessage({ type: 'chunk', ...event.payload })
        bc.close()
      } catch (e) { console.warn('Failed to forward chunk:', e) }
    })

    const unlistenCancel = listen<{ from_ip: string; from_port: number; name: string }>('dcc-file-cancel', async (event) => {
      try {
        const bc = new BroadcastChannel('dcc-cancel')
        bc.postMessage({ type: 'cancel', ...event.payload })
        bc.close()
      } catch (e) { console.warn('Failed to forward cancel:', e) }
    })

    return () => {
      unlistenReq.then((f) => f())
      unlistenOpened.then((f) => f())
      unlistenFileOffer.then((f) => f())
      unlistenFileAccept.then((f) => f())
      unlistenChunk.then((f) => f())
      unlistenCancel.then((f) => f())
    }
  }, [offeredFiles, clientIp, clientPort])

  // Cleanup on exit: mark disconnected and clear transient state
  useEffect(() => {
    function onBeforeUnload() {
      try {
        setConnected(false)
        setStatus('Exiting...')
        setClients([])
      } catch {}
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  // Persist UI preferences
  useEffect(() => {
    setConfig({ navSide, autoPlayMedia, connectOnStartup, autoReconnectPeers, showHistoricClients })
  }, [navSide, autoPlayMedia, connectOnStartup, autoReconnectPeers, showHistoricClients])

  // Expose a debug hook for Cypress to simulate incoming file offers
  useEffect(() => {
    if (typeof window !== 'undefined') {
      ;(window as any).debugReceiveFileOffer = (from_ip: string, from_port: number, name: string, size: number) => {
        setIncomingOffer({ from_ip, from_port, name, size })
        setDccPeer({ ip: from_ip, port: from_port })
      }
    }
  }, [])

  const handleConnect = async () => {
    setError('')
    setStatus('Connecting...')
    setLogs((prev) => [...prev, `${new Date().toLocaleTimeString()}  UI: Connecting...`])

    const attempts = 3
    const timeoutMs = 15000

    const invokeWithTimeout = async <T,>(ms: number, cmd: string, args?: Record<string, any>) => {
      return await Promise.race<T>([
        invoke<T>(cmd, args as any),
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)) as any,
      ])
    }

    for (let i = 1; i <= attempts; i++) {
      try {
        setStatus(`Connecting... (attempt ${i}/${attempts})`)
        setLogs((prev) => [...prev, `${new Date().toLocaleTimeString()}  UI: Attempt ${i}/${attempts} to ${serverIp}:${serverPort}`])
        const result = await invokeWithTimeout<string>(timeoutMs, 'connect_to_server', {
          server: `${serverIp}:${serverPort}`,
        })

        setConnected(true)
        setStatus(result)
        setLogs((prev) => [...prev, `${new Date().toLocaleTimeString()}  ${result}`])

        // Request the current client list from server per new protocol
        try {
          await invoke<string>('request_client_list')
        } catch (e) {
          console.warn('Failed to request client list:', e)
        }
        return
      } catch (err) {
        const msg = `${err}`
        setError(msg)
        setStatus(`Connection attempt ${i}/${attempts} failed`)
        setLogs((prev) => [...prev, `${new Date().toLocaleTimeString()}  UI: attempt ${i} failed: ${msg}`])
        setConnected(false)
        if (i < attempts) {
          // short delay between attempts to avoid hot loop
          await new Promise(res => setTimeout(res, 300))
          setStatus(`Retrying... (${i + 1}/${attempts})`)
        }
      }
    }

    setStatus('All connection attempts failed')
    setLogs((prev) => [...prev, `${new Date().toLocaleTimeString()}  UI: All connection attempts failed`])
  }

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !connected) return

    try {
      await invoke('send_chat_message', {
        message: messageInput,
        channel: currentChannel,
        clientIp,
        clientPort: parseInt(clientPort),
      })
      setMessageInput('')
    } catch (err) {
      setError(`Failed to send message: ${err}`)
    }
  }

  const handleAddChannel = () => {
    if (!newChannelInput.trim() || availableChannels.includes(newChannelInput)) return
    setAvailableChannels((prev) => [...prev, newChannelInput])
    setCurrentChannel(newChannelInput)
    setNewChannelInput('')
  }

  const formatTimestamp = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleTimeString()
    } catch {
      return timestamp
    }
  }

  const reconnectingRef = useRef<Set<string>>(new Set())

  const dccConnectWithRetries = useCallback(async (peer: { ip: string; port: number }, attempts = 3, delayMs = 5000) => {
    const key = peerKey(peer.ip, peer.port)
    if (reconnectingRef.current.has(key)) return
    reconnectingRef.current.add(key)
    // Only show retry attempts if server is disconnected
    if (connected) {
      reconnectingRef.current.delete(key)
      return
    }
    setStatus(`DCC: attempting to connect to ${key} (up to ${attempts} tries, no server relay) ...`)
    for (let i = 1; i <= attempts; i++) {
      setStatus(`DCC: attempt ${i}/${attempts} to open local chat with ${key}`)
      if (i < attempts) {
        await new Promise(res => setTimeout(res, delayMs))
      }
    }
    reconnectingRef.current.delete(key)
  }, [connected])

  // Auto-reconnect known peers when server is disconnected (avoid noisy logs while connected)
  useEffect(() => {
    if (connected || !autoReconnectPeers) return
    const cfg = getConfig()
    const known = cfg.knownPeers || {}
    clients.forEach(c => {
      const key = peerKey(c.ip, c.port)
      if (known[key]) {
        dccConnectWithRetries({ ip: c.ip, port: c.port })
      }
    })
  }, [clients, connected, autoReconnectPeers, dccConnectWithRetries])

  // Derive displayed clients and online key set whenever server list or toggle changes
  useEffect(() => {
    const online = onlineClients as any[]
    const onlineSet = new Set<string>(online.map((c: any) => peerKey(c.ip, c.port)))
    setOnlineKeys(onlineSet)
    const cfg = getConfig()
    const known = cfg.knownPeers || {}
    const historicEntries: any[] = Object.keys(known)
      .filter(k => !onlineSet.has(k))
      .map(k => {
        const [ip, portStr] = k.split(':')
        return { ip, port: parseInt(portStr || '0'), peer_status: 'disconnected' }
      })
    const finalList = showHistoricClients ? ([...online, ...historicEntries]) : online
    setClients(finalList as any)
  }, [onlineClients, showHistoricClients])

  const scrollTo = useCallback((id: string) => {
    if (typeof window === 'undefined') return
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  return (
    <>
      {!isNarrow && (
        <ErrorBoundary name="NavMenu">
          <NavMenu
            side={navSide}
            items={[
              { label: 'Connection', onClick: () => scrollTo('connection') },
              { label: 'Chat', onClick: () => scrollTo('chat') },
              { label: 'Clients', onClick: () => scrollTo('clients') },
              { label: 'Video', onClick: () => scrollTo('video') },
              { label: 'Settings', onClick: () => scrollTo('settings') },
              { label: 'Logs', onClick: () => scrollTo('logs') },
              { label: 'Instructions', onClick: () => scrollTo('instructions') },
            ]}
          />
        </ErrorBoundary>
      )}
      {isNarrow && showMobileNav && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowMobileNav(false)} />
          <ErrorBoundary name="NavMenu">
            <NavMenu
              side={navSide}
              onClose={() => setShowMobileNav(false)}
              items={[
                { label: 'Connection', onClick: () => scrollTo('connection') },
                { label: 'Chat', onClick: () => scrollTo('chat') },
                { label: 'Clients', onClick: () => scrollTo('clients') },
                { label: 'Video', onClick: () => scrollTo('video') },
                { label: 'Settings', onClick: () => scrollTo('settings') },
                { label: 'Logs', onClick: () => scrollTo('logs') },
                { label: 'Instructions', onClick: () => scrollTo('instructions') },
              ]}
            />
          </ErrorBoundary>
        </div>
      )}
      {/* Floating mobile nav button */}
      {isNarrow && (
        <button
          aria-label="Open navigation"
          className={`fixed bottom-5 ${navSide === 'left' ? 'left-5' : 'right-5'} z-50 rounded-full w-12 h-12 bg-blue-600 hover:bg-blue-700 shadow-lg flex items-center justify-center`}
          onClick={() => setShowMobileNav((s) => !s)}
        >
          <span className="sr-only">Toggle navigation</span>
          {/* simple hamburger icon */}
          <span className="block w-6 h-0.5 bg-white mb-1" />
          <span className="block w-6 h-0.5 bg-white mb-1" />
          <span className="block w-6 h-0.5 bg-white" />
        </button>
      )}
      <main className={`min-h-screen p-8 bg-gradient-to-br from-gray-900 to-gray-800 text-white transition-all duration-300 ${!isNarrow ? (navSide === 'left' ? 'ml-56' : 'mr-56') : ''}`}>
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold">Junie IRC Client</h1>
          </div>

          <ErrorBoundary name="ConnectionForm">
            <ConnectionForm
              serverIp={serverIp}
              serverPort={serverPort}
              clientIp={clientIp}
              clientPort={clientPort}
              connected={connected}
              status={status}
              error={error}
              setServerIp={setServerIp}
              setServerPort={setServerPort}
              setClientIp={setClientIp}
              setClientPort={setClientPort}
              onConnect={handleConnect}
            />
          </ErrorBoundary>

          {!connected && (
            <div className="mb-3 bg-yellow-800/40 border border-yellow-700 rounded p-3 flex items-center justify-between">
              <div className="text-sm text-yellow-200">Server chat is disconnected.</div>
              <button className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 rounded" onClick={handleConnect}>Reconnect</button>
            </div>
          )}

          <ErrorBoundary name="ChatSection">
            <ChatSection
              id="chat"
              connected={connected}
              clientIp={clientIp}
              clientPort={parseInt(clientPort || '0')}
              availableChannels={availableChannels}
              currentChannel={currentChannel}
              newChannelInput={newChannelInput}
              chatMessages={chatMessages}
              messageInput={messageInput}
              setCurrentChannel={setCurrentChannel}
              setNewChannelInput={setNewChannelInput}
              setMessageInput={setMessageInput}
              onAddChannel={handleAddChannel}
              onSend={handleSendMessage}
              formatTimestamp={formatTimestamp}
            />
          </ErrorBoundary>

          <ErrorBoundary name="ClientsList">
            <ClientsList
              clients={clients}
              selfIp={clientIp}
              selfPort={parseInt(clientPort || '0')}
              onlineKeys={onlineKeys}
              showHistoric={showHistoricClients}
              onToggleHistoric={() => setShowHistoricClients((v) => !v)}
              onDccConnect={async (peer) => {
                setDccPeer(peer)
                // Initiate direct peer connection (no server relay)
                try {
                  await invoke('connect_to_peer', { toIp: peer.ip, toPort: peer.port })
                } catch (e) {
                  console.warn('Failed to connect to peer:', e)
                }
                try {
                  await invoke('peer_send_dcc_request', { toIp: peer.ip, toPort: peer.port })
                } catch (e) {
                  console.warn('Failed to send DCC request to peer:', e)
                }
                // Attempt DCC connect retries only when server disconnected (logs only)
                dccConnectWithRetries(peer)
                // Instantly open a new chatroom per requirement
                scrollTo('dcc')
              }}
            />
          </ErrorBoundary>

          <ErrorBoundary name="DccChatroom">
            <DccChatroom
              peer={dccPeer}
              onClose={() => setDccPeer(null)}
              onSendFile={(file) => { if (dccPeer) { setOfferedFiles(prev => ({ ...prev, [peerKey(dccPeer.ip, dccPeer.port)]: file })) } }}
              onPlayback={(url) => setVideoSrc(url)}
              incomingOffer={dccPeer && incomingOffer && incomingOffer.from_ip === dccPeer.ip && incomingOffer.from_port === dccPeer.port ? { name: incomingOffer.name, size: incomingOffer.size } : null}
            />
          </ErrorBoundary>

          <ErrorBoundary name="SettingsSection">
            <SettingsSection
              navSide={navSide}
              autoPlayMedia={autoPlayMedia}
              connectOnStartup={connectOnStartup}
              autoReconnectPeers={autoReconnectPeers}
              onChangeNavSide={(side) => setNavSide(side)}
              onToggleAutoPlay={setAutoPlayMedia}
              onToggleConnectOnStartup={setConnectOnStartup}
              onToggleAutoReconnectPeers={setAutoReconnectPeers}
            />
          </ErrorBoundary>

          <ErrorBoundary name="LogsSection">
            <LogsSection logs={logs} />
          </ErrorBoundary>

          <ErrorBoundary name="InstructionsSection">
            <InstructionsSection />
          </ErrorBoundary>

          <ErrorBoundary name="VideoPlayerSection">
            <VideoPlayerSection autoPlay={autoPlayMedia} source={videoSrc} />
          </ErrorBoundary>
      </main>

      {/* DCC Approval Modal */}
      {pendingDcc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 w-[90%] max-w-md">
            <h3 className="text-xl font-semibold mb-2">Incoming DCC Request</h3>
            <p className="text-sm text-gray-300 mb-4">Peer {pendingDcc.ip}:{pendingDcc.port} wants to open a direct chat. Approve?</p>
            <div className="flex justify-end gap-2">
              <button className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600" onClick={() => setPendingDcc(null)}>Decline</button>
              <button
                className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700"
                onClick={async () => {
                  const key = peerKey(pendingDcc.ip, pendingDcc.port)
                  const cfg = getConfig()
                  setConfig({ 
                    approvedPeers: { ...cfg.approvedPeers, [key]: true },
                    knownPeers: { ...cfg.knownPeers, [key]: true }
                  })
                  setDccPeer(pendingDcc)
                  try {
                    await invoke('peer_send_dcc_opened', { toIp: pendingDcc.ip, toPort: pendingDcc.port })
                  } catch (e) {
                    console.warn('Failed to notify dcc_opened:', e)
                  }
                  setPendingDcc(null)
                }}
              >Approve</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
