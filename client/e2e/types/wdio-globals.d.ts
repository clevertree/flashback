import type { MultiRemoteBrowser } from 'webdriverio'

// Ambient declaration to make WebdriverIO global `browser` visible to TypeScript
// during Next.js type checking. At runtime, WDIO provides this global.
declare global {
  const browser: MultiRemoteBrowser
}

export {}
