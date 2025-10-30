import React from "react";

export interface ClientInfo {
  ip: string
  port: number
  peer_status?: string
}

export interface ClientsListProps {
  id?: string
  clients: ClientInfo[]
  selfIp: string
  selfPort: number
  onDccConnect: (client: ClientInfo) => void
  onlineKeys?: Set<string>
  showHistoric?: boolean
  onToggleHistoric?: () => void
  ipMode?: 'local' | 'remote'
  onToggleIpMode?: () => void
}

export default function ClientsList({ id = 'clients', clients, selfIp, selfPort, onDccConnect, onlineKeys, showHistoric, onToggleHistoric, ipMode = 'local', onToggleIpMode }: ClientsListProps) {
  const onlineCount = clients.filter(c => onlineKeys?.has(`${c.ip}:${c.port}`)).length
  const header = showHistoric ? `Clients (${onlineCount} online${clients.length > onlineCount ? `, ${clients.length - onlineCount} historic` : ''})` : `Connected Clients (${clients.length})`
  return (
    <section id={id} className="bg-gray-800 rounded-lg p-6 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold">{header}</h2>
        <div className="flex items-center gap-2">
          {typeof onToggleIpMode === 'function' && (
            <button className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded" onClick={onToggleIpMode}>
              {ipMode === 'local' ? 'Showing Local IP' : 'Showing Remote IP'}
            </button>
          )}
          {typeof showHistoric === 'boolean' && onToggleHistoric && (
            <button className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded" onClick={onToggleHistoric}>
              {showHistoric ? 'Hide historic' : 'Show historic'}
            </button>
          )}
        </div>
      </div>
      {clients.length === 0 ? (
        <p className="text-gray-400 text-center py-8">No clients connected yet. Connect to see other clients.</p>
      ) : (
        <div className="space-y-2">
          {clients.map((client, index) => {
            const isSelf = client.ip === selfIp && client.port === selfPort
            const s = (client as any).peer_status as string | undefined
            const label = s ? s : 'unknown'
            const color = s === 'connected' ? 'bg-green-500' : s === 'connecting' ? 'bg-yellow-500' : isSelf ? 'bg-blue-500' : 'bg-red-500'
            const isOnline = onlineKeys?.has(`${client.ip}:${client.port}`)
            return (
              <div key={index} className="bg-gray-700 p-4 rounded flex items-center justify-between hover:bg-gray-650 transition-colors">
                <div>
                  <span className="font-mono text-blue-400">{client.ip}</span>
                  <span className="text-gray-400 mx-2">:</span>
                  <span className="font-mono text-green-400">{client.port}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center">
                    <span className={`w-2 h-2 ${isOnline ? 'bg-green-500' : 'bg-gray-500'} rounded-full mr-2`}></span>
                    <span className="text-sm text-gray-400">{isOnline ? 'Online' : 'Offline'}</span>
                  </div>
                  <div className="flex items-center">
                    <span className={`w-2 h-2 ${color} rounded-full mr-2`}></span>
                    <span className="text-sm text-gray-400">Direct: {isSelf ? 'self' : label}</span>
                  </div>
                  {!isSelf && (
                    <button
                      className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 rounded"
                      onClick={() => onDccConnect(client)}
                    >
                      Visit
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}