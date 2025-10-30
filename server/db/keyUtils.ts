import {X509Certificate} from "crypto";


export function parseCertWithNodeCrypto(certPem: string): { email?: string } {
    try {
        const x509 = new X509Certificate(certPem);

        // Extract email from SAN (preferred) or Subject fallback
        let email: string | undefined;
        const san = x509.subjectAltName; // e.g., 'DNS:example.com, email:foo@bar.com'
        if (san) {
            // Look for entries like 'email:someone@example.com' (case-insensitive), also handle 'RFC822:email'
            const parts = san.split(/\s*,\s*/);
            for (const p of parts) {
                const m = p.match(/^(?:email|rfc822Name)\s*:\s*(.+)$/i);
                if (m) {
                    email = m[1];
                    break;
                }
            }
        }
        if (!email) {
            // Fallback to Subject string, which may contain 'emailAddress=...'
            const subj = x509.subject; // e.g., 'CN=..., emailAddress=foo@bar.com'
            const m = subj.match(/(?:^|,\s*)emailAddress=([^,]+)/i);
            if (m) email = m[1];
        }
        return {email};
    } catch (e) {
        // Re-throw with a cleaner message
        const msg = e instanceof Error ? e.message : String(e);
        throw new Error(`Certificate parse error: ${msg}`);
    }
}
