'use client';

import React, { useState, useEffect } from 'react';
import { getChannels, queryChaincodeAsync } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { Play, Tv, Gamepad2, Vote, Film } from 'lucide-react';

interface Channel {
  id: string;
  name: string;
  description: string;
  chaincode_id: string;
}

export default function ChannelBrowser() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] =
    useState<Channel | null>(null);
  const [content, setContent] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadChannels();
  }, []);

  const loadChannels = async () => {
    setLoading(true);
    try {
      const result: any = await getChannels();
      setChannels(result.channels || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load channels');
    } finally {
      setLoading(false);
    }
  };

  const handleChannelSelect = async (channel: Channel) => {
    setSelectedChannel(channel);
    setLoading(true);
    try {
      const result: any = await queryChaincodeAsync(
        channel.id,
        channel.chaincode_id,
        'queryAll',
        []
      );
      setContent(result?.results || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load content');
    } finally {
      setLoading(false);
    }
  };

  const getChannelIcon = (channelId: string) => {
    switch (channelId) {
      case 'movies':
        return <Film className="h-6 w-6" />;
      case 'tv-shows':
        return <Tv className="h-6 w-6" />;
      case 'games':
        return <Gamepad2 className="h-6 w-6" />;
      case 'voting':
        return <Vote className="h-6 w-6" />;
      default:
        return <Play className="h-6 w-6" />;
    }
  };

  return (
    <div className="grid grid-cols-3 gap-6">
      {/* Channel List */}
      <div className="rounded-lg bg-slate-800 p-6">
        <h3 className="mb-4 text-xl font-bold">Channels</h3>
        <div className="space-y-2">
          {loading && channels.length === 0 ? (
            <p className="text-slate-400">Loading channels...</p>
          ) : (
            channels.map((channel) => (
              <button
                key={channel.id}
                onClick={() => handleChannelSelect(channel)}
                className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 transition-colors ${
                  selectedChannel?.id === channel.id
                    ? 'bg-cyan-600'
                    : 'bg-slate-700 hover:bg-slate-600'
                }`}
              >
                <div className="text-cyan-400">
                  {getChannelIcon(channel.id)}
                </div>
                <div className="text-left">
                  <p className="font-semibold">{channel.name}</p>
                  <p className="text-xs text-slate-300">
                    {channel.description}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-red-900 p-4 text-sm text-red-200">
            {error}
          </div>
        )}
      </div>

      {/* Channel Browser - Large Content Area */}
      <div className="col-span-2 rounded-lg bg-slate-800 p-6">
        {selectedChannel ? (
          <div>
            <h3 className="mb-4 text-2xl font-bold">
              {selectedChannel.name}
            </h3>
            <p className="mb-6 text-slate-300">
              {selectedChannel.description}
            </p>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <p className="text-slate-400">Loading content...</p>
              </div>
            ) : content.length > 0 ? (
              <div className="grid grid-cols-2 gap-4">
                {content.map((item: any, idx: number) => (
                  <div
                    key={idx}
                    className="rounded-lg bg-slate-700 p-4"
                  >
                    <div className="mb-2 h-40 rounded bg-slate-600" />
                    <h4 className="font-semibold">
                      {item.title || `Content ${idx + 1}`}
                    </h4>
                    <p className="text-sm text-slate-300">
                      {item.description}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center py-20">
                <p className="text-slate-400">
                  No content available in this channel
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center py-20">
            <p className="text-slate-400">
              Select a channel to browse content
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
