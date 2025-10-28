import forge from 'node-forge';

// TODO: format as ssh
export function loadPublicCertificate(
    certPem: string
) {

    // Parse the PEM string into a certificate object
    const certificate = forge.pki.certificateFromPem(certPem);
    // Subject (the owner of the certificate)
    const emailAttr = certificate.subject.attributes.find(attr =>
        attr.name === 'emailAddress');
    const email = emailAttr?.value as string | undefined;

// Get the DER-encoded certificate
    const derCertificate = forge.pki.certificateToAsn1(certificate);
    const der = forge.asn1.toDer(derCertificate).getBytes();

// Create a SHA-256 hash of the DER-encoded certificate
    const md = forge.md.sha256.create();
    md.update(der);
    const publicKeyHash = md.digest().toHex();


    return {
        publicKeyHash,
        email,
        certificate
    };
}

export function generateUserKeysAndCert(
    email: string,
    password: string,
    bits: number = 2048,
    friendlyName: string = 'FlashBack'
) {
// Generate a key pair
    const keys = forge.pki.rsa.generateKeyPair(bits);

// Create a self-signed certificate
    const certificate = forge.pki.createCertificate();
    certificate.publicKey = keys.publicKey;
    certificate.serialNumber = '01';
    certificate.validity.notBefore = new Date();
    certificate.validity.notAfter = new Date();
    certificate.validity.notAfter.setFullYear(certificate.validity.notBefore.getFullYear() + 99); // Valid for 99 years

// Set the subject attributes
    certificate.setSubject([
        {name: 'emailAddress', value: email},
    ]);

    certificate.setIssuer([
        {name: 'emailAddress', value: email},
    ])
    // certificate.setIssuer(attrs);
    certificate.sign(keys.privateKey, forge.md.sha256.create());

// 2. Prepare the components for PKCS#12
    const privateKey = keys.privateKey;

// 3. Create the PKCS#12 structure
    const pkcs12Asn1 = forge.pkcs12.toPkcs12Asn1(
        privateKey,
        [certificate], // Array of certificates (can include intermediate CAs)
        password, {
            generateLocalKeyId: true,
            friendlyName
        }
    );

    console.log('Certificate created successfully.', certificate);

    return {
        getPrivateKeyPemString: () => forge.pki.privateKeyToPem(keys.privateKey),
        getCertPemString: () => forge.pki.certificateToPem(certificate),
        // getPublicKeyString: () => forge.pki.publicKeyToPem(certificate.publicKey),
        getCertString: () => forge.asn1.toDer(pkcs12Asn1).getBytes(),
        // certificate
    }
}