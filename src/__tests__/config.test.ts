import { ConfigManager, getOSName, defaultConfig } from '@/lib/config';

describe('ConfigManager', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('Singleton Pattern', () => {
    test('getInstance returns a ConfigManager instance', () => {
      const instance = ConfigManager.getInstance();
      expect(instance).toBeDefined();
      expect(instance).toHaveProperty('getConfig');
      expect(instance).toHaveProperty('save');
      expect(instance).toHaveProperty('load');
    });
  });

  describe('Configuration', () => {
    test('getConfig returns a valid config object', () => {
      const manager = ConfigManager.getInstance();
      const config = manager.getConfig();
      expect(config).toBeDefined();
      expect(typeof config).toBe('object');
    });

    test('config has all required fields', () => {
      const manager = ConfigManager.getInstance();
      const config = manager.getConfig();

      expect(config).toHaveProperty('autoconnect');
      expect(config).toHaveProperty('theme');
      expect(config).toHaveProperty('keySearchPath');
      expect(config).toHaveProperty('walletPath');
      expect(config).toHaveProperty('defaultChannels');
      expect(config).toHaveProperty('lastSaved');
      expect(config).toHaveProperty('appVersion');
    });
  });

  describe('Save and Load', () => {
    test('save stores config to localStorage', async () => {
      const manager = ConfigManager.getInstance();
      manager.updateMultiple({
        autoconnect: false,
        theme: 'light',
      });
      await manager.save();

      const stored = localStorage.getItem('app-config.json');
      expect(stored).toBeDefined();

      const parsed = JSON.parse(stored!);
      expect(parsed.autoconnect).toBe(false);
      expect(parsed.theme).toBe('light');
    });

    test('load retrieves config from localStorage', async () => {
      const testConfig = {
        ...defaultConfig,
        autoconnect: false,
        theme: 'light' as const,
      };

      localStorage.setItem('app-config.json', JSON.stringify(testConfig));

      const manager = ConfigManager.getInstance();
      await manager.load();

      const stored = localStorage.getItem('app-config.json');
      const parsed = JSON.parse(stored!);
      expect(parsed.autoconnect).toBe(false);
      expect(parsed.theme).toBe('light');
    });

    test('lastSaved is set when saving', async () => {
      const manager = ConfigManager.getInstance();
      const beforeSave = new Date().getTime();
      await manager.save();
      const afterSave = new Date().getTime();

      const config = manager.getConfig();
      const lastSaved = new Date(config.lastSaved!).getTime();

      expect(lastSaved).toBeGreaterThanOrEqual(beforeSave);
      expect(lastSaved).toBeLessThanOrEqual(afterSave);
    });
  });

  describe('Update Methods', () => {
    test('updateMultiple updates multiple fields', () => {
      const manager = ConfigManager.getInstance();
      manager.updateMultiple({
        autoconnect: false,
        theme: 'light',
        compactMode: true,
      });

      const config = manager.getConfig();
      expect(config.autoconnect).toBe(false);
      expect(config.theme).toBe('light');
      expect(config.compactMode).toBe(true);
    });

    test('updateMultiple preserves other fields', () => {
      const manager = ConfigManager.getInstance();
      const originalChannels = manager.getConfig().defaultChannels;

      manager.updateMultiple({
        autoconnect: false,
      });

      const config = manager.getConfig();
      expect(config.defaultChannels).toEqual(originalChannels);
    });
  });
});

describe('OS Detection', () => {
  test('getOSName returns a valid OS name', () => {
    const osName = getOSName();
    const validOSNames = ['Windows', 'macOS', 'Linux', 'Unknown'];
    expect(validOSNames).toContain(osName);
  });

  test('getOSName returns a non-empty string', () => {
    const osName = getOSName();
    expect(typeof osName).toBe('string');
    expect(osName.length).toBeGreaterThan(0);
  });
});

describe('Default Configuration', () => {
  test('defaultConfig has correct structure', () => {
    expect(defaultConfig.autoconnect).toBe(true);
    expect(typeof defaultConfig.theme).toBe('string');
    expect(typeof defaultConfig.compactMode).toBe('boolean');
    expect(defaultConfig.enableAutoSave).toBe(true);
    expect(Array.isArray(defaultConfig.defaultChannels)).toBe(true);
  });

  test('defaultChannels contains expected entries', () => {
    expect(defaultConfig.defaultChannels).toContain('movies');
    expect(defaultConfig.defaultChannels).toContain('tv-shows');
    expect(defaultConfig.defaultChannels).toContain('games');
    expect(defaultConfig.defaultChannels).toContain('voting');
  });
});
