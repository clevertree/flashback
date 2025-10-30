import React, { useEffect, useState } from "react";
import { listen, UnlistenFn } from "@tauri-apps/api/event";

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
  const [currentPath, setCurrentPath] = useState("/");
  const [files, setFiles] = useState<RemoteFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<RemoteFile | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [filePreviewType, setFilePreviewType] = useState<"text" | "image" | "video" | "none">("none");
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [httpServerPort, setHttpServerPort] = useState<number | null>(null);

  // Supported file extensions for viewing
  const SUPPORTED_EXTENSIONS = {
    text: [".md", ".markdown", ".txt", ".css", ".json", ".js", ".ts", ".tsx", ".jsx"],
    image: [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"],
    video: [".mp4", ".webm", ".mov", ".avi", ".mkv"],
    audio: [".mp3", ".wav", ".m4a", ".flac", ".aac"],
  };

  // Listen for HTTP server ready event
  useEffect(() => {
    let unlistenHttpServer: UnlistenFn | null = null;

    const setupListener = async () => {
      try {
        unlistenHttpServer = await listen<{ port: number }>(
          "http-file-server-ready",
          (event) => {
            const port = event.payload.port;
            console.log("HTTP file server ready on port:", port);
            setHttpServerPort(port);
          }
        );
      } catch (e) {
        console.error("Failed to listen for http-file-server-ready:", e);
      }
    };

    setupListener();

    return () => {
      if (unlistenHttpServer) {
        unlistenHttpServer();
      }
    };
  }, []);

  // Load index.md from root on component mount or when HTTP port changes
  useEffect(() => {
    if (httpServerPort) {
      loadFile("index.md");
    }
  }, [httpServerPort]);

  // Construct URL for file on HTTP server
  function getFileUrl(filePath: string): string {
    if (!httpServerPort) return "";
    const normalizedPath = filePath.startsWith("/") ? filePath : `/${filePath}`;
    return `http://127.0.0.1:${httpServerPort}${normalizedPath}`;
  }

  // Fetch file list from HTTP server
  async function fetchFileList() {
    if (!httpServerPort) {
      setError("HTTP server not ready");
      return;
    }

    setLoading(true);
    setError(null);
    setFiles([]);

    try {
      const pathForApi = currentPath === "/" ? "" : currentPath.slice(1);
      const url = `http://127.0.0.1:${httpServerPort}/api/files${
        pathForApi ? `/${pathForApi}` : ""
      }`;

      const response = await fetch(url);
      if (response.ok) {
        const fileList: RemoteFile[] = await response.json();
        setFiles(fileList);
      } else {
        setError(`Failed to fetch files: ${response.status} ${response.statusText}`);
      }
    } catch (e: any) {
      setError(`Failed to fetch file list: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  // Load and display a file
  async function loadFile(fileName: string) {
    if (!httpServerPort) {
      setError("HTTP server not ready");
      return;
    }

    setLoading(true);
    setError(null);
    setSelectedFile(null);
    setFileContent(null);
    setFileUrl(null);
    setFilePreviewType("none");

    try {
      const filePath = `${currentPath}${currentPath === "/" ? "" : "/"}${fileName}`.replace("//", "/");
      const newPath = filePath.substring(0, filePath.lastIndexOf("/")) || "/";
      setCurrentPath(newPath);

      const ext = fileName.substring(fileName.lastIndexOf(".")).toLowerCase();
      const contentUrl = `http://127.0.0.1:${httpServerPort}/content${filePath}`;
      const downloadUrl = `http://127.0.0.1:${httpServerPort}/download${filePath}`;

      const newFile: RemoteFile = {
        name: fileName,
        type: "file",
      };
      setSelectedFile(newFile);

      if (SUPPORTED_EXTENSIONS.text.includes(ext)) {
        setFilePreviewType("text");
        try {
          const response = await fetch(contentUrl);
          if (response.ok) {
            const text = await response.text();
            setFileContent(text);
          } else {
            setError(`Failed to load file: ${response.status} ${response.statusText}`);
          }
        } catch (e: any) {
          setError(`Failed to fetch file: ${e.message}`);
        }
      } else if (SUPPORTED_EXTENSIONS.image.includes(ext)) {
        setFilePreviewType("image");
        setFileUrl(downloadUrl);
      } else if (SUPPORTED_EXTENSIONS.video.includes(ext)) {
        setFilePreviewType("video");
        setFileUrl(downloadUrl);
      } else if (SUPPORTED_EXTENSIONS.audio.includes(ext)) {
        setFilePreviewType("video"); // Reuse video preview for audio
        setFileUrl(downloadUrl);
      } else {
        setError("File type not supported for preview");
      }
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  // Navigate to a directory
  async function navigateToDirectory(dirName: string) {
    const newPath = `${currentPath}${currentPath === "/" ? "" : "/"}${dirName}`.replace("//", "/");
    setCurrentPath(newPath);
    setSelectedFile(null);
    setFileContent(null);
    setFilePreviewType("none");
  }

  // Navigate up one directory
  function navigateUp() {
    if (currentPath !== "/") {
      const newPath = currentPath.substring(0, currentPath.lastIndexOf("/")) || "/";
      setCurrentPath(newPath);
      setSelectedFile(null);
      setFileContent(null);
      setFilePreviewType("none");
    }
  }

  // Fetch files when current path changes
  useEffect(() => {
    if (httpServerPort) {
      fetchFileList();
    }
  }, [currentPath, httpServerPort]);

  function formatFileSize(bytes?: number): string {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 rounded-lg shadow-2xl w-full max-w-6xl h-5/6 flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-slate-700">
          <div>
            <h2 className="text-2xl font-semibold text-white">Remote House</h2>
            <p className="text-sm text-gray-400">
              {clientEmail || `${clientIp}:${clientPort}`}
              {currentPath !== "/" && ` - ${currentPath}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded"
          >
            Close
          </button>
        </div>

        {/* Status Bar */}
        {!httpServerPort && (
          <div className="bg-yellow-900 text-yellow-200 px-4 py-2 text-sm">
            ⚠️ HTTP file server not ready. Make sure fileRootDirectory is configured.
          </div>
        )}

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* File List Panel */}
          <div className="w-1/3 border-r border-slate-700 overflow-y-auto p-4 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-white">Files</h3>
              {currentPath !== "/" && (
                <button
                  onClick={navigateUp}
                  className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded"
                  title="Go up one directory"
                >
                  ⬆️ Up
                </button>
              )}
            </div>

            {loading && <div className="text-gray-400">Loading files...</div>}
            {error && <div className="text-red-500 text-sm">{error}</div>}

            {!loading && files.length === 0 && !error && (
              <div className="text-gray-400 text-sm">No files available</div>
            )}

            <div className="space-y-1 flex-1">
              {files.map((file) => (
                <button
                  key={file.name}
                  onClick={() => {
                    if (file.type === "directory") {
                      navigateToDirectory(file.name);
                    } else {
                      loadFile(file.name);
                    }
                  }}
                  className={`w-full text-left px-3 py-2 rounded transition-colors ${
                    selectedFile?.name === file.name
                      ? "bg-blue-600 text-white"
                      : "hover:bg-slate-700 text-gray-200"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm truncate">
                      {file.type === "directory" ? "📁 " : "📄 "}
                      {file.name}
                    </span>
                    {file.type === "file" && (
                      <span className="text-xs text-gray-400 ml-2 whitespace-nowrap">
                        {formatFileSize(file.size)}
                      </span>
                    )}
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
            {!selectedFile && !httpServerPort && (
              <div className="text-gray-400 text-center py-12">
                HTTP server not ready. Please check your configuration.
              </div>
            )}

            {!selectedFile && httpServerPort && (
              <div className="text-gray-400 text-center py-12">
                Select a file to preview
              </div>
            )}

            {selectedFile && filePreviewType === "text" && (
              <div className="flex flex-col h-full">
                <h4 className="text-lg font-medium mb-4 text-white">{selectedFile.name}</h4>
                {fileContent ? (
                  <pre className="bg-slate-900 p-4 rounded overflow-auto text-gray-300 text-sm flex-1">
                    <code>{fileContent}</code>
                  </pre>
                ) : (
                  <div className="text-gray-400">Loading file content...</div>
                )}
              </div>
            )}

            {selectedFile && filePreviewType === "image" && (
              <div className="flex flex-col h-full">
                <h4 className="text-lg font-medium mb-4 text-white">{selectedFile.name}</h4>
                <div className="bg-slate-900 rounded p-4 flex items-center justify-center flex-1">
                  {fileUrl ? (
                    <img
                      src={fileUrl}
                      alt={selectedFile.name}
                      className="max-w-full max-h-full object-contain"
                      onError={() => setError("Failed to load image")}
                    />
                  ) : (
                    <div className="text-gray-400">Loading image...</div>
                  )}
                </div>
              </div>
            )}

            {selectedFile && filePreviewType === "video" && (
              <div className="flex flex-col h-full">
                <h4 className="text-lg font-medium mb-4 text-white">{selectedFile.name}</h4>
                <div className="bg-slate-900 rounded p-4 flex-1 flex items-center justify-center">
                  {fileUrl ? (
                    <video
                      src={fileUrl}
                      controls
                      className="max-w-full max-h-full"
                      onError={() => setError("Failed to load media")}
                    />
                  ) : (
                    <div className="text-gray-400">Loading media...</div>
                  )}
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
