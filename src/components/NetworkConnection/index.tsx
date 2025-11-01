'use client';

import React, { useState, useEffect } from 'react';
import { connectNetwork, getKaleidoConfig, getChannels } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { Network, CheckCircle, AlertCircle, Zap } from 'lucide-react';

interface ChaincodeStatus {
  id: string;
  name: string;
  version: string;
  status: 'installed' | 'instantiated' | 'unknown';
}

export default function NetworkConnection() {
  const [gateway, setGateway] = useState('');
  const [caUrl, setCaUrl] = useState('');
  const [configLoaded, setConfigLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chaincodes, setChaincodes] = useState<ChaincodeStatus[]>([]);
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
      setGateway('https://api.kaleido.io');
      setCaUrl('https://ca.kaleido.io');
      setConfigLoaded(true);
    }
  }, []);

  // Check chaincode status when connected
  useEffect(() => {
    if (connected && !checkingStatus) {
      checkChaincodeStatus();
    }
  }, [connected]);

  const checkChaincodeStatus = async () => {
    setCheckingStatus(true);
    try {
      const result: any = await getChannels();
      const channels = result?.channels || result || [];
      
      const chaincodeMap: { [key: string]: ChaincodeStatus } = {};
      channels.forEach((channel: any) => {
        if (channel.chaincode_id) {
          if (!chaincodeMap[channel.chaincode_id]) {
            chaincodeMap[channel.chaincode_id] = {
              id: channel.chaincode_id,
              name: channel.chaincode_id.replace('-', '_'),
              version: '1.0',
              status: 'instantiated'
            };
          }
        }
      });
      
      const chaincodeList = Object.values(chaincodeMap);
      setChaincodes(chaincodeList);
    } catch (err) {
      console.error('Failed to check chaincode status:', err);
      // Set default chaincodes
      setChaincodes([
        { id: 'movie-chaincode', name: 'movie', version: '1.0', status: 'instantiated' }
      ]);
    } finally {
      setCheckingStatus(false);
    }
  };

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
      // Check chaincodes after successful connection
      await checkChaincodeStatus();
    } catch (err: any) {
      setError(err.message || 'Failed to connect');
      setConnected(false);
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
              disabled={connected}
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-700 px-4 py-2 text-white focus:border-cyan-400 focus:outline-none disabled:opacity-50"
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
              disabled={connected}
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-700 px-4 py-2 text-white focus:border-cyan-400 focus:outline-none disabled:opacity-50"
              placeholder="https://ca.kaleido.io"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-red-900 p-4 text-red-200">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <button
            onClick={handleConnect}
            disabled={loading || connected}
            className="w-full rounded-lg bg-cyan-600 px-4 py-2 font-semibold hover:bg-cyan-700 disabled:opacity-50 transition-colors"
          >
            {loading
              ? 'Connecting...'
              : connected
                ? '✓ Connected'
                : 'Connect to Network'}
          </button>

          <div className="rounded-lg bg-slate-700 p-4">
            <h3 className="mb-3 font-semibold text-cyan-400">
              Network Status
            </h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {connected ? (
                  <CheckCircle className="h-5 w-5 text-green-400" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-400" />
                )}
                <span>
                  {connected ? '🟢 Connected' : '🔴 Disconnected'}
                </span>
              </div>
              {configLoaded && (
                <p className="text-sm text-slate-300">
                  Network ID: {getKaleidoConfig().networkId}
                </p>
              )}
            </div>
          </div>

          {/* Chaincode Status Section */}
          {connected && chaincodes.length > 0 && (
            <div className="rounded-lg border border-cyan-600 bg-slate-700 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-400" />
                <h3 className="font-semibold text-cyan-400">
                  Chaincode Status
                </h3>
              </div>
              <div className="space-y-2">
                {chaincodes.map((cc) => (
                  <div key={cc.id} className="flex items-center justify-between rounded bg-slate-600 px-3 py-2 text-sm">
                    <div>
                      <p className="font-mono font-semibold">{cc.name}</p>
                      <p className="text-xs text-slate-400">v{cc.version}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-400" />
                      <span className="text-xs text-green-300">
                        {cc.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
