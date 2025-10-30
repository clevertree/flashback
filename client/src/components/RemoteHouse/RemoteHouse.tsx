import React, { useEffect, useState } from "react";

export interface RemoteHouseProps {
  clientIp: string;
  clientPort: number;
  clientEmail?: string;
  onClose?: () => void;
}

export interface RemoteFile {
  name: string;
  type: "file" | "directory";
  size?: number;
  modified?: string;
}

export default function RemoteHouse({
  clientIp,
  clientPort,
  clientEmail,
  onClose,
}: RemoteHouseProps) {
  const [files, setFiles] = useState<RemoteFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<RemoteFile | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [filePreviewType, setFilePreviewType] = useState<"text" | "image" | "video" | "none">("none");

  // Supported file extensions for viewing
  const SUPPORTED_EXTENSIONS = {
    text: [".md", ".markdown", ".txt", ".css"],
    image: [".jpg", ".jpeg", ".png", ".gif", ".webp"],
    video: [".mp4", ".webm", ".mov", ".avi"],
    audio: [".mp3", ".wav", ".m4a", ".flac"],
  };

  useEffect(() => {
    fetchFileList();
  }, [clientIp, clientPort]);

  async function fetchFileList() {
    setLoading(true);
    setError(null);
    setFiles([]);
    try {
      const api: any = window.flashbackApi;
      if (!api) {
        throw new Error("API not available");
      }
      // TODO: Call API to fetch files from remote client
      // For now, use mock data to demonstrate the UI
      setFiles([
        { name: "README.md", type: "file", size: 2048 },
        { name: "guide.md", type: "file", size: 4096 },
        { name: "style.css", type: "file", size: 1024 },
        { name: "photo.jpg", type: "file", size: 102400 },
        { name: "video.mp4", type: "file", size: 5242880 },
      ]);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  async function openFile(file: RemoteFile) {
    setSelectedFile(file);
    setFileContent(null);
    setFilePreviewType("none");

    try {
      const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();

      // Determine file type
      if (SUPPORTED_EXTENSIONS.text.includes(ext)) {
        setFilePreviewType("text");
        // TODO: Fetch text file content from remote
        setFileContent(`# ${file.name}\n\nFile content preview (TODO: fetch from remote)`);
      } else if (SUPPORTED_EXTENSIONS.image.includes(ext)) {
        setFilePreviewType("image");
        // TODO: Fetch image from remote
      } else if (SUPPORTED_EXTENSIONS.video.includes(ext)) {
        setFilePreviewType("video");
        // TODO: Fetch video URL from remote
      } else if (SUPPORTED_EXTENSIONS.audio.includes(ext)) {
        setFilePreviewType("video"); // Reuse video preview for audio
        // TODO: Fetch audio URL from remote
      } else {
        setError("File type not supported for preview");
      }
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  }

  function formatFileSize(bytes?: number): string {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 rounded-lg shadow-2xl w-full max-w-4xl h-4/5 flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-slate-700">
          <div>
            <h2 className="text-2xl font-semibold text-white">Remote House</h2>
            <p className="text-sm text-gray-400">
              {clientEmail || `${clientIp}:${clientPort}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded"
          >
            Close
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* File List Panel */}
          <div className="w-1/3 border-r border-slate-700 overflow-y-auto p-4">
            <h3 className="text-lg font-medium mb-4 text-white">Files</h3>

            {loading && <div className="text-gray-400">Loading files...</div>}
            {error && <div className="text-red-500 text-sm">{error}</div>}

            {!loading && files.length === 0 && !error && (
              <div className="text-gray-400 text-sm">No files available</div>
            )}

            <div className="space-y-1">
              {files.map((file) => (
                <button
                  key={file.name}
                  onClick={() => openFile(file)}
                  className={`w-full text-left px-3 py-2 rounded transition-colors ${
                    selectedFile?.name === file.name
                      ? "bg-blue-600 text-white"
                      : "hover:bg-slate-700 text-gray-200"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-mono text-sm truncate">{file.name}</span>
                    <span className="text-xs text-gray-400 ml-2">
                      {formatFileSize(file.size)}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={fetchFileList}
              disabled={loading}
              className="w-full mt-4 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded text-sm"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {/* File Preview Panel */}
          <div className="w-2/3 overflow-auto p-4">
            {!selectedFile && (
              <div className="text-gray-400 text-center py-12">
                Select a file to preview
              </div>
            )}

            {selectedFile && filePreviewType === "text" && (
              <div>
                <h4 className="text-lg font-medium mb-4 text-white">{selectedFile.name}</h4>
                {fileContent ? (
                  <pre className="bg-slate-900 p-4 rounded overflow-auto text-gray-300 text-sm">
                    <code>{fileContent}</code>
                  </pre>
                ) : (
                  <div className="text-gray-400">Loading file content...</div>
                )}
              </div>
            )}

            {selectedFile && filePreviewType === "image" && (
              <div>
                <h4 className="text-lg font-medium mb-4 text-white">{selectedFile.name}</h4>
                <div className="bg-slate-900 rounded p-4 flex items-center justify-center">
                  {/* TODO: Load image from remote */}
                  <div className="text-gray-400">Image preview (TODO: load from remote)</div>
                </div>
              </div>
            )}

            {selectedFile && filePreviewType === "video" && (
              <div>
                <h4 className="text-lg font-medium mb-4 text-white">{selectedFile.name}</h4>
                <div className="bg-slate-900 rounded p-4">
                  {/* TODO: Embed video player */}
                  <div className="text-gray-400">Media player (TODO: implement)</div>
                </div>
              </div>
            )}

            {selectedFile && filePreviewType === "none" && (
              <div className="text-gray-400">
                File type not supported for preview: {selectedFile.name}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
