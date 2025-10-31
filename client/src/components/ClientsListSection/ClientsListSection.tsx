"use client";
import React, { useEffect, useMemo, useState } from "react";
import { getConfig } from "../../app/config";
import { RegisterResultData } from "../../apiTypes";
import ClientsList from "../ClientsList/ClientsList";

export interface ClientsListSectionProps {
    registeredInfo: RegisterResultData | null;
    onClientVisit?: (client: any) => void;
}

export interface ClientInfo {
    ip: string;
    port: number;
    local_ip?: string;
    remote_ip?: string;
    peer_status?: string;
}

export default function ClientsListSection({ registeredInfo, onClientVisit }: ClientsListSectionProps) {
    const cfg = useMemo(() => getConfig(), []);
    const [visible, setVisible] = useState(!!registeredInfo);
    const [clients, setClients] = useState<ClientInfo[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [onlineKeys, setOnlineKeys] = useState<Set<string>>(new Set());

    useEffect(() => {
        setVisible(!!registeredInfo);
        if (registeredInfo) {
            fetchClientList();
        }
    }, [registeredInfo]);

    async function fetchClientList() {
        setError(null);
        setLoading(true);
        try {
            const api: any = window.flashbackApi;
            if (!api || typeof api.apiGetClients !== 'function') {
                throw new Error('API bridge unavailable');
            }
            const res = await api.apiGetClients();
            if (res && Array.isArray(res.clients)) {
                setClients(res.clients);
                // Mark all fetched clients as online
                const online = new Set<string>();
                res.clients.forEach((client: ClientInfo) => {
                    const key = `${client.remote_ip || client.ip}:${client.port}`;
                    online.add(key);
                });
                setOnlineKeys(online);
            } else {
                setError('Invalid client list response');
            }
        } catch (e: any) {
            setError(e?.message || String(e));
        } finally {
            setLoading(false);
        }
    }

    function handleVisitClient(client: ClientInfo) {
        if (onClientVisit) {
            onClientVisit(client);
        }
    }

    if (!visible) return null;

    return (
        <section className="mb-6">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-medium">3. Connected Clients</h2>
                <button
                    className="px-3 py-2 border rounded disabled:opacity-50 bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={fetchClientList}
                    disabled={loading}
                >
                    {loading ? 'Refreshing...' : 'Refresh'}
                </button>
            </div>

            {error && <div className="text-red-600 text-sm mb-4">{error}</div>}

            {clients.length === 0 && !loading && (
                <div className="text-gray-400 text-sm">
                    {error ? 'Failed to load clients.' : 'No clients connected yet.'}
                </div>
            )}

            {clients.length > 0 && (
                <ClientsList
                    id="connected-clients"
                    clients={clients.map(c => ({
                        ip: c.remote_ip || c.ip,
                        port: c.port,
                        peer_status: c.peer_status || 'unknown'
                    }))}
                    selfIp={registeredInfo?.clientIP || ''}
                    selfPort={0}
                    onDccConnect={handleVisitClient}
                    onlineKeys={onlineKeys}
                    showHistoric={false}
                />
            )}
        </section>
    );
}
