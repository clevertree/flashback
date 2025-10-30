import type {NavSide} from "@app/config";
import React from "react";

export interface SettingsSectionProps {
    navSide: NavSide
    autoPlayMedia: boolean
    connectOnStartup: boolean
    autoReconnectPeers: boolean
    fileRootDirectory?: string
    onChangeNavSide: (side: NavSide) => void
    onToggleAutoPlay: (val: boolean) => void
    onToggleConnectOnStartup: (val: boolean) => void
    onToggleAutoReconnectPeers: (val: boolean) => void
    onChangeFileRootDirectory: (path: string) => void
}

export default function SettingsSection({
                                            navSide,
                                            autoPlayMedia,
                                            connectOnStartup,
                                            autoReconnectPeers,
                                            fileRootDirectory,
                                            onChangeNavSide,
                                            onToggleAutoPlay,
                                            onToggleConnectOnStartup,
                                            onToggleAutoReconnectPeers,
                                            onChangeFileRootDirectory
                                        }: SettingsSectionProps) {
    return (
        <section id="settings" className="bg-gray-800 rounded-lg p-6 shadow-lg mt-8">
            <h2 className="text-2xl font-semibold mb-4 text-white">Settings</h2>

            <div className="space-y-6">
                <div>
                    <h3 className="text-lg font-medium mb-2 text-gray-200">Navigation</h3>
                    <div className="inline-flex rounded border border-gray-600 overflow-hidden" role="group"
                         aria-label="Nav side">
                        {(['left', 'right'] as NavSide[]).map((side) => (
                            <button
                                key={side}
                                onClick={() => onChangeNavSide(side)}
                                className={`px-3 py-1 text-sm ${navSide === side ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
                            >
                                {side.toUpperCase()}
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <h3 className="text-lg font-medium mb-2 text-gray-200">Media</h3>
                    <label className="inline-flex items-center gap-2 text-sm text-gray-300">
                        <input type="checkbox" checked={autoPlayMedia}
                               onChange={(e) => onToggleAutoPlay(e.target.checked)}/>
                        Auto-play media streams
                    </label>
                </div>

                <div>
                    <h3 className="text-lg font-medium mb-2 text-gray-200">Connectivity</h3>
                    <div className="flex flex-col gap-2 text-sm text-gray-300">
                        <label className="inline-flex items-center gap-2">
                            <input type="checkbox" checked={connectOnStartup}
                                   onChange={(e) => onToggleConnectOnStartup(e.target.checked)} />
                            Connect to server on startup
                        </label>
                        <label className="inline-flex items-center gap-2">
                            <input type="checkbox" checked={autoReconnectPeers}
                                   onChange={(e) => onToggleAutoReconnectPeers(e.target.checked)} />
                            Auto re-connect to known peers
                        </label>
                    </div>
                </div>

                <div>
                    <h3 className="text-lg font-medium mb-2 text-gray-200">File Hosting</h3>
                    <div className="flex flex-col gap-2">
                        <label className="text-sm text-gray-300">
                            Root Directory for File Sharing
                        </label>
                        <input
                            type="text"
                            value={fileRootDirectory || ''}
                            onChange={(e) => onChangeFileRootDirectory(e.target.value)}
                            placeholder="/path/to/shared/files"
                            className="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500"
                        />
                        <p className="text-xs text-gray-400">
                            Set the directory path where files will be hosted to other clients via HTTPS. This is a local setting used by the HTTP file serving listener.
                        </p>
                    </div>
                </div>
            </div>
        </section>
    )
}