"use client";
import React, {useEffect, useMemo, useState} from "react";
import {getConfig, setConfig} from "../../app/config";
import {RegisterResultData} from "../../apiTypes";

export interface ServerSectionProps {
    onRegistered: (info: RegisterResultData) => void,
    keyVerified: boolean
}

export default function ServerSection({
                                          onRegistered,
                                          keyVerified
                                      }: ServerSectionProps) {
    const cfg = useMemo(() => getConfig(), []);
    const [visible, setVisible] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [registered, setRegistered] = useState<RegisterResultData | null>(null);
    const [autoRegister, setAutoRegister] = useState(false);

    // Determine if a key exists; only then show this section
    async function checkKey(isCanceled: () => boolean) {
        try {
            if (typeof window === 'undefined' || !window.flashbackCrypto) return;
            const res = await window.flashbackCrypto.checkKeyExists();
            if (isCanceled()) return;
            // Optionally auto connect/register on startup
            if (res?.status === 'valid' && cfg.connectOnStartup && !autoRegister) {
                setAutoRegister(true);
                await doRegister();
            }
        } catch (e: any) {
            // if crypto bridge not ready yet, retry shortly
            setTimeout(checkKey, 300);
        }
    }

    useEffect(() => {
        let cancelled = false;
        if (keyVerified) {
            setVisible(true);
            checkKey(() => cancelled).then();
        }
        return () => {
            cancelled = true;
        };
    }, [keyVerified]);

    async function doRegister() {
        setError(null);
        setBusy(true);
        try {
            const api: any = window.flashbackApi;
            if (!api || typeof api.apiRegisterJson !== 'function') {
                throw new Error('API bridge unavailable');
            }
            const res = await api.apiRegisterJson();
            const status = res?.status;
            if (status === 200) {
                const data = (res?.data || {}) as RegisterResultData;
                setRegistered(data);
                onRegistered(data);
                // persist last known metadata into config for convenience
                setConfig({
                    // store serverUrl already in cfg
                    // add lightweight cache fields if desired later
                });
            } else {
                setError(`Registration failed (${status}).`);
            }
        } catch (e: any) {
            setError(e?.message || String(e));
        } finally {
            setBusy(false);
        }
    }

    if (!visible) return null;

    return (
        <section className="mb-6">
            <h2 className="text-lg font-medium mb-2">2. Server Registration</h2>
            {!registered && (
                <div className="flex flex-col gap-2 max-w-2xl">
                    <div className="text-sm text-gray-700">Server URL: <code>{cfg.serverUrl}</code></div>
                    <div className="flex gap-2 mt-1">
                        <button
                            className="px-3 py-2 border rounded disabled:opacity-50"
                            onClick={doRegister}
                            disabled={busy}
                        >
                            {busy ? 'Registering...' : 'Register with Server'}
                        </button>
                    </div>
                    {error && <div className="text-red-600 text-sm">{error}</div>}
                    <div className="text-xs text-gray-500">This will send your certificate to the server's /api/register
                        route.
                    </div>
                </div>
            )}
            {!!registered && (
                <div className="max-w-2xl border rounded p-3 bg-gray-50">
                    <div className="text-sm text-gray-700 space-y-1">
                        <div><span className="text-gray-500">Server URL:</span> <code>{cfg.serverUrl}</code></div>
                        {registered.serverVersion && (
                            <div><span className="text-gray-500">Server Version:</span>
                                <code>{registered.serverVersion}</code></div>
                        )}
                        {registered.serverTitle && (
                            <div><span className="text-gray-500">Server Title:</span>
                                <code>{registered.serverTitle}</code></div>
                        )}
                    </div>
                    <div className="mt-2 text-green-700">Registered successfully.</div>
                </div>
            )}
        </section>
    );
}
