export type ThemeType = 'stacked' | 'tabbed'
export type NavSide = 'left' | 'right'
export type MainTab = 'Connection' | 'Chat' | 'Clients' | 'Instructions'

export interface AppConfig {
  navSide: NavSide
  theme: ThemeType
  activeTab?: MainTab
}

// Simple runtime config with defaults; can be extended to read from localStorage or a JSON file.
const defaultConfig: AppConfig = {
  navSide: 'left',
  theme: 'stacked',
  activeTab: 'Connection',
}

export function getConfig(): AppConfig {
  if (typeof window !== 'undefined') {
    try {
      const stored = window.localStorage.getItem('flashback.config')
      if (stored) {
        const parsed = JSON.parse(stored)
        return { ...defaultConfig, ...parsed }
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
