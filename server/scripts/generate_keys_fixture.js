#!/usr/bin/env node
/*
 Generates two test certificates using the Flashback client binary (no node-forge)
 and writes them to cypress/fixtures/keys.json so Cypress specs can consume them
 as a fixture.

 Usage:
   node scripts/generate_keys_fixture.js [--out path] [--verify]

 Defaults:
   --out       cypress/fixtures/keys.json

 Notes:
 - This script uses the client CLI to generate certs, mirroring the E2E flow.
 - Output JSON structure (server-side fixtures):
   {
     "certPem": string,
     "certPem2": string,
     "publicKeyHash": string,
     "publicKeyHash2": string,
     "privateKey": string,
     "privateKey2": string
   }
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

function parseArgs(argv) {
    const args = { out: 'cypress/fixtures/keys.json', verify: false };
    for (let i = 2; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--out' && i + 1 < argv.length) { args.out = argv[++i]; continue; }
        if (a === '--verify') { args.verify = true; continue; }
        if (a === '--help' || a === '-h') { args.help = true; }
    }
    return args;
}

function usage() {
    console.log(`Generate Cypress keys fixture (via client CLI)\n\n` +
        `Options:\n` +
        `  --out <path>       Output file path (default: cypress/fixtures/keys.json)\n` +
        `  --verify           After writing, read back and sanity-check the file\n` +
        `  -h, --help         Show this help\n`);
}

function ensureDirFor(filePath) {
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });
}

function writeJson(filePath, data) {
    ensureDirFor(filePath);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function waitForFile(filePath, timeoutMs = 15000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        try {
            const stat = fs.statSync(filePath);
            if (stat && stat.size >= 0) return true;
        } catch { /* not yet */ }
        await sleep(100);
    }
    throw new Error(`Timeout waiting for file: ${filePath}`);
}

function findClientBinary(rootDir) {
    // Prefer debug build
    const debugUnix = path.join(rootDir, 'client', 'src-tauri', 'target', 'debug', 'client');
    const debugWin = debugUnix + '.exe';
    if (fs.existsSync(debugUnix)) return debugUnix;
    if (fs.existsSync(debugWin)) return debugWin;
    return null;
}

async function buildClient(rootDir) {
    return new Promise((resolve, reject) => {
        const cargo = process.platform === 'win32' ? 'cargo.exe' : 'cargo';
        const child = spawn(cargo, ['build', '--manifest-path', path.join(rootDir, 'client', 'src-tauri', 'Cargo.toml')], {
            stdio: 'inherit',
            cwd: rootDir,
        });
        child.on('exit', (code) => {
            if (code === 0) resolve(undefined);
            else reject(new Error(`cargo build failed with code ${code}`));
        });
        child.on('error', reject);
    });
}

function startClient(clientBin, logsDir, name) {
    const env = { ...process.env, WDIO_LOGS_DIR: logsDir, CLIENT_DEBUG: '1' };
    const child = spawn(clientBin, ['--cli'], { stdio: ['pipe', 'pipe', 'pipe'], env });
    // Attach simple logging to files for debugging
    try {
        const logPath = path.join(logsDir, `keys-gen-${name}.log`);
        const ws = fs.createWriteStream(logPath, { flags: 'a' });
        const write = (data) => { try { ws.write(data); } catch {} };
        child.stdout.on('data', write);
        child.stderr.on('data', write);
        child.on('exit', (code, sig) => { try { ws.write(`\n[proc ${name}] exit code=${code} sig=${sig}\n`); ws.end(); } catch {} });
    } catch {}
    return child;
}

function ensureCleanDir(dirPath) {
    try {
        const st = fs.statSync(dirPath);
        if (st.isFile()) {
            // Remove file that blocks directory creation
            fs.unlinkSync(dirPath);
        }
    } catch {
        // does not exist; that's fine
    }
    // Ensure directory exists
    fs.mkdirSync(dirPath, { recursive: true });
}

async function genCertFor(child, email, outDir) {
    // Ensure the output directory exists and is a directory
    ensureCleanDir(outDir);
    // Set the client's certificatePath to outDir/certificate.pem, then generate
    child.stdin.write(`set-cert-path ${path.join(outDir, 'certificate.pem')}\n`);
    // Small delay to allow config write
    await sleep(50);
    child.stdin.write(`gen-cert ${email}\n`);
}

async function gracefulExit(child) {
    try { child.stdin.write('exit\n'); } catch {}
    // give it a moment to exit
    await new Promise((res) => setTimeout(res, 200));
    if (!child.killed) {
        try { child.kill(); } catch {}
    }
}

function readTrim(filePath) {
    return fs.readFileSync(filePath, 'utf8').toString().trim();
}

function verifyFixture(filePath) {
    const raw = fs.readFileSync(filePath, 'utf8');
    const obj = JSON.parse(raw);
    const expected = ['certPem', 'certPem2', 'publicKeyHash', 'publicKeyHash2', 'privateKey', 'privateKey2'];
    const ok = expected.every((k) => Object.prototype.hasOwnProperty.call(obj, k) && typeof obj[k] === 'string');
    if (!ok) {
        throw new Error(`Fixture at ${filePath} is missing required fields: ${expected.join(', ')}`);
    }
}

async function main() {
    const args = parseArgs(process.argv);
    if (args.help) { usage(); return; }

    // Resolve repo root (server/scripts -> ../../)
    const rootDir = path.resolve(__dirname, '..', '..');
    const logsDir = path.join(rootDir, 'wdio-logs', '.log');
    fs.mkdirSync(logsDir, { recursive: true });

    // Ensure client binary exists (build if necessary)
    let clientBin = findClientBinary(rootDir);
    if (!clientBin) {
        console.log('Client binary not found. Building with cargo...');
        await buildClient(rootDir);
        clientBin = findClientBinary(rootDir);
        if (!clientBin) throw new Error('Client binary not found after build');
    }

    // Start two client processes
    console.log('Starting client A and B (CLI mode) ...');
    const clientA = startClient(clientBin, logsDir, 'A');
    const clientB = startClient(clientBin, logsDir, 'B');

    const ts = new Date().toISOString().replace(/[-:.TZ]/g, '');
    const emailA = `testA@test.com`;
    const emailB = `testB@test.com`;

    const dirA = path.join(logsDir, 'clientA');
    const dirB = path.join(logsDir, 'clientB');
    const pemAPath = path.join(dirA, 'certificate.pem');
    const pemBPath = path.join(dirB, 'certificate.pem');
    const privAPath = path.join(dirA, 'private.key');
    const privBPath = path.join(dirB, 'private.key');

    // Give the clients a moment to initialize their stdin readers
    await sleep(1000);
    await genCertFor(clientA, emailA, dirA);
    await genCertFor(clientB, emailB, dirB);

    // Wait for key files (retry gen-cert once if they don't appear quickly)
    try {
        await waitForFile(pemAPath, 15000);
    } catch {
        // Retry once
        await genCertFor(clientA, emailA, dirA);
        await waitForFile(pemAPath, 15000);
    }
    try {
        await waitForFile(pemBPath, 15000);
    } catch {
        await genCertFor(clientB, emailB, dirB);
        await waitForFile(pemBPath, 15000);
    }
    await waitForFile(privAPath, 15000);
    await waitForFile(privBPath, 15000);

    const certPem = readTrim(pemAPath);
    const certPem2 = readTrim(pemBPath);
    const privateKey = readTrim(privAPath);
    const privateKey2 = readTrim(privBPath);

    // PKH files are written into the specified directories as publicKeyHash.txt
    const pkhAPath = path.join(dirA, 'publicKeyHash.txt');
    const pkhBPath = path.join(dirB, 'publicKeyHash.txt');

    await waitForFile(pkhAPath, 15000);
    await waitForFile(pkhBPath, 15000);

    const publicKeyHash = readTrim(pkhAPath).toLowerCase();
    const publicKeyHash2 = readTrim(pkhBPath).toLowerCase();

    const outPath = path.resolve(process.cwd(), args.out);
    const data = { certPem, certPem2, publicKeyHash, publicKeyHash2, privateKey, privateKey2 };
    writeJson(outPath, data);
    console.log(`Fixture written: ${outPath}`);

    if (args.verify) {
        verifyFixture(outPath);
        console.log('Verification passed: fixture has required fields.');
    }

    await gracefulExit(clientA);
    await gracefulExit(clientB);
}

main().catch((err) => {
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
});
