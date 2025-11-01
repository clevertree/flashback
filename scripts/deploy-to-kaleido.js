#!/usr/bin/env node

/**
 * Kaleido Chaincode Deployment Script
 * Deploys the movie chaincode to Kaleido Hyperledger Fabric network via REST Gateway API
 * 
 * Prerequisites:
 * - Chaincode must be built: cd chaincode/movie && go build -o movie-chaincode .
 * - .env.local must be configured with Kaleido credentials
 * 
 * Usage: node scripts/deploy-to-kaleido.js [--dry-run]
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
require('dotenv').config({ path: '.env.local' });

// Configuration from environment variables
const config = {
  restGateway: process.env.KALEIDO_REST_GATEWAY,
  appId: process.env.KALEIDO_APP_ID,
  appPassword: process.env.KALEIDO_APP_PASSWORD,
  channelName: process.env.KALEIDO_CHANNEL_NAME || 'default-channel',
  chaincodeId: 'movie',
  chaincodeVersion: '1.0.0',
  endorsementPolicy: 'OR("Org1MSP.peer")',
};

// Helper to make HTTPS requests
function httpRequest(method, url, data = null, auth = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      rejectUnauthorized: false, // For Kaleido self-signed certificates
    };

    if (auth) {
      options.headers['Authorization'] = `Bearer ${auth}`;
    }

    const protocol = urlObj.protocol === 'https:' ? https : require('http');
    const req = protocol.request(url, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : { status: res.statusCode };
          resolve({ statusCode: res.statusCode, body: parsed, headers: res.headers });
        } catch (e) {
          resolve({ statusCode: res.statusCode, body, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// Helper to create basic auth header
function getBasicAuth() {
  const credentials = `${config.appId}:${config.appPassword}`;
  return Buffer.from(credentials).toString('base64');
}

// Get or create the chaincode installation package
async function packageChaincode() {
  console.log('\n📦 Checking chaincode...');
  
  const chaincodeDir = path.join(__dirname, '../chaincode/movie');
  const chaincodePath = path.join(chaincodeDir, 'movie-chaincode');
  
  if (!fs.existsSync(chaincodePath)) {
    console.error('❌ Chaincode binary not found. Please build first:');
    console.error('   cd chaincode/movie && go build -o movie-chaincode .');
    process.exit(1);
  }
  
  console.log('✓ Chaincode binary found:', chaincodePath);
  console.log(`✓ Chaincode ID: ${config.chaincodeId}`);
  console.log(`✓ Chaincode version: ${config.chaincodeVersion}`);
  
  return {
    path: chaincodePath,
    id: config.chaincodeId,
    version: config.chaincodeVersion,
  };
}

// Install chaincode on peer
async function installChaincode(chaincode) {
  console.log('\n🔧 Installing chaincode on peer...');
  
  const url = `${config.restGateway}/chaincode/install`;
  const auth = getBasicAuth();
  
  const payload = {
    chaincodeName: chaincode.id,
    chaincodeVersion: chaincode.version,
    chaincodeType: 'golang',
    chaincodeSource: fs.readFileSync(chaincode.path),
  };

  try {
    const response = await httpRequest('POST', url, payload, auth);
    
    if (response.statusCode === 200 || response.statusCode === 201) {
      console.log('✓ Chaincode installed successfully');
      console.log('  Response:', response.body);
      return true;
    } else {
      console.error('❌ Installation failed:', response.statusCode);
      console.error('  Response:', response.body);
      return false;
    }
  } catch (error) {
    console.error('❌ Installation error:', error.message);
    return false;
  }
}

// Instantiate chaincode on channel
async function instantiateChaincode(chaincode) {
  console.log('\n⚡ Instantiating chaincode on channel...');
  
  const url = `${config.restGateway}/channels/${config.channelName}/chaincodes`;
  const auth = getBasicAuth();
  
  const payload = {
    chaincodeName: chaincode.id,
    chaincodeVersion: chaincode.version,
    chaincodeType: 'golang',
    args: ['Init'],
    endorsementPolicy: config.endorsementPolicy,
  };

  try {
    const response = await httpRequest('POST', url, payload, auth);
    
    if (response.statusCode === 200 || response.statusCode === 201 || response.statusCode === 202) {
      console.log('✓ Chaincode instantiated successfully');
      console.log('  Response:', response.body);
      return true;
    } else if (response.statusCode === 409) {
      console.log('ℹ Chaincode already instantiated');
      return true;
    } else {
      console.error('❌ Instantiation failed:', response.statusCode);
      console.error('  Response:', response.body);
      return false;
    }
  } catch (error) {
    console.error('❌ Instantiation error:', error.message);
    return false;
  }
}

// Test basic chaincode invocation
async function testChaincode() {
  console.log('\n✅ Testing chaincode invocation...');
  
  const url = `${config.restGateway}/channels/${config.channelName}/chaincodes/${config.chaincodeId}?args=["QueryAll"]`;
  const auth = getBasicAuth();
  
  try {
    const response = await httpRequest('GET', url, null, auth);
    
    if (response.statusCode === 200) {
      console.log('✓ Chaincode test successful');
      console.log('  Response:', response.body);
      return true;
    } else {
      console.error('❌ Chaincode test failed:', response.statusCode);
      console.error('  Response:', response.body);
      return false;
    }
  } catch (error) {
    console.error('❌ Test error:', error.message);
    return false;
  }
}

// Main deployment flow
async function deploy() {
  console.log('🚀 Kaleido Chaincode Deployment');
  console.log('================================\n');
  console.log('Configuration:');
  console.log(`  REST Gateway: ${config.restGateway}`);
  console.log(`  Channel: ${config.channelName}`);
  console.log(`  App ID: ${config.appId}`);
  
  const dryRun = process.argv.includes('--dry-run');
  if (dryRun) {
    console.log('\n⚠️  DRY RUN MODE - No changes will be made\n');
  }

  try {
    const chaincode = await packageChaincode();
    
    if (!dryRun) {
      const installed = await installChaincode(chaincode);
      if (!installed) {
        console.error('\n❌ Deployment failed at installation step');
        process.exit(1);
      }
      
      const instantiated = await instantiateChaincode(chaincode);
      if (!instantiated) {
        console.error('\n❌ Deployment failed at instantiation step');
        process.exit(1);
      }
      
      const tested = await testChaincode();
      if (!tested) {
        console.error('\n⚠️  Warning: Chaincode test failed, but deployment may still succeed');
      }
    }
    
    console.log('\n✨ Deployment complete!');
    console.log('\nNext steps:');
    console.log('  1. Update src-tauri/lib/api.ts with real Kaleido endpoints');
    console.log('  2. Run E2E tests: npm run test:e2e');
    console.log('  3. Monitor chaincode invocations in Kaleido console\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Deployment failed:', error.message);
    process.exit(1);
  }
}

// Run deployment
if (require.main === module) {
  deploy();
}

module.exports = { deploy, httpRequest, config };
