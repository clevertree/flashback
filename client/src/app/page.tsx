"use client";
import React, {useState} from 'react';

// Minimal starter UI per new requirements
// Defaults
const DEFAULT_SERVER = 'http://localhost:8080';
const DEFAULT_LOCAL_PATH = '~/.flashback/';

interface RepoItem {
    id: number;
    title: string;
    url: string;
}

export default function Home() {
    // Step 0: Defaults
    const [serverBase, setServerBase] = useState<string>(DEFAULT_SERVER);
    const [localPath, setLocalPath] = useState<string>(DEFAULT_LOCAL_PATH);

    // Step 1: Keys (basic placeholders; generation not implemented yet)
    const [publicKeyHash, setPublicKeyHash] = useState<string>("");
    const [sshPublicKeyHash, setSshPublicKeyHash] = useState<string>("");
    const [publicKeyFull, setPublicKeyFull] = useState<string>("");

    const [repos, setRepos] = useState<RepoItem[]>([]);
    const [repoLoading, setRepoLoading] = useState(false);
    const [log, setLog] = useState<string>("");

    const [socketAddr, setSocketAddr] = useState<string>(() => {
        // placeholder autodetect idea
        const host = typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1';
        return `${host}:0`;
    });

    function appendLog(msg: string) {
        setLog(prev => `${prev}${prev ? "\n" : ""}${msg}`);
    }

    async function handleRegister() {
        try {
            const url = `${serverBase.replace(/\/$/, '')}/api/register`;
            const res = await fetch(url, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    publicKeyHash: publicKeyHash,
                    public_key_full: publicKeyFull,
                    publicKeyHash: sshPublicKeyHash
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
                body: JSON.stringify({publicKeyHash: publicKeyHash, socket_address: socketAddr}),
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
                        <span className="text-gray-600">Local Path</span>
                        <input className="border px-3 py-2 rounded" value={localPath}
                               onChange={e => setLocalPath(e.target.value)}/>
                    </label>
                </div>
            </section>

            <section className="mb-6">
                <h2 className="text-lg font-medium mb-2">Keys</h2>
                <p className="text-gray-600 mb-2">Default encryption: RSA. Default bitrate: 2048.</p>
                <div className="grid sm:grid-cols-2 gap-3 max-w-3xl">
                    <label className="flex flex-col">
                        <span className="text-gray-600">Public Key Hash</span>
                        <input className="border px-3 py-2 rounded" value={publicKeyHash}
                               onChange={e => setPublicKeyHash(e.target.value)}/>
                    </label>
                    <label className="flex flex-col">
                        <span className="text-gray-600">SSH Public Key Hash</span>
                        <input className="border px-3 py-2 rounded" value={sshPublicKeyHash}
                               onChange={e => setSshPublicKeyHash(e.target.value)}/>
                    </label>
                    <label className="flex flex-col sm:col-span-2">
                        <span className="text-gray-600">Public Key (full)</span>
                        <textarea className="border px-3 py-2 rounded" rows={4} value={publicKeyFull}
                                  onChange={e => setPublicKeyFull(e.target.value)}/>
                    </label>
                </div>
                <div className="flex gap-2 mt-3">
                    <button className="px-3 py-2 border rounded"
                            onClick={() => appendLog('Generate RSA 2048 keypair -> ' + localPath + ' (not implemented)')}>Generate
                        Keypair
                    </button>
                    <button className="px-3 py-2 border rounded" onClick={handleRegister}>Register</button>
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
