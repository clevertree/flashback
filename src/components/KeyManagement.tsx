'use client';

import React, { useState } from 'react';
import { generateKeypair, saveIdentity, loadIdentity } from '@/lib/api';
import { Key, Upload } from 'lucide-react';

export default function KeyManagement() {
  const [loading, setLoading] = useState(false);
  const [identity, setIdentity] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateKey = async () => {
    setLoading(true);
    setError(null);
    try {
      const result: any = await generateKeypair();
      setIdentity({
        user_id: 'user1',
        org_name: 'Org1',
        mspid: 'Org1MSP',
        ...result,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to generate keypair');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveIdentity = async () => {
    if (!identity) return;
    try {
      await saveIdentity('/tmp/fabric-identity.json', identity);
      alert('Identity saved successfully!');
    } catch (err: any) {
      setError(err.message || 'Failed to save identity');
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-slate-800 p-6">
        <div className="mb-4 flex items-center gap-2">
          <Key className="h-6 w-6 text-cyan-400" />
          <h2 className="text-2xl font-bold">Key Management</h2>
        </div>

        <div className="space-y-4">
          <button
            onClick={handleGenerateKey}
            disabled={loading}
            className="w-full rounded-lg bg-cyan-600 px-4 py-2 font-semibold hover:bg-cyan-700 disabled:opacity-50"
          >
            {loading ? 'Generating...' : 'Generate New Keypair'}
          </button>

          {error && (
            <div className="rounded-lg bg-red-900 p-4 text-red-200">
              {error}
            </div>
          )}

          {identity && (
            <div className="space-y-4">
              <div className="rounded-lg bg-slate-700 p-4">
                <h3 className="mb-2 font-semibold text-cyan-400">
                  Identity Generated
                </h3>
                <div className="space-y-2 text-sm">
                  <p>
                    <strong>User ID:</strong> {identity.user_id}
                  </p>
                  <p>
                    <strong>Org:</strong> {identity.org_name}
                  </p>
                  <p>
                    <strong>MSPID:</strong> {identity.mspid}
                  </p>
                  <div className="mt-4">
                    <p className="mb-2 font-semibold">Private Key:</p>
                    <code className="block max-h-24 overflow-auto rounded bg-slate-800 p-2 text-xs">
                      {identity.private_key?.substring(0, 100)}...
                    </code>
                  </div>
                </div>
              </div>

              <button
                onClick={handleSaveIdentity}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 font-semibold hover:bg-green-700"
              >
                <Upload className="h-4 w-4" />
                Save Identity
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
