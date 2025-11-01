#!/usr/bin/env node

/**
 * Kaleido Live Chaincode Deployment
 * Deploys chaincodes using Kaleido REST Gateway and Console API
 * 
 * Prerequisites:
 * - Kaleido network created
 * - Channel exists
 * - Chaincodes built
 * - .env.local configured with credentials
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execAsync = promisify(exec);

// Load environment
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
  restGateway: process.env.KALEIDO_REST_GATEWAY,
  appId: process.env.KALEIDO_APP_ID,
  appPassword: process.env.KALEIDO_APP_PASSWORD,
  channelName: process.env.KALEIDO_CHANNEL_NAME || 'default-channel',
  consoleApi: process.env.KALEIDO_CONSOLE_API || 'https://console.kaleido.io/api/v1',
};

const chaincodes = [
  { name: 'movie', version: '1.0.0', path: 'chaincode/movie' },
];

// HTTP request helper
function httpsRequest(url, method = 'GET', body = null, headers = {}) {
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

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

// Build chaincodes that aren't built yet
async function buildChaincodes() {
  console.log('\n🔨 Checking chaincode binaries...');
  
  const chaincodeDir = path.join(__dirname, '../chaincode');
  const dirs = fs.readdirSync(chaincodeDir);

  for (const dir of dirs) {
    const fullPath = path.join(chaincodeDir, dir);
    const binary = path.join(fullPath, `${dir}-chaincode`);
    
    if (!fs.statSync(fullPath).isDirectory()) continue;

    if (!fs.existsSync(binary)) {
      console.log(`  Building ${dir}-chaincode...`);
      try {
        await execAsync(`cd ${fullPath} && go build -o ${dir}-chaincode .`, { timeout: 60000 });
        console.log(`  ✓ ${dir}-chaincode built`);
      } catch (error) {
        console.warn(`  ⚠️  Failed to build ${dir}-chaincode: ${error.message}`);
      }
    } else {
      const stats = fs.statSync(binary);
      console.log(`  ✓ ${dir}-chaincode ready (${(stats.size / 1024 / 1024).toFixed(1)}MB)`);
    }
  }
}

// Install chaincode via REST Gateway
async function installChaincode(chaincode) {
  console.log(`\n📦 Installing ${chaincode.name}...`);
  
  const binaryPath = path.join(__dirname, '../', chaincode.path, `${chaincode.name}-chaincode`);
  
  if (!fs.existsSync(binaryPath)) {
    console.error(`  ❌ Binary not found: ${binaryPath}`);
    return false;
  }

  try {
    const binary = fs.readFileSync(binaryPath);
    const base64Binary = binary.toString('base64');

    const auth = Buffer.from(`${config.appId}:${config.appPassword}`).toString('base64');
    
    const response = await httpsRequest(
      `${config.restGateway}/channels/${config.channelName}/chaincodes`,
      'POST',
      {
        chaincodeName: chaincode.name,
        chaincodeVersion: chaincode.version,
        chaincodePath: chaincode.path,
        chaincodeType: 'golang',
        chaincodePackage: base64Binary,
      },
      {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      }
    );

    if (response.status >= 200 && response.status < 300) {
      console.log(`  ✓ Installation initiated`);
      console.log(`    Transaction ID: ${response.body?.transactionID || 'pending'}`);
      return true;
    } else if (response.status === 409) {
      console.log(`  ℹ️  ${chaincode.name} already installed`);
      return true;
    } else {
      console.error(`  ❌ Installation failed (${response.status})`);
      console.error(`    Response: ${response.raw.substring(0, 200)}`);
      return false;
    }
  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
    return false;
  }
}

// Instantiate chaincode
async function instantiateChaincode(chaincode) {
  console.log(`\n🚀 Instantiating ${chaincode.name}...`);
  
  try {
    const auth = Buffer.from(`${config.appId}:${config.appPassword}`).toString('base64');
    
    const response = await httpsRequest(
      `${config.restGateway}/channels/${config.channelName}/transactions`,
      'POST',
      {
        chaincodeName: chaincode.name,
        chaincodeVersion: chaincode.version,
        args: ['init'],
        fcn: 'init',
      },
      {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      }
    );

    if (response.status >= 200 && response.status < 300) {
      console.log(`  ✓ Instantiation initiated`);
      console.log(`    Transaction ID: ${response.body?.transactionID || 'pending'}`);
      return true;
    } else if (response.status === 409) {
      console.log(`  ℹ️  ${chaincode.name} already instantiated`);
      return true;
    } else {
      console.error(`  ❌ Instantiation failed (${response.status})`);
      console.error(`    Response: ${response.raw.substring(0, 200)}`);
      return false;
    }
  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
    return false;
  }
}

// Test chaincode
async function testChaincode(chaincode) {
  console.log(`\n🧪 Testing ${chaincode.name}...`);
  
  try {
    const auth = Buffer.from(`${config.appId}:${config.appPassword}`).toString('base64');
    
    // Try query
    const response = await httpsRequest(
      `${config.restGateway}/channels/${config.channelName}/chaincodes/${chaincode.name}?args=["QueryAll"]`,
      'GET',
      null,
      {
        'Authorization': `Basic ${auth}`,
      }
    );

    if (response.status >= 200 && response.status < 300) {
      console.log(`  ✓ Chaincode is responding`);
      return true;
    } else {
      console.log(`  ⚠️  Status ${response.status} (may still be initializing)`);
      return false;
    }
  } catch (error) {
    console.error(`  ⚠️  Test error: ${error.message}`);
    return false;
  }
}

// Main deployment
async function deploy() {
  console.log('🚀 Kaleido Live Chaincode Deployment');
  console.log('═══════════════════════════════════════════\n');
  
  console.log('Configuration:');
  console.log(`  REST Gateway: ${config.restGateway}`);
  console.log(`  Channel: ${config.channelName}`);
  console.log(`  Chaincodes: ${chaincodes.map(c => c.name).join(', ')}`);

  const dryRun = process.argv.includes('--dry-run');
  if (dryRun) {
    console.log('\n⚠️  DRY RUN MODE\n');
  }

  try {
    // Build chaincodes
    await buildChaincodes();

    if (!dryRun) {
      console.log('\n───────────────────────────────────────────');
      console.log('📋 Deploying Chaincodes');
      console.log('───────────────────────────────────────────');

      for (const chaincode of chaincodes) {
        console.log(`\n▶️  ${chaincode.name}@${chaincode.version}`);
        
        // Install
        const installed = await installChaincode(chaincode);
        if (!installed) continue;

        // Wait
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Instantiate
        const instantiated = await instantiateChaincode(chaincode);
        if (!instantiated) continue;

        // Wait
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Test
        await testChaincode(chaincode);
      }

      console.log('\n───────────────────────────────────────────');
      console.log('\n✨ Deployment initiated!\n');
      console.log('📝 Next steps:');
      console.log('  1. Wait 30-60 seconds for instantiation');
      console.log('  2. Verify: npm run check:kaleido');
      console.log('  3. Test: npm run cli:test:live');
      console.log('  4. Monitor: https://console.kaleido.io\n');
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Deployment failed:', error.message);
    process.exit(1);
  }
}

deploy();
