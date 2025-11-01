'use client';

import React, { useState, useEffect } from 'react';
import { connectNetwork, getKaleidoConfig } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { Network } from 'lucide-react';

export default function NetworkConnection() {
  const [gateway, setGateway] = useState('');
  const [caUrl, setCaUrl] = useState('');
  const [configLoaded, setConfigLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { connected, setConnected } = useAppStore();

  // Load Kaleido config on mount
  useEffect(() => {
    try {
      const config = getKaleidoConfig();
      const gatewayUrl = `https://${config.peerRestGateway}`;
      const caEndpoint = config.caEndpoint !== 'TBD' 
        ? `https://${config.caEndpoint}`
        : gatewayUrl;
      
      setGateway(gatewayUrl);
      setCaUrl(caEndpoint);
      setConfigLoaded(true);
    } catch (err) {
      console.error('Failed to load Kaleido config:', err);
      // Fallback to defaults
      setGateway('https://api.kaleido.io');
      setCaUrl('https://ca.kaleido.io');
      setConfigLoaded(true);
    }
  }, []);

  const handleConnect = async () => {
    setLoading(true);
    setError(null);
    try {
      const config = getKaleidoConfig();
      const mockIdentity = {
        user_id: 'user1',
        org_name: config.organization,
        mspid: config.organization,
        certificate: 'cert',
        private_key: 'key',
        public_key: 'pub',
        ca_certificate: 'ca_cert',
      };
      const result = await connectNetwork(
        gateway,
        caUrl,
        mockIdentity
      );
      setConnected(true);
      alert(`Connected to Kaleido network (${config.networkId}) successfully!`);
    } catch (err: any) {
      setError(err.message || 'Failed to connect');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-slate-800 p-6">
        <div className="mb-4 flex items-center gap-2">
          <Network
            className="h-6 w-6 text-cyan-400"
            data-testid="network-icon"
          />
          <h2 className="text-2xl font-bold">
            Network Connection
          </h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold">
              Gateway URL
            </label>
            <input
              type="text"
              value={gateway}
              onChange={(e) => setGateway(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-700 px-4 py-2 text-white focus:border-cyan-400 focus:outline-none"
              placeholder="https://api.kaleido.io"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold">
              CA URL
            </label>
            <input
              type="text"
              value={caUrl}
              onChange={(e) => setCaUrl(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-700 px-4 py-2 text-white focus:border-cyan-400 focus:outline-none"
              placeholder="https://ca.kaleido.io"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-900 p-4 text-red-200">
              {error}
            </div>
          )}

          <button
            onClick={handleConnect}
            disabled={loading || connected}
            className="w-full rounded-lg bg-cyan-600 px-4 py-2 font-semibold hover:bg-cyan-700 disabled:opacity-50"
          >
            {loading
              ? 'Connecting...'
              : connected
                ? '✓ Connected'
                : 'Connect to Network'}
          </button>

          <div className="rounded-lg bg-slate-700 p-4">
            <h3 className="mb-2 font-semibold text-cyan-400">
              Status
            </h3>
            <p>
              Network: {connected ? '🟢 Connected' : '🔴 Disconnected'}
            </p>
            {configLoaded && (
              <p className="mt-2 text-sm text-slate-300">
                Kaleido Network: {getKaleidoConfig().networkId}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
