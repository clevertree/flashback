'use client';

import React, { useState, useEffect } from 'react';
import { queryChaincodeAsync, invokeChaincodeAsync } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { Film, Search, RefreshCw, Star, Plus, X } from 'lucide-react';
import ContentSubmissionModal from '@/components/ContentSubmissionModal';

// Constants for live movie chaincode
const MOVIE_CHANNEL = 'movies-general';
const MOVIE_CHAINCODE = 'flashback_repository';

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
  const [content, setContent] = useState<Movie[]>([]);
  const [filteredContent, setFilteredContent] = useState<Movie[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Filter states
  const [showFilters, setShowFilters] = useState(false);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [yearRange, setYearRange] = useState<{ min: number; max: number }>({
    min: 1990,
    max: 2025,
  });
  const [ratingRange, setRatingRange] = useState<{ min: number; max: number }>({
    min: 0,
    max: 10,
  });
  const [selectedDirector, setSelectedDirector] = useState('');
  
  // Submission modal state
  const [submissionModalOpen, setSubmissionModalOpen] = useState(false);

  // Load movies on mount
  useEffect(() => {
    loadMovies();
  }, []);

  const loadMovies = async () => {
    setLoading(true);
    setError(null);
    try {
      const result: any = await queryChaincodeAsync(
        MOVIE_CHANNEL,
        MOVIE_CHAINCODE,
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
      setFilteredContent(movies);
      console.log(`Loaded ${movies.length} movies from live chaincode`);
    } catch (err: any) {
      setError(err.message || 'Failed to load movies from chaincode');
      setContent([]);
      setFilteredContent([]);
      console.error('Error loading movies:', err);
    } finally {
      setLoading(false);
    }
  };

  // Apply filters to content
  const applyFilters = (moviesToFilter: Movie[]): Movie[] => {
    return moviesToFilter.filter((movie) => {
      // Genre filter
      if (selectedGenres.length > 0 && movie.genres) {
        const hasGenre = selectedGenres.some((genre) =>
          movie.genres?.some(
            (g) => g.toLowerCase() === genre.toLowerCase()
          )
        );
        if (!hasGenre) return false;
      }

      // Year filter
      if (movie.release_year) {
        if (
          movie.release_year < yearRange.min ||
          movie.release_year > yearRange.max
        ) {
          return false;
        }
      }

      // Rating filter
      if (movie.average_rating !== undefined) {
        if (
          movie.average_rating < ratingRange.min ||
          movie.average_rating > ratingRange.max
        ) {
          return false;
        }
      }

      // Director filter
      if (
        selectedDirector &&
        (!movie.director ||
          !movie.director
            .toLowerCase()
            .includes(selectedDirector.toLowerCase()))
      ) {
        return false;
      }

      return true;
    });
  };

  // Update filtered content when filters or content changes
  useEffect(() => {
    const filtered = applyFilters(content);
    setFilteredContent(filtered);
  }, [selectedGenres, yearRange, ratingRange, selectedDirector, content]);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setIsSearching(false);
      await loadMovies();
      return;
    }

    setIsSearching(true);
    setError(null);
    try {
      // Call SearchByTitle function from movie chaincode
      const result: any = await queryChaincodeAsync(
        MOVIE_CHANNEL,
        MOVIE_CHAINCODE,
        'SearchByTitle',
        [query, '50'] // query and limit (increased for better filtering)
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
      const filtered = applyFilters(searchResults);
      setFilteredContent(filtered);
      
      if (filtered.length === 0) {
        setError(
          `No results found for "${query}"${
            selectedGenres.length > 0 ||
            selectedDirector ||
            yearRange.min !== 1990 ||
            yearRange.max !== 2025
              ? ' with current filters'
              : ''
          }`
        );
      }
    } catch (err: any) {
      setError(err.message || `Search failed for "${query}"`);
      setContent([]);
      setFilteredContent([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleRefresh = async () => {
    setSearchQuery('');
    setIsSearching(false);
    await loadMovies();
  };

  // Get unique genres from all loaded movies
  const getAllGenres = (): string[] => {
    const genreSet = new Set<string>();
    content.forEach((movie) => {
      movie.genres?.forEach((genre) => genreSet.add(genre));
    });
    return Array.from(genreSet).sort();
  };

  // Get unique directors from all loaded movies
  const getAllDirectors = (): string[] => {
    const directorSet = new Set<string>();
    content.forEach((movie) => {
      if (movie.director) directorSet.add(movie.director);
    });
    return Array.from(directorSet).sort();
  };

  return (
    <div className="grid grid-cols-3 gap-6">
      {/* Sidebar */}
      <div className="rounded-lg bg-slate-800 p-6">
        <h3 className="mb-4 text-xl font-bold">Channel & Filters</h3>
        <div className="space-y-4">
          {/* Channel Info */}
          <div className="flex items-center gap-3 rounded-lg bg-slate-700 px-4 py-3">
            <Film className="h-6 w-6 text-cyan-500" />
            <div className="flex-1">
              <p className="font-semibold">Movies</p>
              <p className="text-sm text-slate-400">
                {MOVIE_CHANNEL}
              </p>
            </div>
          </div>
          
          <div className="rounded-lg bg-slate-900 p-3">
            <p className="text-sm text-slate-400">
              <strong>Loaded:</strong> {content.length} movies
            </p>
            <p className="mt-1 text-sm text-slate-400">
              <strong>Shown:</strong> {filteredContent.length}
              {selectedGenres.length > 0 ||
              selectedDirector ||
              yearRange.min !== 1990 ||
              yearRange.max !== 2025
                ? ' (filtered)'
                : ''}
            </p>
            {isSearching && (
              <p className="mt-1 text-sm text-cyan-400">Searching...</p>
            )}
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="w-full rounded-lg bg-slate-700 px-4 py-2 font-semibold transition-colors hover:bg-slate-600"
          >
            {showFilters ? '▼ Hide Filters' : '▶ Show Filters'}
          </button>

          {/* Filters Panel */}
          {showFilters && (
            <div className="space-y-4 rounded-lg border border-slate-600 bg-slate-900 p-4">
              {/* Genre Filter */}
              <div>
                <p className="mb-2 text-sm font-semibold text-slate-300">
                  Genres
                </p>
                <div className="flex flex-wrap gap-2">
                  {getAllGenres().slice(0, 8).map((genre) => (
                    <button
                      key={genre}
                      onClick={() => {
                        setSelectedGenres((prev) =>
                          prev.includes(genre)
                            ? prev.filter((g) => g !== genre)
                            : [...prev, genre]
                        );
                      }}
                      className={`rounded px-2 py-1 text-xs transition-colors ${
                        selectedGenres.includes(genre)
                          ? 'bg-cyan-600 text-white'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      {genre}
                    </button>
                  ))}
                </div>
              </div>

              {/* Year Filter */}
              <div>
                <p className="mb-2 text-sm font-semibold text-slate-300">
                  Year: {yearRange.min} - {yearRange.max}
                </p>
                <div className="space-y-2">
                  <input
                    type="range"
                    min="1900"
                    max="2025"
                    value={yearRange.min}
                    onChange={(e) =>
                      setYearRange((prev) => ({
                        ...prev,
                        min: Math.min(
                          parseInt(e.target.value),
                          prev.max
                        ),
                      }))
                    }
                    className="w-full"
                  />
                  <input
                    type="range"
                    min="1900"
                    max="2025"
                    value={yearRange.max}
                    onChange={(e) =>
                      setYearRange((prev) => ({
                        ...prev,
                        max: Math.max(
                          parseInt(e.target.value),
                          prev.min
                        ),
                      }))
                    }
                    className="w-full"
                  />
                </div>
              </div>

              {/* Rating Filter */}
              <div>
                <p className="mb-2 text-sm font-semibold text-slate-300">
                  Rating: {ratingRange.min.toFixed(1)} -{' '}
                  {ratingRange.max.toFixed(1)}
                </p>
                <div className="space-y-2">
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="0.1"
                    value={ratingRange.min}
                    onChange={(e) =>
                      setRatingRange((prev) => ({
                        ...prev,
                        min: Math.min(
                          parseFloat(e.target.value),
                          prev.max
                        ),
                      }))
                    }
                    className="w-full"
                  />
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="0.1"
                    value={ratingRange.max}
                    onChange={(e) =>
                      setRatingRange((prev) => ({
                        ...prev,
                        max: Math.max(
                          parseFloat(e.target.value),
                          prev.min
                        ),
                      }))
                    }
                    className="w-full"
                  />
                </div>
              </div>

              {/* Director Filter */}
              <div>
                <p className="mb-2 text-sm font-semibold text-slate-300">
                  Director
                </p>
                <select
                  value={selectedDirector}
                  onChange={(e) => setSelectedDirector(e.target.value)}
                  className="w-full rounded bg-slate-700 px-3 py-2 text-sm text-white"
                >
                  <option value="">All Directors</option>
                  {getAllDirectors().slice(0, 30).map((director) => (
                    <option key={director} value={director}>
                      {director}
                    </option>
                  ))}
                </select>
              </div>

              {/* Reset Filters */}
              <button
                onClick={() => {
                  setSelectedGenres([]);
                  setYearRange({ min: 1990, max: 2025 });
                  setRatingRange({ min: 0, max: 10 });
                  setSelectedDirector('');
                }}
                className="w-full rounded-lg bg-orange-900 px-3 py-2 text-sm font-semibold transition-colors hover:bg-orange-800"
              >
                Reset Filters
              </button>
            </div>
          )}

          <button
            onClick={handleRefresh}
            disabled={loading || isSearching}
            className="w-full rounded-lg bg-cyan-600 px-4 py-2 font-semibold transition-colors hover:bg-cyan-700 disabled:bg-slate-600"
          >
            {loading ? 'Loading...' : 'Refresh Movies'}
          </button>

          {error && (
            <div className="mt-2 rounded-lg bg-red-900 p-3 text-sm text-red-200">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Movie Browser - Large Content Area */}
      <div className="col-span-2 rounded-lg bg-slate-800 p-6">
        <div>
          <div className="mb-6">
            <h3 className="mb-2 text-2xl font-bold">
              Movies
            </h3>
            <p className="mb-4 text-slate-300">
              Browse and search the movie database
            </p>

            {/* Search Bar and Actions */}
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
              <button
                onClick={() => setSubmissionModalOpen(true)}
                disabled={loading || isSearching}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 font-semibold transition-colors hover:bg-emerald-700 disabled:bg-slate-600"
                title="Submit a missing movie"
              >
                <Plus className="h-5 w-5" />
                Submit
              </button>
            </div>
          </div>

          {loading || isSearching ? (
            <div className="flex items-center justify-center py-20">
              <p className="text-slate-400">
                {isSearching ? 'Searching...' : 'Loading content from chaincode...'}
              </p>
            </div>
          ) : filteredContent.length > 0 ? (
            <div className="grid grid-cols-2 gap-4">
              {filteredContent.map((movie: Movie) => (
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
                {filteredContent.length === 0 && content.length > 0
                  ? 'No movies match your filters'
                  : error && searchQuery
                  ? `No results found for "${searchQuery}"`
                  : 'No content available'}
              </p>
            </div>
          )}

          {error && !isSearching && (
            <div className="mt-4 rounded-lg bg-red-900 p-4 text-sm text-red-200">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Submission Modal */}
      <ContentSubmissionModal
        isOpen={submissionModalOpen}
        onClose={() => setSubmissionModalOpen(false)}
        onSuccess={() => {
          // Refresh movies after successful submission
          loadMovies();
        }}
        existingMovies={content.map((m) => ({
          imdb_id: m.imdb_id,
          title: m.title,
        }))}
      />
    </div>
  );
}
