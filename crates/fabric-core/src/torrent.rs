/// WebTorrent and distributed file protocol module
use crate::error::{Result, FabricCoreError};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Represents a torrent hash reference
#[derive(Debug, Clone, Serialize, Deserialize, Hash, Eq, PartialEq)]
pub struct TorrentHash {
    pub hash: String,
    pub hash_type: HashType,
}

#[derive(Debug, Clone, Serialize, Deserialize, Hash, Eq, PartialEq)]
pub enum HashType {
    InfoHash,      // BitTorrent info hash
    Magnet,        // Magnet link
    SHA256,        // SHA256 content hash
    SHA1,          // SHA1 content hash
}

impl TorrentHash {
    pub fn new(hash: String, hash_type: HashType) -> Self {
        Self { hash, hash_type }
    }

    /// Parse a magnet link and extract hash
    pub fn from_magnet_link(magnet: &str) -> Result<Self> {
        // Extract info hash from magnet link
        // Format: magnet:?xt=urn:btih:HASH
        if !magnet.starts_with("magnet:") {
            return Err(FabricCoreError::TorrentError(
                "Invalid magnet link format".to_string(),
            ));
        }

        let hash = magnet
            .split("xt=urn:btih:")
            .nth(1)
            .and_then(|s| s.split('&').next())
            .ok_or_else(|| {
                FabricCoreError::TorrentError(
                    "Could not extract hash from magnet link".to_string(),
                )
            })?;

        Ok(TorrentHash::new(
            hash.to_string(),
            HashType::InfoHash,
        ))
    }

    /// Convert to magnet link
    pub fn to_magnet_link(&self) -> String {
        match self.hash_type {
            HashType::InfoHash => {
                format!("magnet:?xt=urn:btih:{}", self.hash)
            }
            HashType::Magnet => self.hash.clone(),
            _ => format!("magnet:?xt=urn:btih:{}", self.hash),
        }
    }
}

/// Represents a file being downloaded via WebTorrent
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TorrentDownload {
    pub torrent_hash: TorrentHash,
    pub file_path: PathBuf,
    pub progress: f32, // 0.0 to 1.0
    pub status: DownloadStatus,
    pub peers: usize,
    pub download_speed: u64, // bytes per second
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum DownloadStatus {
    Pending,
    Downloading,
    Paused,
    Completed,
    Failed(String),
}

impl TorrentDownload {
    pub fn new(torrent_hash: TorrentHash, file_path: PathBuf) -> Self {
        Self {
            torrent_hash,
            file_path,
            progress: 0.0,
            status: DownloadStatus::Pending,
            peers: 0,
            download_speed: 0,
        }
    }

    /// Check if download is complete
    pub fn is_complete(&self) -> bool {
        self.status == DownloadStatus::Completed
    }

    /// Check if download failed
    pub fn is_failed(&self) -> bool {
        matches!(self.status, DownloadStatus::Failed(_))
    }
}

/// WebTorrent client for distributing files via DHT and peers
pub struct WebTorrentClient {
    downloads: Vec<TorrentDownload>,
    active: bool,
}

impl WebTorrentClient {
    pub fn new() -> Self {
        Self {
            downloads: Vec::new(),
            active: false,
        }
    }

    /// Initialize the WebTorrent client
    pub async fn init(&mut self) -> Result<()> {
        tracing::info!("Initializing WebTorrent client");
        self.active = true;
        Ok(())
    }

    /// Shutdown the WebTorrent client
    pub async fn shutdown(&mut self) -> Result<()> {
        tracing::info!("Shutting down WebTorrent client");
        self.active = false;
        self.downloads.clear();
        Ok(())
    }

    /// Add a torrent for download
    pub async fn add_torrent(
        &mut self,
        torrent_hash: TorrentHash,
        output_path: PathBuf,
    ) -> Result<()> {
        if !self.active {
            return Err(FabricCoreError::TorrentError(
                "WebTorrent client not initialized".to_string(),
            ));
        }

        let download = TorrentDownload::new(torrent_hash.clone(), output_path);
        self.downloads.push(download);

        tracing::info!("Added torrent: {}", torrent_hash.hash);
        Ok(())
    }

    /// Get download progress
    pub fn get_download_progress(
        &self,
        torrent_hash: &TorrentHash,
    ) -> Result<TorrentDownload> {
        self.downloads
            .iter()
            .find(|d| d.torrent_hash == *torrent_hash)
            .cloned()
            .ok_or_else(|| {
                FabricCoreError::TorrentError(
                    "Download not found".to_string(),
                )
            })
    }

    /// Pause a download
    pub async fn pause_download(
        &mut self,
        torrent_hash: &TorrentHash,
    ) -> Result<()> {
        if let Some(download) = self
            .downloads
            .iter_mut()
            .find(|d| d.torrent_hash == *torrent_hash)
        {
            download.status = DownloadStatus::Paused;
            tracing::info!("Paused download: {}", torrent_hash.hash);
            Ok(())
        } else {
            Err(FabricCoreError::TorrentError(
                "Download not found".to_string(),
            ))
        }
    }

    /// Resume a download
    pub async fn resume_download(
        &mut self,
        torrent_hash: &TorrentHash,
    ) -> Result<()> {
        if let Some(download) = self
            .downloads
            .iter_mut()
            .find(|d| d.torrent_hash == *torrent_hash)
        {
            download.status = DownloadStatus::Downloading;
            tracing::info!("Resumed download: {}", torrent_hash.hash);
            Ok(())
        } else {
            Err(FabricCoreError::TorrentError(
                "Download not found".to_string(),
            ))
        }
    }

    /// Get all active downloads
    pub fn get_downloads(&self) -> Vec<TorrentDownload> {
        self.downloads.clone()
    }

    /// Search for peers in the DHT network
    pub async fn search_peers(
        &self,
        torrent_hash: &TorrentHash,
    ) -> Result<Vec<String>> {
        if !self.active {
            return Err(FabricCoreError::TorrentError(
                "WebTorrent client not initialized".to_string(),
            ));
        }

        tracing::debug!(
            "Searching for peers for torrent: {}",
            torrent_hash.hash
        );

        // Placeholder for actual DHT peer search
        Ok(vec![])
    }

    /// Stream file content while downloading
    pub async fn stream_file(
        &self,
        torrent_hash: &TorrentHash,
    ) -> Result<Vec<u8>> {
        let download = self.get_download_progress(torrent_hash)?;

        if !download.is_complete() {
            return Err(FabricCoreError::TorrentError(
                "File download not complete".to_string(),
            ));
        }

        // Read file from disk
        std::fs::read(&download.file_path).map_err(|e| {
            FabricCoreError::TorrentError(format!(
                "Failed to read file: {}",
                e
            ))
        })
    }
}

impl Default for WebTorrentClient {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_torrent_hash_creation() {
        let hash = TorrentHash::new(
            "abc123".to_string(),
            HashType::InfoHash,
        );
        assert_eq!(hash.hash, "abc123");
    }

    #[test]
    fn test_magnet_link_parsing() {
        let magnet = "magnet:?xt=urn:btih:abc123&dn=test";
        let result = TorrentHash::from_magnet_link(magnet);
        assert!(result.is_ok());
        let hash = result.unwrap();
        assert_eq!(hash.hash, "abc123");
    }

    #[test]
    fn test_magnet_link_generation() {
        let hash = TorrentHash::new(
            "abc123".to_string(),
            HashType::InfoHash,
        );
        let magnet = hash.to_magnet_link();
        assert!(magnet.contains("abc123"));
    }

    #[test]
    fn test_torrent_download_creation() {
        let hash = TorrentHash::new(
            "abc123".to_string(),
            HashType::InfoHash,
        );
        let download =
            TorrentDownload::new(hash, PathBuf::from("/tmp/test"));
        assert_eq!(download.progress, 0.0);
        assert!(!download.is_complete());
    }

    #[tokio::test]
    async fn test_webtorrent_client_init() {
        let mut client = WebTorrentClient::new();
        assert!(!client.active);
        let result = client.init().await;
        assert!(result.is_ok());
        assert!(client.active);
    }
}
