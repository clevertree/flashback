"use client";
import React, {useEffect, useState} from 'react';
import KeySection from "../components/KeySection/KeySection";
import ServerSection from "../components/ServerSection/ServerSection";
import FriendsListSection from "../components/FriendsListSection/FriendsListSection";
import SettingsSection from "../components/SettingsSection/SettingsSection";
import RemoteHouse from "../components/RemoteHouse/RemoteHouse";
import RepoBrowser from "../components/RepoBrowser/RepoBrowser";
import {getConfig, setConfig} from "./config";
import "../integration/flashbackCryptoBridge";
import {RegisterResultData, ClientInfo} from "../apiTypes";

export default function Home() {
    const defaults = getConfig();
    const defaultCertPath = defaults.privateKeyPath;
    const defaultFileRootDir = defaults.fileRootDirectory || '';
    const [keyVerified, setKeyVerified] = useState(false);
    const [registeredInfo, setRegisteredInfo] = useState<RegisterResultData | null>(null);
    const [selectedClient, setSelectedClient] = useState<ClientInfo | null>(null);
    const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
    const [showSettings, setShowSettings] = useState(false);

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
        <div className="min-h-screen p-6 bg-slate-900 text-slate-100">
            <div className="flex justify-between items-center mb-4">
                <h1 className="text-2xl font-semibold text-white">Flashback Client</h1>
                <button
                    onClick={() => setShowSettings(!showSettings)}
                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded text-sm text-gray-100"
                >
                    {showSettings ? 'Hide Settings' : 'Settings'}
                </button>
            </div>
            
            {/* Show RemoteHouse when a friend is selected for connection */}
            {selectedClient && selectedClient.publicCertificate && (
                <RemoteHouse
                    friendEmail={selectedClient.email || 'Unknown'}
                    clientIp={selectedClient.remote_ip || selectedClient.ip || ''}
                    clientPort={selectedClient.port || 0}
                    publicCertificate={selectedClient.publicCertificate}
                    onClose={() => setSelectedClient(null)}
                />
            )}

            {/* Show RepoBrowser when a channel is selected for browsing */}
            {selectedChannel && (
                <RepoBrowser
                    channelName={selectedChannel}
                    onClose={() => setSelectedChannel(null)}
                />
            )}
            
            {/* Hide main sections when RemoteHouse or RepoBrowser is open */}
            {!selectedClient && !selectedChannel && (
                <>
                    {/* Section 1: Generate or Locate Private Key */}
                    <KeySection defaultConfigPath={defaultCertPath || ''}
                                onKeyVerified={() => setKeyVerified(true)}
                    />
                    {/* Section 2: Server registration (shown when a private key exists). */}
                    <ServerSection
                        keyVerified={keyVerified}
                        onRegistered={(info) => setRegisteredInfo(info)}/>
                    {/* Section 3: Friends List (shown after registration) */}
                    <FriendsListSection
                        registeredInfo={registeredInfo}
                        onFriendVisit={(friend) => setSelectedClient(friend)}
                    />
                    {/* Section 4: Repository Browser */}
                    {registeredInfo && (
                        <section className="mb-6">
                            <h2 className="text-lg font-medium mb-4">4. Browse Repositories</h2>
                            <p className="text-sm text-gray-400 mb-4">
                                Click on a channel below to browse entries and comments from the Hyperledger Fabric network.
                            </p>
                            <div className="grid grid-cols-2 gap-3 max-w-4xl">
                                {['movies', 'tv-shows', 'documentaries', 'anime', 'tutorials'].map((channel) => (
                                    <button
                                        key={channel}
                                        onClick={() => setSelectedChannel(channel)}
                                        className="p-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg font-semibold transition-colors"
                                    >
                                        📚 {channel}
                                    </button>
                                ))}
                            </div>
                        </section>
                    )}
                    {/* Section 5: Settings */}
                    {showSettings && (
                        <SettingsSection
                            navSide={defaults.navSide}
                            autoPlayMedia={defaults.autoPlayMedia}
                            connectOnStartup={defaults.connectOnStartup}
                            autoReconnectPeers={defaults.autoReconnectPeers}
                            fileRootDirectory={defaultFileRootDir}
                            onChangeNavSide={(side) => setConfig({ navSide: side })}
                            onToggleAutoPlay={(val) => setConfig({ autoPlayMedia: val })}
                            onToggleConnectOnStartup={(val) => setConfig({ connectOnStartup: val })}
                            onToggleAutoReconnectPeers={(val) => setConfig({ autoReconnectPeers: val })}
                            onChangeFileRootDirectory={(path) => setConfig({ fileRootDirectory: path })}
                        />
                    )}
                </>
            )}
        </div>
    );
}
