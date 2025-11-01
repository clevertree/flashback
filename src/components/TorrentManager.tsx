'use client';

import React, { useState, useEffect } from 'react';
import { addTorrent, getTorrentProgress } from '@/lib/api';
import { Download, Pause, Play } from 'lucide-react';

interface Download {
  hash: string;
  progress: number;
  status: string;
  peers: number;
  download_speed: number;
}

export default function TorrentManager() {
  const [magnetLink, setMagnetLink] = useState('');
  const [outputPath, setOutputPath] = useState('/downloads');
  const [downloads, setDownloads] = useState<Download[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(updateDownloads, 1000);
    return () => clearInterval(interval);
  }, [downloads]);

  const updateDownloads = async () => {
    if (downloads.length === 0) return;
    try {
      const updated = await Promise.all(
        downloads.map(async (dl) => {
          const result: any = await getTorrentProgress(dl.hash);
          return result;
        })
      );
      setDownloads(updated);
    } catch (err) {
      console.error('Failed to update downloads:', err);
    }
  };

  const handleAddTorrent = async () => {
    if (!magnetLink) {
      setError('Please enter a magnet link');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result: any = await addTorrent(magnetLink, outputPath);
      setDownloads([
        ...downloads,
        {
          hash: result.hash,
          progress: 0,
          status: 'Pending',
          peers: 0,
          download_speed: 0,
        },
      ]);
      setMagnetLink('');
      alert('Torrent added successfully!');
    } catch (err: any) {
      setError(err.message || 'Failed to add torrent');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-slate-800 p-6">
        <div className="mb-4 flex items-center gap-2">
          <Download
            className="h-6 w-6 text-cyan-400"
            data-testid="download-icon"
          />
          <h2 className="text-2xl font-bold">Torrent Manager</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold">
              Magnet Link
            </label>
            <input
              type="text"
              value={magnetLink}
              onChange={(e) => setMagnetLink(e.target.value)}
              placeholder="magnet:?xt=urn:btih:..."
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-700 px-4 py-2 text-white focus:border-cyan-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold">
              Output Path
            </label>
            <input
              type="text"
              value={outputPath}
              onChange={(e) => setOutputPath(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-700 px-4 py-2 text-white focus:border-cyan-400 focus:outline-none"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-900 p-4 text-red-200">
              {error}
            </div>
          )}

          <button
            onClick={handleAddTorrent}
            disabled={loading}
            className="w-full rounded-lg bg-cyan-600 px-4 py-2 font-semibold hover:bg-cyan-700 disabled:opacity-50"
          >
            {loading ? 'Adding...' : 'Add Torrent'}
          </button>
        </div>
      </div>

      {/* Active Downloads */}
      {downloads.length > 0 && (
        <div className="rounded-lg bg-slate-800 p-6">
          <h3 className="mb-4 text-xl font-bold">
            Active Downloads ({downloads.length})
          </h3>
          <div className="space-y-4">
            {downloads.map((download) => (
              <div key={download.hash} className="rounded-lg bg-slate-700 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <code className="text-xs text-slate-300">
                    {download.hash.substring(0, 16)}...
                  </code>
                  <span className="text-sm font-semibold">
                    {(download.progress * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="mb-2 h-2 rounded-full bg-slate-600">
                  <div
                    className="h-full rounded-full bg-cyan-500 transition-all"
                    style={{
                      width: `${download.progress * 100}%`,
                    }}
                  />
                </div>
                <div className="flex items-center justify-between text-sm text-slate-300">
                  <span>Peers: {download.peers}</span>
                  <span>Speed: {download.download_speed} KB/s</span>
                  <span className="text-cyan-400">
                    {download.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
