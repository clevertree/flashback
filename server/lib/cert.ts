import {NextRequest} from 'next/server';

/**
 * Extracts the client certificate PEM from headers. In production, a reverse proxy should
 * pass the client certificate in 'x-ssl-cert' (or similar). For local dev/testing you can
 * supply 'x-ssl-cert' header directly. Returns undefined if not present.
 */
export function getClientCertificateFromHeaders(req: NextRequest): string | undefined {
  const hdrs = req.headers;
  // Common header when using Nginx/Envoy to forward peer cert
  const pem = hdrs.get('x-ssl-cert') || hdrs.get('x-client-cert') || undefined;
  if (!pem) return undefined;
  // Some proxies url-encode newlines; try to restore
  const decoded = decodeIfEncoded(pem);
  return normalizePEM(decoded);
}

export function normalizePEM(pem: string): string {
  return pem
    .replace(/\r/g, '')
    .replace(/ +$/gm, '')
    .trim();
}

function decodeIfEncoded(value: string): string {
  try {
    // Heuristic: encoded PEMs often contain %0A
    if (/%0A|%2B|%2F|%3D/i.test(value)) {
      return decodeURIComponent(value);
    }
  } catch {}
  return value;
}
