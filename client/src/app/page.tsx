'use client'

import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/tauri'
import { listen } from '@tauri-apps/api/event'

interface ClientInfo {
  ip: string
  port: number
}

interface ChatMessage {
  from_ip: string
  from_port: number
  message: string
  timestamp: string
  channel: string
}

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

  useEffect(() => {
    // Generate random client port
    const randomPort = Math.floor(Math.random() * (65535 - 49152) + 49152)
    setClientPort(randomPort.toString())

    // Listen for client list updates
    const unlisten = listen<ClientInfo[]>('client-list-updated', (event) => {
      console.log('Client list updated:', event.payload)
      setClients(event.payload)
    })

    // Listen for server disconnection
    const unlistenDisconnect = listen('server-disconnected', () => {
      setConnected(false)
      setStatus('Disconnected from server')
      setError('Server disconnected')
    })

    // Listen for server errors
    const unlistenError = listen<string>('server-error', (event) => {
      setError(`Server error: ${event.payload}`)
    })

    // Listen for chat messages
    const unlistenChat = listen<ChatMessage>('chat-message', (event) => {
      console.log('Chat message received:', event.payload)
      setChatMessages(prev => [...prev, event.payload])
    })

    return () => {
      unlisten.then(f => f())
      unlistenDisconnect.then(f => f())
      unlistenError.then(f => f())
      unlistenChat.then(f => f())
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
    setAvailableChannels(prev => [...prev, newChannelInput])
    setCurrentChannel(newChannelInput)
    setNewChannelInput('')
  }

  const filteredMessages = chatMessages.filter(msg => msg.channel === currentChannel)

  const formatTimestamp = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleTimeString()
    } catch {
      return timestamp
    }
  }

  return (
    <main className="min-h-screen p-8 bg-gradient-to-br from-gray-900 to-gray-800 text-white">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-center">
          Client-Server Connection
        </h1>

        {/* Connection Form */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8 shadow-lg">
          <h2 className="text-2xl font-semibold mb-4">Connection Settings</h2>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Server IP Address
              </label>
              <input
                type="text"
                value={serverIp}
                onChange={(e) => setServerIp(e.target.value)}
                disabled={connected}
                className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none disabled:opacity-50"
                placeholder="127.0.0.1"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">
                Server Port
              </label>
              <input
                type="text"
                value={serverPort}
                onChange={(e) => setServerPort(e.target.value)}
                disabled={connected}
                className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none disabled:opacity-50"
                placeholder="8080"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Your IP Address
              </label>
              <input
                type="text"
                value={clientIp}
                onChange={(e) => setClientIp(e.target.value)}
                disabled={connected}
                className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none disabled:opacity-50"
                placeholder="127.0.0.1"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">
                Your Port
              </label>
              <input
                type="text"
                value={clientPort}
                onChange={(e) => setClientPort(e.target.value)}
                disabled={connected}
                className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none disabled:opacity-50"
                placeholder="Random port"
              />
            </div>
          </div>

          <button
            onClick={handleConnect}
            disabled={connected}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded font-semibold transition-colors"
          >
            {connected ? 'Connected' : 'Connect to Server'}
          </button>

          {status && (
            <div className={`mt-4 p-3 rounded ${connected ? 'bg-green-900/50 text-green-200' : 'bg-yellow-900/50 text-yellow-200'}`}>
              {status}
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 rounded bg-red-900/50 text-red-200">
              {error}
            </div>
          )}
        </div>

        {/* Chat Section */}
        {connected && (
          <div className="bg-gray-800 rounded-lg p-6 shadow-lg mb-8">
            <h2 className="text-2xl font-semibold mb-4">
              💬 Group Chat
            </h2>
            
            {/* Channel Management */}
            <div className="mb-4 space-y-3">
              <div className="flex gap-2">
                <select
                  value={currentChannel}
                  onChange={(e) => setCurrentChannel(e.target.value)}
                  className="flex-1 px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                >
                  {availableChannels.map(channel => (
                    <option key={channel} value={channel}>
                      #{channel}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newChannelInput}
                  onChange={(e) => setNewChannelInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddChannel()}
                  placeholder="Create new channel..."
                  className="flex-1 px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
                />
                <button
                  onClick={handleAddChannel}
                  disabled={!newChannelInput.trim()}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-sm font-semibold transition-colors"
                >
                  Add Channel
                </button>
              </div>
            </div>

            {/* Chat Messages */}
            <div className="bg-gray-900 rounded-lg p-4 h-64 overflow-y-auto mb-4 space-y-2">
              {filteredMessages.length === 0 ? (
                <p className="text-gray-400 text-center py-8">
                  No messages in #{currentChannel} yet. Send a message to start chatting!
                </p>
              ) : (
                filteredMessages.map((msg, index) => {
                  const isOwnMessage = msg.from_ip === clientIp && msg.from_port === parseInt(clientPort)
                  return (
                    <div
                      key={index}
                      className={`p-3 rounded ${
                        isOwnMessage 
                          ? 'bg-blue-900/50 ml-8' 
                          : 'bg-gray-700 mr-8'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold">
                          {isOwnMessage ? 'You' : `${msg.from_ip}:${msg.from_port}`}
                        </span>
                        <span className="text-xs text-gray-400">
                          {formatTimestamp(msg.timestamp)}
                        </span>
                      </div>
                      <p className="text-gray-100">{msg.message}</p>
                    </div>
                  )
                })
              )}
            </div>

            {/* Message Input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder={`Message #${currentChannel}...`}
                className="flex-1 px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              />
              <button
                onClick={handleSendMessage}
                disabled={!messageInput.trim()}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded font-semibold transition-colors"
              >
                Send
              </button>
            </div>
          </div>
        )}

        {/* Connected Clients List */}
        <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
          <h2 className="text-2xl font-semibold mb-4">
            Connected Clients ({clients.length})
          </h2>
          
          {clients.length === 0 ? (
            <p className="text-gray-400 text-center py-8">
              No clients connected yet. Connect to see other clients.
            </p>
          ) : (
            <div className="space-y-2">
              {clients.map((client, index) => (
                <div
                  key={index}
                  className="bg-gray-700 p-4 rounded flex items-center justify-between hover:bg-gray-650 transition-colors"
                >
                  <div>
                    <span className="font-mono text-blue-400">{client.ip}</span>
                    <span className="text-gray-400 mx-2">:</span>
                    <span className="font-mono text-green-400">{client.port}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                    <span className="text-sm text-gray-400">Online</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-gray-800/50 rounded-lg p-6 border border-gray-700">
          <h3 className="text-lg font-semibold mb-2">Instructions</h3>
          <ol className="list-decimal list-inside space-y-1 text-sm text-gray-300">
            <li>Make sure the server is running (cargo run in the server directory)</li>
            <li>Enter the server IP and port (default: 127.0.0.1:8080)</li>
            <li>Your client IP and port will be auto-generated</li>
            <li>Click "Connect to Server" to join</li>
            <li>Open multiple client instances to chat with each other</li>
            <li>Messages are broadcast to all connected clients (not stored on server)</li>
          </ol>
        </div>
      </div>
    </main>
  )
}
