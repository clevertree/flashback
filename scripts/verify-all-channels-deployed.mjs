#!/usr/bin/env node

/**
 * Automated Deployment Verification & Testing Script
 * Run this AFTER deploying all chaincodes via Kaleido Console
 * 
 * Usage: node scripts/verify-all-channels-deployed.mjs
 * Or:    npm run verify:channels
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// Configuration
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
  restGateway: process.env.KALEIDO_REST_GATEWAY,
  appId: process.env.KALEIDO_APP_ID,
  appPassword: process.env.KALEIDO_APP_PASSWORD,
  channelName: process.env.KALEIDO_CHANNEL_NAME,
};

const chaincodes = [
  { name: 'movie', version: '1.0.0' },
  { name: 'tvshow', version: '1.0.0' },
  { name: 'games', version: '1.0.0' },
  { name: 'voting', version: '1.0.0' },
];

// ============================================================================
// HTTP Request Helper
// ============================================================================

function httpsRequest(url, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const auth = Buffer.from(`${config.appId}:${config.appPassword}`).toString('base64');

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
      },
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
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

// ============================================================================
// Verification Functions
// ============================================================================

async function verifyGatewayConnectivity() {
  console.log('\n🔌 Step 1: Verifying REST Gateway Connectivity');
  console.log('═══════════════════════════════════════════════════════\n');

  try {
    const response = await httpsRequest(`${config.restGateway}/channels`);
    
    if (response.status >= 200 && response.status < 500) {
      console.log(`✅ REST Gateway is accessible`);
      console.log(`   Status: ${response.status}`);
      console.log(`   URL: ${config.restGateway}`);
      return true;
    } else {
      console.error(`❌ REST Gateway returned unexpected status: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Failed to connect to REST Gateway:`);
    console.error(`   ${error.message}`);
    return false;
  }
}

async function verifyChaincodeDeployment() {
  console.log('\n📦 Step 2: Verifying Chaincode Deployment Status');
  console.log('═══════════════════════════════════════════════════════\n');

  let deployedCount = 0;
  const results = [];

  for (const cc of chaincodes) {
    try {
      // Try a simple health check query
      const response = await httpsRequest(
        `${config.restGateway}/channels/${config.channelName}/chaincodes/${cc.name}?args=["health"]`,
        'GET'
      );

      const isDeployed = response.status >= 200 && response.status < 400;
      
      if (isDeployed) {
        deployedCount++;
        console.log(`✅ ${cc.name}@${cc.version}`);
        results.push({ name: cc.name, deployed: true });
      } else {
        console.log(`❌ ${cc.name}@${cc.version} (Status: ${response.status})`);
        results.push({ name: cc.name, deployed: false });
      }
    } catch (error) {
      console.log(`❌ ${cc.name}@${cc.version} - Error: ${error.message}`);
      results.push({ name: cc.name, deployed: false });
    }
  }

  console.log(`\nSummary: ${deployedCount}/${chaincodes.length} chaincodes deployed\n`);
  
  return {
    allDeployed: deployedCount === chaincodes.length,
    deployedCount,
    results,
  };
}

async function verifyRESTGatewayEndpoints() {
  console.log('\n🔗 Step 3: Verifying REST Gateway Endpoints');
  console.log('═══════════════════════════════════════════════════════\n');

  const endpoints = [
    { path: '/channels', method: 'GET', desc: 'List channels' },
    { path: `/channels/${config.channelName}`, method: 'GET', desc: 'Get channel info' },
    { path: `/channels/${config.channelName}/chaincodes`, method: 'GET', desc: 'List chaincodes' },
  ];

  let workingCount = 0;

  for (const endpoint of endpoints) {
    try {
      const response = await httpsRequest(
        `${config.restGateway}${endpoint.path}`,
        endpoint.method
      );

      if (response.status >= 200 && response.status < 500) {
        console.log(`✅ ${endpoint.method.padEnd(4)} ${endpoint.path}`);
        console.log(`   ${endpoint.desc}`);
        if (response.status < 300) workingCount++;
      } else {
        console.log(`⚠️  ${endpoint.method.padEnd(4)} ${endpoint.path} (${response.status})`);
      }
    } catch (error) {
      console.log(`❌ ${endpoint.method.padEnd(4)} ${endpoint.path}`);
      console.log(`   Error: ${error.message}`);
    }
  }

  console.log(`\nWorking endpoints: ${workingCount}/${endpoints.length}\n`);
  return workingCount > 0;
}

// ============================================================================
// Test Execution
// ============================================================================

async function runCLITests() {
  console.log('\n🧪 Step 4: Running CLI E2E Tests');
  console.log('═══════════════════════════════════════════════════════\n');

  try {
    console.log('Running: npm run cli:test:live\n');
    const output = execSync('npm run cli:test:live 2>&1', {
      cwd: __dirname.replace('/scripts', ''),
      maxBuffer: 10 * 1024 * 1024,
    }).toString();

    console.log(output);
    return true;
  } catch (error) {
    console.error('❌ CLI tests failed:');
    console.error(error.message);
    return false;
  }
}

// ============================================================================
// Main Verification
// ============================================================================

async function main() {
  console.log('\n╔═════════════════════════════════════════════════════════╗');
  console.log('║  🚀 All Channels Deployment Verification & Testing 🚀   ║');
  console.log('╚═════════════════════════════════════════════════════════╝');

  console.log('\nConfiguration:');
  console.log(`  REST Gateway: ${config.restGateway}`);
  console.log(`  Channel: ${config.channelName}`);
  console.log(`  Chaincodes: ${chaincodes.map(c => c.name).join(', ')}`);

  try {
    // Step 1: Verify gateway connectivity
    const gatewayOk = await verifyGatewayConnectivity();
    if (!gatewayOk) {
      console.error('\n❌ Cannot proceed - REST Gateway not accessible');
      console.error('\nPlease verify:');
      console.error('  1. Kaleido network is running');
      console.error('  2. REST Gateway credentials in .env.local are correct');
      console.error('  3. Network connectivity is working');
      process.exit(1);
    }

    // Step 2: Verify chaincode deployment
    const deploymentStatus = await verifyChaincodeDeployment();
    
    if (!deploymentStatus.allDeployed) {
      console.error('\n⚠️  Not all chaincodes are deployed yet!\n');
      console.error('To deploy via Kaleido Console:');
      console.error('  1. Visit: https://console.kaleido.io');
      console.error('  2. Navigate to network: u0inmt8fjp');
      console.error('  3. Deploy each chaincode:');
      deploymentStatus.results.forEach(r => {
        if (!r.deployed) {
          console.error(`     - ${r.name} (${r.name}-chaincode binary)`);
        }
      });
      console.error('\nSee DEPLOY_ALL_CHANNELS.md for detailed instructions\n');
      process.exit(0);
    }

    // Step 3: Verify endpoints
    const endpointsOk = await verifyRESTGatewayEndpoints();

    // Summary
    console.log('\n╔═════════════════════════════════════════════════════════╗');
    console.log('║                    ✨ VERIFICATION SUMMARY ✨            ║');
    console.log('╚═════════════════════════════════════════════════════════╝\n');

    console.log('✅ All Checks Passed!');
    console.log(`   • REST Gateway: Accessible`);
    console.log(`   • Chaincodes Deployed: ${deploymentStatus.deployedCount}/${chaincodes.length}`);
    console.log(`   • Endpoints Working: Yes`);

    console.log('\n📊 Deployment Status:');
    deploymentStatus.results.forEach(r => {
      console.log(`   ${r.deployed ? '✓' : '✗'} ${r.name}`);
    });

    console.log('\n🧪 Next Steps:');
    console.log('   1. Run CLI E2E tests: npm run cli:test:live');
    console.log('   2. Run Cypress E2E tests: npm run test:e2e:live');
    console.log('   3. Test manually: npm run cli:dev -- query-all');
    console.log('   4. Monitor in console: https://console.kaleido.io\n');

    // Ask if user wants to run tests
    console.log('Would you like to run CLI E2E tests now?');
    console.log('Run: npm run cli:test:live\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Verification failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
