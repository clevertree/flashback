// Initializes window.flashbackCrypto by wiring to Tauri commands if available.
// This is a lightweight runtime bridge for the UI components (e.g., KeySection).

// Only run in browser contexts
if (typeof window !== 'undefined') {
  // Lazy import Tauri APIs to avoid breaking SSR
  (async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core').catch(() => ({ invoke: null as any }))
      const fs: any = await import('@tauri-apps/plugin-fs').catch(() => ({}))

      if (!invoke) {
        // No Tauri environment (e.g., plain Next dev server in browser) -> leave undefined
        return
      }

      // Attach only once
      if (!window.flashbackCrypto) {
        window.flashbackCrypto = {
          checkKeyExists: async (configPath: string) => {
            const res = await invoke('ui_check_key_exists', { configPath }) as { exists: boolean; certPem?: string }
            return res
          },
          generateUserKeysAndCert: async (args: {
            email: string
            password?: string
            bits?: number
            friendlyName?: string
            savePath: string
          }) => {
            // Tauri command expects an object { args }
            const out = await invoke('ui_generate_user_keys_and_cert', { args }) as {
              certPem: string
              privateKeyPemPath: string
              certPemPath: string
            }
            return out
          },
          loadCertPemFromPath: async (path: string) => {
            try {
              if (fs && typeof fs.readTextFile === 'function') {
                const certPem = await fs.readTextFile(path)
                return { certPem }
              }
            } catch {}
            throw new Error('Unable to read certificate from path in this environment')
          },
        }
        try { window.dispatchEvent(new Event('flashbackCryptoReady')); } catch {}
      }
    } catch {
      // silent: keep crypto undefined
    }
  })()
}
