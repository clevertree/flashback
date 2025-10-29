export type NavSide = 'left' | 'right'

export interface AppConfig {
    serverUrl: string
  navSide: NavSide
  // Future settings placeholders
  autoPlayMedia: boolean
  // Connect to server on startup
  connectOnStartup: boolean
  // Auto reconnect to previously successful peers
  autoReconnectPeers: boolean
  // Toggle showing historic (offline) clients in the client list
  showHistoricClients: boolean
    // Determines the optional path for private key, certificate, and other secure files
    certificatePath?: string
  // Peers the user approved for DCC (one-time approval)
  approvedPeers: Record<string, boolean> // key: "ip:port" -> approved once
  // Peers we have successfully connected a DCC with before
  knownPeers: Record<string, boolean>
}

// Runtime config with defaults; backward compatible with older stored keys.
const defaultConfig: AppConfig = {
    serverUrl: 'http://localhost:3000',
  navSide: 'left',
  autoPlayMedia: true,
  connectOnStartup: true,
  autoReconnectPeers: true,
  showHistoricClients: false,
    certificatePath: '~/.relay/',
  approvedPeers: {},
  knownPeers: {},
}

export function getConfig(): AppConfig {
  if (typeof window !== 'undefined') {
    try {
      const stored = window.localStorage.getItem('flashback.config')
      if (stored) {
        const parsed = JSON.parse(stored)
        // drop legacy keys: theme, activeTab if present
        const { theme: _legacyTheme, activeTab: _legacyActive, ...rest } = parsed || {}
        return { ...defaultConfig, ...rest }
      }
    } catch (e) {
      // ignore parse errors and fall back to defaults
    }
  }
  return defaultConfig
}

export function setConfig(partial: Partial<AppConfig>) {
  const next = { ...getConfig(), ...partial }
  if (typeof window !== 'undefined') {
    window.localStorage.setItem('flashback.config', JSON.stringify(next))
  }
}

export function peerKey(ip: string, port: number) {
  return `${ip}:${port}`
}
