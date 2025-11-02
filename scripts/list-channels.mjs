#!/usr/bin/env node

/**
 * List Deployed Channels
 * Queries Kaleido REST Gateway to list all deployed channels
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

async function listChannels() {
  console.log('\n🔍 Fetching Deployed Channels');
  console.log('═══════════════════════════════════════════════\n');

  console.log(`📍 REST Gateway: ${config.restGateway}\n`);

  try {
    const auth = Buffer.from(`${config.appId}:${config.appPassword}`).toString('base64');

    // Try main channels endpoint
    const url = `${config.restGateway}/channels`;
    
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
      console.log('✅ Successfully Retrieved Channels\n');
      
      if (response.body) {
        if (Array.isArray(response.body)) {
          console.log(`Found ${response.body.length} channel(s):\n`);
          response.body.forEach((channel, index) => {
            console.log(`${index + 1}. ${channel.name || channel.channel_name || channel.id || 'unknown'}`);
            if (channel.id) console.log(`   ID: ${channel.id}`);
            if (channel.version) console.log(`   Version: ${channel.version}`);
            if (channel.height) console.log(`   Block Height: ${channel.height}`);
            if (channel.status) console.log(`   Status: ${channel.status}`);
          });
        } else if (response.body.channels) {
          const channels = response.body.channels;
          console.log(`Found ${channels.length} channel(s):\n`);
          channels.forEach((channel, index) => {
            console.log(`${index + 1}. ${channel.name || channel}`);
          });
        } else {
          console.log('Response Body:');
          console.log(JSON.stringify(response.body, null, 2));
        }
      } else {
        console.log('✓ No channels found (empty response)');
      }
    } else if (response.status === 404) {
      console.log('⚠️  Channels endpoint not found (404)\n');
      console.log('Trying alternative endpoints...\n');
      
      // Try alternative endpoints
      const alternatives = [
        `${config.restGateway}/channel`,
        `${config.restGateway}/v1/channels`,
        `${config.restGateway}/api/v1/channels`,
      ];

      for (const altUrl of alternatives) {
        console.log(`⏳ Trying: GET ${altUrl}`);
        
        const altResponse = await httpsRequest(
          altUrl,
          'GET',
          {
            'Authorization': `Basic ${auth}`,
          }
        );

        if (altResponse.status === 200) {
          console.log(`✅ Found working endpoint!\n`);
          console.log(JSON.stringify(altResponse.body, null, 2));
          return;
        } else {
          console.log(`   Status: ${altResponse.status}`);
        }
      }

      console.log('\n⚠️  None of the alternative endpoints worked');
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

listChannels().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
