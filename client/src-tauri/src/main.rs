// Keep Windows console visible (do not hide in release) to support CLI mode

// Declare library modules
mod cli;
mod http_server;

use hex as hex_crate;
use reqwest::StatusCode;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::convert::TryFrom;
use std::sync::{Arc, Mutex};
use tauri::{Emitter, Manager, State};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::mpsc;
use tokio::time::{interval, Duration};

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ClientInfo {
    local_ip: String,
    remote_ip: String,
    port: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
enum PeerStatus {
    Connecting,
    Connected,
    Disconnected,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct EnrichedClientInfo {
    local_ip: String,
    remote_ip: String,
    port: u16,
    peer_status: String,
}

#[allow(dead_code)]
struct PeerConn {
    status: PeerStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
enum Message {
    #[serde(rename = "register")]
    Register { client_ip: String, client_port: u16 },
    #[serde(rename = "client_list")]
    ClientList { clients: Vec<ClientInfo> },
    #[serde(rename = "client_list_request")]
    ClientListRequest,
    #[serde(rename = "server_info_request")]
    ServerInfoRequest,
    #[serde(rename = "server_info")]
    ServerInfo { version: String },
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
        bytes_total: u64,
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

#[derive(Debug, Clone)]
#[allow(dead_code)]
enum RequestKind {
    DccChat,
    FileOffer { name: String, size: u64 },
}

struct PendingRequest {
    ip: String,
    port: u16,
    kind: RequestKind,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct RuntimeConfig {
    // Full path to certificate.pem or directory containing certificate.pem/private.key
    #[serde(default)]
    certificate_path: String,
    // Base URL for server API
    #[serde(default = "default_base_url")]
    base_url: String,
    // User email identifier parsed from certificate
    #[serde(default)]
    email: String,
    // Root directory path for hosting files via HTTPS to other clients
    #[serde(default)]
    file_root_directory: String,
}

fn default_app_data_dir_fallback() -> std::path::PathBuf {
    // Platform-specific fallback if Tauri path resolver is not available yet.
    #[cfg(target_os = "linux")]
    {
        use std::env;
        if let Ok(xdg) = env::var("XDG_DATA_HOME") {
            return std::path::PathBuf::from(xdg).join("RelayClient");
        }
        if let Ok(home) = env::var("HOME") {
            return std::path::PathBuf::from(home).join(".local/share/RelayClient");
        }
        return std::env::temp_dir().join("RelayClient");
    }
    #[cfg(target_os = "macos")]
    {
        use std::env;
        if let Ok(home) = env::var("HOME") {
            return std::path::PathBuf::from(home).join("Library/Application Support/RelayClient");
        }
        return std::env::temp_dir().join("RelayClient");
    }
    #[cfg(target_os = "windows")]
    {
        use std::env;
        if let Ok(appdata) = env::var("APPDATA") {
            return std::path::PathBuf::from(appdata).join("RelayClient");
        }
        return std::env::temp_dir().join("RelayClient");
    }
}

impl Default for RuntimeConfig {
    fn default() -> Self {
        let base = default_app_data_dir_fallback();
        let cert = base.join("certificate.pem");
        Self {
            certificate_path: cert.to_string_lossy().to_string(),
            base_url: default_base_url(),
            email: String::new(),
            file_root_directory: String::new(),
        }
    }
}

struct AppState {
    clients: Arc<Mutex<Vec<ClientInfo>>>,
    tx: Arc<Mutex<Option<mpsc::Sender<Message>>>>,
    #[allow(dead_code)]
    current_channel: Arc<Mutex<String>>,
    self_info: Arc<Mutex<Option<ClientInfo>>>,
    #[allow(dead_code)]
    peers: Arc<Mutex<HashMap<String, PeerConn>>>, // key: "ip:port"
    peer_writers:
        Arc<Mutex<HashMap<String, Arc<tokio::sync::Mutex<tokio::net::tcp::OwnedWriteHalf>>>>>, // key: "ip:port" -> writer
    // CLI approval flow state
    cli_mode: Arc<Mutex<bool>>,
    cli_auto_allow: Arc<Mutex<bool>>,
    allowed_peers: Arc<Mutex<std::collections::HashSet<String>>>,
    pending_request: Arc<Mutex<Option<PendingRequest>>>,
    // Runtime config persisted to disk
    config: Arc<Mutex<RuntimeConfig>>,
}

#[tauri::command]
async fn connect_to_server(
    server: Option<String>,
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    // Determine server:port, defaulting to deployed endpoint if missing
    let server_str = match server {
        Some(s) if !s.trim().is_empty() => s,
        _ => "server.flashbackrepository.org:51111".to_string(),
    };
    // Parse server:port
    let (server_ip, server_port) = parse_host_port(&server_str)?;
    let addr = format!("{}:{}", server_ip, server_port);

    // Detect local client IP
    let client_ip = local_ip_address::local_ip()
        .map_err(|e| format!("Failed to determine local IP: {}", e))?
        .to_string();

    // Start peer listener (accept incoming peer connections) on ephemeral port 0 and capture actual port
    let listener = TcpListener::bind("0.0.0.0:0")
        .await
        .map_err(|e| format!("Failed to bind peer listener: {}", e))?;
    let actual_port = listener
        .local_addr()
        .map_err(|e| format!("Failed to get listener local addr: {}", e))?
        .port();

    // Save self info with detected IP and actual bound port
    {
        let mut self_lock = state.self_info.lock().unwrap();
        *self_lock = Some(ClientInfo {
            local_ip: client_ip.clone(),
            remote_ip: "".to_string(),
            port: actual_port,
        });
    }

    // Spawn the listener accept loop
    {
        let app_handle_clone = app_handle.clone();
        let print_addr = format!("0.0.0.0:{}", actual_port);
        tokio::spawn(async move {
            println!("👂 Peer listener started at {}", print_addr);
            let pw_map = app_handle_clone.state::<AppState>().peer_writers.clone();
            let app_handle_outer = app_handle_clone.clone();
            let listener = listener; // move into task
            loop {
                match listener.accept().await {
                    Ok((stream, remote)) => {
                        println!("🔗 Incoming peer connection from {}", remote);
                        let app_handle_incoming = app_handle_outer.clone();
                        // capture peer_writers map
                        let pw_map = pw_map.clone();
                        tokio::spawn(async move {
                            let (reader, writer) = stream.into_split();
                            let writer_arc = Arc::new(tokio::sync::Mutex::new(writer));
                            let mut reader = BufReader::new(reader);
                            let key = format!("{}", remote);
                            {
                                let mut map = pw_map.lock().unwrap();
                                map.insert(key.clone(), writer_arc.clone());
                            }
                            let mut line = String::new();
                            loop {
                                line.clear();
                                match reader.read_line(&mut line).await {
                                    Ok(0) => break,
                                    Ok(_) => {
                                        if let Ok(msg) = serde_json::from_str::<Message>(&line) {
                                            match msg {
                                                Message::Ping => {
                                                    let pong =
                                                        serde_json::to_string(&Message::Pong)
                                                            .unwrap()
                                                            + "\n";
                                                    let writer_arc_opt = {
                                                        pw_map.lock().unwrap().get(&key).cloned()
                                                    };
                                                    if let Some(w) = writer_arc_opt {
                                                        if let Ok(mut guard) = w.try_lock() {
                                                            if let Err(e) = guard
                                                                .write_all(pong.as_bytes())
                                                                .await
                                                            {
                                                                println!("Peer write error: {}", e);
                                                                break;
                                                            }
                                                            if let Err(e) = guard.flush().await {
                                                                println!("Peer flush error: {}", e);
                                                                break;
                                                            }
                                                        }
                                                    }
                                                }
                                                Message::DccRequest {
                                                    from_ip, from_port, ..
                                                } => {
                                                    {
                                                        let alias = peer_key(&from_ip, from_port);
                                                        let mut map = pw_map.lock().unwrap();
                                                        if !map.contains_key(&alias) {
                                                            map.insert(
                                                                alias.clone(),
                                                                writer_arc.clone(),
                                                            );
                                                        }
                                                    }
                                                    // CLI approval gating
                                                    let state_ref: tauri::State<AppState> =
                                                        app_handle_incoming.state::<AppState>();
                                                    let cli_mode =
                                                        { *state_ref.cli_mode.lock().unwrap() };
                                                    if cli_mode {
                                                        let auto = {
                                                            *state_ref
                                                                .cli_auto_allow
                                                                .lock()
                                                                .unwrap()
                                                        };
                                                        let key = peer_key(&from_ip, from_port);
                                                        let already = {
                                                            state_ref
                                                                .allowed_peers
                                                                .lock()
                                                                .unwrap()
                                                                .contains(&key)
                                                        };
                                                        if !already {
                                                            if auto {
                                                                state_ref
                                                                    .allowed_peers
                                                                    .lock()
                                                                    .unwrap()
                                                                    .insert(key.clone());
                                                                println!("Auto-allowed DCC chat request from {}:{}", from_ip, from_port);
                                                                // Optionally notify opened
                                                                let _ = app_handle_incoming.emit("dcc-opened", serde_json::json!({"ip": from_ip, "port": from_port}));
                                                            } else {
                                                                // set pending request
                                                                {
                                                                    let mut pend = state_ref
                                                                        .pending_request
                                                                        .lock()
                                                                        .unwrap();
                                                                    *pend = Some(PendingRequest {
                                                                        ip: from_ip.clone(),
                                                                        port: from_port,
                                                                        kind: RequestKind::DccChat,
                                                                    });
                                                                }
                                                                println!("Incoming DCC chat request from {}:{}\nType 'allow' to accept, 'deny' to reject, or 'allow auto' to accept all for this session.", from_ip, from_port);
                                                                // Do not emit to app/UI until allowed
                                                                continue;
                                                            }
                                                        }
                                                    }
                                                    let payload = serde_json::json!({"ip": from_ip, "port": from_port});
                                                    let _ = app_handle_incoming
                                                        .emit("dcc-request", payload);
                                                }
                                                Message::DccOpened {
                                                    from_ip, from_port, ..
                                                } => {
                                                    {
                                                        let alias = peer_key(&from_ip, from_port);
                                                        let mut map = pw_map.lock().unwrap();
                                                        if !map.contains_key(&alias) {
                                                            map.insert(
                                                                alias.clone(),
                                                                writer_arc.clone(),
                                                            );
                                                        }
                                                    }
                                                    let payload = serde_json::json!({"ip": from_ip, "port": from_port});
                                                    let _ = app_handle_incoming
                                                        .emit("dcc-opened", payload);
                                                }
                                                Message::FileOffer {
                                                    from_ip,
                                                    from_port,
                                                    name,
                                                    size,
                                                    ..
                                                } => {
                                                    {
                                                        let alias = peer_key(&from_ip, from_port);
                                                        let mut map = pw_map.lock().unwrap();
                                                        if !map.contains_key(&alias) {
                                                            map.insert(
                                                                alias.clone(),
                                                                writer_arc.clone(),
                                                            );
                                                        }
                                                    }
                                                    // CLI approval gating for file offer
                                                    let state_ref: tauri::State<AppState> =
                                                        app_handle_incoming.state::<AppState>();
                                                    let cli_mode =
                                                        { *state_ref.cli_mode.lock().unwrap() };
                                                    if cli_mode {
                                                        let auto = {
                                                            *state_ref
                                                                .cli_auto_allow
                                                                .lock()
                                                                .unwrap()
                                                        };
                                                        let key = peer_key(&from_ip, from_port);
                                                        let already = {
                                                            state_ref
                                                                .allowed_peers
                                                                .lock()
                                                                .unwrap()
                                                                .contains(&key)
                                                        };
                                                        if !already {
                                                            if auto {
                                                                state_ref
                                                                    .allowed_peers
                                                                    .lock()
                                                                    .unwrap()
                                                                    .insert(key.clone());
                                                                println!("Auto-allowed file offer from {}:{} [{} - {} bytes]", from_ip, from_port, name, size);
                                                            } else {
                                                                {
                                                                    let mut pend = state_ref
                                                                        .pending_request
                                                                        .lock()
                                                                        .unwrap();
                                                                    *pend = Some(PendingRequest {
                                                                        ip: from_ip.clone(),
                                                                        port: from_port,
                                                                        kind:
                                                                            RequestKind::FileOffer {
                                                                                name: name.clone(),
                                                                                size,
                                                                            },
                                                                    });
                                                                }
                                                                println!("Incoming file offer from {}:{} -- '{}' ({} bytes)\nType 'allow' to accept, 'deny' to reject, or 'allow auto' to accept all for this session.", from_ip, from_port, name, size);
                                                                continue;
                                                            }
                                                        }
                                                    }
                                                    let payload = serde_json::json!({"from_ip": from_ip, "from_port": from_port, "name": name, "size": size});
                                                    let _ = app_handle_incoming
                                                        .emit("dcc-file-offer", payload);
                                                }
                                                Message::FileAccept {
                                                    from_ip,
                                                    from_port,
                                                    name,
                                                    action,
                                                    ..
                                                } => {
                                                    {
                                                        let alias = peer_key(&from_ip, from_port);
                                                        let mut map = pw_map.lock().unwrap();
                                                        if !map.contains_key(&alias) {
                                                            map.insert(
                                                                alias.clone(),
                                                                writer_arc.clone(),
                                                            );
                                                        }
                                                    }
                                                    let payload = serde_json::json!({"from_ip": from_ip, "from_port": from_port, "name": name, "action": action});
                                                    let _ = app_handle_incoming
                                                        .emit("dcc-file-accept", payload);
                                                }
                                                Message::FileChunk {
                                                    from_ip,
                                                    from_port,
                                                    name,
                                                    offset,
                                                    bytes_total,
                                                    data_base64,
                                                    ..
                                                } => {
                                                    {
                                                        let alias = peer_key(&from_ip, from_port);
                                                        let mut map = pw_map.lock().unwrap();
                                                        if !map.contains_key(&alias) {
                                                            map.insert(
                                                                alias.clone(),
                                                                writer_arc.clone(),
                                                            );
                                                        }
                                                    }
                                                    let payload = serde_json::json!({
                                                        "from_ip": from_ip,
                                                        "from_port": from_port,
                                                        "name": name,
                                                        "offset": offset,
                                                        "bytes_total": bytes_total,
                                                        "data_base64": data_base64
                                                    });
                                                    let _ = app_handle_incoming
                                                        .emit("dcc-file-chunk", payload);
                                                }
                                                Message::FileCancel {
                                                    from_ip,
                                                    from_port,
                                                    name,
                                                    ..
                                                } => {
                                                    {
                                                        let alias = peer_key(&from_ip, from_port);
                                                        let mut map = pw_map.lock().unwrap();
                                                        if !map.contains_key(&alias) {
                                                            map.insert(
                                                                alias.clone(),
                                                                writer_arc.clone(),
                                                            );
                                                        }
                                                    }
                                                    let payload = serde_json::json!({"from_ip": from_ip, "from_port": from_port, "name": name});
                                                    let _ = app_handle_incoming
                                                        .emit("dcc-file-cancel", payload);
                                                }
                                                Message::DccChat {
                                                    from_ip,
                                                    from_port,
                                                    text,
                                                    timestamp,
                                                    ..
                                                } => {
                                                    {
                                                        let alias = peer_key(&from_ip, from_port);
                                                        let mut map = pw_map.lock().unwrap();
                                                        if !map.contains_key(&alias) {
                                                            map.insert(
                                                                alias.clone(),
                                                                writer_arc.clone(),
                                                            );
                                                        }
                                                    }
                                                    // CLI approval gating for DCC chat message
                                                    let state_ref: tauri::State<AppState> =
                                                        app_handle_incoming.state::<AppState>();
                                                    let cli_mode =
                                                        { *state_ref.cli_mode.lock().unwrap() };
                                                    if cli_mode {
                                                        let auto = {
                                                            *state_ref
                                                                .cli_auto_allow
                                                                .lock()
                                                                .unwrap()
                                                        };
                                                        let key = peer_key(&from_ip, from_port);
                                                        let already = {
                                                            state_ref
                                                                .allowed_peers
                                                                .lock()
                                                                .unwrap()
                                                                .contains(&key)
                                                        };
                                                        if !already {
                                                            if auto {
                                                                state_ref
                                                                    .allowed_peers
                                                                    .lock()
                                                                    .unwrap()
                                                                    .insert(key.clone());
                                                                println!("Auto-allowed DCC chat from {}:{}", from_ip, from_port);
                                                            } else {
                                                                {
                                                                    let mut pend = state_ref
                                                                        .pending_request
                                                                        .lock()
                                                                        .unwrap();
                                                                    *pend = Some(PendingRequest {
                                                                        ip: from_ip.clone(),
                                                                        port: from_port,
                                                                        kind: RequestKind::DccChat,
                                                                    });
                                                                }
                                                                println!("Incoming DCC chat from {}:{}\nType 'allow' to accept, 'deny' to reject, or 'allow auto' to accept all for this session.", from_ip, from_port);
                                                                continue;
                                                            }
                                                        }
                                                    }
                                                    let payload = serde_json::json!({
                                                        "from_ip": from_ip,
                                                        "from_port": from_port,
                                                        "text": text,
                                                        "timestamp": timestamp,
                                                    });
                                                    let _ = app_handle_incoming
                                                        .emit("dcc-chat", payload);
                                                }
                                                _ => {}
                                            }
                                        }
                                    }
                                    Err(e) => {
                                        println!("Peer read error: {}", e);
                                        break;
                                    }
                                }
                            }
                            let _ = app_handle_incoming
                                .emit("peer-incoming-closed", format!("{}", remote));
                        });
                    }
                    Err(e) => {
                        println!("Listener accept error: {}", e);
                        break;
                    }
                }
            }
        });
    }

    println!("Connecting to server at {}", addr);
    let _ = app_handle.emit("log", format!("Connecting to server at {}", addr));

    // Connect to server with 15s timeout
    let stream =
        match tokio::time::timeout(Duration::from_secs(15), TcpStream::connect(&addr)).await {
            Ok(Ok(s)) => s,
            Ok(Err(e)) => {
                let _ = app_handle.emit("log", format!("Failed to connect: {}", e));
                return Err(format!("Failed to connect: {}", e));
            }
            Err(_) => {
                let _ = app_handle.emit("log", "Connect timeout after 15s".to_string());
                return Err("Connect timeout after 15s".to_string());
            }
        };

    println!("Connected to server");
    let _ = app_handle.emit("log", format!("Connected to {}", addr));

    let (reader, mut writer) = stream.into_split();
    let mut reader = BufReader::new(reader);

    // Send registration message with detected IP and bound port
    let register_msg = Message::Register {
        client_ip: client_ip.clone(),
        client_port: actual_port,
    };

    let json = serde_json::to_string(&register_msg).map_err(|e| e.to_string())? + "\n";
    writer
        .write_all(json.as_bytes())
        .await
        .map_err(|e| format!("Failed to send registration: {}", e))?;

    println!("Sent registration message");

    // Start HTTP file server if directory is configured
    {
        let cfg = state.config.lock().unwrap().clone();
        let file_root_dir = cfg.file_root_directory.clone();
        if !file_root_dir.is_empty() {
            // Use an available port (0 means OS will choose)
            let http_port = 0u16;
            let app_handle_clone = app_handle.clone();
            tokio::spawn(async move {
                match http_server::start_http_server(file_root_dir, http_port).await {
                    Ok(port) => {
                        println!("HTTP file server started on port {}", port);
                        let _ = app_handle_clone.emit(
                            "http-file-server-ready",
                            serde_json::json!({ "port": port }),
                        );
                    }
                    Err(e) => {
                        println!("Failed to start HTTP file server: {}", e);
                        let _ = app_handle_clone.emit(
                            "http-file-server-error",
                            serde_json::json!({ "error": e.to_string() }),
                        );
                    }
                }
            });
        }
    }

    // Create channel for sending messages
    let (tx, mut rx) = mpsc::channel::<Message>(100);
    {
        let mut state_tx = state.tx.lock().unwrap();
        *state_tx = Some(tx);
    }

    // Request server info immediately (before user list)
    let sender_opt = { state.tx.lock().unwrap().clone() };
    if let Some(sender) = sender_opt {
        let _ = sender.send(Message::ServerInfoRequest).await;
    }

    // Spawn task to handle incoming messages
    let app_handle_clone = app_handle.clone();
    let state_clients = Arc::clone(&state.clients);
    let self_info_arc = Arc::clone(&state.self_info);
    tokio::spawn(async move {
        let mut line = String::new();
        loop {
            line.clear();
            match reader.read_line(&mut line).await {
                Ok(0) => {
                    println!("Server disconnected");
                    let _ = app_handle_clone.emit("server-disconnected", ());
                    let _ = app_handle_clone.emit("log", "Server disconnected".to_string());
                    break;
                }
                Ok(_) => {
                    if let Ok(msg) = serde_json::from_str::<Message>(&line) {
                        match msg {
                            Message::ClientList { clients } => {
                                // In CLI mode, print full client list for visibility
                                let print_details = {
                                    let st: tauri::State<AppState> =
                                        app_handle_clone.state::<AppState>();
                                    let val = *st.cli_mode.lock().unwrap();
                                    val
                                };
                                if print_details {
                                    let list_str = clients
                                        .iter()
                                        .map(|c| format!("{}:{}", c.local_ip, c.port))
                                        .collect::<Vec<_>>()
                                        .join(", ");
                                    println!(
                                        "Received client list ({}): {}",
                                        clients.len(),
                                        list_str
                                    );
                                } else {
                                    println!("Received client list: {} clients", clients.len());
                                }
                                // Save latest server-provided list
                                {
                                    let mut state_clients = state_clients.lock().unwrap();
                                    *state_clients = clients.clone();
                                }

                                // Determine self to skip
                                let self_opt = { self_info_arc.lock().unwrap().clone() };

                                // Emit enriched client list without auto-connecting to peers (default to disconnected)
                                let enriched: Vec<EnrichedClientInfo> = clients
                                    .iter()
                                    .map(|c| {
                                        if let Some(ref me) = self_opt {
                                            if me.local_ip == c.local_ip && me.port == c.port {
                                                return EnrichedClientInfo {
                                                    local_ip: c.local_ip.clone(),
                                                    remote_ip: c.remote_ip.clone(),
                                                    port: c.port,
                                                    peer_status: "self".to_string(),
                                                };
                                            }
                                        }
                                        EnrichedClientInfo {
                                            local_ip: c.local_ip.clone(),
                                            remote_ip: c.remote_ip.clone(),
                                            port: c.port,
                                            peer_status: "disconnected".to_string(),
                                        }
                                    })
                                    .collect();
                                let _ = app_handle_clone.emit("client-list-updated", enriched);
                                // Skip auto-connecting logic to ensure both clients show disconnected on boot
                                continue;
                            }
                            Message::Pong => {
                                println!("💓 Received pong from server");
                            }
                            Message::ServerInfo { version } => {
                                let info_json = serde_json::json!({"version": version});
                                println!("ℹ️ Server info: {}", info_json);
                                let _ = app_handle_clone
                                    .emit("log", format!("Server info: {}", info_json));
                            }
                            Message::Chat {
                                from_ip,
                                from_port,
                                message,
                                timestamp,
                                channel,
                            } => {
                                println!(
                                    "💬 Chat from {}:{} [{}]: {}",
                                    from_ip, from_port, channel, message
                                );
                                let chat_data = serde_json::json!({
                                    "from_ip": from_ip,
                                    "from_port": from_port,
                                    "message": message,
                                    "timestamp": timestamp,
                                    "channel": channel,
                                });
                                let _ = app_handle_clone.emit("chat-message", chat_data);
                            }
                            Message::DccRequest {
                                from_ip, from_port, ..
                            } => {
                                // CLI approval gating
                                let st: tauri::State<AppState> =
                                    app_handle_clone.state::<AppState>();
                                let is_cli = { *st.cli_mode.lock().unwrap() };
                                if is_cli {
                                    let auto = { *st.cli_auto_allow.lock().unwrap() };
                                    let key = peer_key(&from_ip, from_port);
                                    let already =
                                        { st.allowed_peers.lock().unwrap().contains(&key) };
                                    if !already {
                                        if auto {
                                            st.allowed_peers.lock().unwrap().insert(key.clone());
                                            println!(
                                                "Auto-allowed DCC chat request from {}:{}",
                                                from_ip, from_port
                                            );
                                        } else {
                                            {
                                                let mut pend = st.pending_request.lock().unwrap();
                                                *pend = Some(PendingRequest {
                                                    ip: from_ip.clone(),
                                                    port: from_port,
                                                    kind: RequestKind::DccChat,
                                                });
                                            }
                                            println!("Incoming DCC chat request from {}:{}\nType 'allow' to accept, 'deny' to reject, or 'allow auto' to accept all for this session.", from_ip, from_port);
                                            continue;
                                        }
                                    }
                                }
                                println!("📨 DCC request received from {}:{}", from_ip, from_port);
                                let payload = serde_json::json!({"ip": from_ip, "port": from_port});
                                let _ = app_handle_clone.emit("dcc-request", payload);
                            }
                            Message::DccOpened {
                                from_ip, from_port, ..
                            } => {
                                println!(
                                    "🪟 DCC opened notification from {}:{}",
                                    from_ip, from_port
                                );
                                let payload = serde_json::json!({"ip": from_ip, "port": from_port});
                                let _ = app_handle_clone.emit("dcc-opened", payload);
                            }
                            Message::FileOffer {
                                from_ip,
                                from_port,
                                name,
                                size,
                                ..
                            } => {
                                // CLI approval gating
                                let st: tauri::State<AppState> =
                                    app_handle_clone.state::<AppState>();
                                let is_cli = { *st.cli_mode.lock().unwrap() };
                                if is_cli {
                                    let auto = { *st.cli_auto_allow.lock().unwrap() };
                                    let key = peer_key(&from_ip, from_port);
                                    let already =
                                        { st.allowed_peers.lock().unwrap().contains(&key) };
                                    if !already {
                                        if auto {
                                            st.allowed_peers.lock().unwrap().insert(key.clone());
                                            println!("Auto-allowed file offer from {}:{} [{} - {} bytes]", from_ip, from_port, name, size);
                                        } else {
                                            {
                                                let mut pend = st.pending_request.lock().unwrap();
                                                *pend = Some(PendingRequest {
                                                    ip: from_ip.clone(),
                                                    port: from_port,
                                                    kind: RequestKind::FileOffer {
                                                        name: name.clone(),
                                                        size,
                                                    },
                                                });
                                            }
                                            println!("Incoming file offer from {}:{} -- '{}' ({} bytes)\nType 'allow' to accept, 'deny' to reject, or 'allow auto' to accept all for this session.", from_ip, from_port, name, size);
                                            continue;
                                        }
                                    }
                                }
                                println!(
                                    "📁 File offer from {}:{} [{} - {} bytes]",
                                    from_ip, from_port, name, size
                                );
                                let payload = serde_json::json!({"from_ip": from_ip, "from_port": from_port, "name": name, "size": size});
                                let _ = app_handle_clone.emit("dcc-file-offer", payload);
                            }
                            Message::FileAccept {
                                from_ip,
                                from_port,
                                name,
                                action,
                                ..
                            } => {
                                println!(
                                    "✅ File accept received from {}:{} [{} action={}]",
                                    from_ip, from_port, name, action
                                );
                                let payload = serde_json::json!({"from_ip": from_ip, "from_port": from_port, "name": name, "action": action});
                                let _ = app_handle_clone.emit("dcc-file-accept", payload);
                            }
                            Message::FileChunk {
                                from_ip,
                                from_port,
                                name,
                                offset,
                                bytes_total,
                                data_base64,
                                ..
                            } => {
                                let payload = serde_json::json!({
                                    "from_ip": from_ip,
                                    "from_port": from_port,
                                    "name": name,
                                    "offset": offset,
                                    "bytes_total": bytes_total,
                                    "data_base64": data_base64,
                                });
                                let _ = app_handle_clone.emit("dcc-file-chunk", payload);
                            }
                            Message::FileCancel {
                                from_ip,
                                from_port,
                                name,
                                ..
                            } => {
                                let payload = serde_json::json!({
                                    "from_ip": from_ip,
                                    "from_port": from_port,
                                    "name": name,
                                });
                                let _ = app_handle_clone.emit("dcc-file-cancel", payload);
                            }
                            _ => {
                                // Handle other message types if needed
                            }
                        }
                    }
                }
                Err(e) => {
                    println!("Error reading from server: {}", e);
                    let _ = app_handle_clone.emit("server-error", e.to_string());
                    break;
                }
            }
        }
    });

    // Spawn task to handle outgoing messages and pings
    tokio::spawn(async move {
        // Send ping every 60 seconds (configurable, matching server config)
        let mut ping_interval = interval(Duration::from_secs(60));

        loop {
            tokio::select! {
                _ = ping_interval.tick() => {
                    // Send ping message
                    let ping_msg = Message::Ping;
                    if let Ok(json) = serde_json::to_string(&ping_msg) {
                        if let Err(e) = writer.write_all((json + "\n").as_bytes()).await {
                            println!("Failed to send ping: {}", e);
                            break;
                        }
                        if let Err(e) = writer.flush().await {
                            println!("Failed to flush ping: {}", e);
                            break;
                        }
                        println!("💓 Sent ping to server");
                    }
                }
                msg = rx.recv() => {
                    match msg {
                        Some(outgoing_msg) => {
                            // Send the message to the server
                            if let Ok(json) = serde_json::to_string(&outgoing_msg) {
                                if let Err(e) = writer.write_all((json + "\n").as_bytes()).await {
                                    println!("Failed to send message: {}", e);
                                    break;
                                }
                                if let Err(e) = writer.flush().await {
                                    println!("Failed to flush message: {}", e);
                                    break;
                                }
                            }
                        }
                        None => {
                            println!("Message channel closed");
                            break;
                        }
                    }
                }
            }
        }
    });

    Ok(format!("Connected to {}:{}", server_ip, server_port))
}

#[tauri::command]
fn get_clients(state: State<'_, AppState>) -> Vec<ClientInfo> {
    let clients = state.clients.lock().unwrap();
    clients.clone()
}

// P2P DCC: peer connection and messaging commands
fn peer_key(ip: &str, port: u16) -> String {
    format!("{}:{}", ip, port)
}

async fn send_to_peer(
    state: &State<'_, AppState>,
    ip: &str,
    port: u16,
    msg: &Message,
) -> Result<(), String> {
    let key = peer_key(ip, port);
    let json = serde_json::to_string(msg).map_err(|e| e.to_string())? + "\n";
    let writer_opt = { state.peer_writers.lock().unwrap().get(&key).cloned() };
    if let Some(writer_mutex) = writer_opt {
        let mut guard = writer_mutex.lock().await;
        guard
            .write_all(json.as_bytes())
            .await
            .map_err(|e| format!("write error: {}", e))?;
        guard
            .flush()
            .await
            .map_err(|e| format!("flush error: {}", e))?;
        Ok(())
    } else {
        Err("Peer not connected".into())
    }
}

#[tauri::command]
async fn connect_to_peer(
    to_ip: String,
    to_port: u16,
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    let addr = format!("{}:{}", to_ip, to_port);
    let addr_clone = addr.clone();
    match TcpStream::connect(&addr).await {
        Ok(stream) => {
            let (reader, writer) = stream.into_split();
            // store writer
            {
                let mut map = state.peer_writers.lock().unwrap();
                map.insert(
                    peer_key(&to_ip, to_port),
                    Arc::new(tokio::sync::Mutex::new(writer)),
                );
            }
            // spawn reader loop
            let app_handle_clone = app_handle.clone();
            tokio::spawn(async move {
                let mut reader = BufReader::new(reader);
                let mut line = String::new();
                loop {
                    line.clear();
                    match reader.read_line(&mut line).await {
                        Ok(0) => break,
                        Ok(_) => {
                            if let Ok(msg) = serde_json::from_str::<Message>(&line) {
                                match msg {
                                    Message::Ping => {
                                        let _ = app_handle_clone.emit("peer-ping", &addr_clone);
                                    }
                                    Message::Pong => {
                                        let _ = app_handle_clone.emit("peer-pong", &addr_clone);
                                    }
                                    Message::DccRequest {
                                        from_ip, from_port, ..
                                    } => {
                                        let payload =
                                            serde_json::json!({"ip": from_ip, "port": from_port});
                                        let _ = app_handle_clone.emit("dcc-request", payload);
                                    }
                                    Message::DccOpened {
                                        from_ip, from_port, ..
                                    } => {
                                        let payload =
                                            serde_json::json!({"ip": from_ip, "port": from_port});
                                        let _ = app_handle_clone.emit("dcc-opened", payload);
                                    }
                                    Message::FileOffer {
                                        from_ip,
                                        from_port,
                                        name,
                                        size,
                                        ..
                                    } => {
                                        let payload = serde_json::json!({"from_ip": from_ip, "from_port": from_port, "name": name, "size": size});
                                        let _ = app_handle_clone.emit("dcc-file-offer", payload);
                                    }
                                    Message::FileAccept {
                                        from_ip,
                                        from_port,
                                        name,
                                        action,
                                        ..
                                    } => {
                                        let payload = serde_json::json!({"from_ip": from_ip, "from_port": from_port, "name": name, "action": action});
                                        let _ = app_handle_clone.emit("dcc-file-accept", payload);
                                    }
                                    Message::FileChunk {
                                        from_ip,
                                        from_port,
                                        name,
                                        offset,
                                        bytes_total,
                                        data_base64,
                                        ..
                                    } => {
                                        let payload = serde_json::json!({
                                            "from_ip": from_ip,
                                            "from_port": from_port,
                                            "name": name,
                                            "offset": offset,
                                            "bytes_total": bytes_total,
                                            "data_base64": data_base64,
                                        });
                                        let _ = app_handle_clone.emit("dcc-file-chunk", payload);
                                    }
                                    Message::FileCancel {
                                        from_ip,
                                        from_port,
                                        name,
                                        ..
                                    } => {
                                        let payload = serde_json::json!({"from_ip": from_ip, "from_port": from_port, "name": name});
                                        let _ = app_handle_clone.emit("dcc-file-cancel", payload);
                                    }
                                    Message::DccChat {
                                        from_ip,
                                        from_port,
                                        text,
                                        timestamp,
                                        ..
                                    } => {
                                        let payload = serde_json::json!({
                                            "from_ip": from_ip,
                                            "from_port": from_port,
                                            "text": text,
                                            "timestamp": timestamp,
                                        });
                                        let _ = app_handle_clone.emit("dcc-chat", payload);
                                    }
                                    _ => {}
                                }
                            }
                        }
                        Err(_) => break,
                    }
                }
                let _ = app_handle_clone.emit("peer-outgoing-closed", &addr_clone);
            });
            Ok(format!("Connected to peer {}", addr))
        }
        Err(e) => Err(format!("peer connect error: {}", e)),
    }
}

#[tauri::command]
async fn peer_send_dcc_request(
    to_ip: String,
    to_port: u16,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let self_opt = state
        .self_info
        .lock()
        .unwrap()
        .clone()
        .ok_or("Self not set")?;
    let msg = Message::DccRequest {
        from_ip: self_opt.local_ip,
        from_port: self_opt.port,
        to_ip: to_ip.clone(),
        to_port,
    };
    send_to_peer(&state, &to_ip, to_port, &msg).await?;
    Ok("sent".into())
}

#[tauri::command]
async fn peer_send_dcc_opened(
    to_ip: String,
    to_port: u16,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let self_opt = state
        .self_info
        .lock()
        .unwrap()
        .clone()
        .ok_or("Self not set")?;
    let msg = Message::DccOpened {
        from_ip: self_opt.local_ip,
        from_port: self_opt.port,
        to_ip: to_ip.clone(),
        to_port,
    };
    send_to_peer(&state, &to_ip, to_port, &msg).await?;
    Ok("sent".into())
}

#[tauri::command]
async fn peer_send_file_offer(
    to_ip: String,
    to_port: u16,
    name: String,
    size: u64,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let self_opt = state
        .self_info
        .lock()
        .unwrap()
        .clone()
        .ok_or("Self not set")?;
    let msg = Message::FileOffer {
        from_ip: self_opt.local_ip,
        from_port: self_opt.port,
        to_ip: to_ip.clone(),
        to_port,
        name,
        size,
    };
    send_to_peer(&state, &to_ip, to_port, &msg).await?;
    Ok("sent".into())
}

#[tauri::command]
async fn peer_send_file_accept(
    to_ip: String,
    to_port: u16,
    name: String,
    action: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let self_opt = state
        .self_info
        .lock()
        .unwrap()
        .clone()
        .ok_or("Self not set")?;
    let msg = Message::FileAccept {
        from_ip: self_opt.local_ip,
        from_port: self_opt.port,
        to_ip: to_ip.clone(),
        to_port,
        name,
        action,
    };
    send_to_peer(&state, &to_ip, to_port, &msg).await?;
    Ok("sent".into())
}

#[tauri::command]
async fn peer_send_file_chunk(
    to_ip: String,
    to_port: u16,
    name: String,
    offset: u64,
    bytes_total: u64,
    data_base64: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let self_opt = state
        .self_info
        .lock()
        .unwrap()
        .clone()
        .ok_or("Self not set")?;
    let msg = Message::FileChunk {
        from_ip: self_opt.local_ip,
        from_port: self_opt.port,
        to_ip: to_ip.clone(),
        to_port,
        name,
        offset,
        bytes_total,
        data_base64,
    };
    send_to_peer(&state, &to_ip, to_port, &msg).await?;
    Ok("sent".into())
}

#[tauri::command]
async fn peer_send_file_cancel(
    to_ip: String,
    to_port: u16,
    name: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let self_opt = state
        .self_info
        .lock()
        .unwrap()
        .clone()
        .ok_or("Self not set")?;
    let msg = Message::FileCancel {
        from_ip: self_opt.local_ip,
        from_port: self_opt.port,
        to_ip: to_ip.clone(),
        to_port,
        name,
    };
    send_to_peer(&state, &to_ip, to_port, &msg).await?;
    Ok("sent".into())
}

#[tauri::command]
async fn peer_send_dcc_chat(
    to_ip: String,
    to_port: u16,
    text: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let self_opt = state
        .self_info
        .lock()
        .unwrap()
        .clone()
        .ok_or("Self not set")?;
    let timestamp = chrono::Utc::now().to_rfc3339();
    let msg = Message::DccChat {
        from_ip: self_opt.local_ip,
        from_port: self_opt.port,
        to_ip: to_ip.clone(),
        to_port,
        text,
        timestamp,
    };
    send_to_peer(&state, &to_ip, to_port, &msg).await?;
    Ok("sent".into())
}

#[tauri::command]
async fn send_chat_message(
    message: String,
    channel: String,
    client_ip: String,
    client_port: u16,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let tx = state.tx.lock().unwrap().clone();

    if let Some(sender) = tx {
        let timestamp = chrono::Utc::now().to_rfc3339();
        let chat_msg = Message::Chat {
            from_ip: client_ip,
            from_port: client_port,
            message: message.clone(),
            timestamp,
            channel,
        };

        sender
            .send(chat_msg)
            .await
            .map_err(|e| format!("Failed to send chat message: {}", e))?;

        Ok("Message sent".to_string())
    } else {
        Err("Not connected to server".to_string())
    }
}

fn config_file_path() -> std::path::PathBuf {
    // Persist config under app data dir: <appData>/RelayClient/client-config.json
    let base = default_app_data_dir_fallback();
    let _ = std::fs::create_dir_all(&base);
    base.join("client-config.json")
}

fn load_config_from_disk() -> RuntimeConfig {
    let p = config_file_path();
    if let Ok(text) = std::fs::read_to_string(&p) {
        if let Ok(cfg) = serde_json::from_str::<RuntimeConfig>(&text) {
            return cfg;
        }
    }
    RuntimeConfig::default()
}

fn save_config_to_disk(cfg: &RuntimeConfig) {
    let p = config_file_path();
    if let Some(parent) = p.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let _ = std::fs::write(p, serde_json::to_string_pretty(cfg).unwrap_or_default());
}

fn app_data_dir_from_handle(app_handle: Option<&tauri::AppHandle>) -> std::path::PathBuf {
    if let Some(ah) = app_handle {
        if let Ok(p) = ah.path().app_data_dir() {
            return p.join("RelayClient");
        }
    }
    default_app_data_dir_fallback()
}

fn logs_dir_from_app(app_handle: Option<&tauri::AppHandle>) -> std::path::PathBuf {
    if let Ok(dir) = std::env::var("WDIO_LOGS_DIR") {
        return std::path::PathBuf::from(dir);
    }
    app_data_dir_from_handle(app_handle).join(".log")
}

fn cert_dir_from_config(cfg: &RuntimeConfig) -> std::path::PathBuf {
    let path_raw = cfg.certificate_path.clone();
    let p = if path_raw.trim().is_empty() {
        default_app_data_dir_fallback()
    } else {
        std::path::PathBuf::from(path_raw)
    };
    if path_is_dir_like(&p) {
        p
    } else {
        p.parent()
            .map(|x| x.to_path_buf())
            .unwrap_or_else(|| default_app_data_dir_fallback())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct UiGenArgs {
    email: String,
    #[serde(default)]
    password: Option<String>,
    #[serde(default)]
    bits: Option<u32>,
    #[serde(default)]
    friendlyName: Option<String>,
    #[serde(default)]
    savePath: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct UiGenResult {
    status: String, // 'missing' | 'invalid' | 'valid'
    privateKeyPath: String,
    certPemPath: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct UiCheckResult {
    status: String, // 'missing' | 'invalid' | 'valid'
    privateKeyPath: String,
    certPemPath: String,
}

fn path_is_dir_like(p: &std::path::Path) -> bool {
    if let Ok(meta) = std::fs::metadata(p) {
        return meta.is_dir();
    }
    // Heuristic: trailing separator implies directory
    let s = p.to_string_lossy();
    s.ends_with('/') || s.ends_with('\\')
}

fn resolve_output_dir(save_path: &str) -> std::path::PathBuf {
    let p = std::path::PathBuf::from(save_path);
    if path_is_dir_like(&p) {
        return p;
    }
    // If it looks like a file path (e.g., ends with .pem or .key), use its parent
    p.parent()
        .map(|x| x.to_path_buf())
        .unwrap_or_else(|| std::path::PathBuf::from("."))
}

#[tauri::command]
async fn ui_load_private_key(state: State<'_, AppState>) -> Result<UiCheckResult, String> {
    let cfg_cur = state.config.lock().unwrap().clone();
    let path_raw = cfg_cur.certificate_path.clone();
    let p = if path_raw.trim().is_empty() {
        default_app_data_dir_fallback()
    } else {
        std::path::PathBuf::from(path_raw)
    };
    let (_dir, priv_path, cert_path) = if path_is_dir_like(&p) {
        let d = p;
        let privp = d.join("private.key");
        let certp = d.join("certificate.pem");
        (d, privp, certp)
    } else {
        let name = p.file_name().and_then(|s| s.to_str()).unwrap_or("");
        if name.ends_with(".key") {
            let d = p
                .parent()
                .map(|x| x.to_path_buf())
                .unwrap_or_else(|| std::path::PathBuf::from("."));
            (d.clone(), p.clone(), d.join("certificate.pem"))
        } else if name.ends_with(".pem") {
            let d = p
                .parent()
                .map(|x| x.to_path_buf())
                .unwrap_or_else(|| std::path::PathBuf::from("."));
            (d.clone(), d.join("private.key"), p.clone())
        } else {
            // Unknown file name; treat parent as dir
            let d = p
                .parent()
                .map(|x| x.to_path_buf())
                .unwrap_or_else(|| std::path::PathBuf::from("."));
            (d.clone(), d.join("private.key"), d.join("certificate.pem"))
        }
    };
    // Determine status
    let status = if !priv_path.exists() || !cert_path.exists() {
        "missing".to_string()
    } else {
        match std::fs::read_to_string(&cert_path) {
            Ok(cert_pem_str) => {
                let der = pem_to_der(&cert_pem_str).unwrap_or_default();
                if der.is_empty() {
                    "invalid".to_string()
                } else {
                    "valid".to_string()
                }
            }
            Err(_) => "invalid".to_string(),
        }
    };

    Ok(UiCheckResult {
        status,
        privateKeyPath: priv_path.to_string_lossy().to_string(),
        certPemPath: cert_path.to_string_lossy().to_string(),
    })
}

#[tauri::command]
async fn ui_generate_user_keys_and_cert(
    args: UiGenArgs,
    state: State<'_, AppState>,
) -> Result<UiGenResult, String> {
    // Determine output dir from provided savePath or fallback to runtime config certificate_path, then to app data dir
    let provided = args.savePath.unwrap_or_default();
    let provided_trim = provided.trim().to_string();
    let out_dir = if provided_trim.is_empty() {
        // Use runtime config path if set; otherwise fallback
        let cfg_cur = state.config.lock().unwrap().clone();
        let path_raw = cfg_cur.certificate_path.clone();
        let base = if path_raw.trim().is_empty() {
            default_app_data_dir_fallback()
        } else {
            std::path::PathBuf::from(path_raw)
        };
        if path_is_dir_like(&base) {
            base
        } else {
            base.parent()
                .map(|p| p.to_path_buf())
                .unwrap_or_else(|| default_app_data_dir_fallback())
        }
    } else {
        resolve_output_dir(&provided_trim)
    };
    std::fs::create_dir_all(&out_dir).map_err(|e| format!("Failed to create dir: {}", e))?;
    // Build certificate with rcgen; ignore password/bits for now
    let mut params = rcgen::CertificateParams::default();
    params
        .subject_alt_names
        .push(rcgen::SanType::Rfc822Name(args.email.clone()));
    params.distinguished_name.push(
        rcgen::DnType::CommonName,
        format!("Flashback Test {}", args.email),
    );
    // Choose algorithm default ECDSA; friendlyName/bits not used currently
    params.alg = &rcgen::PKCS_ECDSA_P256_SHA256;
    let cert = rcgen::Certificate::from_params(params)
        .map_err(|e| format!("Generate cert error: {}", e))?;
    let pem = cert
        .serialize_pem()
        .map_err(|e| format!("Serialize PEM error: {}", e))?;
    let priv_pem = cert.serialize_private_key_pem();
    // Write files
    let cert_path = out_dir.join("certificate.pem");
    let priv_path = out_dir.join("private.key");
    std::fs::write(&cert_path, &pem).map_err(|e| format!("Write certificate.pem failed: {}", e))?;
    std::fs::write(&priv_path, &priv_pem)
        .map_err(|e| format!("Write private.key failed: {}", e))?;
    // Persist config certificate_path -> certificate.pem (no PKH in state)
    {
        let mut cfg = state.config.lock().unwrap().clone();
        cfg.certificate_path = cert_path.to_string_lossy().to_string();
        cfg.email = args.email.clone();
        let mut guard = state.config.lock().unwrap();
        *guard = cfg.clone();
        save_config_to_disk(&cfg);
    }
    // Verify and report status without loading cert into persistent state
    let check = ui_load_private_key(state).await?;
    Ok(UiGenResult {
        status: check.status,
        privateKeyPath: priv_path.to_string_lossy().to_string(),
        certPemPath: cert_path.to_string_lossy().to_string(),
    })
}

fn main() {
    // Build shared AppState used by both GUI and CLI modes
    let initial_cfg = load_config_from_disk();
    let app_state = AppState {
        clients: Arc::new(Mutex::new(Vec::new())),
        tx: Arc::new(Mutex::new(None)),
        current_channel: Arc::new(Mutex::new("general".to_string())),
        self_info: Arc::new(Mutex::new(None)),
        peers: Arc::new(Mutex::new(HashMap::new())),
        peer_writers: Arc::new(Mutex::new(HashMap::new())),
        cli_mode: Arc::new(Mutex::new(false)),
        cli_auto_allow: Arc::new(Mutex::new(false)),
        allowed_peers: Arc::new(Mutex::new(std::collections::HashSet::new())),
        pending_request: Arc::new(Mutex::new(None)),
        config: Arc::new(Mutex::new(initial_cfg)),
    };

    let args: Vec<String> = std::env::args().collect();
    let want_start_listener = args.iter().any(|a| a == "--start-listener");
    let want_auto_allow = args.iter().any(|a| a == "--auto-allow");
    if args.iter().any(|a| a == "--help" || a == "-h") {
        print_cli_help();
        return;
    }
    // Generate context once for both CLI and GUI modes
    let context = tauri::generate_context!();
    
    if args.iter().any(|a| a == "--cli") {
        // CLI mode: Build a minimal Tauri App so we can reuse the same command functions and state
        // We build with a dummy context but don't run it - instead we manually drive the CLI loop
        let app = tauri::Builder::default()
            .manage(app_state)
            .invoke_handler(tauri::generate_handler![
                connect_to_server,
                get_clients,
                request_client_list,
                send_chat_message,
                connect_to_peer,
                peer_send_dcc_request,
                peer_send_dcc_opened,
                peer_send_file_offer,
                peer_send_file_accept,
                peer_send_file_chunk,
                peer_send_file_cancel,
                peer_send_dcc_chat,
                api_register,
                api_register_json,
                api_get_clients,
                api_get_repositories,
                api_ready,
                api_lookup,
                api_clone_repository,
                list_shareable_files,
                get_shareable_file,
                ui_load_private_key,
                ui_generate_user_keys_and_cert
            ])
            .build(context)
            .expect("failed to build tauri app for CLI mode");
        {
            let st: tauri::State<AppState> = app.state::<AppState>();
            {
                let mut flag = st.cli_mode.lock().unwrap();
                *flag = true;
            }
            if want_auto_allow {
                let mut aa = st.cli_auto_allow.lock().unwrap();
                *aa = true;
            }
            // Handle optional startup certificate generation: --gen-cert=<email>
            // Support startup generation via --gen-key=<email> or legacy --gen-cert=<email>
            let startup_email =
                if let Some(gen_arg) = args.iter().find(|a| a.starts_with("--gen-key=")) {
                    gen_arg.split_once('=').map(|(_, e)| e.to_string())
                } else if let Some(gen_arg) = args.iter().find(|a| a.starts_with("--gen-cert=")) {
                    gen_arg.split_once('=').map(|(_, e)| e.to_string())
                } else {
                    None
                };
            if let Some(email) = startup_email {
                // Generate a self-signed certificate with SAN rfc822Name=email using rcgen (v0.12)
                let mut params = rcgen::CertificateParams::default();
                params
                    .subject_alt_names
                    .push(rcgen::SanType::Rfc822Name(email.to_string()));
                params.distinguished_name.push(
                    rcgen::DnType::CommonName,
                    format!("Flashback Test {}", email),
                );
                match rcgen::Certificate::from_params(params) {
                    Ok(cert) => {
                        let pem = match cert.serialize_pem() {
                            Ok(p) => p,
                            Err(e) => {
                                println!("Error serializing PEM: {}", e);
                                String::new()
                            }
                        };
                        let priv_pem = cert.serialize_private_key_pem();
                        if !pem.is_empty() {
                            // Determine output directory from runtime config (same dir as certificate_path)
                            let cfg_cur = st.config.lock().unwrap().clone();
                            let cert_path_cur =
                                std::path::PathBuf::from(cfg_cur.certificate_path.clone());
                            let out_dir = cert_path_cur
                                .parent()
                                .map(|p| p.to_path_buf())
                                .unwrap_or_else(|| std::path::PathBuf::from("."));
                            let _ = std::fs::create_dir_all(&out_dir);
                            let cert_path = out_dir.join("certificate.pem");
                            let priv_path = out_dir.join("private.key");
                            let _ = std::fs::write(&cert_path, &pem);
                            let _ = std::fs::write(&priv_path, &priv_pem);
                            // Persist config (ensure certificate_path points to certificate.pem in this dir)
                            let mut cfg_save = cfg_cur.clone();
                            cfg_save.certificate_path = cert_path.to_string_lossy().to_string();
                            cfg_save.email = email.clone();
                            {
                                let mut guard = st.config.lock().unwrap();
                                *guard = cfg_save.clone();
                            }
                            save_config_to_disk(&cfg_save);
                            println!("Generated certificate for {}", email);
                        }
                    }
                    Err(e) => {
                        println!("Error generating certificate: {}", e);
                    }
                }
            }
            if want_start_listener {
                // Start listener before entering interactive loop
                let ah = app.handle();
                let st2 = app.state::<AppState>();
                let _ = tauri::async_runtime::block_on(start_peer_listener_async(
                    st2,
                    ah.clone(),
                    None,
                    None,
                ));
            }
        }
        run_cli(app);
        return;
    }

    // GUI mode: Initialize Tauri builder and run the app
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            connect_to_server,
            get_clients,
            request_client_list,
            send_chat_message,
            // P2P DCC commands
            connect_to_peer,
            peer_send_dcc_request,
            peer_send_dcc_opened,
            peer_send_file_offer,
            peer_send_file_accept,
            peer_send_file_chunk,
            peer_send_file_cancel,
            peer_send_dcc_chat,
            api_register,
            api_register_json,
            api_get_clients,
            api_get_repositories,
            api_ready,
            api_lookup,
            api_clone_repository,
            list_shareable_files,
            get_shareable_file,
            ui_load_private_key,
            ui_generate_user_keys_and_cert
        ])
        .run(context)
        .expect("error while running tauri application");
}

fn print_cli_help() {
    println!("Flashback Client CLI\n");
    println!("Commands:");
    println!("  --cli                 Start in interactive CLI mode");
    println!("  --help, -h           Show this help");
    println!("\nInteractive CLI commands:");
    println!("  help                 Show this help");
    println!("  connect-server <server:port>");
    println!("                       Connect to the server (client IP is auto-detected; binds on a random local port)");
    println!("  connect-peer <peer:port>");
    println!("                       Connect to a peer client (DCC)");
    println!("  send-channel <channel> <message>");
    println!("                       Send a message to a server channel");
    println!("  users");
    println!("                       Request the current user list from the server");
    println!("  send-client <peer:port> <text>");
    println!("                       Send a direct message to a peer client (DCC chat)");
    println!("  allow                Approve the pending incoming chat/transfer request");
    println!("  allow auto           Auto-approve all incoming chats/transfers for this session");
    println!("  deny                 Reject the pending incoming chat/transfer request");
    println!("  gen-key <email> [--password=***] [--bits=N] [--alg=ecdsa|ed25519|rsa] [--reuse-key]\n                       Generate or reuse a key: writes private.key, certificate.pem next to Config.certificate_path");
    println!("  gen-cert <email>      (alias) Generate a self-signed cert and private key; writes private.key, certificate.pem next to Config.certificate_path");
    println!("  set-cert-path <path> Set Config.privateKeyPath (file path). If a directory is provided, 'certificate.pem' will be appended");
    println!("  print-cert           Print the generated certificate PEM between markers");
    println!("  start-listener       Start the peer listener on an ephemeral port (no server connection)");
    println!("  api-register [baseUrl]   Register certificate with server");
    println!("  api-ready [baseUrl] [ip:port]  Announce ready socket; if ip:port omitted, uses local listener; prints 'READY OK <ip:port>'");
    println!("  api-lookup [baseUrl] <email> [minutes]  Lookup recent sockets; prints 'LOOKUP SOCKET <ip:port>' or 'LOOKUP NONE'");
    println!("  quit | exit          Exit the CLI");
}

fn parse_host_port(input: &str) -> Result<(String, u16), String> {
    let mut parts = input.rsplitn(2, ':');
    let port_str = parts.next().ok_or_else(|| "missing port".to_string())?;
    let host = parts.next().ok_or_else(|| "missing host".to_string())?;
    let port: u16 = port_str.parse().map_err(|_| "invalid port".to_string())?;
    if host.is_empty() {
        return Err("missing host".to_string());
    }
    Ok((host.to_string(), port))
}

async fn start_peer_listener_async(
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
    bind_host: Option<String>,
    bind_port: Option<u16>,
) -> Result<u16, String> {
    // Detect local client IP
    let client_ip = local_ip_address::local_ip()
        .map_err(|e| format!("Failed to determine local IP: {}", e))?
        .to_string();
    // Bind configured or ephemeral port
    let host = bind_host.unwrap_or_else(|| "0.0.0.0".to_string());
    let port = bind_port.unwrap_or(0);
    let bind_addr = format!("{}:{}", host, port);
    let listener = TcpListener::bind(&bind_addr)
        .await
        .map_err(|e| format!("Failed to bind peer listener at {}: {}", bind_addr, e))?;
    let actual_port = listener
        .local_addr()
        .map_err(|e| format!("Failed to get listener local addr: {}", e))?
        .port();
    // Save self info
    {
        let mut self_lock = state.self_info.lock().unwrap();
        *self_lock = Some(ClientInfo {
            local_ip: client_ip.clone(),
            remote_ip: "".to_string(),
            port: actual_port,
        });
    }
    // Persist the listener port to a file inside logs dir
    let pid = std::process::id();
    let mut ld = if let Ok(dir) = std::env::var("WDIO_LOGS_DIR") {
        std::path::PathBuf::from(dir)
    } else {
        logs_dir_from_app(Some(&app_handle))
    };
    let _ = std::fs::create_dir_all(&ld);
    ld.push(format!("peer-port-{}.txt", pid));
    let _ = std::fs::write(&ld, format!("{}", actual_port));
    // Spawn accept loop
    {
        let app_handle_clone = app_handle.clone();
        let print_addr = format!("0.0.0.0:{}", actual_port);
        tokio::spawn(async move {
            println!("👂 Peer listener started at {}", print_addr);
            let pw_map = app_handle_clone.state::<AppState>().peer_writers.clone();
            let app_handle_outer = app_handle_clone.clone();
            let listener = listener; // move into task
            loop {
                match listener.accept().await {
                    Ok((stream, remote)) => {
                        println!("🔗 Incoming peer connection from {}", remote);
                        let app_handle_incoming = app_handle_outer.clone();
                        let pw_map = pw_map.clone();
                        tokio::spawn(async move {
                            let (reader, writer) = stream.into_split();
                            let writer_arc = Arc::new(tokio::sync::Mutex::new(writer));
                            let mut reader = BufReader::new(reader);
                            let key = format!("{}", remote);
                            {
                                let mut map = pw_map.lock().unwrap();
                                map.insert(key.clone(), writer_arc.clone());
                            }
                            let mut line = String::new();
                            loop {
                                line.clear();
                                match reader.read_line(&mut line).await {
                                    Ok(0) => break,
                                    Ok(_) => {
                                        if let Ok(msg) = serde_json::from_str::<Message>(&line) {
                                            match msg {
                                                Message::Ping => {
                                                    let pong =
                                                        serde_json::to_string(&Message::Pong)
                                                            .unwrap()
                                                            + "\n";
                                                    let writer_arc_opt = {
                                                        pw_map.lock().unwrap().get(&key).cloned()
                                                    };
                                                    if let Some(w) = writer_arc_opt {
                                                        if let Ok(mut guard) = w.try_lock() {
                                                            if let Err(e) = guard
                                                                .write_all(pong.as_bytes())
                                                                .await
                                                            {
                                                                println!("Peer write error: {}", e);
                                                                break;
                                                            }
                                                            if let Err(e) = guard.flush().await {
                                                                println!("Peer flush error: {}", e);
                                                                break;
                                                            }
                                                        }
                                                    }
                                                }
                                                _ => {}
                                            }
                                        }
                                    }
                                    Err(_) => break,
                                }
                            }
                        });
                    }
                    Err(e) => {
                        println!("Accept error: {}", e);
                        break;
                    }
                }
            }
        });
    }
    Ok(actual_port)
}

fn logs_dir_env() -> std::path::PathBuf {
    if let Ok(dir) = std::env::var("WDIO_LOGS_DIR") {
        std::path::PathBuf::from(dir)
    } else {
        std::path::PathBuf::from(".")
    }
}

fn debug_http_enabled() -> bool {
    matches!(
        std::env::var("CLIENT_DEBUG").ok().as_deref(),
        Some("1") | Some("true") | Some("TRUE") | Some("yes") | Some("on")
    )
}

async fn http_post_json(
    url: &str,
    body: serde_json::Value,
) -> Result<(StatusCode, serde_json::Value), String> {
    if debug_http_enabled() {
        println!("[HTTP DEBUG] POST {}\nRequest: {}", url, body);
    }
    let client = reqwest::Client::new();
    let resp = client
        .post(url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("HTTP POST failed: {}", e))?;
    let status = resp.status();
    let text = resp
        .text()
        .await
        .map_err(|e| format!("Read body failed: {}", e))?;
    let json: serde_json::Value =
        serde_json::from_str(&text).unwrap_or(serde_json::json!({"raw": text}));
    if debug_http_enabled() {
        println!(
            "[HTTP DEBUG] <-- {} {}\nResponse: {}",
            status.as_u16(),
            status.canonical_reason().unwrap_or(""),
            json
        );
    }
    Ok((status, json))
}

async fn http_get_json(url: &str) -> Result<(StatusCode, serde_json::Value), String> {
    if debug_http_enabled() {
        println!("[HTTP DEBUG] GET {}", url);
    }
    let client = reqwest::Client::new();
    let resp = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("HTTP GET failed: {}", e))?;
    let status = resp.status();
    let text = resp
        .text()
        .await
        .map_err(|e| format!("Read body failed: {}", e))?;
    let json: serde_json::Value =
        serde_json::from_str(&text).unwrap_or(serde_json::json!({"raw": text}));
    if debug_http_enabled() {
        println!(
            "[HTTP DEBUG] <-- {} {}\nResponse: {}",
            status.as_u16(),
            status.canonical_reason().unwrap_or(""),
            json
        );
    }
    Ok((status, json))
}

fn default_base_url() -> String {
    "http://127.0.0.1:8080".to_string()
}

#[tauri::command]
async fn api_register(state: State<'_, AppState>) -> Result<String, String> {
    let base = {
        let cfg = state.config.lock().unwrap();
        let b = cfg.base_url.clone();
        if b.trim().is_empty() {
            default_base_url()
        } else {
            b
        }
    };
    // Load certificate from disk rather than memory
    let cert_path = { state.config.lock().unwrap().certificate_path.clone() };
    let cert = std::fs::read_to_string(&cert_path)
        .map_err(|e| format!("No certificate on disk at {}: {}", cert_path, e))?;
    let url = format!("{}/api/register", base.trim_end_matches('/'));
    let body = serde_json::json!({"certificate": cert});
    let (status, json) = http_post_json(&url, body).await?;
    if status == StatusCode::CREATED {
        Ok(format!("REGISTERED"))
    } else if status == StatusCode::CONFLICT {
        Ok(format!("REGISTER CONFLICT"))
    } else {
        Ok(format!("REGISTER ERROR {} {}", status.as_u16(), json))
    }
}

#[tauri::command]
async fn api_register_json(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    let base = {
        let cfg = state.config.lock().unwrap();
        let b = cfg.base_url.clone();
        if b.trim().is_empty() {
            default_base_url()
        } else {
            b
        }
    };
    // Load certificate from disk
    let cert_path = { state.config.lock().unwrap().certificate_path.clone() };
    let cert = std::fs::read_to_string(&cert_path)
        .map_err(|e| format!("No certificate on disk at {}: {}", cert_path, e))?;
    let url = format!("{}/api/register", base.trim_end_matches('/'));
    let body = serde_json::json!({"certificate": cert});
    let (status, json) = http_post_json(&url, body).await?;
    Ok(serde_json::json!({
        "status": status.as_u16(),
        "data": json
    }))
}

#[tauri::command]
async fn api_get_clients(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    let base = {
        let cfg = state.config.lock().unwrap();
        let b = cfg.base_url.clone();
        if b.trim().is_empty() {
            default_base_url()
        } else {
            b
        }
    };
    let url = format!("{}/api/clients", base.trim_end_matches('/'));
    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to get clients: {}", e))?;
    let status = response.status();
    let json = response
        .json::<serde_json::Value>()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;
    Ok(serde_json::json!({
        "status": status.as_u16(),
        "clients": json.get("clients").cloned().unwrap_or(serde_json::json!([]))
    }))
}

#[tauri::command]
async fn api_ready(
    localIP: Option<String>,
    remoteIP: Option<String>,
    broadcastPort: Option<u16>,
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    let base = {
        let cfg = state.config.lock().unwrap();
        let b = cfg.base_url.clone();
        if b.trim().is_empty() {
            default_base_url()
        } else {
            b
        }
    };
    let cfg_cur = state.config.lock().unwrap().clone();

    // Ensure peer listener is started and configured
    let need_start = { state.self_info.lock().unwrap().is_none() };
    if need_start {
        let bind_host = localIP.clone().filter(|s| !s.trim().is_empty());
        let bind_port = broadcastPort;
        let _ = start_peer_listener_async(state.clone(), app_handle.clone(), bind_host, bind_port)
            .await?;
    }
    // After ensuring listener, read the actual port
    let (actual_local_ip, actual_port) = {
        let me = state
            .self_info
            .lock()
            .unwrap()
            .clone()
            .ok_or_else(|| "Failed to start listener".to_string())?;
        (me.local_ip, me.port)
    };

    // Build the socket_address to announce
    let remote_host_opt: Option<String> = if let Some(r) = remoteIP.clone() {
        let r = r.trim();
        if r.is_empty() {
            None
        } else if r.contains(':') {
            parse_host_port(r).ok().map(|(h, _)| h)
        } else {
            Some(r.to_string())
        }
    } else {
        None
    };
    let host_for_broadcast = remote_host_opt
        .or_else(|| localIP.clone())
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| "127.0.0.1".to_string());
    let sock = format!("{}:{}", host_for_broadcast, actual_port);

    let url = format!("{}/api/broadcast/ready", base.trim_end_matches('/'));
    let email_val = cfg_cur.email.clone();
    if email_val.trim().is_empty() {
        return Err("Email is not set in config. Please generate keys (username) first.".to_string());
    }
    let body = serde_json::json!({"email": email_val, "socket_address": sock});
    let (status, json) = http_post_json(&url, body).await?;
    if status == StatusCode::OK || status == StatusCode::CREATED {
        Ok(format!(
            "READY OK {}",
            json.get("socket_address")
                .and_then(|v| v.as_str())
                .unwrap_or("")
        ))
    } else {
        Ok(format!("READY ERROR {} {}", status.as_u16(), json))
    }
}

// Allowed file extensions for serving (whitelist)
const ALLOWED_FILE_EXTENSIONS: &[&str] = &[
    ".md", ".markdown", ".txt", ".css",
    ".jpg", ".jpeg", ".png", ".gif", ".webp",
    ".mp4", ".webm", ".mov", ".avi",
    ".mp3", ".wav", ".m4a", ".flac",
];

// Blocked file extensions (blacklist)
const BLOCKED_FILE_EXTENSIONS: &[&str] = &[
    ".html", ".htm", ".js", ".jsx", ".ts", ".tsx",
    ".exe", ".bin", ".sh", ".bat", ".cmd", ".ps1",
    ".dll", ".so", ".dylib", ".jar", ".class",
];

fn is_file_allowed(file_path: &str) -> bool {
    let lower_path = file_path.to_lowercase();
    
    // Check blacklist first (deny)
    for ext in BLOCKED_FILE_EXTENSIONS {
        if lower_path.ends_with(ext) {
            return false;
        }
    }
    
    // Check whitelist (allow)
    for ext in ALLOWED_FILE_EXTENSIONS {
        if lower_path.ends_with(ext) {
            return true;
        }
    }
    
    // Default: deny unknown types
    false
}

fn get_content_type(file_path: &str) -> &'static str {
    let lower = file_path.to_lowercase();
    
    if lower.ends_with(".md") || lower.ends_with(".markdown") || lower.ends_with(".txt") {
        "text/plain"
    } else if lower.ends_with(".css") {
        "text/css"
    } else if lower.ends_with(".jpg") || lower.ends_with(".jpeg") {
        "image/jpeg"
    } else if lower.ends_with(".png") {
        "image/png"
    } else if lower.ends_with(".gif") {
        "image/gif"
    } else if lower.ends_with(".webp") {
        "image/webp"
    } else if lower.ends_with(".mp4") {
        "video/mp4"
    } else if lower.ends_with(".webm") {
        "video/webm"
    } else if lower.ends_with(".mov") {
        "video/quicktime"
    } else if lower.ends_with(".avi") {
        "video/x-msvideo"
    } else if lower.ends_with(".mp3") {
        "audio/mpeg"
    } else if lower.ends_with(".wav") {
        "audio/wav"
    } else if lower.ends_with(".m4a") {
        "audio/mp4"
    } else if lower.ends_with(".flac") {
        "audio/flac"
    } else {
        "application/octet-stream"
    }
}

#[tauri::command]
async fn list_shareable_files() -> Result<serde_json::Value, String> {
    // TODO: Implement file listing from a designated share directory
    // For now, return mock data
    Ok(serde_json::json!({
        "status": 200,
        "files": [
            {"name": "README.md", "type": "file", "size": 2048},
            {"name": "guide.md", "type": "file", "size": 4096},
            {"name": "style.css", "type": "file", "size": 1024},
        ]
    }))
}

#[tauri::command]
async fn get_shareable_file(path: String) -> Result<serde_json::Value, String> {
    // Check if file extension is allowed
    if !is_file_allowed(&path) {
        return Err(format!("File type not allowed: {}", path));
    }
    
    // TODO: Implement secure file serving from designated share directory
    // For now, return mock data
    Ok(serde_json::json!({
        "status": 200,
        "data": {
            "name": "example.md",
            "type": "text/plain",
            "size": 2048,
            "content": "# Example File\n\nThis is a markdown file."
        }
    }))
}

#[tauri::command]
async fn api_lookup(
    email: String,
    minutes: Option<u32>,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let base = {
        let cfg = state.config.lock().unwrap();
        let b = cfg.base_url.clone();
        if b.trim().is_empty() {
            default_base_url()
        } else {
            b
        }
    };
    let mins = minutes.unwrap_or(10);
    let url = format!(
        "{}/api/broadcast/lookup?email={}&minutes={}",
        base.trim_end_matches('/'),
        email,
        mins
    );
    let (status, json) = http_get_json(&url).await?;
    if status == StatusCode::OK {
        if let Some(items) = json.get("items").and_then(|v| v.as_array()) {
            if let Some(first) = items.first() {
                if let Some(sock) = first.get("socket_address").and_then(|v| v.as_str()) {
                    return Ok(format!("LOOKUP SOCKET {}", sock));
                }
            }
        }
        Ok("LOOKUP NONE".to_string())
    } else {
        Ok(format!("LOOKUP ERROR {} {}", status.as_u16(), json))
    }
}

#[tauri::command]
async fn api_clone_repository(
    repo_name: String,
    git_url: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    use std::process::Command;
    
    let cfg = state.config.lock().unwrap();
    let file_root = cfg.file_root_directory.as_ref().and_then(|d| {
        if d.trim().is_empty() { None } else { Some(d.clone()) }
    }).ok_or("fileRootDirectory not configured")?;
    
    let repos_dir = std::path::PathBuf::from(&file_root).join("repos");
    std::fs::create_dir_all(&repos_dir)
        .map_err(|e| format!("Failed to create repos directory: {}", e))?;
    
    let repo_path = repos_dir.join(&repo_name);
    
    // Security check: ensure repo_name doesn't contain path traversal characters
    if repo_name.contains("..") || repo_name.contains("/") || repo_name.contains("\\") {
        return Err("Invalid repository name".to_string());
    }
    
    // If directory already exists, it's already cloned
    if repo_path.exists() {
        return Ok(format!("Repository '{}' already exists at {}", repo_name, repo_path.display()));
    }
    
    // Clone the repository
    let output = Command::new("git")
        .arg("clone")
        .arg(&git_url)
        .arg(&repo_path)
        .output()
        .map_err(|e| format!("Failed to execute git clone: {}", e))?;
    
    if !output.status.success() {
        let err_msg = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Git clone failed: {}", err_msg));
    }
    
    // Verify the clone was successful
    if repo_path.exists() {
        Ok(format!("Repository '{}' cloned successfully to {}", repo_name, repo_path.display()))
    } else {
        Err("Clone succeeded but directory not found".to_string())
    }
}

#[tauri::command]
async fn api_get_repositories(
    state: State<'_, AppState>,
) -> Result<String, String> {
    use serde_json::json;
    
    let base = {
        let cfg = state.config.lock().unwrap();
        let b = cfg.base_url.clone();
        if b.trim().is_empty() {
            default_base_url()
        } else {
            b
        }
    };
    
    let url = format!("{}/api/repository/list", base.trim_end_matches('/'));
    let (_status, json) = http_get_json(&url).await?;
    
    if let Some(items) = json.get("items").and_then(|v| v.as_array()) {
        return Ok(serde_json::to_string(items).unwrap_or_default());
    }
    
    Ok("[]".to_string())
}

fn pem_to_der(pem: &str) -> Option<Vec<u8>> {
    // Try to decode PEM using pem-rfc7468 crate
    match pem_rfc7468::decode_vec(pem.as_bytes()) {
        Ok((_label, der)) => Some(der),
        Err(_) => {
            // Fallback: strip header/footer and base64 decode using data_encoding
            // We avoid adding a new dependency: try a simple manual parse if needed
            let mut b64 = String::new();
            let mut in_body = false;
            for line in pem.lines() {
                if line.starts_with("-----BEGIN") {
                    in_body = true;
                    continue;
                }
                if line.starts_with("-----END") {
                    break;
                }
                if in_body {
                    b64.push_str(line.trim());
                }
            }
            if b64.is_empty() {
                return None;
            }
            base64_simple_decode(&b64)
        }
    }
}

fn base64_simple_decode(s: &str) -> Option<Vec<u8>> {
    // Minimal base64 decoder using pem-rfc7468 base64 engine if available; otherwise none.
    // pem-rfc7468 uses base64ct internally but doesn't expose. Implement a tiny decoder via base64 crate is not available.
    // As a fallback, attempt using standard library via data_encoding if compiled in. Since not available, return None.
    // In practice, decode_vec above should succeed for valid certificate PEMs.
    None
}

fn run_cli(app: tauri::App) {
    use std::io::{self, Write};
    use tauri::async_runtime;

    println!("Running in CLI mode! Type 'help' to see available commands.\n");
    print_cli_help();

    let app_handle = app.handle();
    let state: tauri::State<AppState> = app_handle.state::<AppState>();

    let mut line = String::new();
    loop {
        print!("> ");
        let _ = io::stdout().flush();
        line.clear();
        match io::stdin().read_line(&mut line) {
            Ok(0) => {
                // EOF reached (e.g., stdin closed). Stay alive and keep waiting unless user exits explicitly.
                // Sleep a bit to avoid busy loop when stdin is closed.
                std::thread::sleep(std::time::Duration::from_millis(200));
                continue;
            }
            Ok(_) => {}
            Err(e) => {
                println!("Input error: {}. Type 'exit' to quit (continuing).", e);
                std::thread::sleep(std::time::Duration::from_millis(200));
                continue;
            }
        }
        let input = line.trim();
        if input.is_empty() {
            continue;
        }
        let mut parts = input.split_whitespace();
        let cmd = parts.next().unwrap_or("");
        match cmd {
            "help" | "--help" | "-h" => {
                print_cli_help();
            }
            "quit" | "exit" => {
                println!("Bye!");
                break;
            }
            "gen-key" => {
                // Syntax: gen-key <email> [--password=***] [--bits=N] [--alg=ecdsa|ed25519|rsa] [--reuse-key]
                let email = match parts.next() {
                    Some(e) => e.to_string(),
                    None => {
                        println!("Usage: gen-key <email> [--password=***] [--bits=N] [--alg=ecdsa|ed25519|rsa] [--reuse-key]");
                        continue;
                    }
                };
                // parse flags (optional)
                let mut _password: Option<String> = None;
                let mut _bits: Option<u32> = None;
                let mut alg: String = "ecdsa".to_string();
                let mut reuse = false;
                for tok in parts {
                    if let Some(v) = tok.strip_prefix("--password=") {
                        _password = Some(v.to_string());
                        continue;
                    }
                    if let Some(v) = tok.strip_prefix("--bits=") {
                        if let Ok(n) = v.parse::<u32>() {
                            _bits = Some(n);
                        }
                        continue;
                    }
                    if let Some(v) = tok.strip_prefix("--alg=") {
                        alg = v.to_lowercase();
                        continue;
                    }
                    if tok == "--reuse-key" {
                        reuse = true;
                        continue;
                    }
                }
                // Determine output directory from config.certificate_path
                let mut cfg = state.config.lock().unwrap().clone();
                let cert_path_cur = std::path::PathBuf::from(cfg.certificate_path.clone());
                let out_dir = cert_path_cur
                    .parent()
                    .map(|p| p.to_path_buf())
                    .unwrap_or_else(|| std::path::PathBuf::from("."));
                let _ = std::fs::create_dir_all(&out_dir);
                let cert_path = out_dir.join("certificate.pem");
                let priv_path = out_dir.join("private.key");

                // Reuse mode: do not generate a new private key
                if reuse {
                    if let Ok(priv_pem) = std::fs::read_to_string(&priv_path) {
                        // If certificate.pem exists, compute PKH from it; otherwise generate a cert using existing key
                        let mut pem_opt: Option<String> = None;
                        if let Ok(existing_cert) = std::fs::read_to_string(&cert_path) {
                            pem_opt = Some(existing_cert);
                        } else {
                            // Build params and set alg if possible
                            let mut params = rcgen::CertificateParams::default();
                            params
                                .subject_alt_names
                                .push(rcgen::SanType::Rfc822Name(email.clone()));
                            params.distinguished_name.push(
                                rcgen::DnType::CommonName,
                                format!("Flashback Test {}", email),
                            );
                            // alg selection best-effort
                            match alg.as_str() {
                                "ed25519" => {
                                    params.alg = &rcgen::PKCS_ED25519;
                                }
                                "rsa" => {
                                    params.alg = &rcgen::PKCS_RSA_SHA256;
                                }
                                _ => {
                                    params.alg = &rcgen::PKCS_ECDSA_P256_SHA256;
                                }
                            }
                            // attach existing key
                            if let Ok(kp) = rcgen::KeyPair::from_pem(&priv_pem) {
                                params.key_pair = Some(kp);
                                match rcgen::Certificate::from_params(params) {
                                    Ok(cert) => {
                                        if let Ok(pem) = cert.serialize_pem() {
                                            let _ = std::fs::write(&cert_path, &pem);
                                            pem_opt = Some(pem);
                                        }
                                    }
                                    Err(e) => {
                                        println!(
                                            "Error generating certificate from existing key: {}",
                                            e
                                        );
                                    }
                                }
                            } else {
                                println!("Invalid existing private.key; cannot reuse.");
                                continue;
                            }
                        }
                        if let Some(_pem) = pem_opt {
                            // update config path and email only
                            cfg.certificate_path = cert_path.to_string_lossy().to_string();
                            // best effort: preserve existing cfg.email; user can re-register to set server-side mapping
                            {
                                let mut guard = state.config.lock().unwrap();
                                *guard = cfg.clone();
                            }
                            save_config_to_disk(&cfg);
                            println!("Reused existing private.key; ensured certificate.pem");
                        }
                    } else {
                        println!(
                            "No existing private.key found at {}",
                            priv_path.to_string_lossy()
                        );
                    }
                    continue;
                }

                // Fresh key generation
                let mut params = rcgen::CertificateParams::default();
                params
                    .subject_alt_names
                    .push(rcgen::SanType::Rfc822Name(email.clone()));
                params.distinguished_name.push(
                    rcgen::DnType::CommonName,
                    format!("Flashback Test {}", email),
                );
                match alg.as_str() {
                    "ed25519" => {
                        params.alg = &rcgen::PKCS_ED25519;
                    }
                    "rsa" => {
                        params.alg = &rcgen::PKCS_RSA_SHA256;
                    }
                    _ => {
                        params.alg = &rcgen::PKCS_ECDSA_P256_SHA256;
                    }
                }
                let cert = match rcgen::Certificate::from_params(params) {
                    Ok(c) => c,
                    Err(e) => {
                        println!("Error generating certificate: {}", e);
                        continue;
                    }
                };
                let pem = match cert.serialize_pem() {
                    Ok(p) => p,
                    Err(e) => {
                        println!("Error serializing PEM: {}", e);
                        continue;
                    }
                };
                let priv_pem = cert.serialize_private_key_pem();
                let _ = std::fs::write(&cert_path, &pem);
                let _ = std::fs::write(&priv_path, &priv_pem);
                cfg.certificate_path = cert_path.to_string_lossy().to_string();
                cfg.email = email.clone();
                {
                    let mut guard = state.config.lock().unwrap();
                    *guard = cfg.clone();
                }
                save_config_to_disk(&cfg);
                println!(
                    "Generated key and certificate for {} (alg={}, bits={})",
                    email,
                    alg,
                    _bits.unwrap_or(0)
                );
            }
            "gen-cert" => {
                // Backward-compatible alias to gen-key
                let email = match parts.next() {
                    Some(e) => e.to_string(),
                    None => {
                        println!("Usage: gen-cert <email>");
                        continue;
                    }
                };
                // Delegate to gen-key default behavior
                let ah = app_handle.clone();
                // Reconstruct command line for gen-key
                println!("Note: 'gen-cert' is deprecated, use 'gen-key'. Proceeding...");
                // call same logic as above by generating with defaults
                // Implement inline to avoid refactor: duplicate minimal logic
                let mut params = rcgen::CertificateParams::default();
                params
                    .subject_alt_names
                    .push(rcgen::SanType::Rfc822Name(email.clone()));
                params.distinguished_name.push(
                    rcgen::DnType::CommonName,
                    format!("Flashback Test {}", email),
                );
                params.alg = &rcgen::PKCS_ECDSA_P256_SHA256;
                let cert = match rcgen::Certificate::from_params(params) {
                    Ok(c) => c,
                    Err(e) => {
                        println!("Error generating certificate: {}", e);
                        continue;
                    }
                };
                let pem = match cert.serialize_pem() {
                    Ok(p) => p,
                    Err(e) => {
                        println!("Error serializing PEM: {}", e);
                        continue;
                    }
                };
                let priv_pem = cert.serialize_private_key_pem();
                let mut cfg = state.config.lock().unwrap().clone();
                let cert_path_cur = std::path::PathBuf::from(cfg.certificate_path.clone());
                let out_dir = cert_path_cur
                    .parent()
                    .map(|p| p.to_path_buf())
                    .unwrap_or_else(|| std::path::PathBuf::from("."));
                let _ = std::fs::create_dir_all(&out_dir);
                let cert_path = out_dir.join("certificate.pem");
                let priv_path = out_dir.join("private.key");
                let _ = std::fs::write(&cert_path, &pem);
                let _ = std::fs::write(&priv_path, &priv_pem);
                cfg.certificate_path = cert_path.to_string_lossy().to_string();
                cfg.email = email.clone();
                {
                    let mut guard = state.config.lock().unwrap();
                    *guard = cfg.clone();
                }
                save_config_to_disk(&cfg);
                println!("Generated certificate for {}", email);
            }
            "print-cert" => {
                // Read certificate from disk via config
                let cert_path = { state.config.lock().unwrap().certificate_path.clone() };
                if let Ok(pem) = std::fs::read_to_string(&cert_path) {
                    println!("-----BEGIN CERT START-----");
                    print!("{}", pem);
                    println!("-----END CERT START-----");
                } else {
                    println!("No certificate. Run gen-key <email> first.");
                }
            }
            "start-listener" => {
                let ah = app_handle.clone();
                let st = state.clone();
                match async_runtime::block_on(start_peer_listener_async(st, ah, None, None)) {
                    Ok(port) => println!("Listener started on 0.0.0.0:{}", port),
                    Err(e) => println!("Error starting listener: {}", e),
                }
            }
            "connect-server" => {
                let server = match parts.next() {
                    Some(s) => s.to_string(),
                    None => {
                        println!("Usage: connect-server <server:port>");
                        continue;
                    }
                };
                if parts.next().is_some() {
                    println!(
                        "Warning: extra arguments ignored. Usage: connect-server <server:port>"
                    );
                }
                let ah = app_handle.clone();
                let st = state.clone();
                let fut = connect_to_server(Some(server), st, ah);
                match async_runtime::block_on(fut) {
                    Ok(msg) => println!("{}", msg),
                    Err(e) => println!("Error: {}", e),
                }
            }
            "connect-peer" => {
                let addr = match parts.next() {
                    Some(s) => s.to_string(),
                    None => {
                        println!("Usage: connect-peer <peer:port>");
                        continue;
                    }
                };
                if let Ok((ip, port)) = parse_host_port(&addr) {
                    let ah = app_handle.clone();
                    let st = state.clone();
                    let fut = connect_to_peer(ip, port, st, ah);
                    match async_runtime::block_on(fut) {
                        Ok(msg) => println!("{}", msg),
                        Err(e) => println!("Error: {}", e),
                    }
                } else {
                    println!("Usage: connect-peer <peer:port>");
                }
            }
            "send-channel" => {
                // message may contain spaces; reconstruct from remaining parts
                let channel = match parts.next() {
                    Some(c) => c.to_string(),
                    None => {
                        println!("Usage: send-channel <channel> <message>");
                        continue;
                    }
                };
                let message = parts.collect::<Vec<_>>().join(" ");
                if message.is_empty() {
                    println!("Usage: send-channel <channel> <message>");
                    continue;
                }
                // try to pull client_ip/port from self_info
                let (client_ip, client_port) = {
                    let guard = state.self_info.lock().unwrap();
                    if let Some(me) = &*guard {
                        (me.local_ip.clone(), me.port)
                    } else {
                        println!(
                            "You must connect-server first to set your client_ip and client_port."
                        );
                        continue;
                    }
                };
                let st = state.clone();
                let fut = send_chat_message(message, channel, client_ip, client_port, st);
                match async_runtime::block_on(fut) {
                    Ok(msg) => println!("{}", msg),
                    Err(e) => println!("Error: {}", e),
                }
            }
            "users" => {
                let st = state.clone();
                let fut = request_client_list(st);
                match async_runtime::block_on(fut) {
                    Ok(_) => println!("Requested client list"),
                    Err(e) => println!("Error: {}", e),
                }
            }
            "send-client" => {
                let addr = match parts.next() {
                    Some(v) => v.to_string(),
                    None => {
                        println!("Usage: send-client <peer:port> <text>");
                        continue;
                    }
                };
                let text = parts.collect::<Vec<_>>().join(" ");
                if text.is_empty() {
                    println!("Usage: send-client <peer:port> <text>");
                    continue;
                }
                match parse_host_port(&addr) {
                    Ok((to_ip, to_port)) => {
                        let st = state.clone();
                        let fut = peer_send_dcc_chat(to_ip, to_port, text, st);
                        match async_runtime::block_on(fut) {
                            Ok(msg) => println!("{}", msg),
                            Err(e) => println!("Error: {}", e),
                        }
                    }
                    Err(_) => println!("Usage: send-client <peer:port> <text>"),
                }
            }
            "set-cert-path" => {
                let path_arg = match parts.next() {
                    Some(p) => p.to_string(),
                    None => {
                        println!("Usage: set-cert-path <path>");
                        continue;
                    }
                };
                if parts.next().is_some() {
                    println!("Usage: set-cert-path <path>");
                    continue;
                }
                // If a directory is passed, append certificate.pem
                let mut p = std::path::PathBuf::from(&path_arg);
                let meta_is_dir = std::fs::metadata(&p)
                    .map(|m| m.is_dir())
                    .unwrap_or_else(|_| path_arg.ends_with('/') || path_arg.ends_with('\\'));
                if meta_is_dir {
                    p = p.join("certificate.pem");
                }
                if let Some(parent) = p.parent() {
                    let _ = std::fs::create_dir_all(parent);
                }
                let mut cfg = state.config.lock().unwrap().clone();
                cfg.certificate_path = p.to_string_lossy().to_string();
                {
                    let mut guard = state.config.lock().unwrap();
                    *guard = cfg.clone();
                }
                save_config_to_disk(&cfg);
                println!("privateKeyPath set to {}", cfg.certificate_path);
                continue;
            }
            "allow" => {
                // Check if user typed 'allow auto'
                if let Some(next) = parts.next() {
                    if next == "auto" {
                        {
                            let mut flag = state.cli_auto_allow.lock().unwrap();
                            *flag = true;
                        }
                        // Also approve any pending request
                        let pending = { state.pending_request.lock().unwrap().take() };
                        if let Some(p) = pending {
                            let key = peer_key(&p.ip, p.port);
                            state.allowed_peers.lock().unwrap().insert(key);
                            match p.kind {
                                RequestKind::DccChat => {
                                    let st = state.clone();
                                    let fut = peer_send_dcc_opened(p.ip, p.port, st);
                                    let _ = async_runtime::block_on(fut);
                                }
                                RequestKind::FileOffer { name, .. } => {
                                    let st = state.clone();
                                    let fut = peer_send_file_accept(
                                        p.ip,
                                        p.port,
                                        name,
                                        "accept".to_string(),
                                        st,
                                    );
                                    let _ = async_runtime::block_on(fut);
                                }
                            }
                        }
                        println!("Auto-allow enabled.");
                        continue;
                    }
                }
                // Normal allow: approve current pending
                let pending = { state.pending_request.lock().unwrap().take() };
                if let Some(p) = pending {
                    let key = peer_key(&p.ip, p.port);
                    state.allowed_peers.lock().unwrap().insert(key);
                    match p.kind {
                        RequestKind::DccChat => {
                            let st = state.clone();
                            let fut = peer_send_dcc_opened(p.ip, p.port, st);
                            match async_runtime::block_on(fut) {
                                Ok(_) => println!("DCC chat approved."),
                                Err(e) => println!("Failed to notify DCC opened: {}", e),
                            }
                        }
                        RequestKind::FileOffer { name, .. } => {
                            let st = state.clone();
                            let fut =
                                peer_send_file_accept(p.ip, p.port, name, "accept".to_string(), st);
                            match async_runtime::block_on(fut) {
                                Ok(_) => println!("File offer accepted."),
                                Err(e) => println!("Failed to send file accept: {}", e),
                            }
                        }
                    }
                } else {
                    println!("No pending request to allow.");
                }
            }
            "deny" => {
                let pending = { state.pending_request.lock().unwrap().take() };
                if let Some(p) = pending {
                    match p.kind {
                        RequestKind::DccChat => {
                            println!("DCC chat denied from {}:{}.", p.ip, p.port);
                        }
                        RequestKind::FileOffer { name, .. } => {
                            let st = state.clone();
                            let fut = peer_send_file_accept(
                                p.ip.clone(),
                                p.port,
                                name.clone(),
                                "reject".to_string(),
                                st,
                            );
                            match async_runtime::block_on(fut) {
                                Ok(_) => println!("File offer rejected."),
                                Err(e) => println!("Failed to send file reject: {}", e),
                            }
                        }
                    }
                } else {
                    println!("No pending request to deny.");
                }
            }
            "api-register" => {
                // optional baseUrl
                // let base = parts.next().map(|s| s.to_string());
                let st = state.clone();
                let fut = api_register(st);
                match async_runtime::block_on(fut) {
                    Ok(m) => println!("{}", m),
                    Err(e) => println!("Error: {}", e),
                }
            }
            "api-ready" => {
                // usage: api-ready [baseUrl] [ip:port]
                let first = parts.next().map(|s| s.to_string());
                let (maybe_base, sock_opt) = if let Some(f) = first.clone() {
                    if f.contains("://") {
                        (first, parts.next().map(|s| s.to_string()))
                    } else {
                        (None, first)
                    }
                } else {
                    (None, None)
                };
                // If baseUrl provided, persist into runtime config
                if let Some(b) = maybe_base {
                    if !b.trim().is_empty() {
                        let mut cfg = state.config.lock().unwrap();
                        cfg.base_url = b;
                        save_config_to_disk(&cfg.clone());
                    }
                }
                let st = state.clone();
                // Map optional ip:port to localIP and broadcastPort; remoteIP unused in CLI
                let (local_ip_opt, port_opt): (Option<String>, Option<u16>) =
                    if let Some(sock) = sock_opt.clone() {
                        if let Ok((h, p)) = parse_host_port(&sock) {
                            (Some(h), Some(p))
                        } else {
                            (None, None)
                        }
                    } else {
                        (None, None)
                    };
                let fut = api_ready(local_ip_opt, None, port_opt, st, app_handle.clone());
                match async_runtime::block_on(fut) {
                    Ok(m) => println!("{}", m),
                    Err(e) => println!("Error: {}", e),
                }
            }
            "api-lookup" => {
                // usage: api-lookup [baseUrl] <email> [minutes]
                let mut base: Option<String> = None;
                let first = parts.next().map(|s| s.to_string());
                let (email, minutes) = if let Some(f) = first.clone() {
                    if f.contains("://") {
                        base = first;
                        (
                            parts.next().map(|s| s.to_string()),
                            parts.next().and_then(|m| m.parse::<u32>().ok()),
                        )
                    } else {
                        (first, parts.next().and_then(|m| m.parse::<u32>().ok()))
                    }
                } else {
                    (None, None)
                };
                // Persist provided baseUrl into config if present
                if let Some(b) = base.clone() {
                    if !b.trim().is_empty() {
                        let mut cfg = state.config.lock().unwrap();
                        cfg.base_url = b;
                        save_config_to_disk(&cfg.clone());
                    }
                }
                let email = match email {
                    Some(p) => p,
                    None => {
                        println!("Usage: api-lookup [baseUrl] <email> [minutes]");
                        continue;
                    }
                };
                let st = state.clone();
                let fut = api_lookup(email, minutes, st);
                match async_runtime::block_on(fut) {
                    Ok(m) => println!("{}", m),
                    Err(e) => println!("Error: {}", e),
                }
            }
            other => {
                println!("Unknown command: {}", other);
                println!("Type 'help' to see available commands.");
            }
        }
    }
}

// Helper to emit the enriched client list using current peers map and self info
#[allow(dead_code)]
fn emit_enriched_client_list(
    app_handle: &tauri::AppHandle,
    state_clients: &Arc<Mutex<Vec<ClientInfo>>>,
    state_peers: &Arc<Mutex<HashMap<String, PeerConn>>>,
    self_info_arc: &Arc<Mutex<Option<ClientInfo>>>,
) {
    // Clone current clients to avoid holding the lock while building the list
    let clients_snapshot = {
        let clients = state_clients.lock().unwrap();
        clients.clone()
    };
    let self_opt = { self_info_arc.lock().unwrap().clone() };

    let enriched: Vec<EnrichedClientInfo> = clients_snapshot
        .iter()
        .map(|c| {
            if let Some(ref me) = self_opt {
                if me.local_ip == c.local_ip && me.port == c.port {
                    return EnrichedClientInfo {
                        local_ip: c.local_ip.clone(),
                        remote_ip: c.remote_ip.clone(),
                        port: c.port,
                        peer_status: "self".to_string(),
                    };
                }
            }
            let key = format!("{}:{}", c.local_ip, c.port);
            let status_str = {
                let peers = state_peers.lock().unwrap();
                match peers.get(&key).map(|pc| pc.status.clone()) {
                    Some(PeerStatus::Connected) => "connected".to_string(),
                    Some(PeerStatus::Connecting) => "connecting".to_string(),
                    Some(PeerStatus::Disconnected) => "disconnected".to_string(),
                    None => "disconnected".to_string(),
                }
            };
            EnrichedClientInfo {
                local_ip: c.local_ip.clone(),
                remote_ip: c.remote_ip.clone(),
                port: c.port,
                peer_status: status_str,
            }
        })
        .collect();

    let _ = app_handle.emit("client-list-updated", enriched);
}

#[tauri::command]
async fn request_client_list(state: State<'_, AppState>) -> Result<String, String> {
    let tx_opt = state.tx.lock().unwrap().clone();
    if let Some(tx) = tx_opt {
        tx.send(Message::ClientListRequest)
            .await
            .map_err(|e| format!("Failed to request client list: {}", e))?;
        Ok("requested".into())
    } else {
        Err("Not connected to server".into())
    }
}
