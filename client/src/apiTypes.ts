export interface RegisterResultData {
    id?: number;
    email?: string;
    serverVersion?: string;
    serverTitle?: string;
    clientIP: string;
    /**
     * Public certificate returned by relay tracker server for TLS handshake.
     * SECURITY RULE: Must only come from relay tracker, never from the client.
     * The tracker verifies certificate ownership and ensures secure data transfer.
     */
    publicCertificate?: string;
    /**
     * List of repositories hosted by this client
     */
    repositories?: RepositorySummary[];
}

// Broadcast payload sent to relay tracker when client is ready
export interface BroadcastPayload {
    email: string;
    socketAddresses: string[]; // Array of IP addresses client is available on
    port: number;
    repositories?: RepositorySummary[]; // Repositories this client is hosting
}

// Summary of repository information
export interface RepositorySummary {
    name: string; // Unique repository identifier (e.g., "movies", "tv-shows")
    description?: string; // Human-readable description
    rules?: Record<string, any>; // Validation rules for repository data
}

// Full repository information
export interface Repository extends RepositorySummary {
    id?: number;
    git_url: string; // Git URL for cloning
    certificate_subject?: string; // X.509 certificate subject for commit signing
}

// Friend/Client information used for connecting to peers
export interface ClientInfo {
    email: string; // Friend's email address
    ip?: string; // Socket IP address
    port?: number; // Socket port
    remote_ip?: string; // Remote IP if different from local
    local_ip?: string; // Local IP
    peer_status?: string; // Connection status
    /**
     * Public certificate from relay tracker for establishing secure handshake.
     * SECURITY RULE: Must only come from relay tracker server.
     * The relay tracker ensures the certificate belongs to the specified email.
     */
    publicCertificate?: string;
    /**
     * Repositories hosted by this peer
     */
    repositories?: RepositorySummary[];
}