#!/usr/bin/env node

/**
 * Direct Kaleido Deployment - Alternative Methods
 * 
 * Since Kaleido Console and Consortium API are unavailable,
 * this script provides alternative deployment methods:
 * 
 * 1. Via Fabric peer CLI (if installed)
 * 2. Via Docker + Fabric CLI
 * 3. Generate deployment commands for manual execution
 * 4. Via REST Gateway inspection
 */

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execAsync = promisify(exec);

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
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
  peerEndpoint: process.env.KALEIDO_PEER_ENDPOINT,
  ordererEndpoint: process.env.KALEIDO_ORDERER_ENDPOINT,
  organization: process.env.KALEIDO_ORGANIZATION,
  channelName: process.env.KALEIDO_CHANNEL_NAME,
  mspId: process.env.KALEIDO_ORGANIZATION,
  networkId: process.env.KALEIDO_NETWORK_ID,
  restGateway: process.env.KALEIDO_REST_GATEWAY,
};

const chaincodes = [
  { name: 'movie', version: '1.0.0' },
  { name: 'tvshow', version: '1.0.0' },
  { name: 'games', version: '1.0.0' },
  { name: 'voting', version: '1.0.0' },
];

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

async function checkToolAvailability() {
  const tools = {};

  // Check for peer CLI
  try {
    const { stdout } = await execAsync('peer version');
    tools.peer = true;
    console.log('✓ peer CLI available');
  } catch {
    tools.peer = false;
  }

  // Check for docker
  try {
    await execAsync('docker --version');
    tools.docker = true;
    console.log('✓ Docker available');
  } catch {
    tools.docker = false;
  }

  // Check for fabric image
  if (tools.docker) {
    try {
      await execAsync('docker image inspect hyperledger/fabric-tools:latest 2>/dev/null || echo "not found"');
      tools.fabricImage = true;
      console.log('✓ Hyperledger Fabric Docker image available');
    } catch {
      tools.fabricImage = false;
    }
  }

  return tools;
}

async function testRESTGateway() {
  console.log('\n🔍 Testing REST Gateway...');
  
  try {
    const https = await import('https');
    
    return new Promise((resolve) => {
      const options = {
        hostname: new URL(config.restGateway).hostname,
        port: 443,
        path: '/',
        method: 'GET',
        rejectUnauthorized: false,
        timeout: 5000,
      };

      const req = https.request(options, (res) => {
        console.log(`  ✓ REST Gateway responding (${res.statusCode})`);
        resolve(true);
      });

      req.on('error', (error) => {
        console.log(`  ❌ REST Gateway error: ${error.message}`);
        resolve(false);
      });

      req.on('timeout', () => {
        req.destroy();
        console.log('  ❌ REST Gateway timeout');
        resolve(false);
      });

      req.end();
    });
  } catch (error) {
    console.log(`  ⚠️  Error: ${error.message}`);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DEPLOYMENT METHODS
// ═══════════════════════════════════════════════════════════════════════════

function generateDeploymentCommands() {
  console.log('\n📋 Generated Deployment Commands\n');
  
  const commands = [];

  for (const cc of chaincodes) {
    const ccPath = path.join(__dirname, '../chaincode', cc.name);
    const binaryPath = path.join(ccPath, `${cc.name}-chaincode`);

    if (!fs.existsSync(binaryPath)) {
      console.log(`⚠️  ${cc.name}: Binary not found`);
      continue;
    }

    console.log(`\n${'='.repeat(70)}`);
    console.log(`CHAINCODE: ${cc.name}@${cc.version}`);
    console.log(`${'='.repeat(70)}\n`);

    // Environment variables
    const envVars = [
      'export CORE_PEER_TLS_ENABLED="true"',
      `export CORE_PEER_ADDRESS="${config.peerEndpoint}"`,
      `export CORE_PEER_LOCALMSPID="${config.mspId}"`,
      `export ORDERER_CA="./fabric/tlscacerts/orderer.pem"`,
    ];

    envVars.forEach(v => console.log(v));

    // Install command
    console.log('\n# 1. Install chaincode');
    console.log(`peer lifecycle chaincode install \\`);
    console.log(`  --channelID ${config.channelName} \\`);
    console.log(`  --name ${cc.name} \\`);
    console.log(`  --version ${cc.version} \\`);
    console.log(`  --lang golang \\`);
    console.log(`  --path ${binaryPath}`);

    // Query installed
    console.log('\n# 2. Query installed chaincodes');
    console.log('peer lifecycle chaincode queryinstalled');

    // Approve for org
    console.log('\n# 3. Approve chaincode for organization');
    console.log(`peer lifecycle chaincode approveformyorg \\`);
    console.log(`  --channelID ${config.channelName} \\`);
    console.log(`  --name ${cc.name} \\`);
    console.log(`  --version ${cc.version} \\`);
    console.log(`  --package-id <PACKAGE_ID_FROM_STEP_2> \\`);
    console.log(`  --sequence 1 \\`);
    console.log(`  --tls --tlsRootCertFiles ./fabric/tlscacerts/orderer.pem`);

    // Check commit readiness
    console.log('\n# 4. Check commit readiness');
    console.log(`peer lifecycle chaincode checkcommitreadiness \\`);
    console.log(`  --channelID ${config.channelName} \\`);
    console.log(`  --name ${cc.name} \\`);
    console.log(`  --version ${cc.version} \\`);
    console.log(`  --sequence 1 \\`);
    console.log(`  --tls --tlsRootCertFiles ./fabric/tlscacerts/orderer.pem`);

    // Commit
    console.log('\n# 5. Commit chaincode definition');
    console.log(`peer lifecycle chaincode commit \\`);
    console.log(`  --channelID ${config.channelName} \\`);
    console.log(`  --name ${cc.name} \\`);
    console.log(`  --version ${cc.version} \\`);
    console.log(`  --sequence 1 \\`);
    console.log(`  --tls --tlsRootCertFiles ./fabric/tlscacerts/orderer.pem`);

    commands.push(cc.name);
  }

  return commands;
}

function showAlternativeMethods() {
  console.log('\n' + '='.repeat(70));
  console.log('🔧 ALTERNATIVE DEPLOYMENT METHODS');
  console.log('='.repeat(70));

  console.log(`\n${BLUE}Method 1: Using Fabric peer CLI (if installed)${NC}`);
  console.log(`
  1. Install peer CLI:
     brew tap hyperledger/fabric
     brew install fabric-tools

  2. Set environment variables from your .env.local
  
  3. Run deployment commands generated above
  
  4. Verify with:
     peer lifecycle chaincode queryinstalled
`);

  console.log(`\n${BLUE}Method 2: Using Docker${NC}`);
  console.log(`
  1. Install Docker: https://docker.com
  
  2. Run Fabric CLI in container:
     docker run -it --rm \\
       -v /path/to/certs:/certs \\
       -e CORE_PEER_ADDRESS=${config.peerEndpoint} \\
       hyperledger/fabric-tools:latest \\
       peer lifecycle chaincode install ...
`);

  console.log(`\n${BLUE}Method 3: Manual via Kaleido Console${NC}`);
  console.log(`
  1. Go to: https://console.kaleido.io
  2. Select network: ${config.networkId}
  3. Find "Deploy Chaincode" or "Chaincodes" section
  4. For each chaincode, fill in:
     - Name: movie, tvshow, games, voting
     - Version: 1.0.0
     - Language: Go
     - Upload binary or source
  5. Deploy to channel: ${config.channelName}
`);

  console.log(`\n${BLUE}Method 4: Contact Kaleido Support${NC}`);
  console.log(`
  If Consortium API has permission issues:
  1. Log in to https://console.kaleido.io
  2. Click Help or Support
  3. Request Consortium API access for your account
  4. Once enabled, run: npm run deploy:api
`);
}

function generateDockerDeploymentScript() {
  console.log('\n📦 Generating Docker Deployment Script...\n');

  const script = `#!/bin/bash
# Docker-based Kaleido Chaincode Deployment

PEER_ENDPOINT="${config.peerEndpoint}"
ORDERER_ENDPOINT="${config.ordererEndpoint}"
CHANNEL_NAME="${config.channelName}"
NETWORK_ID="${config.networkId}"

# Create temporary directory for certs
mkdir -p /tmp/fabric-deploy/certs

# Run Fabric CLI in Docker
docker run -it --rm \\
  -e CORE_PEER_TLS_ENABLED=true \\
  -e CORE_PEER_ADDRESS="\$PEER_ENDPOINT" \\
  -e CORE_PEER_LOCALMSPID="${config.mspId}" \\
  -v /tmp/fabric-deploy:/workspace \\
  hyperledger/fabric-tools:latest bash -c "
  
  # Install chaincodes
  peer lifecycle chaincode install /workspace/movie-chaincode
  peer lifecycle chaincode install /workspace/tvshow-chaincode
  peer lifecycle chaincode install /workspace/games-chaincode
  peer lifecycle chaincode install /workspace/voting-chaincode
  
  # Query installed
  peer lifecycle chaincode queryinstalled
"
`;

  const scriptPath = path.join(__dirname, 'deploy-docker.sh');
  fs.writeFileSync(scriptPath, script);
  console.log(`✓ Created: ${scriptPath}`);
  console.log('  Usage: bash scripts/deploy-docker.sh\n');
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

const BLUE = '\x1b[34m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const NC = '\x1b[0m';

async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║   🚀 Kaleido Direct Deployment - Alternative Methods    ║');
  console.log('║   Since Consortium API & Console are unavailable        ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  // Check configuration
  console.log(`${BLUE}📋 Configuration:${NC}`);
  console.log(`  Peer: ${config.peerEndpoint}`);
  console.log(`  Orderer: ${config.ordererEndpoint}`);
  console.log(`  Channel: ${config.channelName}`);
  console.log(`  Org MSP ID: ${config.mspId}`);
  console.log(`  Chaincodes: ${chaincodes.map(c => c.name).join(', ')}\n`);

  // Check tools
  console.log(`${BLUE}🔍 Checking available tools:${NC}`);
  const tools = await checkToolAvailability();

  if (!tools.peer && !tools.docker) {
    console.log(`${YELLOW}  ⚠️  Neither peer CLI nor Docker available${NC}`);
  }

  console.log('');

  // Test REST Gateway
  await testRESTGateway();

  // Show generated commands
  generateDeploymentCommands();

  // Create docker script
  if (tools.docker) {
    generateDockerDeploymentScript();
  }

  // Show alternatives
  showAlternativeMethods();

  console.log('\n' + '='.repeat(70));
  console.log(`${GREEN}📝 RECOMMENDED NEXT STEPS:${NC}`);
  console.log('='.repeat(70));

  if (tools.peer) {
    console.log(`\n1. ${GREEN}peer CLI is available!${NC}`);
    console.log('   Run the generated commands above to deploy chaincodes.');
  } else if (tools.docker) {
    console.log(`\n1. ${GREEN}Docker is available!${NC}`);
    console.log('   Run: bash scripts/deploy-docker.sh');
  } else {
    console.log(`\n1. ${YELLOW}Install either peer CLI or Docker${NC}`);
    console.log('   Then run the deployment commands shown above.');
  }

  console.log(`\n2. After deployment, verify with:`);
  console.log(`   npm run check:kaleido`);

  console.log(`\n3. Test chaincodes with:`);
  console.log(`   npm run cli:test:live\n`);
}

main().catch(error => {
  console.error(`${RED}Error: ${error.message}${NC}`);
  process.exit(1);
});
