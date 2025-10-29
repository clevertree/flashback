"use client";
import React, {useEffect, useState} from 'react';
import KeySection from "./sections/KeySection";
import ServerSection from "./sections/ServerSection";
import BroadcastSection from "./sections/BroadcastSection";
import {getConfig, setConfig} from "./config";
import "../integration/flashbackCryptoBridge";
import {RegisterResultData} from "../apiTypes";

export default function Home() {
    const defaults = getConfig();
    const defaultCertPath = defaults.privateKeyPath;
    const [keyVerified, setKeyVerified] = useState(false);
    const [registeredInfo, setRegisteredInfo] = useState<RegisterResultData | null>(null);

    // Persist window state on move/resize and try to restore on load (plugin handles auto-restore)
    useEffect(() => {
        let unsub: Array<() => void> = [];
        (async () => {
            try {
                const {getCurrentWindow} = await import('@tauri-apps/api/window');
                const win = getCurrentWindow();
                // Initial capture (after plugin restore)
                try {
                    const [pos, size, max] = await Promise.all([
                        win.outerPosition(),
                        win.outerSize(),
                        win.isMaximized(),
                    ]);
                    setConfig({winX: pos.x, winY: pos.y, winW: size.width, winH: size.height, winMaximized: max});
                } catch {
                }
                // Listeners
                const offResized = await win.onResized(async () => {
                    try {
                        const size = await win.outerSize();
                        const max = await win.isMaximized();
                        setConfig({winW: size.width, winH: size.height, winMaximized: max});
                    } catch {
                    }
                });
                const offMoved = await win.onMoved(async () => {
                    try {
                        const pos = await win.outerPosition();
                        setConfig({winX: pos.x, winY: pos.y});
                    } catch {
                    }
                });
                unsub.push(() => offResized());
                unsub.push(() => offMoved());
            } catch {
                // Not running under Tauri; ignore
            }
        })();
        return () => {
            unsub.forEach((fn) => {
                try {
                    fn();
                } catch {
                }
            });
        };
    }, []);

    return (
        <div className="min-h-screen p-6 text-sm text-gray-900">
            <h1 className="text-2xl font-semibold mb-4">Flashback Client</h1>
            {/* Section 1: Generate or Locate Private Key */}
            <KeySection defaultConfigPath={defaultCertPath}
                        onKeyVerified={() => setKeyVerified(true)}
            />
            {/* Section 2: Server registration (shown when a private key exists). */}
            <ServerSection
                keyVerified={keyVerified}
                onRegistered={(info) => setRegisteredInfo(info)}/>
            {/* Section 3: Broadcast presence (after successful register) */}
            <BroadcastSection
                registeredInfo={registeredInfo}/>
        </div>
    );
}
