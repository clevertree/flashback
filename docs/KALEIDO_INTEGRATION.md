# Kaleido Integration Documentation

## Overview

This document describes how the application integrates with Hyperledger Fabric via Kaleido, a blockchain network-as-a-service platform.

## Configuration

### Environment Variables

The application loads Kaleido configuration from `.env.local` file. All configuration variables are defined in `src/lib/kaleido-config.ts`.

Key environment variables:

- **Network Configuration**
  - `KALEIDO_NETWORK_ID`: Unique identifier for the Kaleido network
  - `KALEIDO_APP_ID`: Application ID for API authentication
  - `KALEIDO_APP_PASSWORD`: Application password for API authentication

- **Peer Configuration**
  - `KALEIDO_PEER_ID`: Unique peer identifier
  - `KALEIDO_PEER_ENDPOINT`: Peer endpoint URL
  - `KALEIDO_PEER_REST_GATEWAY`: REST gateway URL for peer communication
  - `KALEIDO_PEER_EXPLORER`: Explorer URL for peer
  - `KALEIDO_PEER_TLS_ENABLED`: Enable/disable TLS for peer (default: true)

- **Orderer Configuration**
  - `KALEIDO_ORDERER_ENDPOINT`: Orderer endpoint URL
  - `KALEIDO_ORDERER_MSP_ID`: MSP ID for orderer
  - `KALEIDO_ORDERER_TLS_ENABLED`: Enable/disable TLS for orderer (default: true)

- **Certificate Authority (CA) Configuration**
  - `KALEIDO_CA_ENDPOINT`: CA endpoint URL
  - `KALEIDO_CA_NAME`: Name of the CA
  - `KALEIDO_CA_USERNAME`: CA username for authentication
  - `KALEIDO_CA_PASSWORD`: CA password for authentication

- **Connection Configuration**
  - `KALEIDO_CONNECTION_TIMEOUT_MS`: Connection timeout in milliseconds (default: 30000)
  - `KALEIDO_REQUEST_TIMEOUT_MS`: Request timeout in milliseconds (default: 30000)
  - `KALEIDO_MAX_CONNECTIONS`: Maximum number of concurrent connections (default: 10)
  - `KALEIDO_SKIP_TLS_VERIFY`: Skip TLS certificate verification (default: false)

- **Channel Configuration**
  - `KALEIDO_CHANNEL_NAME`: Default channel name for transactions
  - `KALEIDO_ORGANIZATION`: Organization MSP ID (e.g., "Org1MSP")

- **Other Configuration**
  - `KALEIDO_REST_GATEWAY`: REST gateway URL for the network
  - `KALEIDO_CONSOLE_API`: Console API URL
  - `KALEIDO_WALLET_PATH`: Path for storing wallet credentials
  - `KALEIDO_DEBUG_LOGGING`: Enable debug logging (default: false)

### Example Configuration

See `.env.local.example` for a complete example of all Kaleido environment variables.

## Code Integration

### Configuration Module (`src/lib/kaleido-config.ts`)

The configuration module provides:

```typescript
// Load all Kaleido configuration
export function loadKaleidoConfig(): KaleidoConfig

// Get gateway URL for network connection
export function getGatewayUrl(): string

// Get CA URL for certificate authority
export function getCaUrl(): string

// Get authentication credentials
export function getAuthCredentials(): { username: string; password: string }

// Get organization MSP ID
export function getOrganizationMspId(): string

// Get default channel name
export function getDefaultChannelName(): string
```

### API Module (`src/lib/api.ts`)

The API module has been updated to use Kaleido configuration:

```typescript
// Get Kaleido configuration
export function getKaleidoConfig()

// Generate keypair with organization context from Kaleido config
export async function generateKeypair()

// Connect to Kaleido network with provided or default configuration
export async function connectNetwork(gateway?, caUrl?, identity?)
```

### Components Integration

#### KeyManagement Component

The component now:
- Loads Kaleido configuration on generation
- Displays network ID and peer ID in identity details
- Uses Kaleido organization MSP ID for the identity

#### NetworkConnection Component

The component now:
- Loads Kaleido gateway and CA URLs from configuration on mount
- Displays the Kaleido network ID when connected
- Uses Kaleido app credentials for authentication

#### E2E Tests

The Cypress E2E tests now:
- Load Kaleido configuration from environment variables
- Use actual gateway URLs from Kaleido config
- Verify Kaleido network ID and organization in tests
- Support both environment variables and fallback defaults

## Usage Example

### Step 1: Generate Identity

```typescript
import { generateKeypair, getKaleidoConfig } from '@/lib/api';

const config = getKaleidoConfig();
const identity = await generateKeypair();
// Identity will include:
// - org_name: from KALEIDO_ORGANIZATION
// - network_id: from KALEIDO_NETWORK_ID
// - peer_id: from KALEIDO_PEER_ID
```

### Step 2: Connect to Network

```typescript
import { connectNetwork, getKaleidoConfig } from '@/lib/api';

const config = getKaleidoConfig();
await connectNetwork(
  undefined,  // Uses default from KALEIDO_PEER_REST_GATEWAY
  undefined,  // Uses default from KALEIDO_CA_ENDPOINT
  identity
);
```

### Step 3: Perform Transactions

```typescript
import { queryChaincodeAsync, invokeChaincodeAsync } from '@/lib/api';

// Query chaincode
const result = await queryChaincodeAsync(
  'default-channel',
  'mycc',
  'query',
  ['key']
);

// Invoke chaincode
const txId = await invokeChaincodeAsync(
  'default-channel',
  'mycc',
  'invoke',
  ['key', 'value']
);
```

## Build and Deploy

### Development

1. Copy `.env.local.example` to `.env.local` and fill in your Kaleido credentials
2. Run `npm run tauri:dev` to start the development server
3. The app will automatically load Kaleido configuration on startup

### Production

1. Set environment variables on your deployment platform
2. Run `npm run tauri:build` to create a production build
3. The built application will use the environment variables at runtime

## Testing

### Unit Tests

Unit tests mock Kaleido configuration:

```typescript
jest.mock('@/lib/api', () => ({
  getKaleidoConfig: jest.fn().mockReturnValue({
    organization: 'Org1MSP',
    networkId: 'u0inmt8fjp',
    peerId: 'u0z8yv2jc2',
    // ... other config
  }),
}));
```

### E2E Tests

E2E tests load Kaleido configuration from Cypress environment variables:

```typescript
const kaleidoNetworkId = Cypress.env('KALEIDO_NETWORK_ID');
const kaleidoOrganization = Cypress.env('KALEIDO_ORGANIZATION');
```

## Troubleshooting

### Connection Issues

- Verify `KALEIDO_PEER_REST_GATEWAY` is correct
- Check `KALEIDO_APP_ID` and `KALEIDO_APP_PASSWORD` are valid
- Ensure TLS settings match your Kaleido network configuration

### Certificate Issues

- Verify `KALEIDO_CA_ENDPOINT` and `KALEIDO_CA_NAME` are correct
- Check `KALEIDO_CA_USERNAME` and `KALEIDO_CA_PASSWORD` credentials
- If TLS verification fails, check `KALEIDO_SKIP_TLS_VERIFY` setting

### Timeout Issues

- Increase `KALEIDO_CONNECTION_TIMEOUT_MS` for slow networks
- Increase `KALEIDO_REQUEST_TIMEOUT_MS` for long-running operations
- Check network connectivity to Kaleido endpoints

## Security Considerations

- **Never commit `.env.local`** to version control
- Use `.env.local.example` to document required variables
- Store sensitive credentials (passwords, API keys) in secure vault
- Use environment-specific configuration for dev/staging/production
- Enable TLS verification in production (`KALEIDO_SKIP_TLS_VERIFY=false`)
- Rotate credentials regularly
- Use short-lived tokens or API keys when possible

## Additional Resources

- [Kaleido Documentation](https://docs.kaleido.io/)
- [Hyperledger Fabric Documentation](https://hyperledger-fabric.readthedocs.io/)
- [Environment Variables in Next.js](https://nextjs.org/docs/basic-features/environment-variables)
