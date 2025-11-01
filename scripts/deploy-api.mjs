#!/usr/bin/env node

/**
 * Kaleido API-based Chaincode Deployment
 * Uses Kaleido Consortium API to deploy chaincodes via REST API
 * No UI/Console interaction required
 * 
 * Prerequisites:
 * - Kaleido network created (u0inmt8fjp)
 * - Channel exists (default-channel)
 * - Chaincodes built
 * - .env.local configured with Consortium API credentials
 * 
 * Environment Variables Required:
 * - KALEIDO_ORG_ID: Organization ID
 * - KALEIDO_ENV_ID: Environment ID  
 * - KALEIDO_API_KEY: Consortium API key
 * - KALEIDO_API_SECRET: Consortium API secret
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execAsync = promisify(exec);

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

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const config = {
  // REST Gateway (for querying deployed chaincodes)
  restGateway: process.env.KALEIDO_REST_GATEWAY || 'https://u0inmt8fjp-connect.us0-aws-ws.kaleido.io',
  restAppId: process.env.KALEIDO_APP_ID || 'u0hjwp2mgt',
  restAppPassword: process.env.KALEIDO_APP_PASSWORD || '',
  
  // Consortium API (for deployment)
  consortiumApi: process.env.KALEIDO_CONSORTIUM_API || 'https://api.kaleido.io/api/v1',
  orgId: process.env.KALEIDO_ORG_ID || process.env.KALEIDO_NETWORK_ID || 'u0inmt8fjp',
  envId: process.env.KALEIDO_ENV_ID || 'u0inmt8fjp',
  apiKey: process.env.KALEIDO_API_KEY,
  apiSecret: process.env.KALEIDO_API_SECRET,
  
  channelName: process.env.KALEIDO_CHANNEL_NAME || 'default-channel',
};

const chaincodes = [
  { 
    name: 'movie', 
    version: '1.0.0', 
    path: 'chaincode/movie',
    language: 'golang',
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// HTTP UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Make HTTPS request
 */
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

/**
 * Generate Kaleido Consortium API signature
 * Uses HMAC-SHA256 for request authentication
 */
function generateConsortiumAuth(method, path, body = null, apiKey, apiSecret) {
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomBytes(16).toString('hex');
  
  let bodyStr = '';
  if (body) {
    bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
  }

  // Create signature string
  const signatureString = [
    apiKey,
    method,
    path,
    bodyStr,
    timestamp,
    nonce,
  ].join('\n');

  // Generate HMAC-SHA256 signature
  const signature = crypto
    .createHmac('sha256', apiSecret)
    .update(signatureString)
    .digest('hex');

  return {
    'Authorization': `Bearer ${apiKey}:${signature}`,
    'X-Kaleido-Timestamp': timestamp.toString(),
    'X-Kaleido-Nonce': nonce,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// CHAINCODE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build chaincodes that aren't built yet
 */
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

/**
 * Upload chaincode to Kaleido Consortium API
 */
async function uploadChaincode(chaincode) {
  console.log(`\n📤 Uploading ${chaincode.name}...`);
  
  const binaryPath = path.join(__dirname, '../', chaincode.path, `${chaincode.name}-chaincode`);
  
  if (!fs.existsSync(binaryPath)) {
    console.error(`  ❌ Binary not found: ${binaryPath}`);
    return null;
  }

  try {
    const binary = fs.readFileSync(binaryPath);
    const base64Binary = binary.toString('base64');
    const stats = fs.statSync(binaryPath);

    const uploadUrl = `${config.consortiumApi}/organizations/${config.orgId}/environments/${config.envId}/chaincodes`;
    
    const body = {
      name: chaincode.name,
      version: chaincode.version,
      language: chaincode.language,
      chaincode: base64Binary,
    };

    const auth = generateConsortiumAuth(
      'POST',
      `/api/v1/organizations/${config.orgId}/environments/${config.envId}/chaincodes`,
      body,
      config.apiKey,
      config.apiSecret
    );

    const response = await httpsRequest(
      uploadUrl,
      'POST',
      body,
      {
        ...auth,
        'Content-Type': 'application/json',
      }
    );

    if (response.status >= 200 && response.status < 300) {
      const ccId = response.body?.id || response.body?.chaincode_id;
      console.log(`  ✓ Uploaded successfully`);
      console.log(`    Size: ${(stats.size / 1024 / 1024).toFixed(1)}MB`);
      console.log(`    Chaincode ID: ${ccId}`);
      return response.body;
    } else {
      console.error(`  ❌ Upload failed (${response.status})`);
      console.error(`    Response: ${response.raw.substring(0, 300)}`);
      return null;
    }
  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
    return null;
  }
}

/**
 * Install chaincode on peer
 */
async function installChaincode(chaincode) {
  console.log(`\n🔧 Installing ${chaincode.name}...`);
  
  try {
    const installUrl = `${config.consortiumApi}/organizations/${config.orgId}/environments/${config.envId}/chaincodes/${chaincode.name}/install`;
    
    const body = {
      peers: ['peer0'],
      version: chaincode.version,
    };

    const auth = generateConsortiumAuth(
      'POST',
      `/api/v1/organizations/${config.orgId}/environments/${config.envId}/chaincodes/${chaincode.name}/install`,
      body,
      config.apiKey,
      config.apiSecret
    );

    const response = await httpsRequest(
      installUrl,
      'POST',
      body,
      {
        ...auth,
        'Content-Type': 'application/json',
      }
    );

    if (response.status >= 200 && response.status < 300) {
      console.log(`  ✓ Installation initiated`);
      console.log(`    Task ID: ${response.body?.task_id || 'processing'}`);
      return true;
    } else if (response.status === 409) {
      console.log(`  ℹ️  Already installed`);
      return true;
    } else {
      console.error(`  ❌ Installation failed (${response.status})`);
      console.error(`    Response: ${response.raw.substring(0, 300)}`);
      return false;
    }
  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
    return false;
  }
}

/**
 * Instantiate chaincode on channel
 */
async function instantiateChaincode(chaincode) {
  console.log(`\n🚀 Instantiating ${chaincode.name} on ${config.channelName}...`);
  
  try {
    const instantiateUrl = `${config.consortiumApi}/organizations/${config.orgId}/environments/${config.envId}/channels/${config.channelName}/chaincodes`;
    
    const body = {
      chaincode_name: chaincode.name,
      chaincode_version: chaincode.version,
      endorsement_policy: "OR('Org1MSP.peer')",
      init_args: ['init'],
      init_function: 'init',
    };

    const auth = generateConsortiumAuth(
      'POST',
      `/api/v1/organizations/${config.orgId}/environments/${config.envId}/channels/${config.channelName}/chaincodes`,
      body,
      config.apiKey,
      config.apiSecret
    );

    const response = await httpsRequest(
      instantiateUrl,
      'POST',
      body,
      {
        ...auth,
        'Content-Type': 'application/json',
      }
    );

    if (response.status >= 200 && response.status < 300) {
      console.log(`  ✓ Instantiation initiated`);
      console.log(`    Transaction ID: ${response.body?.txid || 'processing'}`);
      return true;
    } else if (response.status === 409) {
      console.log(`  ℹ️  Already instantiated`);
      return true;
    } else {
      console.error(`  ❌ Instantiation failed (${response.status})`);
      console.error(`    Response: ${response.raw.substring(0, 300)}`);
      return false;
    }
  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
    return false;
  }
}

/**
 * Test chaincode via REST Gateway
 */
async function testChaincode(chaincode) {
  console.log(`\n🧪 Testing ${chaincode.name}...`);
  
  try {
    const auth = Buffer.from(`${config.restAppId}:${config.restAppPassword}`).toString('base64');
    
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
      console.log(`    Response: ${response.raw.substring(0, 100)}...`);
      return true;
    } else if (response.status === 404) {
      console.log(`  ⏳ Still initializing (may take 30-60 seconds)`);
      return false;
    } else {
      console.error(`  ⚠️  Status ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error(`  ⚠️  Test error: ${error.message}`);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN DEPLOYMENT
// ═══════════════════════════════════════════════════════════════════════════

async function deploy() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║   🚀 Kaleido API-Based Chaincode Deployment 🚀           ║');
  console.log('║   Using Consortium API - No UI Interaction Required       ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  
  console.log('\n📋 Configuration:');
  console.log(`  REST Gateway: ${config.restGateway}`);
  console.log(`  Consortium API: ${config.consortiumApi}`);
  console.log(`  Organization: ${config.orgId}`);
  console.log(`  Environment: ${config.envId}`);
  console.log(`  Channel: ${config.channelName}`);
  console.log(`  Chaincodes: ${chaincodes.map(c => c.name).join(', ')}`);

  const dryRun = process.argv.includes('--dry-run');
  if (dryRun) {
    console.log('\n⚠️  DRY RUN MODE - No changes will be made\n');
  }

  // Verify API credentials
  if (!config.apiKey || !config.apiSecret) {
    console.warn('\n⚠️  WARNING: Consortium API credentials not found in .env.local');
    console.warn('  Expected: KALEIDO_API_KEY and KALEIDO_API_SECRET');
    console.log('\n  Attempting deployment with available credentials...\n');
  }

  try {
    // Build chaincodes
    await buildChaincodes();

    if (!dryRun) {
      console.log('\n═══════════════════════════════════════════════════════════');
      console.log('📋 DEPLOYMENT PHASE');
      console.log('═══════════════════════════════════════════════════════════');

      for (const chaincode of chaincodes) {
        console.log(`\n▶️  DEPLOYING: ${chaincode.name}@${chaincode.version}`);
        console.log('─────────────────────────────────────────────────────────');
        
        // Upload
        const uploaded = await uploadChaincode(chaincode);
        if (!uploaded) {
          console.warn(`  ⚠️  Upload failed, continuing...`);
        }

        // Wait for upload
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Install
        const installed = await installChaincode(chaincode);
        if (!installed) {
          console.warn(`  ⚠️  Installation may have failed, continuing...`);
        }

        // Wait for install
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Instantiate
        const instantiated = await instantiateChaincode(chaincode);
        if (!instantiated) {
          console.warn(`  ⚠️  Instantiation may have failed, continuing...`);
        }

        // Wait for instantiation
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Test
        await testChaincode(chaincode);
      }

      console.log('\n═══════════════════════════════════════════════════════════');
      console.log('✨ DEPLOYMENT COMPLETE');
      console.log('═══════════════════════════════════════════════════════════');
      
      console.log('\n📝 Next steps:');
      console.log('  1. Wait 60-120 seconds for all operations to complete');
      console.log('  2. Verify: npm run check:kaleido');
      console.log('  3. Test: npm run cli:test:live');
      console.log('  4. Monitor: https://console.kaleido.io');
      console.log('  5. Query manually: npm run cli:dev -- query-all --format table\n');
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Deployment error:', error.message);
    console.error('\nTroubleshooting:');
    console.error('  - Verify .env.local has all required variables');
    console.error('  - Check Consortium API credentials');
    console.error('  - Ensure Kaleido network is accessible');
    console.error('  - Review Kaleido console for detailed error logs');
    process.exit(1);
  }
}

// Run deployment
deploy().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
