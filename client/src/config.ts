export type NavSide = 'left' | 'right'

export interface AppConfig {
  navSide: NavSide
  // Future settings placeholders
  autoPlayMedia: boolean
}

// Runtime config with defaults; backward compatible with older stored keys.
const defaultConfig: AppConfig = {
  navSide: 'left',
  autoPlayMedia: true,
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
