'use client';

import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import KeyManagement from '@/components/KeyManagement';
import NetworkConnection from '@/components/NetworkConnection';
import ChannelBrowser from '@/components/ChannelBrowser';
import TorrentManager from '@/components/TorrentManager';
import { useAppStore } from '@/lib/store';

export default function Home() {
  const [currentView, setCurrentView] = useState<
    'home' | 'keys' | 'network' | 'channels' | 'torrent'
  >('home');
  const { connected } = useAppStore();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white">
      {/* Header Navigation */}
      <header className="border-b border-slate-700 bg-slate-950 shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-cyan-400">
              Fabric Desktop Client
            </h1>
            <nav className="flex gap-2">
              <button
                onClick={() => setCurrentView('home')}
                className={`px-4 py-2 rounded transition-colors ${
                  currentView === 'home'
                    ? 'bg-cyan-600 text-white'
                    : 'bg-slate-700 hover:bg-slate-600'
                }`}
              >
                Home
              </button>
              <button
                onClick={() => setCurrentView('keys')}
                className={`px-4 py-2 rounded transition-colors ${
                  currentView === 'keys'
                    ? 'bg-cyan-600 text-white'
                    : 'bg-slate-700 hover:bg-slate-600'
                }`}
              >
                Keys
              </button>
              <button
                onClick={() => setCurrentView('network')}
                className={`px-4 py-2 rounded transition-colors ${
                  currentView === 'network'
                    ? 'bg-cyan-600 text-white'
                    : 'bg-slate-700 hover:bg-slate-600'
                }`}
              >
                Network
              </button>
              {connected && (
                <>
                  <button
                    onClick={() => setCurrentView('channels')}
                    className={`px-4 py-2 rounded transition-colors ${
                      currentView === 'channels'
                        ? 'bg-cyan-600 text-white'
                        : 'bg-slate-700 hover:bg-slate-600'
                    }`}
                  >
                    Channels
                  </button>
                  <button
                    onClick={() => setCurrentView('torrent')}
                    className={`px-4 py-2 rounded transition-colors ${
                      currentView === 'torrent'
                        ? 'bg-cyan-600 text-white'
                        : 'bg-slate-700 hover:bg-slate-600'
                    }`}
                  >
                    Torrent
                  </button>
                </>
              )}
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {currentView === 'home' && (
          <div className="rounded-lg bg-slate-800 p-8 text-center">
            <h2 className="mb-4 text-3xl font-bold">
              Welcome to Fabric Desktop Client
            </h2>
            <p className="mb-6 text-slate-300">
              Hyperledger Fabric network explorer with distributed file
              sharing via WebTorrent.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg bg-slate-700 p-4">
                <h3 className="mb-2 font-bold text-cyan-400">
                  Getting Started
                </h3>
                <p className="text-sm">
                  1. Generate or import keys
                  <br />
                  2. Connect to network
                  <br />
                  3. Browse channels
                  <br />
                  4. Download via torrent
                </p>
              </div>
              <div className="rounded-lg bg-slate-700 p-4">
                <h3 className="mb-2 font-bold text-cyan-400">Status</h3>
                <p className="text-sm">
                  Network: {connected ? '🟢 Connected' : '🔴 Disconnected'}
                </p>
              </div>
            </div>
          </div>
        )}

        {currentView === 'keys' && <KeyManagement />}
        {currentView === 'network' && <NetworkConnection />}
        {currentView === 'channels' && connected && (
          <ChannelBrowser />
        )}
        {currentView === 'torrent' && <TorrentManager />}
      </main>
    </div>
  );
}
