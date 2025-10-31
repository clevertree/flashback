"use client";
import React, {useEffect, useMemo, useState} from "react";
import {getConfig, setConfig} from "../../app/config";
import {RegisterResultData} from "../../apiTypes";

export interface BroadcastSectionProps {
    registeredInfo: RegisterResultData | null;
}

export default function BroadcastSection({registeredInfo}: BroadcastSectionProps) {
    const cfg = useMemo(() => getConfig(), []);
    const [visible, setVisible] = useState(!!registeredInfo);
    const [broadcastPort, setBroadcastPort] = useState<number>(13337);
    const [fileRootDirectory, setFileRootDirectory] = useState<string>(cfg.fileRootDirectory || '');
    const [localIP, setLocalIP] = useState<string>("127.0.0.1");
    const [remoteIP, setRemoteIP] = useState<string>(registeredInfo?.clientIP ? registeredInfo.clientIP : "");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [online, setOnline] = useState(false);

    useEffect(() => {
        setVisible(!!registeredInfo);
        if (registeredInfo) {
            // Pre-fill remote socket using clientIP (port can be edited by user)
            setRemoteIP(`${registeredInfo.clientIP}:0`);
        }
    }, [registeredInfo]);

    async function goReady() {
        setError(null);
        setBusy(true);
        try {
            const api: any = window.flashbackApi;
            if (!api || typeof api.apiReady !== 'function') throw new Error('API bridge unavailable');
            const res: string = await api.apiReady(localIP, remoteIP, broadcastPort);
            if (/^READY OK /.test(res)) {
                setOnline(true);
            } else {
                setError(res || 'Unknown error');
            }
        } catch (e: any) {
            setError(e?.message || String(e));
        } finally {
            setBusy(false);
        }
    }

    function goOffline() {
        // For now, just clear the online state. A complementary API for offline can be added later.
        setOnline(false);
    }

    if (!visible) return null;

    return (
        <section className="mb-6">
            <h2 className="text-lg font-medium mb-2">3. Broadcast Presence</h2>
            {!online && (
                <div className="flex flex-col gap-2 max-w-2xl">
                    <label className="flex flex-col">
                        <span className="text-gray-600">Local Socket</span>
                        <input className="border px-3 py-2 rounded" value={localIP}
                               onChange={(e) => setLocalIP(e.target.value)} placeholder="127.0.0.1"/>
                    </label>
                    <label className="flex flex-col">
                        <span className="text-gray-600">Remote Socket</span>
                        <input className="border px-3 py-2 rounded" value={remoteIP}
                               onChange={(e) => setRemoteIP(e.target.value)} placeholder="<remote-ip>"/>
                    </label>
                    <label className="flex flex-col">
                        <span className="text-gray-600">Broadcast Port</span>
                        <input className="border px-3 py-2 rounded" value={broadcastPort}
                               onChange={(e) => setBroadcastPort(parseInt(e.target.value, 10) || 13337)} placeholder="13337"/>
                    </label>
                    <label className="flex flex-col">
                        <span className="text-gray-600">File Root Directory</span>
                        <input className="border px-3 py-2 rounded" value={fileRootDirectory}
                               onChange={(e) => {
                                   setFileRootDirectory(e.target.value);
                                   setConfig({fileRootDirectory: e.target.value});
                               }} placeholder="/path/to/shared/files"/>
                        <span className="text-xs text-gray-500 mt-1">Directory containing files to serve via HTTPS to other clients</span>
                    </label>
                    <div>
                        <button className="px-3 py-2 border rounded disabled:opacity-50"
                                onClick={goReady} disabled={busy || !localIP}>
                            {busy ? 'Working...' : 'Ready!'}
                        </button>
                    </div>
                    {error && <div className="text-red-600 text-sm">{error}</div>}
                    <div className="text-xs text-gray-500">This will call /api/broadcast/ready to announce your
                        availability.
                    </div>
                </div>
            )}
            {online && (
                <div className="max-w-2xl border rounded p-3 bg-gray-50">
                    <div className="text-green-700 mb-2">Online. Your ready socket is registered.</div>
                    <div className="text-sm text-gray-700 space-y-1">
                        <div><span className="text-gray-500">Local Socket:</span> <code>{localIP}</code></div>
                        {remoteIP && (
                            <div><span className="text-gray-500">Remote Socket:</span> <code>{remoteIP}</code></div>
                        )}
                    </div>
                    <div className="mt-2">
                        <button className="px-3 py-2 border rounded" onClick={goOffline}>Go offline</button>
                    </div>
                </div>
            )}
        </section>
    );
}
