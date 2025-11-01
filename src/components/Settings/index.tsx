'use client';

import React, { useState, useEffect } from 'react';
import { ConfigManager, getOSName } from '@/lib/config';

/**
 * Settings Component
 * UI for managing app configuration including:
 * - Autoconnect settings
 * - Private key search paths
 * - Theme preferences
 * - Connection defaults
 */
export const Settings: React.FC = () => {
  const [autoconnect, setAutoconnect] = useState(false);
  const [keySearchPath, setKeySearchPath] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [defaultGatewayUrl, setDefaultGatewayUrl] = useState('');
  const [defaultCaUrl, setDefaultCaUrl] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [isLoading, setIsLoading] = useState(true);

  const osName = getOSName();
  const configManager = ConfigManager.getInstance();

  // Load current config on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const config = configManager.getConfig();
        setAutoconnect(config.autoconnect ?? true);
        setKeySearchPath(config.keySearchPath || '');
        setTheme((config.theme as 'light' | 'dark') || 'light');
        setDefaultGatewayUrl(config.lastGatewayUrl || '');
        setDefaultCaUrl(config.lastCaUrl || '');
      } catch (error) {
        console.error('Failed to load config:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadConfig();
  }, [configManager]);

  // Mark as dirty when any field changes
  const handleChange = (
    field: string,
    value: string | boolean
  ) => {
    switch (field) {
      case 'autoconnect':
        setAutoconnect(value as boolean);
        break;
      case 'keySearchPath':
        setKeySearchPath(value as string);
        break;
      case 'theme':
        setTheme(value as 'light' | 'dark');
        break;
      case 'defaultGatewayUrl':
        setDefaultGatewayUrl(value as string);
        break;
      case 'defaultCaUrl':
        setDefaultCaUrl(value as string);
        break;
    }
    setIsDirty(true);
  };

  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      configManager.updateMultiple({
        autoconnect,
        keySearchPath: keySearchPath || undefined,
        theme,
        lastGatewayUrl: defaultGatewayUrl || undefined,
        lastCaUrl: defaultCaUrl || undefined,
      });
      await configManager.save();
      setIsDirty(false);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Failed to save settings:', error);
      setSaveStatus('idle');
    }
  };

  const handleCancel = () => {
    // Reload config to revert changes
    const config = configManager.getConfig();
    setAutoconnect(config.autoconnect ?? true);
    setKeySearchPath(config.keySearchPath || '');
    setTheme((config.theme as 'light' | 'dark') || 'light');
    setDefaultGatewayUrl(config.lastGatewayUrl || '');
    setDefaultCaUrl(config.lastCaUrl || '');
    setIsDirty(false);
  };

  const handleResetDefaults = () => {
    const defaults = {
      autoconnect: true,
      keySearchPath: '',
      theme: 'light' as const,
      defaultGatewayUrl: '',
      defaultCaUrl: '',
    };
    setAutoconnect(defaults.autoconnect);
    setKeySearchPath(defaults.keySearchPath);
    setTheme(defaults.theme);
    setDefaultGatewayUrl(defaults.defaultGatewayUrl);
    setDefaultCaUrl(defaults.defaultCaUrl);
    setIsDirty(true);
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-400">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">
        Settings
      </h1>

      <div className="space-y-6">
        {/* Autoconnect Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Autoconnect
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Automatically connect to the last used gateway and CA on startup
              </p>
            </div>
            <label className="flex items-center cursor-pointer">
              <div className="relative">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={autoconnect}
                  onChange={(e) => handleChange('autoconnect', e.target.checked)}
                />
                <div
                  className={`w-14 h-8 rounded-full transition ${
                    autoconnect
                      ? 'bg-blue-500'
                      : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                />
                <div
                  className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition transform ${
                    autoconnect ? 'translate-x-6' : ''
                  }`}
                />
              </div>
            </label>
          </div>
        </div>

        {/* Theme Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Theme
          </h2>
          <div className="flex gap-4">
            {(['light', 'dark'] as const).map((option) => (
              <label
                key={option}
                className="flex items-center cursor-pointer gap-2"
              >
                <input
                  type="radio"
                  name="theme"
                  value={option}
                  checked={theme === option}
                  onChange={(e) => handleChange('theme', e.target.value)}
                  className="w-4 h-4"
                />
                <span className="text-gray-900 dark:text-white capitalize">
                  {option}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Key Search Path Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Private Key Search Path
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            Directory to search for private keys (current OS: {osName})
          </p>
          <input
            type="text"
            value={keySearchPath}
            onChange={(e) => handleChange('keySearchPath', e.target.value)}
            placeholder="Leave empty for default location"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Example: ~/.ssh or ~/keys
          </p>
        </div>

        {/* Connection Defaults Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Connection Defaults
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Default Gateway URL
              </label>
              <input
                type="text"
                value={defaultGatewayUrl}
                onChange={(e) => handleChange('defaultGatewayUrl', e.target.value)}
                placeholder="https://example.com:7051"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Default CA URL
              </label>
              <input
                type="text"
                value={defaultCaUrl}
                onChange={(e) => handleChange('defaultCaUrl', e.target.value)}
                placeholder="https://example.com:7054"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 justify-between">
          <button
            onClick={handleResetDefaults}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition"
          >
            Reset to Defaults
          </button>

          <div className="flex gap-3">
            <button
              onClick={handleCancel}
              disabled={!isDirty}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!isDirty || saveStatus === 'saving'}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saveStatus === 'saving' ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : saveStatus === 'saved' ? (
                <>
                  <span>✓ Saved</span>
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </div>

        {/* Status Message */}
        {saveStatus === 'saved' && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 px-4 py-3 rounded-lg">
            ✓ Settings saved successfully
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;
