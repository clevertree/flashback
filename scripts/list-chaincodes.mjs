#!/usr/bin/env node

/**
 * List Deployed Chaincodes
 * Queries Kaleido REST Gateway to list all deployed chaincodes
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
};

function httpsRequest(url, method = 'GET', headers = {}) {
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
      timeout: 10000,
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
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

async function listChaincodes() {
  console.log('\n🔍 Fetching Deployed Chaincodes');
  console.log('═══════════════════════════════════════════════\n');

  console.log(`📍 REST Gateway: ${config.restGateway}`);
  console.log(`📍 Channel: ${config.channelName}\n`);

  try {
    const auth = Buffer.from(`${config.appId}:${config.appPassword}`).toString('base64');

    // Try to get list of deployed chaincodes
    const url = `${config.restGateway}/channels/${config.channelName}/chaincodes`;
    
    console.log(`⏳ Querying: GET ${url}\n`);

    const response = await httpsRequest(
      url,
      'GET',
      {
        'Authorization': `Basic ${auth}`,
      }
    );

    console.log(`📊 Response Status: ${response.status}\n`);

    if (response.status === 200) {
      console.log('✅ Successfully Retrieved Chaincodes\n');
      
      if (response.body) {
        if (Array.isArray(response.body)) {
          console.log(`Found ${response.body.length} chaincode(s):\n`);
          response.body.forEach((cc, index) => {
            console.log(`${index + 1}. ${cc.name || 'unknown'}`);
            if (cc.version) console.log(`   Version: ${cc.version}`);
            if (cc.id) console.log(`   ID: ${cc.id}`);
            if (cc.path) console.log(`   Path: ${cc.path}`);
          });
        } else if (response.body.chaincodes) {
          const ccs = response.body.chaincodes;
          console.log(`Found ${ccs.length} chaincode(s):\n`);
          ccs.forEach((cc, index) => {
            console.log(`${index + 1}. ${cc.name || 'unknown'}`);
            if (cc.version) console.log(`   Version: ${cc.version}`);
            if (cc.id) console.log(`   ID: ${cc.id}`);
          });
        } else {
          console.log('Response Body:');
          console.log(JSON.stringify(response.body, null, 2));
        }
      } else {
        console.log('✓ No chaincodes found (empty response)');
      }
    } else if (response.status === 404) {
      console.log('⚠️  Endpoint not found (404)\n');
      console.log('This is expected if the REST Gateway hasn\'t been properly configured');
      console.log('or if the chaincodes haven\'t been deployed yet.\n');
      
      // Try alternative endpoint
      console.log('Trying alternative endpoint...\n');
      
      const altUrl = `${config.restGateway}/channels/${config.channelName}/chaincode`;
      console.log(`⏳ Querying: GET ${altUrl}\n`);

      const altResponse = await httpsRequest(
        altUrl,
        'GET',
        {
          'Authorization': `Basic ${auth}`,
        }
      );

      if (altResponse.status === 200) {
        console.log('✅ Alternative endpoint successful\n');
        console.log(JSON.stringify(altResponse.body, null, 2));
      } else {
        console.log(`Alternative endpoint also returned ${altResponse.status}`);
        console.log(`Response: ${altResponse.raw.substring(0, 200)}`);
      }
    } else {
      console.log(`❌ Error (${response.status})\n`);
      console.log(`Response: ${response.raw.substring(0, 300)}`);
    }

    console.log('\n');

  } catch (error) {
    console.error(`❌ Error: ${error.message}\n`);
    process.exit(1);
  }
}

listChaincodes().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
