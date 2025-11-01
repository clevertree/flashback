'use client';

import React, { useState, useEffect } from 'react';
import { getChannels, queryChaincodeAsync } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { Play, Tv, Gamepad2, Vote, Film, Search, RefreshCw, Star } from 'lucide-react';

interface Channel {
  id: string;
  name: string;
  description: string;
  chaincode_id: string;
}

interface Movie {
  imdb_id: string;
  title: string;
  director?: string;
  release_year?: number;
  genres?: string[];
  description?: string;
  torrent_hash?: string;
  views?: number;
  average_rating?: number;
}

export default function ChannelBrowser() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] =
    useState<Channel | null>(null);
  const [content, setContent] = useState<Movie[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
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
    setSearchQuery('');
    setIsSearching(false);
    setLoading(true);
    setError(null);
    try {
      // Call QueryAll function from movie chaincode
      const result: any = await queryChaincodeAsync(
        channel.id,
        channel.chaincode_id,
        'QueryAll',
        []
      );
      
      // Handle different response formats
      let movies: Movie[] = [];
      if (result?.data && Array.isArray(result.data)) {
        movies = result.data;
      } else if (Array.isArray(result)) {
        movies = result;
      } else if (result?.results && Array.isArray(result.results)) {
        movies = result.results;
      }
      
      setContent(movies);
      if (movies.length === 0) {
        setError(null); // Clear error if no results (expected for new channel)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load content from chaincode');
      setContent([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (query: string) => {
    if (!selectedChannel) return;
    
    setSearchQuery(query);
    if (!query.trim()) {
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setError(null);
    try {
      // Call SearchByTitle function from movie chaincode
      const result: any = await queryChaincodeAsync(
        selectedChannel.id,
        selectedChannel.chaincode_id,
        'SearchByTitle',
        [query, '20'] // query and limit
      );
      
      // Handle different response formats
      let searchResults: Movie[] = [];
      if (result?.data && Array.isArray(result.data)) {
        searchResults = result.data;
      } else if (Array.isArray(result)) {
        searchResults = result;
      } else if (result?.results && Array.isArray(result.results)) {
        searchResults = result.results;
      }
      
      setContent(searchResults);
      if (searchResults.length === 0) {
        setError(`No results found for "${query}"`);
      }
    } catch (err: any) {
      setError(err.message || `Search failed for "${query}"`);
      setContent([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleRefresh = async () => {
    if (selectedChannel) {
      setSearchQuery('');
      setIsSearching(false);
      await handleChannelSelect(selectedChannel);
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
            <div className="mb-6">
              <h3 className="mb-2 text-2xl font-bold">
                {selectedChannel.name}
              </h3>
              <p className="mb-4 text-slate-300">
                {selectedChannel.description}
              </p>

              {/* Search Bar */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    placeholder="Search movies by title..."
                    className="w-full rounded-lg border border-slate-600 bg-slate-700 py-2 pl-10 pr-4 text-white placeholder-slate-400 focus:border-cyan-400 focus:outline-none"
                    disabled={loading || isSearching}
                  />
                </div>
                <button
                  onClick={handleRefresh}
                  disabled={loading || isSearching}
                  className="rounded-lg bg-slate-700 px-4 py-2 hover:bg-slate-600 disabled:opacity-50"
                  title="Refresh content"
                >
                  <RefreshCw className="h-5 w-5" />
                </button>
              </div>
            </div>

            {loading || isSearching ? (
              <div className="flex items-center justify-center py-20">
                <p className="text-slate-400">
                  {isSearching ? 'Searching...' : 'Loading content from chaincode...'}
                </p>
              </div>
            ) : content.length > 0 ? (
              <div className="grid grid-cols-2 gap-4">
                {content.map((movie: Movie) => (
                  <div
                    key={movie.imdb_id}
                    className="overflow-hidden rounded-lg bg-slate-700 transition-transform hover:scale-105"
                  >
                    <div className="mb-3 h-40 rounded bg-gradient-to-br from-cyan-600 to-slate-600 flex items-center justify-center">
                      <Film className="h-12 w-12 text-slate-300 opacity-50" />
                    </div>
                    <div className="p-4">
                      <h4 className="mb-1 font-semibold leading-tight">
                        {movie.title}
                      </h4>
                      <p className="mb-2 text-xs text-slate-400">
                        {movie.director && `Dir: ${movie.director}`}
                        {movie.release_year && ` • ${movie.release_year}`}
                      </p>
                      {movie.genres && movie.genres.length > 0 && (
                        <div className="mb-2 flex flex-wrap gap-1">
                          {movie.genres.slice(0, 2).map((genre) => (
                            <span
                              key={genre}
                              className="inline-block rounded bg-cyan-900 px-2 py-1 text-xs text-cyan-200"
                            >
                              {genre}
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="mb-2 line-clamp-2 text-sm text-slate-300">
                        {movie.description}
                      </p>
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>IMDb: {movie.imdb_id}</span>
                        {movie.average_rating && (
                          <div className="flex items-center gap-1">
                            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                            <span>{movie.average_rating.toFixed(1)}</span>
                          </div>
                        )}
                      </div>
                      {movie.torrent_hash && (
                        <p className="mt-2 truncate rounded bg-slate-600 px-2 py-1 text-xs text-cyan-300" title={movie.torrent_hash}>
                          Hash: {movie.torrent_hash.substring(0, 12)}...
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center py-20">
                <p className="text-slate-400">
                  {error && searchQuery
                    ? `No results found for "${searchQuery}"`
                    : 'No content available in this channel'}
                </p>
              </div>
            )}

            {error && !isSearching && (
              <div className="mt-4 rounded-lg bg-red-900 p-4 text-sm text-red-200">
                {error}
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
