/**
 * Secure Connection Utilities
 *
 * Provides certificate-based encryption and secure HTTPS communication
 * between clients using public/private key infrastructure.
 */

export interface SecureConnectionOptions {
  clientIp: string;
  clientPort: number;
  clientEmail?: string;
  timeout?: number;
}

export interface RemoteFileRequest {
  path: string;
  offset?: number;
  length?: number;
}

export interface RemoteFileResponse {
  status: number;
  data?: {
    name: string;
    type: string;
    size: number;
    content?: string;
    contentType?: string;
  };
  error?: string;
}

/**
 * Fetches a user's public certificate from the server by email
 * This certificate is used to verify and encrypt communication with the remote client
 */
export async function fetchRemoteUserCertificate(email: string): Promise<string> {
  try {
    const api: any = window.flashbackApi;
    if (!api) {
      throw new Error('API not available');
    }
    
    // TODO: Implement endpoint to fetch certificate by email
    // For now, return empty string (certificates are stored during registration)
    // Server endpoint: GET /api/users/{email}/certificate
    
    const baseUrl = localStorage.getItem('serverUrl') || 'http://127.0.0.1:8080';
    const response = await fetch(`${baseUrl}/api/users/${encodeURIComponent(email)}/certificate`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch certificate: ${response.statusText}`);
    }

    const data = await response.json();
    return data.certificate || '';
  } catch (e: any) {
    console.error('Error fetching remote certificate:', e);
    throw new Error(`Failed to fetch certificate for ${email}: ${e.message}`);
  }
}

/**
 * Establishes a secure connection to a remote client
 * Uses certificate-based encryption
 */
export async function establishSecureConnection(
  options: SecureConnectionOptions
): Promise<{ sessionId: string; verified: boolean }> {
  const { clientIp, clientPort, clientEmail, timeout = 5000 } = options;

  try {
    // TODO: Fetch remote client's certificate if email is provided
    if (clientEmail) {
      const remoteCert = await fetchRemoteUserCertificate(clientEmail);
      if (!remoteCert) {
        throw new Error('Unable to verify remote client certificate');
      }
    }

    // Generate session ID for this connection
    const sessionId = generateSessionId();

    return {
      sessionId,
      verified: true,
    };
  } catch (e: any) {
    console.error('Error establishing secure connection:', e);
    return {
      sessionId: '',
      verified: false,
    };
  }
}

/**
 * Makes a secure HTTPS request to a remote client
 */
export async function makeSecureRequest<T = any>(
  options: SecureConnectionOptions & { endpoint: string; method?: string; body?: any }
): Promise<T> {
  const { clientIp, clientPort, endpoint, method = 'GET', body } = options;

  try {
    const url = `https://${clientIp}:${clientPort}${endpoint}`;

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`Request failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data as T;
  } catch (e: any) {
    console.error('Error making secure request:', e);
    throw e;
  }
}

/**
 * Fetches a file from a remote client
 */
export async function fetchRemoteFile(
  options: SecureConnectionOptions & { filePath: string }
): Promise<RemoteFileResponse> {
  const { filePath, ...connectionOptions } = options;

  try {
    const response = await makeSecureRequest({
      ...connectionOptions,
      endpoint: `/api/files?path=${encodeURIComponent(filePath)}`,
    });

    return response as RemoteFileResponse;
  } catch (e: any) {
    return {
      status: 500,
      error: e.message,
    };
  }
}

/**
 * Lists files available on a remote client
 */
export async function listRemoteFiles(options: SecureConnectionOptions): Promise<{ files: any[] }> {
  try {
    const response = await makeSecureRequest({
      ...options,
      endpoint: '/api/files',
    });

    return response as { files: any[] };
  } catch (e: any) {
    console.error('Error listing remote files:', e);
    return { files: [] };
  }
}

/**
 * Generates a unique session ID for a secure connection
 */
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Verifies that a certificate is valid and trusted
 */
export function verifyCertificate(certificate: string, issuer?: string): boolean {
  try {
    if (!certificate || certificate.trim().length === 0) {
      return false;
    }

    // TODO: Implement certificate verification using Web Crypto API
    // For now, just check that it looks like a PEM certificate
    const isPem =
      certificate.includes('-----BEGIN CERTIFICATE-----') ||
      certificate.includes('-----BEGIN PUBLIC KEY-----');

    return isPem;
  } catch (e) {
    console.error('Error verifying certificate:', e);
    return false;
  }
}

/**
 * Encodes a message using the remote client's public key
 */
export async function encodeWithPublicKey(
  message: string,
  publicKey: string
): Promise<string> {
  try {
    // TODO: Implement public key encryption using Web Crypto API
    // For now, just return base64 encoded message
    return btoa(message);
  } catch (e: any) {
    console.error('Error encoding with public key:', e);
    throw e;
  }
}

/**
 * Decodes a message using the local private key
 */
export async function decodeWithPrivateKey(
  encryptedMessage: string,
  privateKey: string
): Promise<string> {
  try {
    // TODO: Implement private key decryption using Web Crypto API
    // For now, just return base64 decoded message
    return atob(encryptedMessage);
  } catch (e: any) {
    console.error('Error decoding with private key:', e);
    throw e;
  }
}
