// Flashback Client Library - Shared state and logic for CLI and GUI
// This library exposes common data structures and utilities that can be used
// by both the Tauri GUI application and the standalone CLI binary

pub mod cli;

use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

// ============================================================================
// Core Data Structures
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientInfo {
    pub local_ip: String,
    pub remote_ip: String,
    pub port: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PeerStatus {
    Connecting,
    Connected,
    Disconnected,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnrichedClientInfo {
    pub local_ip: String,
    pub remote_ip: String,
    pub port: u16,
    pub peer_status: String,
}

#[allow(dead_code)]
pub struct PeerConn {
    pub status: PeerStatus,
}

// Message types for communication
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum Message {
    #[serde(rename = "register")]
    Register {
        client_ip: String,
        client_port: u16,
    },
    #[serde(rename = "client_list")]
    ClientList {
        clients: Vec<ClientInfo>,
    },
    #[serde(rename = "client_list_request")]
    ClientListRequest,
    #[serde(rename = "server_info_request")]
    ServerInfoRequest,
    #[serde(rename = "server_info")]
    ServerInfo {
        version: String,
    },
    #[serde(rename = "ping")]
    Ping,
    #[serde(rename = "pong")]
    Pong,
    #[serde(rename = "chat")]
    Chat {
        from_ip: String,
        from_port: u16,
        message: String,
        timestamp: String,
        channel: String,
    },
    #[serde(rename = "dcc_chat")]
    DccChat {
        from_ip: String,
        from_port: u16,
        to_ip: String,
        to_port: u16,
        text: String,
        timestamp: String,
    },
    #[serde(rename = "dcc_request")]
    DccRequest {
        from_ip: String,
        from_port: u16,
        to_ip: String,
        to_port: u16,
    },
    #[serde(rename = "dcc_opened")]
    DccOpened {
        from_ip: String,
        from_port: u16,
        to_ip: String,
        to_port: u16,
    },
    #[serde(rename = "file_offer")]
    FileOffer {
        from_ip: String,
        from_port: u16,
        to_ip: String,
        to_port: u16,
        name: String,
        size: u64,
    },
    #[serde(rename = "file_accept")]
    FileAccept {
        from_ip: String,
        from_port: u16,
        to_ip: String,
        to_port: u16,
        name: String,
        #[serde(default)]
        action: String,
    },
    #[serde(rename = "file_chunk")]
    FileChunk {
        from_ip: String,
        from_port: u16,
        to_ip: String,
        to_port: u16,
        name: String,
        offset: u64,
        data: Vec<u8>,
        #[serde(default)]
        bytes_total: u64,
        #[serde(default)]
        data_base64: String,
    },
    #[serde(rename = "file_cancel")]
    FileCancel {
        from_ip: String,
        from_port: u16,
        to_ip: String,
        to_port: u16,
        name: String,
    },
}

// ============================================================================
// Configuration
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuntimeConfig {
    pub certificate_path: String,
    #[serde(default = "default_base_url")]
    pub base_url: String,
    pub email: String,
}

fn default_base_url() -> String {
    "http://127.0.0.1:8080".to_string()
}

impl Default for RuntimeConfig {
    fn default() -> Self {
        Self {
            certificate_path: "config/certificate.pem".to_string(),
            base_url: default_base_url(),
            email: String::new(),
        }
    }
}

// ============================================================================
// Application State - Shared between GUI and CLI
// ============================================================================

pub struct AppState {
    // Client connections and messaging
    pub clients: Arc<Mutex<Vec<ClientInfo>>>,
    pub tx: Arc<Mutex<Option<tokio::sync::mpsc::Sender<Message>>>>,
    pub current_channel: Arc<Mutex<String>>,
    pub self_info: Arc<Mutex<Option<ClientInfo>>>,
    pub peers: Arc<Mutex<HashMap<String, PeerConn>>>,
    pub peer_writers: Arc<Mutex<HashMap<String, Arc<tokio::sync::Mutex<tokio::net::tcp::OwnedWriteHalf>>>>>,

    // CLI mode flags
    pub cli_mode: Arc<Mutex<bool>>,
    pub cli_auto_allow: Arc<Mutex<bool>>,
    pub allowed_peers: Arc<Mutex<HashSet<String>>>,
    pub pending_request: Arc<Mutex<Option<String>>>,

    // Runtime configuration
    pub config: Arc<Mutex<RuntimeConfig>>,
}

impl Clone for AppState {
    fn clone(&self) -> Self {
        AppState {
            clients: Arc::clone(&self.clients),
            tx: Arc::clone(&self.tx),
            current_channel: Arc::clone(&self.current_channel),
            self_info: Arc::clone(&self.self_info),
            peers: Arc::clone(&self.peers),
            peer_writers: Arc::clone(&self.peer_writers),
            cli_mode: Arc::clone(&self.cli_mode),
            cli_auto_allow: Arc::clone(&self.cli_auto_allow),
            allowed_peers: Arc::clone(&self.allowed_peers),
            pending_request: Arc::clone(&self.pending_request),
            config: Arc::clone(&self.config),
        }
    }
}

impl AppState {
    /// Create a new AppState with default configuration
    pub fn new() -> Self {
        Self {
            clients: Arc::new(Mutex::new(Vec::new())),
            tx: Arc::new(Mutex::new(None)),
            current_channel: Arc::new(Mutex::new("general".to_string())),
            self_info: Arc::new(Mutex::new(None)),
            peers: Arc::new(Mutex::new(HashMap::new())),
            peer_writers: Arc::new(Mutex::new(HashMap::new())),
            cli_mode: Arc::new(Mutex::new(false)),
            cli_auto_allow: Arc::new(Mutex::new(false)),
            allowed_peers: Arc::new(Mutex::new(HashSet::new())),
            pending_request: Arc::new(Mutex::new(None)),
            config: Arc::new(Mutex::new(RuntimeConfig::default())),
        }
    }

    /// Create AppState with custom initial configuration
    pub fn with_config(config: RuntimeConfig) -> Self {
        let state = Self::new();
        if let Ok(mut cfg) = state.config.lock() {
            *cfg = config;
        }
        state
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// Utility Functions
// ============================================================================

/// Load configuration from disk (if it exists)
pub fn load_config_from_disk(path: &str) -> Option<RuntimeConfig> {
    if let Ok(content) = std::fs::read_to_string(path) {
        if let Ok(config) = toml::from_str(&content) {
            return Some(config);
        }
    }
    None
}

/// Save configuration to disk
pub fn save_config_to_disk(config: &RuntimeConfig) {
    let config_dir = std::path::Path::new(&config.certificate_path)
        .parent()
        .map(|p| p.to_path_buf())
        .unwrap_or_else(|| PathBuf::from("config"));

    let _ = std::fs::create_dir_all(&config_dir);

    let config_path = config_dir.join("config.toml");
    if let Ok(toml_str) = toml::to_string_pretty(config) {
        let _ = std::fs::write(&config_path, toml_str);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_app_state_creation() {
        let state = AppState::new();
        assert_eq!(
            *state.current_channel.lock().unwrap(),
            "general".to_string()
        );
    }

    #[test]
    fn test_app_state_clone() {
        let state = AppState::new();
        let cloned = state.clone();
        // Both should share the same Arc data
        assert!(Arc::ptr_eq(&state.clients, &cloned.clients));
    }
}
