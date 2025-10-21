'use client'

import { useState, useEffect, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import NavMenu from '../components/NavMenu/index'
import { getConfig, setConfig, type NavSide, peerKey } from '../config'
import ConnectionForm from '../components/ConnectionForm/index'
import ChatSection, { type ChatMessage } from '../components/ChatSection/index'
import ClientsList, { type ClientInfo } from '../components/ClientsList/index'
import InstructionsSection from '../components/InstructionsSection/index'
import SettingsSection from '../components/SettingsSection/index'
import DccChatroom from '../components/DccChatroom/index'
import VideoPlayerSection from '../components/VideoPlayerSection/index'

export default function Home() {
  const [serverIp, setServerIp] = useState('127.0.0.1')
  const [serverPort, setServerPort] = useState('8080')
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
  const [dccPeer, setDccPeer] = useState<{ ip: string; port: number } | null>(null)
  const [winWidth, setWinWidth] = useState<number>(typeof window !== 'undefined' ? window.innerWidth : 1024)
  const isNarrow = winWidth <= 800
  const [pendingDcc, setPendingDcc] = useState<{ ip: string; port: number } | null>(null)
  const [videoSrc, setVideoSrc] = useState<string | undefined>(undefined)
  const [incomingOffer, setIncomingOffer] = useState<{ from_ip: string; from_port: number; name: string; size: number } | null>(null)

  useEffect(() => {
    const randomPort = Math.floor(Math.random() * (65535 - 49152) + 49152)
    setClientPort(randomPort.toString())

    const unlisten = listen<ClientInfo[]>('client-list-updated', (event) => {
      setClients(event.payload)
    })

    const unlistenDisconnect = listen('server-disconnected', () => {
      setConnected(false)
      setStatus('Disconnected from server')
      setError('Server disconnected')
    })

    const unlistenError = listen<string>('server-error', (event) => {
      setError(`Server error: ${event.payload}`)
    })

    const unlistenChat = listen<ChatMessage>('chat-message', (event) => {
      setChatMessages((prev) => [...prev, event.payload])
    })

    return () => {
      unlisten.then((f) => f())
      unlistenDisconnect.then((f) => f())
      unlistenError.then((f) => f())
      unlistenChat.then((f) => f())
    }
  }, [])

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

    return () => {
      unlistenReq.then((f) => f())
      unlistenOpened.then((f) => f())
      unlistenFileOffer.then((f) => f())
    }
  }, [])

  // Persist UI preferences
  useEffect(() => {
    setConfig({ navSide, autoPlayMedia })
  }, [navSide, autoPlayMedia])

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
    try {
      setError('')
      setStatus('Connecting...')

      const result = await invoke<string>('connect_to_server', {
        serverIp,
        serverPort: parseInt(serverPort),
        clientIp,
        clientPort: parseInt(clientPort),
      })

      setConnected(true)
      setStatus(result)

      // Fetch initial client list as a fallback to ensure UI sync
      try {
        const initial = await invoke<any>('get_clients')
        if (Array.isArray(initial)) {
          setClients(initial as any)
        }
      } catch {}
    } catch (err) {
      setError(err as string)
      setStatus('Connection failed')
      setConnected(false)
    }
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

  const scrollTo = useCallback((id: string) => {
    if (typeof window === 'undefined') return
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  return (
    <>
      {!isNarrow && (
        <NavMenu
          side={navSide}
          items={[
            { label: 'Connection', onClick: () => scrollTo('connection') },
            { label: 'Chat', onClick: () => scrollTo('chat') },
            { label: 'Clients', onClick: () => scrollTo('clients') },
            { label: 'Video', onClick: () => scrollTo('video') },
            { label: 'Settings', onClick: () => scrollTo('settings') },
            { label: 'Instructions', onClick: () => scrollTo('instructions') },
          ]}
        />
      )}
      <main className={`min-h-screen p-8 bg-gradient-to-br from-gray-900 to-gray-800 text-white transition-all duration-300 ${!isNarrow ? (navSide === 'left' ? 'ml-56' : 'mr-56') : ''}`}>
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold">Junie IRC Client</h1>
          </div>

          <VideoPlayerSection autoPlay={autoPlayMedia} source={videoSrc} />

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

          <ClientsList
            clients={clients}
            selfIp={clientIp}
            selfPort={parseInt(clientPort || '0')}
            onDccConnect={async (peer) => {
              setDccPeer(peer)
              // Notify server to relay DCC request to the peer
              try {
                await invoke('dcc_request', { toIp: peer.ip, toPort: peer.port })
              } catch (e) {
                console.warn('Failed to send dcc_request:', e)
              }
              // Requirement: When a user hits 'connect' with another user, instantly open a new chatroom
              scrollTo('dcc')
            }}
          />

          <DccChatroom
            peer={dccPeer}
            onClose={() => setDccPeer(null)}
            onPlayback={(url) => setVideoSrc(url)}
            incomingOffer={dccPeer && incomingOffer && incomingOffer.from_ip === dccPeer.ip && incomingOffer.from_port === dccPeer.port ? { name: incomingOffer.name, size: incomingOffer.size } : null}
          />

          <SettingsSection
            navSide={navSide}
            autoPlayMedia={autoPlayMedia}
            onChangeNavSide={(side) => setNavSide(side)}
            onToggleAutoPlay={setAutoPlayMedia}
          />

          <InstructionsSection />
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
                  setConfig({ approvedPeers: { ...cfg.approvedPeers, [key]: true } })
                  setDccPeer(pendingDcc)
                  try {
                    await invoke('dcc_opened', { toIp: pendingDcc.ip, toPort: pendingDcc.port })
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
