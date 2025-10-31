import React, { useEffect, useState } from "react";

export interface RepoBrowserProps {
  channelName: string;
  onClose?: () => void;
}

export interface BlockchainEntry {
  id: string;
  title: string;
  description?: string;
  creator?: string;
  createdAt?: string;
  commentCount?: number;
  tags?: string[];
}

export default function RepoBrowser({
  channelName,
  onClose,
}: RepoBrowserProps) {
  const [entries, setEntries] = useState<BlockchainEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<BlockchainEntry | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTags, setFilterTags] = useState<Set<string>>(new Set());
  const [comments, setComments] = useState<any[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);

  // Load entries from Fabric channel on mount
  useEffect(() => {
    loadEntries();
  }, [channelName]);

  // Load comments when entry is selected
  useEffect(() => {
    if (selectedEntry) {
      loadComments(selectedEntry.id);
    }
  }, [selectedEntry]);

  async function loadEntries() {
    setLoading(true);
    setError(null);
    setEntries([]);

    try {
      const api: any = window.flashbackApi;
      if (!api || typeof api.fabricQueryEntries !== "function") {
        throw new Error("Fabric API bridge unavailable");
      }

      // Query entries from Fabric channel
      const result = await api.fabricQueryEntries(channelName, {
        query: searchQuery || undefined,
        tags: filterTags.size > 0 ? Array.from(filterTags) : undefined,
      });

      let entriesList: BlockchainEntry[] = [];
      if (typeof result === "string") {
        entriesList = JSON.parse(result);
      } else if (Array.isArray(result)) {
        entriesList = result;
      }

      setEntries(entriesList);
    } catch (e: any) {
      setError(`Failed to load entries: ${e.message}`);
      console.error("Error loading entries:", e);
    } finally {
      setLoading(false);
    }
  }

  async function loadComments(entryId: string) {
    setLoadingComments(true);
    setError(null);

    try {
      const api: any = window.flashbackApi;
      if (!api || typeof api.fabricQueryComments !== "function") {
        throw new Error("Fabric API bridge unavailable");
      }

      // Query comments for entry from Fabric
      const result = await api.fabricQueryComments(channelName, entryId);

      let commentsList: any[] = [];
      if (typeof result === "string") {
        commentsList = JSON.parse(result);
      } else if (Array.isArray(result)) {
        commentsList = result;
      }

      setComments(commentsList.filter((c) => c.status !== "deleted"));
    } catch (e: any) {
      setError(`Failed to load comments: ${e.message}`);
      console.error("Error loading comments:", e);
    } finally {
      setLoadingComments(false);
    }
  }

  async function handleSearch() {
    setSelectedEntry(null);
    setComments([]);
    await loadEntries();
  }

  async function handleTagFilter(tag: string) {
    const newTags = new Set(filterTags);
    if (newTags.has(tag)) {
      newTags.delete(tag);
    } else {
      newTags.add(tag);
    }
    setFilterTags(newTags);
    setSelectedEntry(null);
    setComments([]);
  }

  // Extract all unique tags from entries for filter suggestions
  const allTags = Array.from(
    new Set(entries.flatMap((e) => e.tags || []))
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 rounded-lg shadow-2xl w-full max-w-7xl h-5/6 flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-slate-700">
          <div>
            <h2 className="text-2xl font-semibold text-white">
              Repository Browser - {channelName}
            </h2>
            <p className="text-sm text-gray-400">
              Browse entries and comments on the Hyperledger Fabric blockchain
            </p>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded"
          >
            Close
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="p-4 border-b border-slate-700 bg-slate-750 space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              className="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-2 text-gray-200 placeholder-gray-400"
              placeholder="Search entries (title, description)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  handleSearch();
                }
              }}
            />
            <button
              onClick={handleSearch}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded"
            >
              {loading ? "Searching..." : "Search"}
            </button>
          </div>

          {/* Tag Filters */}
          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-gray-400 self-center">
                Filter by tags:
              </span>
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => handleTagFilter(tag)}
                  className={`px-3 py-1 rounded text-sm transition-colors ${
                    filterTags.has(tag)
                      ? "bg-blue-600 text-white"
                      : "bg-slate-700 hover:bg-slate-600 text-gray-300"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Entries List Panel */}
          <div className="w-1/3 border-r border-slate-700 overflow-y-auto p-4 flex flex-col">
            <h3 className="text-lg font-medium text-white mb-4">
              Entries ({entries.length})
            </h3>

            {error && (
              <div className="text-red-500 text-sm mb-4 p-3 bg-red-900 rounded">
                {error}
              </div>
            )}

            {loading && <div className="text-gray-400">Loading entries...</div>}

            {!loading && entries.length === 0 && !error && (
              <div className="text-gray-400 text-sm">
                No entries found. Try adjusting your search or filters.
              </div>
            )}

            <div className="space-y-2 flex-1">
              {entries.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => setSelectedEntry(entry)}
                  className={`w-full text-left p-3 rounded transition-colors border ${
                    selectedEntry?.id === entry.id
                      ? "bg-blue-600 border-blue-500 text-white"
                      : "border-slate-600 hover:bg-slate-700 text-gray-200"
                  }`}
                >
                  <div className="font-semibold truncate">{entry.title}</div>
                  {entry.creator && (
                    <div className="text-xs text-gray-400 truncate">
                      by {entry.creator}
                    </div>
                  )}
                  {entry.commentCount !== undefined && (
                    <div className="text-xs text-gray-400">
                      💬 {entry.commentCount} comments
                    </div>
                  )}
                  {entry.tags && entry.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {entry.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="text-xs bg-slate-600 px-2 py-1 rounded"
                        >
                          {tag}
                        </span>
                      ))}
                      {entry.tags.length > 3 && (
                        <span className="text-xs text-gray-400">
                          +{entry.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Entry Details & Comments Panel */}
          <div className="w-2/3 overflow-auto p-4 flex flex-col">
            {!selectedEntry && (
              <div className="text-gray-400 text-center py-12">
                Select an entry to view details and comments
              </div>
            )}

            {selectedEntry && (
              <>
                {/* Entry Details */}
                <div className="mb-6 pb-4 border-b border-slate-700">
                  <h2 className="text-2xl font-bold text-white mb-2">
                    {selectedEntry.title}
                  </h2>
                  <div className="text-sm text-gray-400 space-y-1">
                    {selectedEntry.creator && (
                      <div>
                        <span className="font-semibold">Creator:</span>{" "}
                        {selectedEntry.creator}
                      </div>
                    )}
                    {selectedEntry.createdAt && (
                      <div>
                        <span className="font-semibold">Created:</span>{" "}
                        {new Date(selectedEntry.createdAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>

                  {selectedEntry.description && (
                    <div className="mt-4 p-3 bg-slate-900 rounded text-gray-300">
                      {selectedEntry.description}
                    </div>
                  )}

                  {selectedEntry.tags && selectedEntry.tags.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {selectedEntry.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-xs bg-blue-600 px-3 py-1 rounded text-white"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Comments Section */}
                <div className="flex-1 flex flex-col">
                  <h3 className="text-lg font-semibold text-white mb-4">
                    Comments ({comments.length})
                  </h3>

                  {loadingComments && (
                    <div className="text-gray-400">Loading comments...</div>
                  )}

                  {!loadingComments && comments.length === 0 && (
                    <div className="text-gray-400 text-sm">
                      No comments yet. Be the first to comment!
                    </div>
                  )}

                  <div className="space-y-3 overflow-y-auto flex-1">
                    {comments.map((comment, idx) => (
                      <div
                        key={comment.id || idx}
                        className="p-3 bg-slate-900 rounded border border-slate-700"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="font-semibold text-sm text-gray-200">
                              {comment.commentedBy}
                            </div>
                            <div className="text-xs text-gray-500">
                              {comment.createdAt
                                ? new Date(
                                    comment.createdAt
                                  ).toLocaleDateString()
                                : ""}
                            </div>
                          </div>
                          {comment.rating && (
                            <div className="text-sm font-semibold text-yellow-400">
                              ⭐ {comment.rating}/5
                            </div>
                          )}
                        </div>
                        <p className="text-sm text-gray-300">
                          {comment.content}
                        </p>
                        {comment.editCount && comment.editCount > 0 && (
                          <div className="text-xs text-gray-500 mt-2">
                            (edited {comment.editCount} times)
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
