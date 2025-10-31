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
}