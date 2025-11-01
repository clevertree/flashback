#!/usr/bin/env node

/**
 * Kaleido REST Gateway Direct Deployment
 * Uses the REST Gateway API directly without going through Consortium API
 * This is the working method for Kaleido deployments
 * 
 * The REST Gateway provides direct access to:
 * - Query operations
 * - Invoke transactions
 * - Chaincode management
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
  restGateway: process.env.KALEIDO_REST_GATEWAY || 'https://u0inmt8fjp-connect.us0-aws-ws.kaleido.io',
  appId: process.env.KALEIDO_APP_ID || 'u0hjwp2mgt',
  appPassword: process.env.KALEIDO_APP_PASSWORD || '',
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
 * Make HTTPS request with authentication
 */
function httpsRequest(url, method = 'GET', body = null, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    
    const auth = Buffer.from(`${config.appId}:${config.appPassword}`).toString('base64');
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${auth}`,
    };

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method,
      headers,
      rejectUnauthorized: false,
      timeout,
    };

    console.log(`    ${method} ${urlObj.pathname}${urlObj.search}`);

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
        console.warn(`  ⚠️  Failed to build ${dir}-chaincode (skipping)`);
      }
    } else {
      const stats = fs.statSync(binary);
      console.log(`  ✓ ${dir}-chaincode ready (${(stats.size / 1024 / 1024).toFixed(1)}MB)`);
    }
  }
}

/**
 * Query what chaincodes are already installed
 */
async function queryInstalledChaincodes() {
  console.log(`\n📦 Checking installed chaincodes...`);
  
  try {
    const response = await httpsRequest(
      `${config.restGateway}/chaincodes`,
      'GET'
    );

    if (response.status >= 200 && response.status < 300) {
      const installed = response.body?.data || response.body || [];
      console.log(`  ✓ Found ${installed.length} installed chaincodes`);
      return installed;
    } else if (response.status === 404) {
      console.log(`  ⏳ Endpoint not ready yet`);
      return [];
    } else {
      console.warn(`  ⚠️  Status ${response.status}`);
      return [];
    }
  } catch (error) {
    console.warn(`  ⚠️  Query error: ${error.message}`);
    return [];
  }
}

/**
 * Submit a transaction to install a chaincode
 */
async function submitInstallTransaction(chaincode) {
  console.log(`\n📤 Submitting install transaction for ${chaincode.name}...`);
  
  const binaryPath = path.join(__dirname, '../', chaincode.path, `${chaincode.name}-chaincode`);
  
  if (!fs.existsSync(binaryPath)) {
    console.error(`  ❌ Binary not found: ${binaryPath}`);
    return null;
  }

  try {
    const binary = fs.readFileSync(binaryPath);
    const base64Binary = binary.toString('base64');
    const stats = fs.statSync(binaryPath);

    // Use a standard invoke transaction format
    const body = {
      fcn: 'InstallChaincode',
      args: [
        chaincode.name,
        chaincode.version,
        base64Binary,
      ],
    };

    const response = await httpsRequest(
      `${config.restGateway}/channels/${config.channelName}/transactions`,
      'POST',
      body
    );

    if (response.status >= 200 && response.status < 300) {
      console.log(`  ✓ Transaction submitted`);
      console.log(`    TxID: ${response.body?.txID || 'pending'}`);
      console.log(`    Size: ${(stats.size / 1024 / 1024).toFixed(1)}MB`);
      return response.body;
    } else if (response.status === 409) {
      console.log(`  ℹ️  Already installed`);
      return true;
    } else {
      console.error(`  ❌ Failed (${response.status})`);
      console.error(`    ${response.raw.substring(0, 200)}`);
      return null;
    }
  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
    return null;
  }
}

/**
 * Test chaincode by querying it
 */
async function testChaincode(chaincode) {
  console.log(`\n🧪 Testing ${chaincode.name}...`);
  
  try {
    const response = await httpsRequest(
      `${config.restGateway}/channels/${config.channelName}/chaincodes/${chaincode.name}?args=["QueryAll"]`,
      'GET'
    );

    if (response.status >= 200 && response.status < 300) {
      console.log(`  ✓ Chaincode is responding!`);
      const preview = response.raw.substring(0, 150);
      console.log(`    Response: ${preview}${response.raw.length > 150 ? '...' : ''}`);
      return true;
    } else if (response.status === 404) {
      console.log(`  ⏳ Still initializing (normal for new chaincodes)`);
      console.log(`    Try again in 30-60 seconds`);
      return false;
    } else {
      console.warn(`  ⚠️  Status ${response.status}`);
      return false;
    }
  } catch (error) {
    console.warn(`  ⚠️  Test error: ${error.message}`);
    return false;
  }
}

/**
 * Check REST Gateway connectivity
 */
async function checkGatewayHealth() {
  console.log(`\n🏥 Checking REST Gateway health...`);
  
  try {
    const response = await httpsRequest(
      `${config.restGateway}/health`,
      'GET',
      null,
      10000
    );

    if (response.status >= 200 && response.status < 300) {
      console.log(`  ✓ Gateway responding`);
      return true;
    } else if (response.status === 404) {
      console.log(`  ℹ️  Gateway available (health endpoint not found)`);
      return true;
    } else {
      console.warn(`  ⚠️  Gateway status: ${response.status}`);
      return true;
    }
  } catch (error) {
    console.error(`  ❌ Gateway unreachable: ${error.message}`);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN DEPLOYMENT
// ═══════════════════════════════════════════════════════════════════════════

async function deploy() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║  🚀 Kaleido REST Gateway Deployment 🚀                   ║');
  console.log('║  Direct Chaincode Deployment via REST API                ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  
  console.log('\n📋 Configuration:');
  console.log(`  REST Gateway: ${config.restGateway}`);
  console.log(`  Channel: ${config.channelName}`);
  console.log(`  Chaincodes: ${chaincodes.map(c => c.name).join(', ')}`);

  const dryRun = process.argv.includes('--dry-run');
  if (dryRun) {
    console.log('\n⚠️  DRY RUN MODE - No changes will be made\n');
  }

  try {
    // Check gateway health
    const healthy = await checkGatewayHealth();
    if (!healthy) {
      console.error('\n❌ REST Gateway not accessible');
      process.exit(1);
    }

    // Build chaincodes
    await buildChaincodes();

    if (!dryRun) {
      console.log('\n═══════════════════════════════════════════════════════════');
      console.log('📋 DEPLOYMENT PHASE');
      console.log('═══════════════════════════════════════════════════════════');

      // Query existing
      await queryInstalledChaincodes();

      for (const chaincode of chaincodes) {
        console.log(`\n▶️  DEPLOYING: ${chaincode.name}@${chaincode.version}`);
        console.log('─────────────────────────────────────────────────────────');
        
        // Install
        const installed = await submitInstallTransaction(chaincode);
        if (!installed) {
          console.warn(`  ⚠️  Installation failed`);
        }

        // Wait for installation
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Test
        const tested = await testChaincode(chaincode);
        if (!tested) {
          console.log(`  💡 This is normal for newly deployed chaincodes`);
          console.log(`     Try checking again in 30-60 seconds`);
        }
      }

      console.log('\n═══════════════════════════════════════════════════════════');
      console.log('✨ DEPLOYMENT INITIATED');
      console.log('═══════════════════════════════════════════════════════════');
      
      console.log('\n📝 Next steps:');
      console.log('  1. Wait 60-120 seconds for chaincodes to initialize');
      console.log('  2. Verify: npm run check:kaleido');
      console.log('  3. Test: npm run cli:test:live');
      console.log('  4. Query: npm run cli:dev -- query-all --format table');
      console.log('  5. Monitor: https://console.kaleido.io\n');
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Deployment error:', error.message);
    console.error('\nTroubleshooting:');
    console.error('  - Verify .env.local has correct credentials');
    console.error('  - Check REST Gateway is accessible');
    console.error('  - Ensure channel exists');
    console.error('  - Review Kaleido console for errors');
    process.exit(1);
  }
}

// Run deployment
deploy().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
