#!/usr/bin/env node

/**
 * Kaleido Live Deployment Script
 * Deploys chaincodes to Kaleido via REST Gateway API and sets up channels
 * 
 * Prerequisites:
 * - Chaincodes built: cd chaincode/{movie,tvshow,games,voting} && go build -o {name}-chaincode .
 * - .env.local configured with Kaleido credentials
 * 
 * Usage: node scripts/deploy-kaleido-live.mjs [--dry-run]
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// Configuration Loading
// ============================================================================

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
  restGateway: process.env.KALEIDO_REST_GATEWAY || 'https://u0inmt8fjp-connect.us0-aws-ws.kaleido.io',
  appId: process.env.KALEIDO_APP_ID || 'u0hjwp2mgt',
  appPassword: process.env.KALEIDO_APP_PASSWORD || 'FZ_uU_KTzqLevq8mWWjxMUahqcKxAc0me_qUjKqDAa0',
  channelName: process.env.KALEIDO_CHANNEL_NAME || 'default-channel',
  organization: process.env.KALEIDO_ORGANIZATION || 'Org1MSP',
  networkId: process.env.KALEIDO_NETWORK_ID || 'u0inmt8fjp',
};

const chaincodes = [
  { name: 'movie', version: '1.0.0', path: 'chaincode/movie' },
  { name: 'tvshow', version: '1.0.0', path: 'chaincode/tvshow' },
  { name: 'games', version: '1.0.0', path: 'chaincode/games' },
  { name: 'voting', version: '1.0.0', path: 'chaincode/voting' },
];

// ============================================================================
// HTTP Request Helper
// ============================================================================

function makeRequest(method, pathname, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(config.restGateway);
    const auth = Buffer.from(`${config.appId}:${config.appPassword}`).toString('base64');

    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: pathname,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
      },
      rejectUnauthorized: false, // For self-signed certs
    };

    const protocol = url.protocol === 'https:' ? https : http;
    const req = protocol.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : null;
          resolve({
            status: res.statusCode,
            statusText: res.statusMessage,
            headers: res.headers,
            body: parsed,
            raw: data,
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            statusText: res.statusMessage,
            headers: res.headers,
            body: null,
            raw: data,
          });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

// ============================================================================
// Deployment Functions
// ============================================================================

async function checkGatewayHealth() {
  console.log('🔍 Checking REST Gateway connectivity...');
  try {
    // Test basic connectivity
    const response = await makeRequest('GET', '/');
    console.log(`✓ REST Gateway is accessible (responded with ${response.status})`);
    return true;
  } catch (error) {
    console.error(`❌ Gateway check failed: ${error.message}`);
    return false;
  }
}

async function getChaincodes(channel = config.channelName) {
  console.log(`\n📋 Querying deployed chaincodes on channel "${channel}"...`);
  try {
    // The REST Gateway format for querying is: /channels/{channel}/chaincodes/{ccid}?args=["function","arg1"]
    // For now, we'll just list what we know should be there
    const chaincodes = [];
    
    for (const cc of chaincodes) {
      try {
        const response = await makeRequest(
          'GET',
          `/channels/${channel}/chaincodes/${cc.name}?args=["QueryAll"]`
        );
        if (response.status >= 200 && response.status < 300) {
          chaincodes.push({ name: cc.name, version: cc.version });
          console.log(`  ✓ ${cc.name}:${cc.version}`);
        }
      } catch (e) {
        // Ignore
      }
    }
    
    return chaincodes;
  } catch (error) {
    console.error(`⚠️  Could not query chaincodes: ${error.message}`);
    return [];
  }
}

async function installChaincode(chaincode) {
  console.log(`\n📦 Installing chaincode: ${chaincode.name}@${chaincode.version}...`);
  
  const chaincodePath = path.join(__dirname, '..', chaincode.path, `${chaincode.name}-chaincode`);
  if (!fs.existsSync(chaincodePath)) {
    console.error(`❌ Chaincode binary not found: ${chaincodePath}`);
    console.log('   Build with: cd ' + path.join(chaincode.path) + ' && go build -o ' + chaincode.name + '-chaincode .');
    return false;
  }

  const binary = fs.readFileSync(chaincodePath);
  const base64Binary = binary.toString('base64');

  const payload = {
    channel: config.channelName,
    chaincodeName: chaincode.name,
    chaincodeVersion: chaincode.version,
    chaincodeType: 'golang',
    chaincodeBinary: base64Binary,
  };

  try {
    const response = await makeRequest('POST', `/channels/${config.channelName}/chaincodes`, payload);
    
    if (response.status >= 200 && response.status < 300) {
      console.log(`✓ Chaincode ${chaincode.name} installed successfully`);
      console.log(`  Transaction ID: ${response.body?.txid || 'N/A'}`);
      return true;
    } else {
      console.error(`❌ Installation failed: ${response.statusText}`);
      console.error(`  Response: ${response.raw || JSON.stringify(response.body)}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Installation error: ${error.message}`);
    return false;
  }
}

async function instantiateChaincode(chaincode) {
  console.log(`\n🚀 Instantiating chaincode: ${chaincode.name}@${chaincode.version}...`);

  const payload = {
    channel: config.channelName,
    chaincodeName: chaincode.name,
    chaincodeVersion: chaincode.version,
    args: ['init'],
  };

  try {
    const response = await makeRequest('POST', `/channels/${config.channelName}/transactions`, payload);
    
    if (response.status >= 200 && response.status < 300) {
      console.log(`✓ Chaincode ${chaincode.name} instantiated successfully`);
      console.log(`  Transaction ID: ${response.body?.transactionID || response.body?.txid || 'N/A'}`);
      return true;
    } else {
      console.error(`❌ Instantiation failed: ${response.statusText}`);
      console.error(`  Response: ${response.raw || JSON.stringify(response.body)}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Instantiation error: ${error.message}`);
    return false;
  }
}

async function testChaincodeQuery(chaincode) {
  console.log(`\n🧪 Testing chaincode: ${chaincode.name}...`);

  try {
    const response = await makeRequest(
      'GET',
      `/channels/${config.channelName}/chaincodes/${chaincode.name}?args=["QueryAll"]`
    );

    if (response.status >= 200 && response.status < 300) {
      console.log(`✓ Chaincode ${chaincode.name} responding to queries`);
      return true;
    } else {
      console.log(`⚠️  Chaincode test returned ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Test error: ${error.message}`);
    return false;
  }
}

async function verifyDeployment() {
  console.log('\n📊 Verifying deployment...');
  
  const installed = await getChaincodes();
  const allDeployed = chaincodes.every(cc => 
    installed.some(i => i.name === cc.name && i.version === cc.version)
  );

  if (allDeployed) {
    console.log('\n✨ All chaincodes deployed successfully!');
    return true;
  } else {
    console.log('\n⚠️  Some chaincodes not deployed:');
    chaincodes.forEach(cc => {
      const found = installed.some(i => i.name === cc.name && i.version === cc.version);
      console.log(`  ${found ? '✓' : '✗'} ${cc.name}@${cc.version}`);
    });
    return false;
  }
}

// ============================================================================
// Main Deployment Flow
// ============================================================================

async function deploy() {
  console.log('🚀 Kaleido Live Deployment');
  console.log('═══════════════════════════════════════\n');
  
  console.log('Configuration:');
  console.log(`  REST Gateway: ${config.restGateway}`);
  console.log(`  Channel: ${config.channelName}`);
  console.log(`  App ID: ${config.appId}`);
  console.log(`  Organization: ${config.organization}`);
  
  const dryRun = process.argv.includes('--dry-run');
  if (dryRun) {
    console.log('\n⚠️  DRY RUN MODE - No changes will be made\n');
  }

  try {
    // Check gateway health
    const healthy = await checkGatewayHealth();
    if (!healthy) {
      console.error('\n❌ REST Gateway is not accessible');
      process.exit(1);
    }

    // Get current state
    const currentChaincodes = await getChaincodes();

    if (!dryRun) {
      console.log('\n───────────────────────────────────────');
      console.log('📦 Starting chaincode deployment...');
      console.log('───────────────────────────────────────');

      let successCount = 0;
      for (const chaincode of chaincodes) {
        const alreadyDeployed = currentChaincodes.some(
          c => c.name === chaincode.name && c.version === chaincode.version
        );

        if (alreadyDeployed) {
          console.log(`\n⏭️  Skipping ${chaincode.name} - already deployed`);
          successCount++;
          continue;
        }

        // Install
        const installed = await installChaincode(chaincode);
        if (!installed) continue;

        // Wait a bit
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Instantiate
        const instantiated = await instantiateChaincode(chaincode);
        if (!instantiated) continue;

        // Test
        await new Promise(resolve => setTimeout(resolve, 1000));
        const tested = await testChaincodeQuery(chaincode);

        if (tested) successCount++;
      }

      console.log('\n───────────────────────────────────────');
      console.log(`✨ Deployment complete! (${successCount}/${chaincodes.length} successful)`);
      console.log('───────────────────────────────────────');

      // Final verification
      await verifyDeployment();

      console.log('\n📝 Next steps:');
      console.log('  1. Run CLI E2E tests:');
      console.log('     npm run cli:test:live');
      console.log('  2. Run Cypress E2E tests:');
      console.log('     npm run test:e2e:live');
      console.log('  3. Monitor in Kaleido console:');
      console.log('     https://console.kaleido.io\n');
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Deployment failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run deployment
deploy();
