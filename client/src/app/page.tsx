'use client'

import { useState, useEffect, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import NavMenu from '../components/NavMenu'
import { getConfig, setConfig, type NavSide } from '../config'
import ConnectionForm from '../components/ConnectionForm'
import ChatSection, { type ChatMessage } from '../components/ChatSection'
import ClientsList, { type ClientInfo } from '../components/ClientsList'
import InstructionsSection from '../components/InstructionsSection'
import SettingsSection from '../components/SettingsSection'
import DccChatroom from '../components/DccChatroom'
import VideoPlayerSection from '../components/VideoPlayerSection'

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

  // Persist UI preferences
  useEffect(() => {
    setConfig({ navSide, autoPlayMedia })
  }, [navSide, autoPlayMedia])

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
      <main className={`min-h-screen p-8 bg-gradient-to-br from-gray-900 to-gray-800 text-white transition-all duration-300 ${navSide === 'left' ? 'ml-56' : 'mr-56'}`}>
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold">Junie IRC Client</h1>
          </div>

          <VideoPlayerSection autoPlay={autoPlayMedia} />

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
            onDccConnect={(peer) => {
              setDccPeer(peer)
              // Requirement: When a user hits 'connect' with another user, instantly open a new chatroom
              scrollTo('dcc')
            }}
          />

          <DccChatroom peer={dccPeer} onClose={() => setDccPeer(null)} />

          <SettingsSection
            navSide={navSide}
            autoPlayMedia={autoPlayMedia}
            onChangeNavSide={(side) => setNavSide(side)}
            onToggleAutoPlay={setAutoPlayMedia}
          />

          <InstructionsSection />
        </div>
      </main>
    </>
  )
}
