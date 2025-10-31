"use client";
import React, { useEffect, useState } from "react";
import { RegisterResultData, RepositorySummary, ClientInfo } from "../../apiTypes";
import RemoteHouse from "../RemoteHouse/RemoteHouse";

export interface RepositoryBrowserProps {
    registeredInfo: RegisterResultData | null;
}

interface RepositoryWithPeers extends RepositorySummary {
    peers: ClientInfo[]; // Peers hosting this repository
}

export default function RepositoryBrowser({ registeredInfo }: RepositoryBrowserProps) {
    const [visible, setVisible] = useState(!!registeredInfo);
    const [repositories, setRepositories] = useState<RepositoryWithPeers[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedRepo, setSelectedRepo] = useState<RepositoryWithPeers | null>(null);
    const [selectedPeer, setSelectedPeer] = useState<ClientInfo | null>(null);
    const [peerLoading, setPeerLoading] = useState<string | null>(null); // Track which repo is loading peers

    useEffect(() => {
        setVisible(!!registeredInfo);
        if (registeredInfo) {
            loadRepositories();
        }
    }, [registeredInfo]);

    async function loadRepositories() {
        setError(null);
        setLoading(true);
        try {
            const api: any = window.flashbackApi;
            if (!api || typeof api.apiGetRepositories !== 'function') {
                throw new Error('API bridge unavailable for repository list');
            }

            // Fetch available repositories from relay tracker
            const result = await api.apiGetRepositories();
            
            let repoList: RepositorySummary[] = [];
            if (typeof result === 'string') {
                repoList = JSON.parse(result);
            } else if (Array.isArray(result)) {
                repoList = result;
            }

            // Initialize with empty peers
            const reposWithPeers: RepositoryWithPeers[] = repoList.map(repo => ({
                ...repo,
                peers: [],
            }));

            setRepositories(reposWithPeers);
        } catch (e: any) {
            setError(e?.message || String(e));
        } finally {
            setLoading(false);
        }
    }

    async function loadRepositoryPeers(repo: RepositoryWithPeers) {
        setError(null);
        setPeerLoading(repo.name);
        
        try {
            const api: any = window.flashbackApi;
            if (!api || typeof api.apiLookup !== 'function') {
                throw new Error('API bridge unavailable');
            }

            // Lookup peers hosting this repository by repository name
            // SECURITY: Certificate must come from relay tracker
            const result = await api.apiLookup(repo.name);

            let lookupData: any;
            if (typeof result === 'string') {
                lookupData = JSON.parse(result);
            } else {
                lookupData = result;
            }

            // Handle both array of peers and single peer response
            let peers: ClientInfo[] = [];
            if (Array.isArray(lookupData)) {
                peers = lookupData;
            } else if (lookupData.peers) {
                peers = lookupData.peers;
            } else if (lookupData.email) {
                peers = [lookupData];
            }

            // Update the repository with peers
            setRepositories(repos =>
                repos.map(r =>
                    r.name === repo.name ? { ...r, peers } : r
                )
            );
            setSelectedRepo({ ...repo, peers });
        } catch (e: any) {
            setError(e?.message || String(e));
        } finally {
            setPeerLoading(null);
        }
    }

    function handleVisitPeer(peer: ClientInfo, repo: RepositoryWithPeers) {
        setSelectedPeer({
            ...peer,
            repositories: [repo], // Include the specific repository being accessed
        });
    }

    if (!visible) return null;

    // Show RemoteHouse when a peer is selected
    if (selectedPeer && selectedRepo) {
        return (
            <RemoteHouse
                clientIp={selectedPeer.remote_ip || selectedPeer.ip || ''}
                clientPort={selectedPeer.port || 0}
                clientEmail={selectedPeer.email}
                publicCertificate={selectedPeer.publicCertificate}
                repositoryName={selectedRepo.name}
                onClose={() => setSelectedPeer(null)}
            />
        );
    }

    return (
        <section className="mb-6">
            <h2 className="text-lg font-medium mb-4">4. Repository Browser</h2>

            {error && <div className="text-red-600 text-sm mb-4">{error}</div>}

            {loading && <div className="text-gray-400 text-sm">Loading repositories...</div>}

            {!loading && repositories.length === 0 ? (
                <div className="text-gray-400 text-sm">
                    No repositories available.
                </div>
            ) : (
                <div className="space-y-3 max-w-4xl">
                    {repositories.map((repo) => (
                        <div key={repo.name} className="border border-gray-700 rounded p-4 bg-gray-900">
                            {/* Repository Header */}
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex-1">
                                    <h3 className="text-sm font-medium text-gray-100">
                                        {repo.name}
                                    </h3>
                                    {repo.description && (
                                        <p className="text-xs text-gray-400 mt-1">
                                            {repo.description}
                                        </p>
                                    )}
                                </div>
                                <button
                                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm disabled:opacity-50"
                                    onClick={() => loadRepositoryPeers(repo)}
                                    disabled={peerLoading === repo.name}
                                >
                                    {peerLoading === repo.name ? 'Loading...' : 'Browse'}
                                </button>
                            </div>

                            {/* Peers List for this Repository */}
                            {selectedRepo?.name === repo.name && repo.peers.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-gray-700 space-y-2">
                                    <p className="text-xs text-gray-400">
                                        {repo.peers.length} peer{repo.peers.length !== 1 ? 's' : ''} hosting this repository:
                                    </p>
                                    {repo.peers.map((peer) => (
                                        <div
                                            key={peer.email}
                                            className="flex items-center justify-between p-2 bg-gray-800 rounded text-xs"
                                        >
                                            <span className="text-gray-200">{peer.email}</span>
                                            <button
                                                className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs"
                                                onClick={() => handleVisitPeer(peer, repo)}
                                            >
                                                Visit
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {selectedRepo?.name === repo.name && repo.peers.length === 0 && (
                                <div className="mt-3 pt-3 border-t border-gray-700 text-xs text-gray-400">
                                    No peers hosting this repository.
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            <div className="mt-4 text-xs text-gray-400">
                Select a repository to find peers hosting it. Click "Visit" to browse the repository on a peer.
            </div>
        </section>
    );
}
