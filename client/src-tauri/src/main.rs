#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::{Emitter, State};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::mpsc;
use tokio::time::{interval, Duration};

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ClientInfo {
    ip: String,
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
    ip: String,
    port: u16,
    peer_status: String,
}

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
}

struct AppState {
    clients: Arc<Mutex<Vec<ClientInfo>>>,
    tx: Arc<Mutex<Option<mpsc::Sender<Message>>>>,
    current_channel: Arc<Mutex<String>>,
    self_info: Arc<Mutex<Option<ClientInfo>>>,
    peers: Arc<Mutex<HashMap<String, PeerConn>>>, // key: "ip:port"
}

#[tauri::command]
async fn connect_to_server(
    server_ip: String,
    server_port: u16,
    client_ip: String,
    client_port: u16,
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    let addr = format!("{}:{}", server_ip, server_port);

    // Save self info
    {
        let mut self_lock = state.self_info.lock().unwrap();
        *self_lock = Some(ClientInfo {
            ip: client_ip.clone(),
            port: client_port,
        });
    }

    // Start peer listener (accept incoming peer connections)
    {
        let listen_addr = format!("0.0.0.0:{}", client_port);
        let app_handle_clone = app_handle.clone();
        tokio::spawn(async move {
            match TcpListener::bind(&listen_addr).await {
                Ok(listener) => {
                    println!("👂 Peer listener started at {}", listen_addr);
                    loop {
                        match listener.accept().await {
                            Ok((mut stream, remote)) => {
                                println!("🔗 Incoming peer connection from {}", remote);
                                let app_handle_incoming = app_handle_clone.clone();
                                tokio::spawn(async move {
                                    let (reader, mut writer) = stream.split();
                                    let mut reader = BufReader::new(reader);
                                    let mut line = String::new();
                                    loop {
                                        line.clear();
                                        match reader.read_line(&mut line).await {
                                            Ok(0) => break,
                                            Ok(_) => {
                                                if let Ok(msg) =
                                                    serde_json::from_str::<Message>(&line)
                                                {
                                                    match msg {
                                                        Message::Ping => {
                                                            let pong = serde_json::to_string(
                                                                &Message::Pong,
                                                            )
                                                            .unwrap()
                                                                + "\n";
                                                            if let Err(e) = writer
                                                                .write_all(pong.as_bytes())
                                                                .await
                                                            {
                                                                println!("Peer write error: {}", e);
                                                                break;
                                                            }
                                                            if let Err(e) = writer.flush().await {
                                                                println!("Peer flush error: {}", e);
                                                                break;
                                                            }
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
                }
                Err(e) => {
                    println!("❌ Failed to bind peer listener {}: {}", listen_addr, e);
                }
            }
        });
    }

    println!("Connecting to server at {}", addr);

    // Connect to server
    let stream = TcpStream::connect(&addr)
        .await
        .map_err(|e| format!("Failed to connect: {}", e))?;

    println!("Connected to server");

    let (reader, mut writer) = stream.into_split();
    let mut reader = BufReader::new(reader);

    // Send registration message
    let register_msg = Message::Register {
        client_ip: client_ip.clone(),
        client_port,
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

    // Spawn task to handle incoming messages
    let app_handle_clone = app_handle.clone();
    let state_clients = Arc::clone(&state.clients);
    let state_peers = Arc::clone(&state.peers);
    let self_info_arc = Arc::clone(&state.self_info);
    tokio::spawn(async move {
        let mut line = String::new();
        loop {
            line.clear();
            match reader.read_line(&mut line).await {
                Ok(0) => {
                    println!("Server disconnected");
                    let _ = app_handle_clone.emit("server-disconnected", ());
                    break;
                }
                Ok(_) => {
                    if let Ok(msg) = serde_json::from_str::<Message>(&line) {
                        match msg {
                            Message::ClientList { clients } => {
                                println!("Received client list: {} clients", clients.len());
                                // Save latest server-provided list
                                {
                                    let mut state_clients = state_clients.lock().unwrap();
                                    *state_clients = clients.clone();
                                }

                                // Determine self to skip
                                let self_opt = { self_info_arc.lock().unwrap().clone() };

                                // Connect to peers (outbound) and update statuses
                                for c in &clients {
                                    if let Some(ref me) = self_opt {
                                        if me.ip == c.ip && me.port == c.port {
                                            continue;
                                        }
                                    }
                                    let key = format!("{}:{}", c.ip, c.port);
                                    let mut need_connect = false;
                                    {
                                        let mut peers = state_peers.lock().unwrap();
                                        match peers.get(&key) {
                                            Some(pc) => match pc.status {
                                                PeerStatus::Disconnected => {
                                                    need_connect = true;
                                                }
                                                PeerStatus::Connecting | PeerStatus::Connected => {}
                                            },
                                            None => {
                                                peers.insert(
                                                    key.clone(),
                                                    PeerConn {
                                                        status: PeerStatus::Connecting,
                                                    },
                                                );
                                                need_connect = true;
                                            }
                                        }
                                    }

                                    if need_connect {
                                        let key_clone = key.clone();
                                        let state_peers_clone = Arc::clone(&state_peers);
                                        let app_handle_pe = app_handle_clone.clone();
                                        let state_clients_clone = Arc::clone(&state_clients);
                                        let self_info_arc_clone = Arc::clone(&self_info_arc);
                                        let target = format!("{}:{}", c.ip, c.port);
                                        tokio::spawn(async move {
                                            let connect_target = target.clone();
                                            println!("➡️ Connecting to peer {}", connect_target);
                                            match TcpStream::connect(&connect_target).await {
                                                Ok(stream) => {
                                                    println!(
                                                        "✅ Connected to peer {}",
                                                        connect_target
                                                    );
                                                    {
                                                        let mut peers =
                                                            state_peers_clone.lock().unwrap();
                                                        if let Some(pc) = peers.get_mut(&key_clone)
                                                        {
                                                            pc.status = PeerStatus::Connected;
                                                        }
                                                    }
                                                    let _ = app_handle_pe.emit(
                                                        "peer-status-updated",
                                                        &connect_target,
                                                    );
                                                    // Also emit refreshed client list so UI updates direct status immediately
                                                    emit_enriched_client_list(
                                                        &app_handle_pe,
                                                        &state_clients_clone,
                                                        &state_peers_clone,
                                                        &self_info_arc_clone,
                                                    );
                                                    // Split and spawn reader + heartbeat
                                                    let (reader, mut writer) = stream.into_split();
                                                    let mut reader = BufReader::new(reader);
                                                    // Heartbeat ticker
                                                    let mut ping_interval =
                                                        interval(Duration::from_secs(60));
                                                    let ping_target = connect_target.clone();
                                                    tokio::spawn(async move {
                                                        loop {
                                                            if ping_interval
                                                                .tick()
                                                                .await
                                                                .elapsed()
                                                                .is_zero()
                                                            { /* noop */
                                                            }
                                                            let ping = serde_json::to_string(
                                                                &Message::Ping,
                                                            )
                                                            .unwrap()
                                                                + "\n";
                                                            if let Err(e) = writer
                                                                .write_all(ping.as_bytes())
                                                                .await
                                                            {
                                                                println!(
                                                                    "Peer ping write error {}: {}",
                                                                    ping_target, e
                                                                );
                                                                break;
                                                            }
                                                            if let Err(e) = writer.flush().await {
                                                                println!(
                                                                    "Peer ping flush error {}: {}",
                                                                    ping_target, e
                                                                );
                                                                break;
                                                            }
                                                            println!(
                                                                "💓 Sent ping to peer {}",
                                                                ping_target
                                                            );
                                                        }
                                                    });
                                                    // Reader loop: respond to pings and observe pongs
                                                    let reader_target = connect_target.clone();
                                                    let state_peers_clone_reader =
                                                        state_peers_clone.clone();
                                                    let app_handle_pe_reader =
                                                        app_handle_pe.clone();
                                                    let key_clone_reader = key_clone.clone();
                                                    let state_clients_clone_reader =
                                                        state_clients_clone.clone();
                                                    let self_info_arc_clone_reader =
                                                        self_info_arc_clone.clone();
                                                    tokio::spawn(async move {
                                                        let mut line = String::new();
                                                        loop {
                                                            line.clear();
                                                            match reader.read_line(&mut line).await
                                                            {
                                                                Ok(0) => {
                                                                    println!(
                                                                        "Peer {} closed",
                                                                        reader_target
                                                                    );
                                                                    break;
                                                                }
                                                                Ok(_) => {
                                                                    if let Ok(msg) =
                                                                        serde_json::from_str::<
                                                                            Message,
                                                                        >(
                                                                            &line
                                                                        )
                                                                    {
                                                                        match msg {
                                                                            Message::Ping => {}
                                                                            Message::Pong => {
                                                                                println!("💓 Received pong from peer {}", reader_target);
                                                                            }
                                                                            _ => {}
                                                                        }
                                                                    }
                                                                }
                                                                Err(e) => {
                                                                    println!(
                                                                        "Peer {} read error: {}",
                                                                        reader_target, e
                                                                    );
                                                                    break;
                                                                }
                                                            }
                                                        }
                                                        // Mark disconnected
                                                        let mut peers = state_peers_clone_reader
                                                            .lock()
                                                            .unwrap();
                                                        if let Some(pc) =
                                                            peers.get_mut(&key_clone_reader)
                                                        {
                                                            pc.status = PeerStatus::Disconnected;
                                                        }
                                                        let _ = app_handle_pe_reader.emit(
                                                            "peer-status-updated",
                                                            &reader_target,
                                                        );
                                                        // Also emit refreshed client list so UI updates direct status immediately
                                                        emit_enriched_client_list(
                                                            &app_handle_pe_reader,
                                                            &state_clients_clone_reader,
                                                            &state_peers_clone_reader,
                                                            &self_info_arc_clone_reader,
                                                        );
                                                    });
                                                }
                                                Err(e) => {
                                                    println!(
                                                        "❌ Failed to connect to peer {}: {}",
                                                        connect_target, e
                                                    );
                                                    let mut peers =
                                                        state_peers_clone.lock().unwrap();
                                                    if let Some(pc) = peers.get_mut(&key_clone) {
                                                        pc.status = PeerStatus::Disconnected;
                                                    } else {
                                                        peers.insert(
                                                            key_clone,
                                                            PeerConn {
                                                                status: PeerStatus::Disconnected,
                                                            },
                                                        );
                                                    }
                                                    let _ = app_handle_pe.emit(
                                                        "peer-status-updated",
                                                        &connect_target,
                                                    );
                                                    // Also emit refreshed client list so UI updates direct status immediately
                                                    emit_enriched_client_list(
                                                        &app_handle_pe,
                                                        &state_clients_clone,
                                                        &state_peers_clone,
                                                        &self_info_arc_clone,
                                                    );
                                                }
                                            }
                                        });
                                    }
                                }

                                // Build enriched list with peer status for UI
                                let enriched: Vec<EnrichedClientInfo> = clients
                                    .iter()
                                    .map(|c| {
                                        if let Some(ref me) = self_opt {
                                            if me.ip == c.ip && me.port == c.port {
                                                return EnrichedClientInfo {
                                                    ip: c.ip.clone(),
                                                    port: c.port,
                                                    peer_status: "self".to_string(),
                                                };
                                            }
                                        }
                                        let key = format!("{}:{}", c.ip, c.port);
                                        let status_str = {
                                            let peers = state_peers.lock().unwrap();
                                            match peers.get(&key).map(|pc| pc.status.clone()) {
                                                Some(PeerStatus::Connected) => {
                                                    "connected".to_string()
                                                }
                                                Some(PeerStatus::Connecting) => {
                                                    "connecting".to_string()
                                                }
                                                Some(PeerStatus::Disconnected) => {
                                                    "disconnected".to_string()
                                                }
                                                None => "disconnected".to_string(),
                                            }
                                        };
                                        EnrichedClientInfo {
                                            ip: c.ip.clone(),
                                            port: c.port,
                                            peer_status: status_str,
                                        }
                                    })
                                    .collect();

                                let _ = app_handle_clone.emit("client-list-updated", enriched);
                            }
                            Message::Pong => {
                                println!("💓 Received pong from server");
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

fn main() {
    let app_state = AppState {
        clients: Arc::new(Mutex::new(Vec::new())),
        tx: Arc::new(Mutex::new(None)),
        current_channel: Arc::new(Mutex::new("general".to_string())),
        self_info: Arc::new(Mutex::new(None)),
        peers: Arc::new(Mutex::new(HashMap::new())),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            connect_to_server,
            get_clients,
            send_chat_message
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// Helper to emit the enriched client list using current peers map and self info
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
                if me.ip == c.ip && me.port == c.port {
                    return EnrichedClientInfo {
                        ip: c.ip.clone(),
                        port: c.port,
                        peer_status: "self".to_string(),
                    };
                }
            }
            let key = format!("{}:{}", c.ip, c.port);
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
                ip: c.ip.clone(),
                port: c.port,
                peer_status: status_str,
            }
        })
        .collect();

    let _ = app_handle.emit("client-list-updated", enriched);
}
