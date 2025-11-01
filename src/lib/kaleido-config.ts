/**
 * Kaleido Configuration
 * Loads environment variables for Hyperledger Fabric Kaleido integration
 */

export interface KaleidoConfig {
  // Network Configuration
  networkId: string;
  appId: string;
  appPassword: string;

  // Peer Configuration
  peerId: string;
  peerEndpoint: string;
  peerRestGateway: string;
  peerExplorer: string;
  peerTlsEnabled: boolean;

  // Orderer Configuration
  ordererEndpoint: string;
  ordererMspId: string;
  ordererTlsEnabled: boolean;

  // CA Configuration
  caEndpoint: string;
  caName: string;
  caUsername: string;
  caPassword: string;

  // Connection Configuration
  connectionTimeoutMs: number;
  requestTimeoutMs: number;
  maxConnections: number;
  skipTlsVerify: boolean;

  // Channel Configuration
  channelName: string;
  organization: string;

  // REST Gateway
  restGateway: string;
  consoleApi: string;

  // Wallet Configuration
  walletPath: string;

  // Feature Flags
  debugLogging: boolean;

  // Other
  createdAt: string;
  owner: string;
  runtimeUrl: string;
}

/**
 * Load Kaleido configuration from environment variables
 */
export function loadKaleidoConfig(): KaleidoConfig {
  const config: KaleidoConfig = {
    // Network Configuration
    networkId: process.env.NEXT_PUBLIC_KALEIDO_NETWORK_ID || process.env.KALEIDO_NETWORK_ID || 'u0inmt8fjp',
    appId: process.env.NEXT_PUBLIC_KALEIDO_APP_ID || process.env.KALEIDO_APP_ID || 'u0hjwp2mgt',
    appPassword: process.env.KALEIDO_APP_PASSWORD || 'FZ_uU_KTzqLevq8mWWjxMUahqcKxAc0me_qUjKqDAa0',

    // Peer Configuration
    peerId: process.env.NEXT_PUBLIC_KALEIDO_PEER_ID || process.env.KALEIDO_PEER_ID || 'u0z8yv2jc2',
    peerEndpoint: process.env.NEXT_PUBLIC_KALEIDO_PEER_ENDPOINT || process.env.KALEIDO_PEER_ENDPOINT || 'u0inmt8fjp-u0z8yv2jc2-peer.us0-aws-ws.kaleido.io',
    peerRestGateway: process.env.NEXT_PUBLIC_KALEIDO_PEER_REST_GATEWAY || process.env.KALEIDO_PEER_REST_GATEWAY || 'u0inmt8fjp-u0z8yv2jc2-connect.us0-aws-ws.kaleido.io',
    peerExplorer: process.env.NEXT_PUBLIC_KALEIDO_PEER_EXPLORER || process.env.KALEIDO_PEER_EXPLORER || 'u0inmt8fjp-u0z8yv2jc2-explorer.us0-aws-ws.kaleido.io',
    peerTlsEnabled: (process.env.KALEIDO_PEER_TLS_ENABLED || 'true').toLowerCase() === 'true',

    // Orderer Configuration
    ordererEndpoint: process.env.NEXT_PUBLIC_KALEIDO_ORDERER_ENDPOINT || process.env.KALEIDO_ORDERER_ENDPOINT || 'u0cr887p2s.u0inmt8fjp.kaleido.network:40050',
    ordererMspId: process.env.NEXT_PUBLIC_KALEIDO_ORDERER_MSP_ID || process.env.KALEIDO_ORDERER_MSP_ID || 'u0dxa9ckig',
    ordererTlsEnabled: (process.env.KALEIDO_ORDERER_TLS_ENABLED || 'true').toLowerCase() === 'true',

    // CA Configuration
    caEndpoint: process.env.KALEIDO_CA_ENDPOINT || 'TBD',
    caName: process.env.KALEIDO_CA_NAME || 'ca-org1',
    caUsername: process.env.KALEIDO_CA_USERNAME || 'admin',
    caPassword: process.env.KALEIDO_CA_PASSWORD || 'TBD',

    // Connection Configuration
    connectionTimeoutMs: parseInt(process.env.KALEIDO_CONNECTION_TIMEOUT_MS || '30000', 10),
    requestTimeoutMs: parseInt(process.env.KALEIDO_REQUEST_TIMEOUT_MS || '30000', 10),
    maxConnections: parseInt(process.env.KALEIDO_MAX_CONNECTIONS || '10', 10),
    skipTlsVerify: (process.env.KALEIDO_SKIP_TLS_VERIFY || 'false').toLowerCase() === 'true',

    // Channel Configuration
    channelName: process.env.KALEIDO_CHANNEL_NAME || 'default-channel',
    organization: process.env.NEXT_PUBLIC_KALEIDO_ORGANIZATION || process.env.KALEIDO_ORGANIZATION || 'Org1MSP',

    // REST Gateway
    restGateway: process.env.NEXT_PUBLIC_KALEIDO_REST_GATEWAY || process.env.KALEIDO_REST_GATEWAY || 'https://u0inmt8fjp-connect.us0-aws-ws.kaleido.io',
    consoleApi: process.env.KALEIDO_CONSOLE_API || 'https://console.kaleido.io/api/v1',

    // Wallet Configuration
    walletPath: process.env.KALEIDO_WALLET_PATH || './fabric/wallet',

    // Feature Flags
    debugLogging: (process.env.KALEIDO_DEBUG_LOGGING || 'false').toLowerCase() === 'true',

    // Other
    createdAt: process.env.KALEIDO_CREATED_AT || new Date().toISOString(),
    owner: process.env.KALEIDO_OWNER || 'Clevertree',
    runtimeUrl: process.env.KALEIDO_RUNTIME_URL || 'https://u0hjwp2mgt:FZ_uU_KTzqLevq8mWWjxMUahqcKxAc0me_qUjKqDAa0@u0inmt8fjp-u0cr887p2s-orderer.us0-aws-ws.kaleido.io/',
  };

  return config;
}

/**
 * Get the gateway URL for network connection
 */
export function getGatewayUrl(): string {
  const config = loadKaleidoConfig();
  return `https://${config.peerRestGateway}`;
}

/**
 * Get the CA URL for certificate authority
 */
export function getCaUrl(): string {
  const config = loadKaleidoConfig();
  return config.caEndpoint !== 'TBD' 
    ? `https://${config.caEndpoint}`
    : `https://${config.peerRestGateway}`;
}

/**
 * Get authentication credentials
 */
export function getAuthCredentials(): { username: string; password: string } {
  const config = loadKaleidoConfig();
  return {
    username: config.appId,
    password: config.appPassword,
  };
}

/**
 * Get organization MSP ID
 */
export function getOrganizationMspId(): string {
  const config = loadKaleidoConfig();
  return config.organization;
}

/**
 * Get default channel name
 */
export function getDefaultChannelName(): string {
  const config = loadKaleidoConfig();
  return config.channelName;
}
