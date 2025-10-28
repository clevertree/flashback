"use client";
import React, {useEffect, useMemo, useState} from 'react';

// Client must use Rust plugins for all crypto; no Node/browser crypto implementations here.
// Defaults
const DEFAULT_SERVER = 'http://localhost:8080';
const DEFAULT_LOCAL_PATH = '~/.relay-client/';

// Rust plugin interface (provided by Tauri, WRY, or custom bridge at runtime)
declare global {
    interface Window {
        flashbackCrypto?: {
            // Check if a private RSA key exists at the given config path. May also return a cert if available.
            checkKeyExists: (configPath: string) => Promise<{ exists: boolean; certPem?: string }>;
            // Generate RSA keypair and self-signed X.509 certificate (email in subject) and save to path.
            generateUserKeysAndCert: (args: {
                email: string;
                password: string;
                bits?: number;
                friendlyName?: string;
                savePath: string;
            }) => Promise<{ certPem: string; privateKeyPemPath: string; certPemPath: string }>;
            // Optional helper to load cert PEM from disk if needed.
            loadCertPemFromPath?: (path: string) => Promise<{ certPem: string }>;
        };
    }
}

interface RepoItem {
    id: number;
    title: string;
    url: string;
}

export default function Home() {
    // Step 0: Defaults
    const [serverBase, setServerBase] = useState<string>(DEFAULT_SERVER);
    const [localPath, setLocalPath] = useState<string>(DEFAULT_LOCAL_PATH);

    // Keys/cert state
    const [email, setEmail] = useState<string>("");
    const [password, setPassword] = useState<string>("");
    const [bits, setBits] = useState<number>(2048);
    const [friendlyName, setFriendlyName] = useState<string>('FlashBack');

    const [keyExists, setKeyExists] = useState<boolean>(false);
    const [checkingKey, setCheckingKey] = useState<boolean>(false);
    const [certPem, setCertPem] = useState<string>("");

    const [repos, setRepos] = useState<RepoItem[]>([]);
    const [repoLoading, setRepoLoading] = useState(false);
    const [log, setLog] = useState<string>("");

    const [socketAddr, setSocketAddr] = useState<string>(() => {
        const host = typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1';
        return `${host}:0`;
    });

    const cryptoAvailable = useMemo(() => typeof window !== 'undefined' && !!window.flashbackCrypto, []);

    function appendLog(msg: string) {
        setLog(prev => `${prev}${prev ? "\n" : ""}${msg}`);
    }

    // Check for private RSA key existence at config path and optionally load certificate
    useEffect(() => {
        let cancelled = false;
        async function run() {
            if (!cryptoAvailable) return;
            setCheckingKey(true);
            try {
                const res = await window.flashbackCrypto!.checkKeyExists(localPath);
                if (cancelled) return;
                setKeyExists(!!res?.exists);
                if (res?.certPem) setCertPem(res.certPem);
                appendLog(`Key check at ${localPath}: ${res?.exists ? 'found' : 'not found'}`);
            } catch (e: any) {
                appendLog(`key check error: ${e?.message || e}`);
            } finally {
                if (!cancelled) setCheckingKey(false);
            }
        }
        run();
        return () => { cancelled = true };
    }, [localPath, cryptoAvailable]);

    async function handleGenerate() {
        if (!cryptoAvailable) {
            appendLog('Crypto plugin not available. Ensure Rust plugin is loaded.');
            return;
        }
        if (!email || !password) {
            appendLog('Please provide email and password to generate keys.');
            return;
        }
        try {
            appendLog(`Generating RSA ${bits} keypair and certificate via Rust plugin...`);
            const res = await window.flashbackCrypto!.generateUserKeysAndCert({
                email, password, bits, friendlyName, savePath: localPath,
            });
            setCertPem(res.certPem || "");
            setKeyExists(true);
            appendLog(`Keys generated. Saved private key at ${res.privateKeyPemPath}, cert at ${res.certPemPath}.`);
        } catch (e: any) {
            appendLog(`generate error: ${e?.message || e}`);
        }
    }

    async function handleRegister() {
        try {
            if (!certPem) {
                appendLog('No certificate loaded. Generate or load keys first.');
                return;
            }
            const url = `${serverBase.replace(/\/$/, '')}/api/register`;
            const res = await fetch(url, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    certificate: certPem,
                }),
            });
            const data = await res.json();
            appendLog(`register ${res.status}: ${JSON.stringify(data)}`);
        } catch (e: any) {
            appendLog(`register error: ${e?.message || e}`);
        }
    }

    async function fetchRepos() {
        setRepoLoading(true);
        try {
            const url = `${serverBase.replace(/\/$/, '')}/api/repository/list`;
            const res = await fetch(url);
            const data = await res.json();
            const items: RepoItem[] = data?.items || [];
            setRepos(items);
            appendLog(`Loaded ${items.length} repositories`);
        } catch (e: any) {
            appendLog(`repo list error: ${e?.message || e}`);
        } finally {
            setRepoLoading(false);
        }
    }

    function handleDownload(repo: RepoItem) {
        appendLog(`Download requested: ${repo.title} -> ${localPath}repos/ (not implemented)`);
        // TODO: Use Tauri shell/plugin to run `git clone repo.url <localPath>/repos/<safe-title>`
    }

    async function handleBroadcastReady() {
        try {
            const url = `${serverBase.replace(/\/$/, '')}/api/broadcast/ready`;
            const res = await fetch(url, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                // Server contract may change; keeping placeholder publicKeyHash for now if needed later
                body: JSON.stringify({ socket_address: socketAddr }),
            });
            const data = await res.json();
            appendLog(`broadcast/ready ${res.status}: ${JSON.stringify(data)}`);
        } catch (e: any) {
            appendLog(`broadcast/ready error: ${e?.message || e}`);
        }
    }

    return (
        <div className="min-h-screen p-6 text-sm text-gray-900">
            <h1 className="text-2xl font-semibold mb-4">Flashback Client</h1>

            <section className="mb-6">
                <h2 className="text-lg font-medium mb-2">Defaults</h2>
                <div className="flex flex-col gap-2 max-w-xl">
                    <label className="flex flex-col">
                        <span className="text-gray-600">Server Base URL</span>
                        <input className="border px-3 py-2 rounded" value={serverBase}
                               onChange={e => setServerBase(e.target.value)}/>
                    </label>
                    <label className="flex flex-col">
                        <span className="text-gray-600">Config Path</span>
                        <input className="border px-3 py-2 rounded" value={localPath}
                               onChange={e => setLocalPath(e.target.value)}/>
                    </label>
                    <div className="text-xs text-gray-500">
                        Encryption processing policy: handled exclusively by Rust plugin; no Node/browser crypto.
                    </div>
                </div>
            </section>

            <section className="mb-6">
                <h2 className="text-lg font-medium mb-2">Keys & Certificate</h2>
                <div className="mb-2 text-gray-600">
                    {checkingKey ? 'Checking for existing key...' : keyExists ? 'Private key found at config path.' : 'No private key found at config path.'}
                </div>

                {!keyExists && (
                    <div className="grid sm:grid-cols-2 gap-3 max-w-3xl">
                        <label className="flex flex-col">
                            <span className="text-gray-600">Email</span>
                            <input className="border px-3 py-2 rounded" value={email}
                                   onChange={e => setEmail(e.target.value)} placeholder="you@example.com"/>
                        </label>
                        <label className="flex flex-col">
                            <span className="text-gray-600">Password</span>
                            <input type="password" className="border px-3 py-2 rounded" value={password}
                                   onChange={e => setPassword(e.target.value)} placeholder="Secret to protect P12/PK"/>
                        </label>
                        <label className="flex flex-col">
                            <span className="text-gray-600">Bit length</span>
                            <input type="number" min={2048} step={1024} className="border px-3 py-2 rounded" value={bits}
                                   onChange={e => setBits(parseInt(e.target.value || '2048', 10))}/>
                        </label>
                        <label className="flex flex-col">
                            <span className="text-gray-600">Friendly Name</span>
                            <input className="border px-3 py-2 rounded" value={friendlyName}
                                   onChange={e => setFriendlyName(e.target.value)}/>
                        </label>
                        <div className="sm:col-span-2 flex gap-2 mt-1">
                            <button className="px-3 py-2 border rounded" onClick={handleGenerate} disabled={!cryptoAvailable}>
                                {cryptoAvailable ? 'Generate Keypair (Rust)' : 'Crypto Plugin Unavailable'}
                            </button>
                        </div>
                    </div>
                )}

                {certPem && (
                    <div className="mt-3">
                        <div className="text-gray-600 mb-1">Certificate (PEM):</div>
                        <textarea className="border px-3 py-2 rounded w-full" rows={6} value={certPem}
                                  onChange={e => setCertPem(e.target.value)} />
                    </div>
                )}

                <div className="flex gap-2 mt-3">
                    <button className="px-3 py-2 border rounded" onClick={handleRegister} disabled={!certPem}>Register</button>
                </div>
            </section>

            <section className="mb-6">
                <h2 className="text-lg font-medium mb-2">Download a Repository</h2>
                <div className="flex gap-2 mb-3">
                    <button className="px-3 py-2 border rounded" onClick={fetchRepos}
                            disabled={repoLoading}>{repoLoading ? 'Loading...' : 'Load Repository List'}</button>
                </div>
                <div className="flex flex-wrap gap-2">
                    {repos.map(r => (
                        <button key={r.id} className="px-3 py-2 border rounded"
                                onClick={() => handleDownload(r)}>{r.title}</button>
                    ))}
                    {repos.length === 0 && !repoLoading && (
                        <div className="text-gray-500">No repositories loaded.</div>
                    )}
                </div>
            </section>

            <section className="mb-6">
                <h2 className="text-lg font-medium mb-2">Broadcast</h2>
                <div className="grid sm:grid-cols-2 gap-3 max-w-3xl">
                    <label className="flex flex-col">
                        <span className="text-gray-600">Socket Address</span>
                        <input className="border px-3 py-2 rounded" value={socketAddr}
                               onChange={e => setSocketAddr(e.target.value)}/>
                    </label>
                </div>
                <div className="flex gap-2 mt-3">
                    <button className="px-3 py-2 border rounded" onClick={handleBroadcastReady}>Enable Broadcasting
                    </button>
                </div>
            </section>

            <section>
                <h2 className="text-lg font-medium mb-2">Logs</h2>
                <pre className="bg-gray-100 p-3 rounded max-w-3xl whitespace-pre-wrap">{log}</pre>
            </section>
        </div>
    );
}
