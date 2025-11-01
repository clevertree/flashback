#!/usr/bin/env node

/**
 * Kaleido Deployment Status Checker
 * Checks current deployment status and readiness for testing
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local
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
  consoleApi: process.env.KALEIDO_CONSOLE_API || 'https://console.kaleido.io/api/v1',
  networkId: process.env.KALEIDO_NETWORK_ID || 'u0inmt8fjp',
};

function makeRequest(method, url, body = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const auth = Buffer.from(`${config.appId}:${config.appPassword}`).toString('base64');

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
      },
      rejectUnauthorized: false,
    };

    const protocol = urlObj.protocol === 'https:' ? https : http;
    const req = protocol.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            body: data ? JSON.parse(data) : null,
            raw: data,
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
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

async function testChaincodeQuery() {
  console.log('\n🧪 Testing chaincode query endpoint...');
  try {
    const url = `${config.restGateway}/channels/${config.channelName}/chaincodes/movie?args=["QueryAll"]`;
    const response = await makeRequest('GET', url);
    
    console.log(`  Status: ${response.status}`);
    if (response.status >= 200 && response.status < 300) {
      console.log('  ✓ Chaincode query endpoint is working');
      return true;
    } else {
      console.log(`  ⚠️  Received status ${response.status}`);
      if (response.raw) console.log(`  Response: ${response.raw.substring(0, 100)}...`);
      return false;
    }
  } catch (error) {
    console.log(`  ⚠️  Error: ${error.message}`);
    return false;
  }
}

async function testChaincodeInvoke() {
  console.log('\n🧪 Testing chaincode invoke endpoint...');
  try {
    const url = `${config.restGateway}/channels/${config.channelName}/transactions`;
    const response = await makeRequest('POST', url, {
      chaincodeName: 'movie',
      args: ['QueryAll'],
    });
    
    console.log(`  Status: ${response.status}`);
    if (response.status >= 200 && response.status < 300) {
      console.log('  ✓ Chaincode invoke endpoint is working');
      return true;
    } else {
      console.log(`  ⚠️  Received status ${response.status}`);
      if (response.raw) console.log(`  Response: ${response.raw.substring(0, 100)}...`);
      return false;
    }
  } catch (error) {
    console.log(`  ⚠️  Error: ${error.message}`);
    return false;
  }
}

async function checkChaincodeStatus() {
  console.log('\n📊 Checking chaincode deployment status...');
  
  const chaincodes = ['movie', 'tvshow', 'games', 'voting'];
  let deployed = 0;

  for (const cc of chaincodes) {
    try {
      const url = `${config.restGateway}/channels/${config.channelName}/chaincodes/${cc}?args=["QueryAll"]`;
      const response = await makeRequest('GET', url);
      
      if (response.status >= 200 && response.status < 300) {
        console.log(`  ✓ ${cc} is deployed`);
        deployed++;
      } else if (response.status === 404 || response.status === 500) {
        console.log(`  ✗ ${cc} is NOT deployed`);
      } else {
        console.log(`  ? ${cc} - unclear status (${response.status})`);
      }
    } catch (error) {
      console.log(`  ? ${cc} - error: ${error.message}`);
    }
  }

  console.log(`\n  Summary: ${deployed}/${chaincodes.length} chaincodes deployed`);
  return deployed > 0;
}

async function checkEnv() {
  console.log('\n✓ Environment Configuration:');
  console.log(`  REST Gateway: ${config.restGateway}`);
  console.log(`  Channel: ${config.channelName}`);
  console.log(`  App ID: ${config.appId}`);
  console.log(`  Password: ${config.appPassword.substring(0, 10)}...`);
  
  // Check if binaries exist
  const chaincodes = ['movie', 'tvshow', 'games', 'voting'];
  console.log('\n✓ Chaincode Binaries:');
  
  for (const cc of chaincodes) {
    const binary = path.join(__dirname, '..', 'chaincode', cc, `${cc}-chaincode`);
    const exists = fs.existsSync(binary);
    console.log(`  ${exists ? '✓' : '✗'} ${cc}-chaincode`);
  }
}

async function main() {
  console.log('🚀 Kaleido Deployment Status Check');
  console.log('═══════════════════════════════════════\n');

  try {
    await checkEnv();

    console.log('\n\n🔗 REST Gateway Status:');
    const queryOk = await testChaincodeQuery();
    const invokeOk = await testChaincodeInvoke();

    await checkChaincodeStatus();

    console.log('\n\n📋 Deployment Summary:');
    console.log('═══════════════════════════════════════');
    
    if (queryOk || invokeOk) {
      console.log('✓ REST Gateway is responding');
      console.log('\n✨ You can now run live E2E tests:');
      console.log('  npm run cli:test:live');
      console.log('  npm run test:e2e:live');
    } else {
      console.log('⚠️  REST Gateway may not be responding correctly');
      console.log('\n📝 To deploy chaincodes:');
      console.log('  1. Go to Kaleido Console: https://console.kaleido.io');
      console.log('  2. Deploy chaincodes via the UI');
      console.log('  3. Run this check again');
    }

    console.log('\n');

  } catch (error) {
    console.error('❌ Check failed:', error.message);
    process.exit(1);
  }
}

main();
