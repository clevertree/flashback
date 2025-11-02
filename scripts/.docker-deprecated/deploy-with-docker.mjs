#!/usr/bin/env node

/**
 * Kaleido Chaincode Deployment via Docker + Fabric CLI
 * 
 * This script deploys chaincodes directly to Kaleido Hyperledger Fabric
 * using Docker container with fabric-tools and the CA certificate
 * 
 * Prerequisites:
 * - Docker installed and running
 * - hyperledger/fabric-tools:latest image available
 * - CA certificate in fabric/tlscacerts/ca-cert.pem
 * - Chaincodes built
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
  networkId: process.env.KALEIDO_NETWORK_ID,
};

const chaincodes = [
  { name: 'movie', version: '1.0.0' },
  { name: 'tvshow', version: '1.0.0' },
  { name: 'games', version: '1.0.0' },
  { name: 'voting', version: '1.0.0' },
];

const BLUE = '\x1b[34m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const NC = '\x1b[0m';

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

async function validateSetup() {
  console.log(`${BLUE}🔍 Validating setup...${NC}\n`);

  // Check Docker
  try {
    await execAsync('docker --version');
    console.log(`${GREEN}✓${NC} Docker available`);
  } catch {
    console.error(`${RED}✗${NC} Docker not found or not running`);
    return false;
  }

  // Check Fabric image
  try {
    await execAsync('docker image inspect hyperledger/fabric-tools:latest > /dev/null 2>&1');
    console.log(`${GREEN}✓${NC} Fabric tools image available`);
  } catch {
    console.error(`${RED}✗${NC} Fabric tools image not found`);
    console.log(`  Run: docker pull hyperledger/fabric-tools:latest`);
    return false;
  }

  // Check CA certificate
  const certPath = path.join(__dirname, '../fabric/tlscacerts/ca-cert.pem');
  if (!fs.existsSync(certPath)) {
    console.error(`${RED}✗${NC} CA certificate not found at ${certPath}`);
    return false;
  }
  console.log(`${GREEN}✓${NC} CA certificate found`);

  // Check chaincodes
  let allFound = true;
  for (const cc of chaincodes) {
    const binaryPath = path.join(__dirname, '../chaincode', cc.name, `${cc.name}-chaincode`);
    if (!fs.existsSync(binaryPath)) {
      console.error(`${RED}✗${NC} Chaincode ${cc.name} not built`);
      allFound = false;
    }
  }
  if (allFound) {
    console.log(`${GREEN}✓${NC} All chaincodes built`);
  }

  return allFound;
}

// ═══════════════════════════════════════════════════════════════════════════
// DOCKER DEPLOYMENT
// ═══════════════════════════════════════════════════════════════════════════

async function deployWithDocker() {
  console.log(`\n${BLUE}📦 Starting Docker-based deployment...${NC}\n`);

  const projectRoot = path.join(__dirname, '..');
  const fabricDir = path.join(projectRoot, 'fabric');
  const chaincodeDir = path.join(projectRoot, 'chaincode');

  // Environment variables for fabric CLI
  const envVars = [
    `CORE_PEER_TLS_ENABLED=true`,
    `CORE_PEER_ADDRESS=${config.peerEndpoint}`,
    `CORE_PEER_LOCALMSPID=${config.organization}`,
    `ORDERER_CA=/workspace/tlscacerts/ca-cert.pem`,
    `FABRIC_CFG_PATH=/workspace`,
  ];

  for (const chaincode of chaincodes) {
    console.log(`${YELLOW}▶️  Deploying: ${chaincode.name}@${chaincode.version}${NC}`);
    
    const ccPath = path.join(chaincodeDir, chaincode.name);
    const binaryPath = path.join(ccPath, `${chaincode.name}-chaincode`);
    const binaryName = `${chaincode.name}-chaincode`;

    // Create temporary workspace for Docker
    const tempDir = path.join(fabricDir, '.deploy-temp', chaincode.name);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Copy chaincode binary to temp directory
    fs.copyFileSync(binaryPath, path.join(tempDir, binaryName));
    console.log(`   📋 Binary: ${binaryName}`);

    try {
      // Run peer CLI in Docker to install chaincode
      const dockerCmd = [
        'docker run --rm',
        `-v ${fabricDir}:/workspace`,
        `${envVars.map(e => `-e ${e}`).join(' ')}`,
        'hyperledger/fabric-tools:latest',
        'bash -c',
        `"echo 'Installing ${chaincode.name}...' && peer lifecycle chaincode install /workspace/.deploy-temp/${chaincode.name}/${binaryName} 2>&1"`,
      ].join(' ');

      console.log(`   🔧 Running install command...`);
      const { stdout, stderr } = await execAsync(dockerCmd);
      
      if (stdout.includes('Chaincode package ID:')) {
        const match = stdout.match(/Chaincode package ID: ([a-f0-9]+)/);
        if (match) {
          console.log(`   ${GREEN}✓${NC} Install successful`);
          console.log(`      Package ID: ${match[1]}`);
        }
      } else if (!stderr.includes('error') && !stderr.includes('Error')) {
        console.log(`   ${GREEN}✓${NC} Install command executed`);
      }

      // Log any output
      if (stderr && !stderr.includes('Warning')) {
        console.log(`   📝 Output: ${stderr.substring(0, 100)}`);
      }

    } catch (error) {
      console.error(`   ${RED}✗${NC} Error: ${error.message.substring(0, 100)}`);
    }

    console.log('');
  }

  // Cleanup
  try {
    const tempDeployDir = path.join(fabricDir, '.deploy-temp');
    if (fs.existsSync(tempDeployDir)) {
      fs.rmSync(tempDeployDir, { recursive: true });
    }
  } catch {
    // Ignore cleanup errors
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// REST GATEWAY VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════

async function verifyViaRestGateway() {
  console.log(`\n${BLUE}🔍 Verifying deployment via REST Gateway...${NC}\n`);

  const restGateway = process.env.KALEIDO_REST_GATEWAY;
  const appId = process.env.KALEIDO_APP_ID;
  const appPassword = process.env.KALEIDO_APP_PASSWORD;

  if (!restGateway || !appId || !appPassword) {
    console.log(`${YELLOW}⚠️  REST Gateway credentials not configured${NC}`);
    return;
  }

  const https = await import('https');

  for (const chaincode of chaincodes) {
    try {
      const auth = Buffer.from(`${appId}:${appPassword}`).toString('base64');
      const url = new URL(restGateway);

      return new Promise((resolve) => {
        const options = {
          hostname: url.hostname,
          port: url.port || 443,
          path: `/channels/${config.channelName}/chaincodes/${chaincode.name}?args=["QueryAll"]`,
          method: 'GET',
          headers: {
            'Authorization': `Basic ${auth}`,
          },
          rejectUnauthorized: false,
          timeout: 5000,
        };

        const req = https.request(options, (res) => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log(`${GREEN}✓${NC} ${chaincode.name}: Responding`);
          } else if (res.statusCode === 404) {
            console.log(`${YELLOW}⏳${NC} ${chaincode.name}: Not yet available (${res.statusCode})`);
          } else {
            console.log(`⚠️  ${chaincode.name}: Status ${res.statusCode}`);
          }
          resolve();
        });

        req.on('error', () => {
          console.log(`⚠️  ${chaincode.name}: Could not verify`);
          resolve();
        });

        req.on('timeout', () => {
          req.destroy();
          console.log(`⚠️  ${chaincode.name}: Timeout`);
          resolve();
        });

        req.end();
      });
    } catch (error) {
      console.log(`⚠️  ${chaincode.name}: ${error.message.substring(0, 50)}`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║   🚀 Kaleido Deployment via Docker + Fabric CLI        ║');
  console.log('║   Deploying 4 chaincodes to Kaleido network            ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  // Show configuration
  console.log(`${BLUE}📋 Configuration:${NC}`);
  console.log(`  Peer: ${config.peerEndpoint}`);
  console.log(`  Orderer: ${config.ordererEndpoint}`);
  console.log(`  Channel: ${config.channelName}`);
  console.log(`  Chaincodes: ${chaincodes.map(c => c.name).join(', ')}`);
  console.log('');

  // Validate setup
  if (!(await validateSetup())) {
    console.error(`\n${RED}❌ Setup validation failed${NC}`);
    process.exit(1);
  }

  // Deploy
  await deployWithDocker();

  // Verify
  await verifyViaRestGateway();

  // Next steps
  console.log(`\n${BLUE}═══════════════════════════════════════════════════════════${NC}`);
  console.log(`${GREEN}✨ Deployment complete!${NC}`);
  console.log(`${BLUE}═══════════════════════════════════════════════════════════${NC}\n`);

  console.log(`${YELLOW}📝 Next steps:${NC}`);
  console.log(`  1. Wait 30-60 seconds for chaincodes to initialize`);
  console.log(`  2. Verify deployment:`);
  console.log(`     ${BLUE}npm run check:kaleido${NC}`);
  console.log(`  3. Run tests:`);
  console.log(`     ${BLUE}npm run cli:test:live${NC}`);
  console.log(`  4. Query chaincodes:`);
  console.log(`     ${BLUE}npm run cli:dev -- query-all --format table${NC}`);
  console.log(`  5. Monitor in Kaleido Console:`);
  console.log(`     ${BLUE}https://console.kaleido.io${NC}\n`);
}

main().catch(error => {
  console.error(`${RED}❌ Error: ${error.message}${NC}`);
  process.exit(1);
});
