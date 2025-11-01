/**
 * App Configuration Management
 * Handles saving and loading app state between runs
 * Includes settings like autoconnect, key paths, and network preferences
 */

import { useAppStore } from './store';
import { getKaleidoConfig } from './api';

/**
 * Detect operating system
 */
export function getOSName(): string {
  if (typeof window === 'undefined') {
    return 'Unknown';
  }

  const userAgent = navigator.userAgent.toLowerCase();

  if (userAgent.includes('win')) {
    return 'Windows';
  } else if (userAgent.includes('mac')) {
    return 'macOS';
  } else if (userAgent.includes('linux')) {
    return 'Linux';
  } else {
    return 'Unknown';
  }
}

/**
 * OS-specific default paths for private key storage
 */
function getDefaultKeySearchPath(): string {
  if (typeof window === 'undefined') {
    return './fabric/wallet'; // Fallback for server-side
  }

  // Detect OS and return appropriate path
  const userAgent = navigator.userAgent.toLowerCase();
  const homeDir = process.env.HOME || process.env.USERPROFILE || '~';

  if (userAgent.includes('win')) {
    // Windows
    return `${process.env.USERPROFILE || 'C:\\Users\\'}\\AppData\\Local\\Fabric\\wallet`;
  } else if (userAgent.includes('mac')) {
    // macOS
    return `${homeDir}/Library/Application Support/Fabric/wallet`;
  } else {
    // Linux and others
    return `${homeDir}/.local/share/fabric/wallet`;
  }
}

/**
 * Application configuration structure
 */
export interface AppConfig {
  // Connection settings
  autoconnect: boolean;
  lastGatewayUrl?: string;
  lastCaUrl?: string;

  // Identity settings
  lastIdentity?: {
    user_id: string;
    org_name: string;
    mspid: string;
  };
  lastSelectedIdentityPath?: string;

  // Channel preferences
  lastSelectedChannel?: string;
  defaultChannels: string[];

  // File system settings
  keySearchPath: string;
  walletPath: string;
  lastDownloadPath?: string;

  // UI preferences
  theme?: 'light' | 'dark';
  compactMode?: boolean;

  // Feature flags
  enableDebugLogging: boolean;
  enableAutoSave: boolean;

  // Metadata
  lastSaved: string;
  appVersion: string;
}

/**
 * Default configuration
 */
export const defaultConfig: AppConfig = {
  autoconnect: true,
  defaultChannels: ['movies', 'tv-shows', 'games', 'voting'],
  keySearchPath: getDefaultKeySearchPath(),
  walletPath: './fabric/wallet',
  theme: 'dark',
  compactMode: false,
  enableDebugLogging: false,
  enableAutoSave: true,
  lastSaved: new Date().toISOString(),
  appVersion: '0.1.0',
};

/**
 * Configuration class for managing app state
 */
export class ConfigManager {
  private static instance: ConfigManager;
  private config: AppConfig;
  private configPath: string = 'app-config.json';

  private constructor() {
    this.config = { ...defaultConfig };
  }

  /**
   * Get singleton instance
   */
  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * Load configuration from local storage
   */
  async load(): Promise<AppConfig> {
    try {
      if (typeof window !== 'undefined' && localStorage) {
        const stored = localStorage.getItem(this.configPath);
        if (stored) {
          this.config = JSON.parse(stored);
          return this.config;
        }
      }
    } catch (error) {
      console.error('Failed to load config from localStorage:', error);
    }

    // Return default config if nothing loaded
    return this.config;
  }

  /**
   * Save configuration to local storage
   */
  async save(): Promise<void> {
    try {
      this.config.lastSaved = new Date().toISOString();
      if (typeof window !== 'undefined' && localStorage) {
        localStorage.setItem(this.configPath, JSON.stringify(this.config));
      }
    } catch (error) {
      console.error('Failed to save config to localStorage:', error);
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): AppConfig {
    return { ...this.config };
  }

  /**
   * Update specific configuration field
   */
  update(key: keyof AppConfig, value: any): void {
    this.config = {
      ...this.config,
      [key]: value,
    };
  }

  /**
   * Update multiple fields at once
   */
  updateMultiple(updates: Partial<AppConfig>): void {
    this.config = {
      ...this.config,
      ...updates,
    };
  }

  /**
   * Save current app state (from Zustand store) to config
   */
  saveAppState(): void {
    const store = useAppStore.getState();
    const config = getKaleidoConfig();

    this.updateMultiple({
      lastGatewayUrl: config.peerRestGateway
        ? `https://${config.peerRestGateway}`
        : undefined,
      lastCaUrl: config.caEndpoint,
      lastIdentity: store.identity
        ? {
            user_id: store.identity.user_id,
            org_name: store.identity.org_name,
            mspid: store.identity.mspid,
          }
        : undefined,
      lastSelectedChannel: store.selectedChannel || undefined,
    });
  }

  /**
   * Restore app state from config (used on startup)
   */
  async restoreAppState(): Promise<void> {
    const config = this.getConfig();

    if (config.autoconnect && config.lastGatewayUrl) {
      // Auto-connect will be handled by the autoconnect hook
      console.log('Auto-connect enabled, will connect to:', config.lastGatewayUrl);
    }

    // Restore last selected channel if it was saved
    if (config.lastSelectedChannel) {
      useAppStore.getState().setSelectedChannel(config.lastSelectedChannel);
    }
  }

  /**
   * Reset configuration to defaults
   */
  reset(): void {
    this.config = { ...defaultConfig };
  }

  /**
   * Get OS-specific default key search path
   */
  getDefaultKeyPath(): string {
    return getDefaultKeySearchPath();
  }

  /**
   * Validate configuration
   */
  validate(): boolean {
    return (
      this.config.keySearchPath !== undefined &&
      this.config.walletPath !== undefined &&
      Array.isArray(this.config.defaultChannels)
    );
  }
}

/**
 * Hook to use config manager
 */
export function useConfig() {
  const configManager = ConfigManager.getInstance();
  return configManager;
}

/**
 * Initialize configuration on app startup
 */
export async function initializeConfig(): Promise<AppConfig> {
  const configManager = ConfigManager.getInstance();
  await configManager.load();
  await configManager.restoreAppState();
  return configManager.getConfig();
}

/**
 * Save state on app close (call from Tauri close event)
 */
export async function saveStateOnClose(): Promise<void> {
  const configManager = ConfigManager.getInstance();
  configManager.saveAppState();
  await configManager.save();
}
