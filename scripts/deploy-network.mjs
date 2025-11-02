#!/usr/bin/env node

/**
 * Kaleido Network Deployment via CLI
 * Creates a new Kaleido network with all required components
 * 
 * Prerequisites:
 * - Kaleido API credentials in .env.local
 * - Node.js 18+
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ═══════════════════════════════════════════════════════════════════════════
// ENVIRONMENT LOADING
// ═══════════════════════════════════════════════════════════════════════════

function loadEnv() {
  const envPath = path.join(__dirname, '../.env.local');
  if (!fs.existsSync(envPath)) {
    throw new Error(`❌ .env.local not found at ${envPath}`);
  }
  
  const content = fs.readFileSync(envPath, 'utf-8');
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key) {
        const value = valueParts.join('=').replace(/^["']|["']$/g, '');
        process.env[key.trim()] = value;
      }
    }
  });
}

loadEnv();

const config = {
  apiKey: process.env.KALEIDO_API_KEY,
  apiSecret: process.env.KALEIDO_API_SECRET,
};

// ═══════════════════════════════════════════════════════════════════════════
// HTTP UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

function httpsRequest(url, method = 'GET', body = null, headers = {}, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    
    const defaultHeaders = {
      'Content-Type': 'application/json',
      ...headers,
    };

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method,
      headers: defaultHeaders,
      rejectUnauthorized: false,
      timeout,
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data ? JSON.parse(data) : null,
            raw: data,
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: null,
            raw: data,
          });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timeout after ${timeout}ms`));
    });

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// KALEIDO API CALLS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate Kaleido API signature for authentication
 */
function generateAuthHeader(method, path, body = null) {
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomBytes(16).toString('hex');
  
  let bodyStr = '';
  if (body) {
    bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
  }

  const signatureString = [
    config.apiKey,
    method,
    path,
    bodyStr,
    timestamp,
    nonce,
  ].join('\n');

  const signature = crypto
    .createHmac('sha256', config.apiSecret)
    .update(signatureString)
    .digest('hex');

  return {
    'Authorization': `Bearer ${config.apiKey}:${signature}`,
    'X-Kaleido-Timestamp': timestamp.toString(),
    'X-Kaleido-Nonce': nonce,
  };
}

/**
 * Create a new organization
 */
async function createOrganization(orgName) {
  console.log(`\n📋 Creating Organization: ${orgName}`);
  
  const path = '/api/v1/organizations';
  const body = {
    name: orgName,
    sso_enabled: false,
  };

  const auth = generateAuthHeader('POST', path, body);

  try {
    const response = await httpsRequest(
      `https://api.kaleido.io${path}`,
      'POST',
      body,
      auth
    );

    if (response.status >= 200 && response.status < 300) {
      const orgId = response.body?.id;
      console.log(`✅ Organization created: ${orgId}`);
      return orgId;
    } else {
      console.error(`❌ Failed (${response.status}): ${response.raw.substring(0, 200)}`);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    return null;
  }
}

/**
 * Create a new consortium
 */
async function createConsortium(orgId, consortiumName) {
  console.log(`\n🏢 Creating Consortium: ${consortiumName}`);
  
  const path = `/api/v1/organizations/${orgId}/consortiums`;
  const body = {
    name: consortiumName,
    sso_enabled: false,
  };

  const auth = generateAuthHeader('POST', path, body);

  try {
    const response = await httpsRequest(
      `https://api.kaleido.io${path}`,
      'POST',
      body,
      auth
    );

    if (response.status >= 200 && response.status < 300) {
      const consortiumId = response.body?.id;
      console.log(`✅ Consortium created: ${consortiumId}`);
      return consortiumId;
    } else {
      console.error(`❌ Failed (${response.status}): ${response.raw.substring(0, 200)}`);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    return null;
  }
}

/**
 * Create a new environment (network)
 */
async function createEnvironment(orgId, consortiumId, envName) {
  console.log(`\n🌐 Creating Environment (Network): ${envName}`);
  
  const path = `/api/v1/organizations/${orgId}/consortiums/${consortiumId}/environments`;
  const body = {
    name: envName,
    description: `Hyperledger Fabric network for ${envName}`,
    blockchain_type: 'fabric',
    consensus_type: 'raft',
    membership_type: 'permissioned',
  };

  const auth = generateAuthHeader('POST', path, body);

  try {
    const response = await httpsRequest(
      `https://api.kaleido.io${path}`,
      'POST',
      body,
      auth
    );

    if (response.status >= 200 && response.status < 300) {
      const envId = response.body?.id;
      console.log(`✅ Environment created: ${envId}`);
      console.log(`   Status: ${response.body?.state || 'provisioning'}`);
      return envId;
    } else {
      console.error(`❌ Failed (${response.status}): ${response.raw.substring(0, 200)}`);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    return null;
  }
}

/**
 * Create a node (peer)
 */
async function createNode(orgId, envId, nodeName) {
  console.log(`\n👤 Creating Node (Peer): ${nodeName}`);
  
  const path = `/api/v1/organizations/${orgId}/environments/${envId}/nodes`;
  const body = {
    name: nodeName,
    node_type: 'peer',
  };

  const auth = generateAuthHeader('POST', path, body);

  try {
    const response = await httpsRequest(
      `https://api.kaleido.io${path}`,
      'POST',
      body,
      auth
    );

    if (response.status >= 200 && response.status < 300) {
      const nodeId = response.body?.id;
      console.log(`✅ Node created: ${nodeId}`);
      console.log(`   Status: ${response.body?.state || 'provisioning'}`);
      return nodeId;
    } else {
      console.error(`❌ Failed (${response.status}): ${response.raw.substring(0, 200)}`);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    return null;
  }
}

/**
 * Create a channel
 */
async function createChannel(orgId, envId, channelName) {
  console.log(`\n📡 Creating Channel: ${channelName}`);
  
  const path = `/api/v1/organizations/${orgId}/environments/${envId}/channels`;
  const body = {
    name: channelName,
  };

  const auth = generateAuthHeader('POST', path, body);

  try {
    const response = await httpsRequest(
      `https://api.kaleido.io${path}`,
      'POST',
      body,
      auth
    );

    if (response.status >= 200 && response.status < 300) {
      const channelId = response.body?.id;
      console.log(`✅ Channel created: ${channelId}`);
      console.log(`   Status: ${response.body?.state || 'provisioning'}`);
      return channelId;
    } else {
      console.error(`❌ Failed (${response.status}): ${response.raw.substring(0, 200)}`);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    return null;
  }
}

/**
 * Create REST Gateway
 */
async function createRESTGateway(orgId, envId, gatewayName) {
  console.log(`\n🔌 Creating REST Gateway: ${gatewayName}`);
  
  const path = `/api/v1/organizations/${orgId}/environments/${envId}/gateways`;
  const body = {
    name: gatewayName,
    gateway_type: 'rest',
  };

  const auth = generateAuthHeader('POST', path, body);

  try {
    const response = await httpsRequest(
      `https://api.kaleido.io${path}`,
      'POST',
      body,
      auth
    );

    if (response.status >= 200 && response.status < 300) {
      const gatewayId = response.body?.id;
      console.log(`✅ REST Gateway created: ${gatewayId}`);
      console.log(`   Status: ${response.body?.state || 'provisioning'}`);
      if (response.body?.url) console.log(`   URL: ${response.body.url}`);
      return gatewayId;
    } else {
      console.error(`❌ Failed (${response.status}): ${response.raw.substring(0, 200)}`);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN DEPLOYMENT
// ═══════════════════════════════════════════════════════════════════════════

async function deployNetwork() {
  console.log('\n╔═══════════════════════════════════════════════════════╗');
  console.log('║  🚀 Kaleido Network Deployment via CLI 🚀            ║');
  console.log('║  Creating new Hyperledger Fabric network              ║');
  console.log('╚═══════════════════════════════════════════════════════╝');
  
  // Verify API credentials
  if (!config.apiKey || !config.apiSecret) {
    console.error('\n❌ Error: KALEIDO_API_KEY and KALEIDO_API_SECRET not found in .env.local');
    process.exit(1);
  }

  console.log('\n📋 Configuration:');
  console.log(`  API Key: ${config.apiKey.substring(0, 10)}...`);
  console.log(`  API Secret: ${config.apiSecret.substring(0, 10)}...`);

  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    
    // Create organization
    const orgName = `fabric-org-${timestamp}`;
    const orgId = await createOrganization(orgName);
    if (!orgId) throw new Error('Failed to create organization');

    // Wait a bit for org to be created
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Create consortium
    const consortiumName = `fabric-consortium-${timestamp}`;
    const consortiumId = await createConsortium(orgId, consortiumName);
    if (!consortiumId) throw new Error('Failed to create consortium');

    // Wait a bit for consortium to be created
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Create environment (network)
    const envName = `fabric-net-${timestamp}`;
    const envId = await createEnvironment(orgId, consortiumId, envName);
    if (!envId) throw new Error('Failed to create environment');

    // Wait for network provisioning
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Create node (peer)
    const nodeName = 'peer0';
    const nodeId = await createNode(orgId, envId, nodeName);
    if (!nodeId) throw new Error('Failed to create node');

    // Wait for node provisioning
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Create channel
    const channelName = 'default-channel';
    const channelId = await createChannel(orgId, envId, channelName);
    if (!channelId) throw new Error('Failed to create channel');

    // Wait for channel creation
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Create REST Gateway
    const gatewayName = 'rest-gateway';
    const gatewayId = await createRESTGateway(orgId, envId, gatewayName);
    if (!gatewayId) throw new Error('Failed to create REST Gateway');

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('✨ NETWORK DEPLOYMENT INITIATED');
    console.log('═══════════════════════════════════════════════════════\n');

    console.log('📊 Created Resources:\n');
    console.log(`  Organization ID:  ${orgId}`);
    console.log(`  Consortium ID:    ${consortiumId}`);
    console.log(`  Environment ID:   ${envId}`);
    console.log(`  Node ID:          ${nodeId}`);
    console.log(`  Channel ID:       ${channelId}`);
    console.log(`  Gateway ID:       ${gatewayId}`);

    console.log('\n📝 Next Steps:\n');
    console.log('  1. Update .env.local with new network credentials:');
    console.log(`     KALEIDO_NETWORK_ID=${envId}`);
    console.log(`     KALEIDO_ORG_ID=${orgId}`);
    console.log(`     KALEIDO_ENV_ID=${envId}`);
    console.log('\n  2. Wait 2-5 minutes for full provisioning');
    console.log('  3. Deploy chaincodes via Console or API');
    console.log('  4. Query status: npm run check:kaleido\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Deployment failed:', error.message);
    console.error('\nTroubleshooting:');
    console.error('  - Verify API credentials are correct');
    console.error('  - Check that API credentials have required permissions');
    console.error('  - Ensure your Kaleido account is active');
    process.exit(1);
  }
}

deployNetwork().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
