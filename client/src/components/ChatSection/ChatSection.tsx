import React from "react";

export interface ChatMessage {
  from_ip: string
  from_port: number
  message: string
  timestamp: string
  channel: string
}

export interface ChatSectionProps {
  id?: string
  connected: boolean
  clientIp: string
  clientPort: number
  availableChannels: string[]
  currentChannel: string
  newChannelInput: string
  chatMessages: ChatMessage[]
  messageInput: string
  setCurrentChannel: (v: string) => void
  setNewChannelInput: (v: string) => void
  setMessageInput: (v: string) => void
  onAddChannel: () => void
  onSend: () => void
  formatTimestamp: (ts: string) => string
}

export default function ChatSection({ id = 'chat', ...props }: ChatSectionProps) {
  const {
    connected,
    clientIp,
    clientPort,
    availableChannels,
    currentChannel,
    newChannelInput,
    chatMessages,
    messageInput,
    setCurrentChannel,
    setNewChannelInput,
    setMessageInput,
    onAddChannel,
    onSend,
    formatTimestamp,
  } = props

  if (!connected) return null

  const filteredMessages = chatMessages.filter((m) => m.channel === currentChannel)

  return (
    <section id={id} className="bg-gray-800 rounded-lg p-6 shadow-lg mb-8">
      <h2 className="text-2xl font-semibold mb-4 text-white">💬 Group Chat</h2>

      <div className="mb-4 space-y-3">
        <div className="flex gap-2">
          <select
            value={currentChannel}
            onChange={(e) => setCurrentChannel(e.target.value)}
            className="flex-1 px-4 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
          >
            {availableChannels.map((ch) => (
              <option key={ch} value={ch}>#{ch}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newChannelInput}
            onChange={(e) => setNewChannelInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && onAddChannel()}
            placeholder="Create new channel..."
            className="flex-1 px-4 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-sm placeholder-gray-400"
          />
          <button
            onClick={onAddChannel}
            disabled={!newChannelInput.trim()}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-sm font-semibold transition-colors text-white"
          >
            Add Channel
          </button>
        </div>
      </div>

      <div className="bg-gray-900 rounded-lg p-4 h-64 overflow-y-auto mb-4 space-y-2">
        {filteredMessages.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No messages in #{currentChannel} yet. Send a message to start chatting!</p>
        ) : (
          filteredMessages.map((msg, index) => {
            const isOwn = msg.from_ip === clientIp && msg.from_port === clientPort
            return (
              <div key={index} className={`p-3 rounded ${isOwn ? 'bg-blue-900/50 ml-8' : 'bg-gray-700 mr-8'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-white">{isOwn ? 'You' : `${msg.from_ip}:${msg.from_port}`}</span>
                  <span className="text-xs text-gray-400">{formatTimestamp(msg.timestamp)}</span>
                </div>
                <p className="text-gray-100">{msg.message}</p>
              </div>
            )
          })
        )}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={messageInput}
          onChange={(e) => setMessageInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && onSend()}
          placeholder={`Message #${currentChannel}...`}
          className="flex-1 px-4 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none placeholder-gray-400"
        />
        <button
          onClick={onSend}
          disabled={!messageInput.trim()}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded font-semibold transition-colors text-white"
        >
          Send
        </button>
      </div>
    </section>
  )
}