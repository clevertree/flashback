'use client'

export function isCryptoAvailable() {
    try {
        flashbackCrypto()
    } catch (e) {
        console.error("Crypto not available", e)
        return false;
    }
    return true;
}

export function flashbackCrypto() {
    if (typeof window !== "undefined" && !!window.flashbackCrypto) {
        return window.flashbackCrypto as IFlashBackCrypto;
    }
    throw new Error("flashbackCrypto not available");
}

interface IFlashBackCrypto {
    checkKeyExists: () => Promise<{
        status: 'missing' | 'invalid' | 'valid';
        privateKeyPath: string;
        certPemPath: string
    }>;
    generateUserKeysAndCert: (args: {
        email: string;
        password?: string;
        bits?: number;
        friendlyName?: string;
        savePath?: string;
    }) => Promise<{
        status: 'missing' | 'invalid' | 'valid';
        privateKeyPath: string;
        certPemPath: string
    }>;
    loadCertPemFromPath?: (path: string) => Promise<{ certPem: string }>
}

interface IFlashBackAPI {
    apiRegisterJson: () => Promise<{ status: number; data: any }>;
    apiReady: (localIP: string, remoteIP: string, broadcastPort: number) => Promise<string>;
    apiLookup: (email: string, minutes?: number) => Promise<string>;
}

declare global {
    interface Window {
        flashbackCrypto?: IFlashBackCrypto
        flashbackApi?: IFlashBackAPI
    }
}

