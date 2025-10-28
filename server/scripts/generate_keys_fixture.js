#!/usr/bin/env node
/*
 Generates two test keypairs and certificates and writes them to
 cypress/fixtures/keys.json so Cypress specs can consume them as a fixture.

 Usage:
   node scripts/generate_keys_fixture.js [--out path] [--password pwd] [--bits 2048] [--verify]

 Defaults:
   --out       cypress/fixtures/keys.json
   --password  test-password-123
   --bits      2048

 Notes:
 - The output JSON structure matches what the Cypress specs expect:
   {
     "certPem": string,
     "certPem2": string,
     "privateKeyPem": string,
     "privateKeyPem2": string
   }
 - "certPem" here contains the DER bytes string of a PKCS#12 (PFX) package, to
   match the existing test utility. This is NOT a PEM string despite the name.
*/

const fs = require('fs');
const path = require('path');
const forge = require('node-forge');

function parseArgs(argv) {
    const args = {out: 'cypress/fixtures/keys.json', password: 'test-password-123', bits: 2048, verify: false};
    for (let i = 2; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--out' && i + 1 < argv.length) {
            args.out = argv[++i];
            continue;
        }
        if (a === '--password' && i + 1 < argv.length) {
            args.password = argv[++i];
            continue;
        }
        if (a === '--bits' && i + 1 < argv.length) {
            args.bits = parseInt(argv[++i], 10) || 2048;
            continue;
        }
        if (a === '--verify') {
            args.verify = true;
            continue;
        }
        if (a === '--help' || a === '-h') {
            args.help = true;
        }
    }
    return args;
}

function usage() {
    console.log(`Generate Cypress keys fixture\n\n` +
        `Options:\n` +
        `  --out <path>       Output file path (default: cypress/fixtures/keys.json)\n` +
        `  --password <pwd>   Password for PKCS#12 (default: test-password-123)\n` +
        `  --bits <n>         RSA key bits (default: 2048)\n` +
        `  --verify           After writing, read back and sanity-check the file\n` +
        `  -h, --help         Show this help\n`);
}

function generateUserKeysAndCert(email, password, bits, friendlyName) {
    const keys = forge.pki.rsa.generateKeyPair(bits);
    const certificate = forge.pki.createCertificate();
    certificate.publicKey = keys.publicKey;
    certificate.serialNumber = '01';
    certificate.validity.notBefore = new Date();
    certificate.validity.notAfter = new Date();
    certificate.validity.notAfter.setFullYear(certificate.validity.notBefore.getFullYear() + 99);

    const attrs = [{shortName: 'emailAddress', value: email}];
    certificate.setSubject(attrs);
    certificate.setIssuer(attrs);
    certificate.sign(keys.privateKey, forge.md.sha256.create());

    const pkcs12Asn1 = forge.pkcs12.toPkcs12Asn1(
        keys.privateKey,
        [certificate],
        password,
        {generateLocalKeyId: true, friendlyName}
    );

    return {
        getPrivateKeyPemString: () => forge.pki.privateKeyToPem(keys.privateKey),
        getCertPemString: () => forge.pki.certificateToPem(certificate),
        getCertString: () => forge.asn1.toDer(pkcs12Asn1).getBytes(),
    };
}

function ensureDirFor(filePath) {
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, {recursive: true});
}

function writeJson(filePath, data) {
    ensureDirFor(filePath);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function verifyFixture(filePath) {
    const raw = fs.readFileSync(filePath, 'utf8');
    const obj = JSON.parse(raw);
    const expected = ['certPem', 'certPem2', 'privateKeyPem', 'privateKeyPem2'];
    const ok = expected.every((k) => Object.prototype.hasOwnProperty.call(obj, k) && typeof obj[k] === 'string');
    if (!ok) {
        throw new Error(`Fixture at ${filePath} is missing required fields: ${expected.join(', ')}`);
    }
}

async function main() {
    const args = parseArgs(process.argv);
    if (args.help) {
        usage();
        return;
    }

    const email1 = 'test@test.com';
    const email2 = 'test2@test.com';
    const friendly = 'FlashBack Test';

    console.log(`Generating test keys (bits=${args.bits}) ...`);
    const kp1 = generateUserKeysAndCert(email1, args.password, args.bits, friendly);
    const kp2 = generateUserKeysAndCert(email2, args.password, args.bits, friendly);

    const data = {
        certPem: kp1.getCertString(),
        certPem2: kp2.getCertString(),
        privateKeyPem: kp1.getPrivateKeyPemString(),
        privateKeyPem2: kp2.getPrivateKeyPemString(),
    };

    writeJson(args.out, data);
    console.log(`Fixture written: ${args.out}`);

    if (args.verify) {
        verifyFixture(args.out);
        console.log('Verification passed: fixture has required fields.');
    }
}

main().catch((err) => {
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
});
