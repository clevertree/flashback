// Keep Windows console visible (do not hide in release) to support CLI mode

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::{Emitter, State, Manager};
use sha2::{Digest, Sha256};
use hex as hex_crate;
use std::convert::TryFrom;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::mpsc;
use tokio::time::{interval, Duration};
use reqwest::StatusCode;

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
    DccChat { from_ip: String, from_port: u16, to_ip: String, to_port: u16, text: String, timestamp: String },
    #[serde(rename = "dcc_request")]
    DccRequest { from_ip: String, from_port: u16, to_ip: String, to_port: u16 },
    #[serde(rename = "dcc_opened")]
    DccOpened { from_ip: String, from_port: u16, to_ip: String, to_port: u16 },
    #[serde(rename = "file_offer")]
    FileOffer { from_ip: String, from_port: u16, to_ip: String, to_port: u16, name: String, size: u64 },
    #[serde(rename = "file_accept")]
    FileAccept { from_ip: String, from_port: u16, to_ip: String, to_port: u16, name: String, action: String },
    #[serde(rename = "file_chunk")]
    FileChunk { from_ip: String, from_port: u16, to_ip: String, to_port: u16, name: String, offset: u64, bytes_total: u64, data_base64: String },
    #[serde(rename = "file_cancel")]
    FileCancel { from_ip: String, from_port: u16, to_ip: String, to_port: u16, name: String },
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
    certificate_path: String,
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
    peer_writers: Arc<Mutex<HashMap<String, Arc<tokio::sync::Mutex<tokio::net::tcp::OwnedWriteHalf>>>>>, // key: "ip:port" -> writer
    // CLI approval flow state
    cli_mode: Arc<Mutex<bool>>,
    cli_auto_allow: Arc<Mutex<bool>>,
    allowed_peers: Arc<Mutex<std::collections::HashSet<String>>>,
    pending_request: Arc<Mutex<Option<PendingRequest>>>,
    // Certificate and hash for registration
    cert_pem: Arc<Mutex<Option<String>>>,
    pkh_hex: Arc<Mutex<Option<String>>>,
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
                                                    let pong = serde_json::to_string(&Message::Pong).unwrap() + "\n";
                                                    let writer_arc_opt = { pw_map.lock().unwrap().get(&key).cloned() };
                                                    if let Some(w) = writer_arc_opt {
                                                        if let Ok(mut guard) = w.try_lock() {
                                                            if let Err(e) = guard.write_all(pong.as_bytes()).await { println!("Peer write error: {}", e); break; }
                                                            if let Err(e) = guard.flush().await { println!("Peer flush error: {}", e); break; }
                                                        }
                                                    }
                                                }
                                                Message::DccRequest { from_ip, from_port, .. } => {
                                                    {
                                                        let alias = peer_key(&from_ip, from_port);
                                                        let mut map = pw_map.lock().unwrap();
                                                        if !map.contains_key(&alias) { map.insert(alias.clone(), writer_arc.clone()); }
                                                    }
                                                    // CLI approval gating
                                                    let state_ref: tauri::State<AppState> = app_handle_incoming.state::<AppState>();
                                                    let cli_mode = { *state_ref.cli_mode.lock().unwrap() };
                                                    if cli_mode {
                                                        let auto = { *state_ref.cli_auto_allow.lock().unwrap() };
                                                        let key = peer_key(&from_ip, from_port);
                                                        let already = { state_ref.allowed_peers.lock().unwrap().contains(&key) };
                                                        if !already {
                                                            if auto {
                                                                state_ref.allowed_peers.lock().unwrap().insert(key.clone());
                                                                println!("Auto-allowed DCC chat request from {}:{}", from_ip, from_port);
                                                                // Optionally notify opened
                                                                let _ = app_handle_incoming.emit("dcc-opened", serde_json::json!({"ip": from_ip, "port": from_port}));
                                                            } else {
                                                                // set pending request
                                                                {
                                                                    let mut pend = state_ref.pending_request.lock().unwrap();
                                                                    *pend = Some(PendingRequest{ ip: from_ip.clone(), port: from_port, kind: RequestKind::DccChat });
                                                                }
                                                                println!("Incoming DCC chat request from {}:{}\nType 'allow' to accept, 'deny' to reject, or 'allow auto' to accept all for this session.", from_ip, from_port);
                                                                // Do not emit to app/UI until allowed
                                                                continue;
                                                            }
                                                        }
                                                    }
                                                    let payload = serde_json::json!({"ip": from_ip, "port": from_port});
                                                    let _ = app_handle_incoming.emit("dcc-request", payload);
                                                }
                                                Message::DccOpened { from_ip, from_port, .. } => {
                                                    {
                                                        let alias = peer_key(&from_ip, from_port);
                                                        let mut map = pw_map.lock().unwrap();
                                                        if !map.contains_key(&alias) { map.insert(alias.clone(), writer_arc.clone()); }
                                                    }
                                                    let payload = serde_json::json!({"ip": from_ip, "port": from_port});
                                                    let _ = app_handle_incoming.emit("dcc-opened", payload);
                                                }
                                                Message::FileOffer { from_ip, from_port, name, size, .. } => {
                                                    {
                                                        let alias = peer_key(&from_ip, from_port);
                                                        let mut map = pw_map.lock().unwrap();
                                                        if !map.contains_key(&alias) { map.insert(alias.clone(), writer_arc.clone()); }
                                                    }
                                                    // CLI approval gating for file offer
                                                    let state_ref: tauri::State<AppState> = app_handle_incoming.state::<AppState>();
                                                    let cli_mode = { *state_ref.cli_mode.lock().unwrap() };
                                                    if cli_mode {
                                                        let auto = { *state_ref.cli_auto_allow.lock().unwrap() };
                                                        let key = peer_key(&from_ip, from_port);
                                                        let already = { state_ref.allowed_peers.lock().unwrap().contains(&key) };
                                                        if !already {
                                                            if auto {
                                                                state_ref.allowed_peers.lock().unwrap().insert(key.clone());
                                                                println!("Auto-allowed file offer from {}:{} [{} - {} bytes]", from_ip, from_port, name, size);
                                                            } else {
                                                                {
                                                                    let mut pend = state_ref.pending_request.lock().unwrap();
                                                                    *pend = Some(PendingRequest{ ip: from_ip.clone(), port: from_port, kind: RequestKind::FileOffer { name: name.clone(), size } });
                                                                }
                                                                println!("Incoming file offer from {}:{} -- '{}' ({} bytes)\nType 'allow' to accept, 'deny' to reject, or 'allow auto' to accept all for this session.", from_ip, from_port, name, size);
                                                                continue;
                                                            }
                                                        }
                                                    }
                                                    let payload = serde_json::json!({"from_ip": from_ip, "from_port": from_port, "name": name, "size": size});
                                                    let _ = app_handle_incoming.emit("dcc-file-offer", payload);
                                                }
                                                Message::FileAccept { from_ip, from_port, name, action, .. } => {
                                                    {
                                                        let alias = peer_key(&from_ip, from_port);
                                                        let mut map = pw_map.lock().unwrap();
                                                        if !map.contains_key(&alias) { map.insert(alias.clone(), writer_arc.clone()); }
                                                    }
                                                    let payload = serde_json::json!({"from_ip": from_ip, "from_port": from_port, "name": name, "action": action});
                                                    let _ = app_handle_incoming.emit("dcc-file-accept", payload);
                                                }
                                                Message::FileChunk { from_ip, from_port, name, offset, bytes_total, data_base64, .. } => {
                                                    {
                                                        let alias = peer_key(&from_ip, from_port);
                                                        let mut map = pw_map.lock().unwrap();
                                                        if !map.contains_key(&alias) { map.insert(alias.clone(), writer_arc.clone()); }
                                                    }
                                                    let payload = serde_json::json!({
                                                        "from_ip": from_ip,
                                                        "from_port": from_port,
                                                        "name": name,
                                                        "offset": offset,
                                                        "bytes_total": bytes_total,
                                                        "data_base64": data_base64
                                                    });
                                                    let _ = app_handle_incoming.emit("dcc-file-chunk", payload);
                                                }
                                                Message::FileCancel { from_ip, from_port, name, .. } => {
                                                    {
                                                        let alias = peer_key(&from_ip, from_port);
                                                        let mut map = pw_map.lock().unwrap();
                                                        if !map.contains_key(&alias) { map.insert(alias.clone(), writer_arc.clone()); }
                                                    }
                                                    let payload = serde_json::json!({"from_ip": from_ip, "from_port": from_port, "name": name});
                                                    let _ = app_handle_incoming.emit("dcc-file-cancel", payload);
                                                }
                                                Message::DccChat { from_ip, from_port, text, timestamp, .. } => {
                                                    {
                                                        let alias = peer_key(&from_ip, from_port);
                                                        let mut map = pw_map.lock().unwrap();
                                                        if !map.contains_key(&alias) { map.insert(alias.clone(), writer_arc.clone()); }
                                                    }
                                                    // CLI approval gating for DCC chat message
                                                    let state_ref: tauri::State<AppState> = app_handle_incoming.state::<AppState>();
                                                    let cli_mode = { *state_ref.cli_mode.lock().unwrap() };
                                                    if cli_mode {
                                                        let auto = { *state_ref.cli_auto_allow.lock().unwrap() };
                                                        let key = peer_key(&from_ip, from_port);
                                                        let already = { state_ref.allowed_peers.lock().unwrap().contains(&key) };
                                                        if !already {
                                                            if auto {
                                                                state_ref.allowed_peers.lock().unwrap().insert(key.clone());
                                                                println!("Auto-allowed DCC chat from {}:{}", from_ip, from_port);
                                                            } else {
                                                                {
                                                                    let mut pend = state_ref.pending_request.lock().unwrap();
                                                                    *pend = Some(PendingRequest{ ip: from_ip.clone(), port: from_port, kind: RequestKind::DccChat });
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
                                                    let _ = app_handle_incoming.emit("dcc-chat", payload);
                                                }
                                                _ => {}
                                            }
                                        }
                                    }
                                    Err(e) => { println!("Peer read error: {}", e); break; }
                                }
                            }
                            let _ = app_handle_incoming.emit("peer-incoming-closed", format!("{}", remote));
                        });
                    }
                    Err(e) => { println!("Listener accept error: {}", e); break; }
                }
            }
        });
    }

    println!("Connecting to server at {}", addr);
    let _ = app_handle.emit("log", format!("Connecting to server at {}", addr));

    // Connect to server with 15s timeout
    let stream = match tokio::time::timeout(Duration::from_secs(15), TcpStream::connect(&addr)).await {
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
                                    let st: tauri::State<AppState> = app_handle_clone.state::<AppState>();
                                    let val = *st.cli_mode.lock().unwrap();
                                    val
                                };
                                if print_details {
                                    let list_str = clients.iter().map(|c| format!("{}:{}", c.local_ip, c.port)).collect::<Vec<_>>().join(", ");
                                    println!("Received client list ({}): {}", clients.len(), list_str);
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
                                                return EnrichedClientInfo { local_ip: c.local_ip.clone(), remote_ip: c.remote_ip.clone(), port: c.port, peer_status: "self".to_string() };
                                            }
                                        }
                                        EnrichedClientInfo { local_ip: c.local_ip.clone(), remote_ip: c.remote_ip.clone(), port: c.port, peer_status: "disconnected".to_string() }
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
                                let _ = app_handle_clone.emit("log", format!("Server info: {}", info_json));
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
                            Message::DccRequest { from_ip, from_port, .. } => {
                                // CLI approval gating
                                let st: tauri::State<AppState> = app_handle_clone.state::<AppState>();
                                let is_cli = { *st.cli_mode.lock().unwrap() };
                                if is_cli {
                                    let auto = { *st.cli_auto_allow.lock().unwrap() };
                                    let key = peer_key(&from_ip, from_port);
                                    let already = { st.allowed_peers.lock().unwrap().contains(&key) };
                                    if !already {
                                        if auto {
                                            st.allowed_peers.lock().unwrap().insert(key.clone());
                                            println!("Auto-allowed DCC chat request from {}:{}", from_ip, from_port);
                                        } else {
                                            {
                                                let mut pend = st.pending_request.lock().unwrap();
                                                *pend = Some(PendingRequest{ ip: from_ip.clone(), port: from_port, kind: RequestKind::DccChat });
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
                            Message::DccOpened { from_ip, from_port, .. } => {
                                println!("🪟 DCC opened notification from {}:{}", from_ip, from_port);
                                let payload = serde_json::json!({"ip": from_ip, "port": from_port});
                                let _ = app_handle_clone.emit("dcc-opened", payload);
                            }
                            Message::FileOffer { from_ip, from_port, name, size, .. } => {
                                // CLI approval gating
                                let st: tauri::State<AppState> = app_handle_clone.state::<AppState>();
                                let is_cli = { *st.cli_mode.lock().unwrap() };
                                if is_cli {
                                    let auto = { *st.cli_auto_allow.lock().unwrap() };
                                    let key = peer_key(&from_ip, from_port);
                                    let already = { st.allowed_peers.lock().unwrap().contains(&key) };
                                    if !already {
                                        if auto {
                                            st.allowed_peers.lock().unwrap().insert(key.clone());
                                            println!("Auto-allowed file offer from {}:{} [{} - {} bytes]", from_ip, from_port, name, size);
                                        } else {
                                            {
                                                let mut pend = st.pending_request.lock().unwrap();
                                                *pend = Some(PendingRequest{ ip: from_ip.clone(), port: from_port, kind: RequestKind::FileOffer { name: name.clone(), size } });
                                            }
                                            println!("Incoming file offer from {}:{} -- '{}' ({} bytes)\nType 'allow' to accept, 'deny' to reject, or 'allow auto' to accept all for this session.", from_ip, from_port, name, size);
                                            continue;
                                        }
                                    }
                                }
                                println!("📁 File offer from {}:{} [{} - {} bytes]", from_ip, from_port, name, size);
                                let payload = serde_json::json!({"from_ip": from_ip, "from_port": from_port, "name": name, "size": size});
                                let _ = app_handle_clone.emit("dcc-file-offer", payload);
                            }
                            Message::FileAccept { from_ip, from_port, name, action, .. } => {
                                println!("✅ File accept received from {}:{} [{} action={}]", from_ip, from_port, name, action);
                                let payload = serde_json::json!({"from_ip": from_ip, "from_port": from_port, "name": name, "action": action});
                                let _ = app_handle_clone.emit("dcc-file-accept", payload);
                            }
                            Message::FileChunk { from_ip, from_port, name, offset, bytes_total, data_base64, .. } => {
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
                            Message::FileCancel { from_ip, from_port, name, .. } => {
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
fn peer_key(ip: &str, port: u16) -> String { format!("{}:{}", ip, port) }

async fn send_to_peer(state: &State<'_, AppState>, ip: &str, port: u16, msg: &Message) -> Result<(), String> {
    let key = peer_key(ip, port);
    let json = serde_json::to_string(msg).map_err(|e| e.to_string())? + "\n";
    let writer_opt = { state.peer_writers.lock().unwrap().get(&key).cloned() };
    if let Some(writer_mutex) = writer_opt {
        let mut guard = writer_mutex.lock().await;
        guard.write_all(json.as_bytes()).await.map_err(|e| format!("write error: {}", e))?;
        guard.flush().await.map_err(|e| format!("flush error: {}", e))?;
        Ok(())
    } else {
        Err("Peer not connected".into())
    }
}

#[tauri::command]
async fn connect_to_peer(to_ip: String, to_port: u16, state: State<'_, AppState>, app_handle: tauri::AppHandle) -> Result<String, String> {
    let addr = format!("{}:{}", to_ip, to_port);
    let addr_clone = addr.clone();
    match TcpStream::connect(&addr).await {
        Ok(stream) => {
            let (reader, writer) = stream.into_split();
            // store writer
            {
                let mut map = state.peer_writers.lock().unwrap();
                map.insert(peer_key(&to_ip, to_port), Arc::new(tokio::sync::Mutex::new(writer)));
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
                                    Message::DccRequest { from_ip, from_port, .. } => {
                                        let payload = serde_json::json!({"ip": from_ip, "port": from_port});
                                        let _ = app_handle_clone.emit("dcc-request", payload);
                                    }
                                    Message::DccOpened { from_ip, from_port, .. } => {
                                        let payload = serde_json::json!({"ip": from_ip, "port": from_port});
                                        let _ = app_handle_clone.emit("dcc-opened", payload);
                                    }
                                    Message::FileOffer { from_ip, from_port, name, size, .. } => {
                                        let payload = serde_json::json!({"from_ip": from_ip, "from_port": from_port, "name": name, "size": size});
                                        let _ = app_handle_clone.emit("dcc-file-offer", payload);
                                    }
                                    Message::FileAccept { from_ip, from_port, name, action, .. } => {
                                        let payload = serde_json::json!({"from_ip": from_ip, "from_port": from_port, "name": name, "action": action});
                                        let _ = app_handle_clone.emit("dcc-file-accept", payload);
                                    }
                                    Message::FileChunk { from_ip, from_port, name, offset, bytes_total, data_base64, .. } => {
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
                                    Message::FileCancel { from_ip, from_port, name, .. } => {
                                        let payload = serde_json::json!({"from_ip": from_ip, "from_port": from_port, "name": name});
                                        let _ = app_handle_clone.emit("dcc-file-cancel", payload);
                                    }
                                    Message::DccChat { from_ip, from_port, text, timestamp, .. } => {
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
async fn peer_send_dcc_request(to_ip: String, to_port: u16, state: State<'_, AppState>) -> Result<String, String> {
    let self_opt = state.self_info.lock().unwrap().clone().ok_or("Self not set")?;
    let msg = Message::DccRequest { from_ip: self_opt.local_ip, from_port: self_opt.port, to_ip: to_ip.clone(), to_port };
    send_to_peer(&state, &to_ip, to_port, &msg).await?;
    Ok("sent".into())
}

#[tauri::command]
async fn peer_send_dcc_opened(to_ip: String, to_port: u16, state: State<'_, AppState>) -> Result<String, String> {
    let self_opt = state.self_info.lock().unwrap().clone().ok_or("Self not set")?;
    let msg = Message::DccOpened { from_ip: self_opt.local_ip, from_port: self_opt.port, to_ip: to_ip.clone(), to_port };
    send_to_peer(&state, &to_ip, to_port, &msg).await?;
    Ok("sent".into())
}

#[tauri::command]
async fn peer_send_file_offer(to_ip: String, to_port: u16, name: String, size: u64, state: State<'_, AppState>) -> Result<String, String> {
    let self_opt = state.self_info.lock().unwrap().clone().ok_or("Self not set")?;
    let msg = Message::FileOffer { from_ip: self_opt.local_ip, from_port: self_opt.port, to_ip: to_ip.clone(), to_port, name, size };
    send_to_peer(&state, &to_ip, to_port, &msg).await?;
    Ok("sent".into())
}

#[tauri::command]
async fn peer_send_file_accept(to_ip: String, to_port: u16, name: String, action: String, state: State<'_, AppState>) -> Result<String, String> {
    let self_opt = state.self_info.lock().unwrap().clone().ok_or("Self not set")?;
    let msg = Message::FileAccept { from_ip: self_opt.local_ip, from_port: self_opt.port, to_ip: to_ip.clone(), to_port, name, action };
    send_to_peer(&state, &to_ip, to_port, &msg).await?;
    Ok("sent".into())
}

#[tauri::command]
async fn peer_send_file_chunk(to_ip: String, to_port: u16, name: String, offset: u64, bytes_total: u64, data_base64: String, state: State<'_, AppState>) -> Result<String, String> {
    let self_opt = state.self_info.lock().unwrap().clone().ok_or("Self not set")?;
    let msg = Message::FileChunk { from_ip: self_opt.local_ip, from_port: self_opt.port, to_ip: to_ip.clone(), to_port, name, offset, bytes_total, data_base64 };
    send_to_peer(&state, &to_ip, to_port, &msg).await?;
    Ok("sent".into())
}

#[tauri::command]
async fn peer_send_file_cancel(to_ip: String, to_port: u16, name: String, state: State<'_, AppState>) -> Result<String, String> {
    let self_opt = state.self_info.lock().unwrap().clone().ok_or("Self not set")?;
    let msg = Message::FileCancel { from_ip: self_opt.local_ip, from_port: self_opt.port, to_ip: to_ip.clone(), to_port, name };
    send_to_peer(&state, &to_ip, to_port, &msg).await?;
    Ok("sent".into())
}

#[tauri::command]
async fn peer_send_dcc_chat(to_ip: String, to_port: u16, text: String, state: State<'_, AppState>) -> Result<String, String> {
    let self_opt = state.self_info.lock().unwrap().clone().ok_or("Self not set")?;
    let timestamp = chrono::Utc::now().to_rfc3339();
    let msg = Message::DccChat { from_ip: self_opt.local_ip, from_port: self_opt.port, to_ip: to_ip.clone(), to_port, text, timestamp };
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
    if let Some(parent) = p.parent() { let _ = std::fs::create_dir_all(parent); }
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
        cert_pem: Arc::new(Mutex::new(None)),
        pkh_hex: Arc::new(Mutex::new(None)),
        config: Arc::new(Mutex::new(initial_cfg)),
    };

    let args: Vec<String> = std::env::args().collect();
    let want_start_listener = args.iter().any(|a| a == "--start-listener");
    let want_auto_allow = args.iter().any(|a| a == "--auto-allow");
    if args.iter().any(|a| a == "--help" || a == "-h") {
        print_cli_help();
        return;
    }
    if args.iter().any(|a| a == "--cli") {
        // CLI mode: Build a minimal Tauri App so we can reuse the same command functions and state
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
                api_ready,
                api_lookup
            ])
            .build(tauri::generate_context!())
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
            if let Some(gen_arg) = args.iter().find(|a| a.starts_with("--gen-cert=")) {
                if let Some((_, email)) = gen_arg.split_once('=') {
                    // Generate a self-signed certificate with SAN rfc822Name=email using rcgen (v0.12)
                    let mut params = rcgen::CertificateParams::default();
                    params.subject_alt_names.push(rcgen::SanType::Rfc822Name(email.to_string()));
                    params
                        .distinguished_name
                        .push(rcgen::DnType::CommonName, format!("Flashback Test {}", email));
                    match rcgen::Certificate::from_params(params) {
                        Ok(cert) => {
                            let pem = match cert.serialize_pem() { Ok(p) => p, Err(e) => { println!("Error serializing PEM: {}", e); String::new() } };
                            let der = match cert.serialize_der() { Ok(d) => d, Err(e) => { println!("Error serializing DER: {}", e); Vec::new() } };
                            let priv_pem = cert.serialize_private_key_pem();
                            if !pem.is_empty() && !der.is_empty() {
                                let mut hasher = Sha256::new();
                                hasher.update(&der);
                                let pkh = hex_crate::encode(hasher.finalize());
                                {
                                    let mut c = st.cert_pem.lock().unwrap();
                                    *c = Some(pem.clone());
                                }
                                {
                                    let mut h = st.pkh_hex.lock().unwrap();
                                    *h = Some(pkh.clone());
                                }
                                // Determine output directory from runtime config (same dir as certificate_path)
                                let cfg_cur = st.config.lock().unwrap().clone();
                                let cert_path_cur = std::path::PathBuf::from(cfg_cur.certificate_path.clone());
                                let out_dir = cert_path_cur.parent().map(|p| p.to_path_buf()).unwrap_or_else(|| std::path::PathBuf::from("."));
                                let _ = std::fs::create_dir_all(&out_dir);
                                let cert_path = out_dir.join("certificate.pem");
                                let priv_path = out_dir.join("private.key");
                                let hash_path = out_dir.join("publicKeyHash.txt");
                                let _ = std::fs::write(&cert_path, &pem);
                                let _ = std::fs::write(&priv_path, &priv_pem);
                                let _ = std::fs::write(&hash_path, &pkh);
                                // Also write legacy PKH file into logs dir for backward compatibility
                                let mut ld = if let Ok(dir) = std::env::var("WDIO_LOGS_DIR") { std::path::PathBuf::from(dir) } else { logs_dir_from_app(None) };
                                let _ = std::fs::create_dir_all(&ld);
                                ld.push(format!("pkh-{}.txt", std::process::id()));
                                let _ = std::fs::write(&ld, &pkh);
                                // Persist config (ensure certificate_path points to certificate.pem in this dir)
                                let mut cfg_save = cfg_cur.clone();
                                cfg_save.certificate_path = cert_path.to_string_lossy().to_string();
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
            }
            if want_start_listener {
                // Start listener before entering interactive loop
                let ah = app.handle();
                let st2 = app.state::<AppState>();
                let _ = tauri::async_runtime::block_on(start_peer_listener_async(st2, ah.clone()));
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
            api_ready,
            api_lookup
        ])
        .run(tauri::generate_context!())
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
    println!("  gen-cert <email>      Generate a self-signed cert and private key; writes private.key, certificate.pem, publicKeyHash.txt next to Config.certificate_path");
    println!("  set-cert-path <path> Set Config.certificatePath (file path). If a directory is provided, 'certificate.pem' will be appended");
    println!("  print-cert           Print the generated certificate PEM between markers");
    println!("  print-pkh            Print the SHA-256 hash of DER certificate as hex (lowercase)");
    println!("  start-listener       Start the peer listener on an ephemeral port (no server connection)");
    println!("  api-register [baseUrl]   Register certificate with server; stores PKH and prints 'REGISTERED PKH <pkh>'");
    println!("  api-ready [baseUrl] [ip:port]  Announce ready socket; if ip:port omitted, uses local listener; prints 'READY OK <ip:port>'");
    println!("  api-lookup [baseUrl] <pkh> [minutes]  Lookup recent sockets; prints 'LOOKUP SOCKET <ip:port>' or 'LOOKUP NONE'");
    println!("  quit | exit          Exit the CLI");
}

fn parse_host_port(input: &str) -> Result<(String, u16), String> {
    let mut parts = input.rsplitn(2, ':');
    let port_str = parts.next().ok_or_else(|| "missing port".to_string())?;
    let host = parts.next().ok_or_else(|| "missing host".to_string())?;
    let port: u16 = port_str.parse().map_err(|_| "invalid port".to_string())?;
    if host.is_empty() { return Err("missing host".to_string()); }
    Ok((host.to_string(), port))
}


async fn start_peer_listener_async(state: State<'_, AppState>, app_handle: tauri::AppHandle) -> Result<u16, String> {
    // Detect local client IP
    let client_ip = local_ip_address::local_ip()
        .map_err(|e| format!("Failed to determine local IP: {}", e))?
        .to_string();
    // Bind ephemeral port
    let listener = TcpListener::bind("0.0.0.0:0")
        .await
        .map_err(|e| format!("Failed to bind peer listener: {}", e))?;
    let actual_port = listener
        .local_addr()
        .map_err(|e| format!("Failed to get listener local addr: {}", e))?
        .port();
    // Save self info
    {
        let mut self_lock = state.self_info.lock().unwrap();
        *self_lock = Some(ClientInfo { local_ip: client_ip.clone(), remote_ip: "".to_string(), port: actual_port });
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
                                                    let pong = serde_json::to_string(&Message::Pong).unwrap() + "\n";
                                                    let writer_arc_opt = { pw_map.lock().unwrap().get(&key).cloned() };
                                                    if let Some(w) = writer_arc_opt {
                                                        if let Ok(mut guard) = w.try_lock() {
                                                            if let Err(e) = guard.write_all(pong.as_bytes()).await { println!("Peer write error: {}", e); break; }
                                                            if let Err(e) = guard.flush().await { println!("Peer flush error: {}", e); break; }
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
    if let Ok(dir) = std::env::var("WDIO_LOGS_DIR") { std::path::PathBuf::from(dir) } else { std::path::PathBuf::from(".") }
}

fn debug_http_enabled() -> bool {
    matches!(std::env::var("CLIENT_DEBUG").ok().as_deref(), Some("1") | Some("true") | Some("TRUE") | Some("yes") | Some("on"))
}

async fn http_post_json(url: &str, body: serde_json::Value) -> Result<(StatusCode, serde_json::Value), String> {
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
    let text = resp.text().await.map_err(|e| format!("Read body failed: {}", e))?;
    let json: serde_json::Value = serde_json::from_str(&text).unwrap_or(serde_json::json!({"raw": text}));
    if debug_http_enabled() {
        println!("[HTTP DEBUG] <-- {} {}\nResponse: {}", status.as_u16(), status.canonical_reason().unwrap_or(""), json);
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
    let text = resp.text().await.map_err(|e| format!("Read body failed: {}", e))?;
    let json: serde_json::Value = serde_json::from_str(&text).unwrap_or(serde_json::json!({"raw": text}));
    if debug_http_enabled() {
        println!("[HTTP DEBUG] <-- {} {}\nResponse: {}", status.as_u16(), status.canonical_reason().unwrap_or(""), json);
    }
    Ok((status, json))
}

fn default_base_url() -> String { "http://127.0.0.1:3000".to_string() }

#[tauri::command]
async fn api_register(base_url: Option<String>, state: State<'_, AppState>) -> Result<String, String> {
    let base = base_url.filter(|s| !s.is_empty()).unwrap_or_else(default_base_url);
    let cert = { state.cert_pem.lock().unwrap().clone() }.ok_or_else(|| "No certificate. Run gen-cert <email> first.".to_string())?;
    let url = format!("{}/api/register", base.trim_end_matches('/'));
    let body = serde_json::json!({"certificate": cert});
    let (status, json) = http_post_json(&url, body).await?;
    if status == StatusCode::CREATED {
        let pkh = json.get("publicKeyHash").and_then(|v| v.as_str()).unwrap_or("").to_string();
        if !pkh.is_empty() { let mut h = state.pkh_hex.lock().unwrap(); *h = Some(pkh.clone()); }
        Ok(format!("REGISTERED PKH {}", pkh))
    } else if status == StatusCode::CONFLICT {
        let pkh = { state.pkh_hex.lock().unwrap().clone().unwrap_or_default() };
        Ok(format!("REGISTER CONFLICT PKH {}", pkh))
    } else {
        Ok(format!("REGISTER ERROR {} {}", status.as_u16(), json))
    }
}

#[tauri::command]
async fn api_ready(base_url: Option<String>, socket_address: Option<String>, state: State<'_, AppState>) -> Result<String, String> {
    let base = base_url.filter(|s| !s.is_empty()).unwrap_or_else(default_base_url);
    let pkh = { state.pkh_hex.lock().unwrap().clone() }.ok_or_else(|| "No PKH. Run gen-cert and api-register first.".to_string())?;
    let sock = if let Some(s) = socket_address { s } else {
        let me = state.self_info.lock().unwrap().clone().ok_or_else(|| "No listener. Run start-listener first.".to_string())?;
        format!("127.0.0.1:{}", me.port)
    };
    let url = format!("{}/api/broadcast/ready", base.trim_end_matches('/'));
    let body = serde_json::json!({"publicKeyHash": pkh, "socket_address": sock});
    let (status, json) = http_post_json(&url, body).await?;
    if status == StatusCode::OK || status == StatusCode::CREATED {
        Ok(format!("READY OK {}", json.get("socket_address").and_then(|v| v.as_str()).unwrap_or("") ))
    } else {
        Ok(format!("READY ERROR {} {}", status.as_u16(), json))
    }
}

#[tauri::command]
async fn api_lookup(base_url: Option<String>, public_key_hash: String, minutes: Option<u32>) -> Result<String, String> {
    let base = base_url.filter(|s| !s.is_empty()).unwrap_or_else(default_base_url);
    let mins = minutes.unwrap_or(10);
    let url = format!(
        "{}/api/broadcast/lookup?publicKeyHash={}&minutes={}",
        base.trim_end_matches('/'), public_key_hash, mins
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
        if input.is_empty() { continue; }
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
            "gen-cert" => {
                let email = match parts.next() { Some(e) => e.to_string(), None => { println!("Usage: gen-cert <email>"); continue; } };
                if parts.next().is_some() {
                    println!("Usage: gen-cert <email>");
                    continue;
                }
                // Generate a self-signed certificate with SAN rfc822Name=email using rcgen (v0.12)
                let mut params = rcgen::CertificateParams::default();
                // Add SAN email entry (RFC 822 name)
                params.subject_alt_names.push(rcgen::SanType::Rfc822Name(email.clone()));
                // Optionally set a CN for readability (not used by server)
                params
                    .distinguished_name
                    .push(rcgen::DnType::CommonName, format!("Flashback Test {}", email));
                let cert = match rcgen::Certificate::from_params(params) {
                    Ok(c) => c,
                    Err(e) => { println!("Error generating certificate: {}", e); continue; }
                };
                let pem = match cert.serialize_pem() { Ok(p) => p, Err(e) => { println!("Error serializing PEM: {}", e); continue; } };
                let der = match cert.serialize_der() { Ok(d) => d, Err(e) => { println!("Error serializing DER: {}", e); continue; } };
                let priv_pem = cert.serialize_private_key_pem();
                // Compute SHA-256 hash over the DER certificate bytes (server does the same)
                let mut hasher = Sha256::new();
                hasher.update(&der);
                let pkh = hex_crate::encode(hasher.finalize());
                // Save in state
                {
                    let mut c = state.cert_pem.lock().unwrap();
                    *c = Some(pem.clone());
                }
                {
                    let mut h = state.pkh_hex.lock().unwrap();
                    *h = Some(pkh.clone());
                }
                // Determine output directory from the parent directory of config.certificate_path
                let mut cfg = state.config.lock().unwrap().clone();
                let cert_path_cur = std::path::PathBuf::from(cfg.certificate_path.clone());
                let out_dir = cert_path_cur.parent().map(|p| p.to_path_buf()).unwrap_or_else(|| std::path::PathBuf::from("."));
                let _ = std::fs::create_dir_all(&out_dir);
                let cert_path = out_dir.join("certificate.pem");
                let priv_path = out_dir.join("private.key");
                let hash_path = out_dir.join("publicKeyHash.txt");
                let _ = std::fs::write(&cert_path, &pem);
                let _ = std::fs::write(&priv_path, &priv_pem);
                let _ = std::fs::write(&hash_path, &pkh);
                // Also write legacy PKH file into logs dir
                let mut ld = if let Ok(dir) = std::env::var("WDIO_LOGS_DIR") { std::path::PathBuf::from(dir) } else { logs_dir_from_app(None) };
                let _ = std::fs::create_dir_all(&ld);
                ld.push(format!("pkh-{}.txt", std::process::id()));
                let _ = std::fs::write(&ld, &pkh);
                // Update config.certificate_path to point to the new certificate.pem
                cfg.certificate_path = cert_path.to_string_lossy().to_string();
                {
                    let mut guard = state.config.lock().unwrap();
                    *guard = cfg.clone();
                }
                save_config_to_disk(&cfg);
                println!("Generated certificate for {}", email);
            }
            "print-cert" => {
                let cert_opt = { state.cert_pem.lock().unwrap().clone() };
                if let Some(pem) = cert_opt {
                    println!("-----BEGIN CERT START-----");
                    print!("{}", pem);
                    println!("-----END CERT START-----");
                } else {
                    println!("No certificate. Run gen-cert <email> first.");
                }
            }
            "print-pkh" => {
                let pkh_opt = { state.pkh_hex.lock().unwrap().clone() };
                if let Some(pkh) = pkh_opt { println!("{}", pkh); } else { println!("No PKH. Run gen-cert <email> first."); }
            }
            "start-listener" => {
                let ah = app_handle.clone();
                let st = state.clone();
                match async_runtime::block_on(start_peer_listener_async(st, ah)) {
                    Ok(port) => println!("Listener started on 0.0.0.0:{}", port),
                    Err(e) => println!("Error starting listener: {}", e),
                }
            }
            "connect-server" => {
                let server = match parts.next() { Some(s) => s.to_string(), None => { println!("Usage: connect-server <server:port>"); continue; } };
                if parts.next().is_some() {
                    println!("Warning: extra arguments ignored. Usage: connect-server <server:port>");
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
                let addr = match parts.next() { Some(s) => s.to_string(), None => { println!("Usage: connect-peer <peer:port>"); continue; } };
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
                let channel = match parts.next() { Some(c) => c.to_string(), None => { println!("Usage: send-channel <channel> <message>"); continue; } };
                let message = parts.collect::<Vec<_>>().join(" ");
                if message.is_empty() { println!("Usage: send-channel <channel> <message>"); continue; }
                // try to pull client_ip/port from self_info
                let (client_ip, client_port) = {
                    let guard = state.self_info.lock().unwrap();
                    if let Some(me) = &*guard {
                        (me.local_ip.clone(), me.port)
                    } else {
                        println!("You must connect-server first to set your client_ip and client_port.");
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
                let addr = match parts.next() { Some(v) => v.to_string(), None => { println!("Usage: send-client <peer:port> <text>"); continue; } };
                let text = parts.collect::<Vec<_>>().join(" ");
                if text.is_empty() { println!("Usage: send-client <peer:port> <text>"); continue; }
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
                let path_arg = match parts.next() { Some(p) => p.to_string(), None => { println!("Usage: set-cert-path <path>"); continue; } };
                if parts.next().is_some() { println!("Usage: set-cert-path <path>"); continue; }
                // If a directory is passed, append certificate.pem
                let mut p = std::path::PathBuf::from(&path_arg);
                let meta_is_dir = std::fs::metadata(&p).map(|m| m.is_dir()).unwrap_or_else(|_| path_arg.ends_with('/') || path_arg.ends_with('\\'));
                if meta_is_dir {
                    p = p.join("certificate.pem");
                }
                if let Some(parent) = p.parent() { let _ = std::fs::create_dir_all(parent); }
                let mut cfg = state.config.lock().unwrap().clone();
                cfg.certificate_path = p.to_string_lossy().to_string();
                {
                    let mut guard = state.config.lock().unwrap();
                    *guard = cfg.clone();
                }
                save_config_to_disk(&cfg);
                println!("certificatePath set to {}", cfg.certificate_path);
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
                                    let fut = peer_send_file_accept(p.ip, p.port, name, "accept".to_string(), st);
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
                            let fut = peer_send_file_accept(p.ip, p.port, name, "accept".to_string(), st);
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
                            let fut = peer_send_file_accept(p.ip.clone(), p.port, name.clone(), "reject".to_string(), st);
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
                let base = parts.next().map(|s| s.to_string());
                let st = state.clone();
                let fut = api_register(base, st);
                match async_runtime::block_on(fut) { Ok(m) => println!("{}", m), Err(e) => println!("Error: {}", e) }
            }
            "api-ready" => {
                // usage: api-ready [baseUrl] [ip:port]
                let first = parts.next().map(|s| s.to_string());
                let (base, sock_opt) = if let Some(f) = first.clone() {
                    if f.contains("://") { (first, parts.next().map(|s| s.to_string())) } else { (None, first) }
                } else { (None, None) };
                let st = state.clone();
                let fut = api_ready(base, sock_opt, st);
                match async_runtime::block_on(fut) { Ok(m) => println!("{}", m), Err(e) => println!("Error: {}", e) }
            }
            "api-lookup" => {
                // usage: api-lookup [baseUrl] <pkh> [minutes]
                let mut base: Option<String> = None;
                let first = parts.next().map(|s| s.to_string());
                let (pkh, minutes) = if let Some(f) = first.clone() {
                    if f.contains("://") { base = first; (parts.next().map(|s| s.to_string()), parts.next().and_then(|m| m.parse::<u32>().ok())) } else { (first, parts.next().and_then(|m| m.parse::<u32>().ok())) }
                } else { (None, None) };
                let pkh = match pkh { Some(p) => p, None => { println!("Usage: api-lookup [baseUrl] <pkh> [minutes]"); continue; } };
                let fut = api_lookup(base, pkh, minutes);
                match async_runtime::block_on(fut) { Ok(m) => println!("{}", m), Err(e) => println!("Error: {}", e) }
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
