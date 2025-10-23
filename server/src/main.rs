use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::env;
use std::fs;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;
use chrono::{DateTime, Utc};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::RwLock;
use tokio::time::{interval, timeout};

#[derive(Debug, Deserialize)]
struct ServerConfig {
    server: ServerSettings,
}

#[derive(Debug, Deserialize)]
struct ServerSettings {
    #[serde(default = "default_port")]
    port: u16,
    #[serde(default = "default_heartbeat_interval")]
    heartbeat_interval: u64,
    #[serde(default = "default_connection_timeout")]
    connection_timeout: u64,
    #[serde(default = "default_host")]
    #[allow(dead_code)]
    host: String,
    #[serde(default = "default_max_clients")]
    max_clients: usize,
}

fn default_port() -> u16 { 8080 }
fn default_heartbeat_interval() -> u64 { 60 }
fn default_connection_timeout() -> u64 { 120 }
fn default_host() -> String { "0.0.0.0".to_string() }
fn default_max_clients() -> usize { 100 }

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ClientInfo {
    ip: String,
    port: u16,
    #[serde(skip)]
    last_ping: Arc<RwLock<DateTime<Utc>>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
enum Message {
    #[serde(rename = "register")]
    Register {
        client_ip: String,
        client_port: u16,
    },
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
    // DCC signaling (server-relayed)
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
        // a preview or stream URL could be provided in future; omitted here
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
    // Streaming bytes + control
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

type ClientMap = Arc<RwLock<HashMap<SocketAddr, ClientInfo>>>;
type WriterMap = Arc<RwLock<HashMap<SocketAddr, Arc<tokio::sync::Mutex<tokio::net::tcp::OwnedWriteHalf>>>>>;

#[tokio::main]
async fn main() {
    println!("🚀 Starting Client-Server Application Server");
    println!("============================================");
    
    // Load configuration
    let config = load_config();
    println!("⚙️  Configuration loaded:");
    println!("   Heartbeat interval: {}s", config.server.heartbeat_interval);
    println!("   Connection timeout: {}s", config.server.connection_timeout);
    println!("   Max clients: {}", config.server.max_clients);
    println!("");
    
    // Check for custom port from command line arguments
    let args: Vec<String> = env::args().collect();
    let custom_port = if args.len() > 1 {
        match args[1].parse::<u16>() {
            Ok(port) => {
                println!("🎯 Using custom port: {}", port);
                Some(port)
            }
            Err(_) => {
                eprintln!("❌ Invalid port number: {}", args[1]);
                eprintln!("💡 Usage: cargo run [port]");
                eprintln!("   Example: cargo run 9090");
                std::process::exit(1);
            }
        }
    } else {
        None
    };

    // Try multiple ports if configured port is in use
    let ports = if let Some(port) = custom_port {
        vec![port]
    } else {
        vec![config.server.port, 8081, 8082, 8083, 8084, 8085]
    };
    
    let mut listener = None;
    let mut bound_addr = String::new();

    for port in &ports {
        let addr = format!("0.0.0.0:{}", port);
        match TcpListener::bind(&addr).await {
            Ok(l) => {
                println!("✅ Successfully bound to {}", addr);
                bound_addr = addr.clone();
                listener = Some(l);
                break;
            }
            Err(e) => {
                if custom_port.is_some() {
                    eprintln!("❌ Failed to bind to {}: {}", addr, e);
                    eprintln!("💡 Port {} is already in use", port);
                    eprintln!("   Find what's using it: lsof -i :{}", port);
                    eprintln!("   Try a different port: cargo run -- <port>");
                    std::process::exit(1);
                }
                if *port == config.server.port {
                    println!("⚠️  Port {} is in use, trying next port...", port);
                } else {
                    println!("⚠️  Port {} is in use, trying next port...", port);
                }
            }
        }
    }

    let listener = match listener {
        Some(l) => l,
        None => {
            eprintln!("❌ Failed to bind to any port. All ports 8080-8085 are in use.");
            eprintln!("");
            eprintln!("💡 To fix this:");
            eprintln!("   1. Find the process using port 8080:");
            eprintln!("      lsof -i :8080");
            eprintln!("");
            eprintln!("   2. Kill it (replace <PID> with the actual process ID):");
            eprintln!("      kill -9 <PID>");
            eprintln!("");
            eprintln!("   3. Or use a custom port:");
            eprintln!("      cargo run -- 9090");
            std::process::exit(1);
        }
    };

    println!("");
    println!("🚀 Server is running!");
    println!("   Address: {}", bound_addr);
    println!("   Ready to accept client connections");
    println!("============================================");
    println!("");

    let clients: ClientMap = Arc::new(RwLock::new(HashMap::new()));
    let writers: WriterMap = Arc::new(RwLock::new(HashMap::new()));
    
    // Start connection timeout checker
    let timeout_clients = Arc::clone(&clients);
    let timeout_writers = Arc::clone(&writers);
    let timeout_duration = config.server.connection_timeout;
    tokio::spawn(async move {
        check_connection_timeouts(timeout_clients, timeout_writers, timeout_duration).await;
    });

    loop {
        let (socket, socket_addr) = listener.accept().await.unwrap();
        println!("✅ New connection from: {}", socket_addr);

        let clients = Arc::clone(&clients);
        let writers = Arc::clone(&writers);
        let heartbeat_interval = config.server.heartbeat_interval;
        tokio::spawn(async move {
            handle_client(socket, socket_addr, clients, writers, heartbeat_interval).await;
        });
    }
}

fn load_config() -> ServerConfig {
    match fs::read_to_string("config.toml") {
        Ok(content) => match toml::from_str(&content) {
            Ok(config) => config,
            Err(e) => {
                eprintln!("⚠️  Failed to parse config.toml: {}", e);
                eprintln!("   Using default configuration");
                default_config()
            }
        },
        Err(_) => {
            println!("⚠️  config.toml not found, using default configuration");
            default_config()
        }
    }
}

fn default_config() -> ServerConfig {
    ServerConfig {
        server: ServerSettings {
            port: default_port(),
            heartbeat_interval: default_heartbeat_interval(),
            connection_timeout: default_connection_timeout(),
            host: default_host(),
            max_clients: default_max_clients(),
        }
    }
}

async fn check_connection_timeouts(clients: ClientMap, writers: WriterMap, timeout_seconds: u64) {
    let mut check_interval = interval(Duration::from_secs(10));
    
    loop {
        check_interval.tick().await;
        
        let now = Utc::now();
        let mut disconnected = Vec::new();
        
        {
            let clients_lock = clients.read().await;
            for (addr, info) in clients_lock.iter() {
                let last_ping = *info.last_ping.read().await;
                let elapsed = now.signed_duration_since(last_ping);
                
                if elapsed.num_seconds() > timeout_seconds as i64 {
                    disconnected.push((*addr, info.clone()));
                }
            }
        }
        
        if !disconnected.is_empty() {
            let mut clients_lock = clients.write().await;
            let mut writers_lock = writers.write().await;
            for (addr, info) in disconnected {
                clients_lock.remove(&addr);
                writers_lock.remove(&addr);
                println!("⏱️  Client timeout: {}:{} (no ping for {}s)", 
                    info.ip, info.port, timeout_seconds);
            }
        }
    }
}

async fn handle_client(socket: TcpStream, socket_addr: SocketAddr, clients: ClientMap, writers: WriterMap, heartbeat_interval: u64) {
    let (reader, writer) = socket.into_split();
    let mut reader = BufReader::new(reader);
    let mut line = String::new();
    
    let writer = Arc::new(tokio::sync::Mutex::new(writer));

    // Read client registration message
    match reader.read_line(&mut line).await {
        Ok(0) => {
            println!("❌ Client {} disconnected immediately", socket_addr);
            return;
        }
        Ok(_) => {
            if let Ok(msg) = serde_json::from_str::<Message>(&line) {
                if let Message::Register {
                    client_ip,
                    client_port,
                } = msg
                {
                    let client_info = ClientInfo {
                        ip: client_ip.clone(),
                        port: client_port,
                        last_ping: Arc::new(RwLock::new(Utc::now())),
                    };

                    // Add client to the map
                    {
                        let mut clients_lock = clients.write().await;
                        clients_lock.insert(socket_addr, client_info.clone());
                        let mut writers_lock = writers.write().await;
                        writers_lock.insert(socket_addr, Arc::clone(&writer));
                        println!(
                            "📝 Registered client: {}:{} (socket: {})",
                            client_ip, client_port, socket_addr
                        );
                    }

                    // Broadcast updated client list to all clients
                    broadcast_client_list(&clients, &writers).await;

                    // Send initial client list to this client
                    if let Err(e) = send_client_list(&writer, &clients).await {
                        println!("❌ Error sending client list: {}", e);
                    }

                    // Keep connection alive and handle pings
                    line.clear();
                    loop {
                        // Use timeout to prevent indefinite blocking
                        let read_result = timeout(
                            Duration::from_secs(heartbeat_interval * 2),
                            reader.read_line(&mut line)
                        ).await;
                        
                        match read_result {
                            Ok(Ok(0)) => {
                                // Connection closed
                                println!("🔌 Client {}:{} closed connection", client_ip, client_port);
                                break;
                            }
                            Ok(Ok(_)) => {
                                // Client sent a message
                                if let Ok(msg) = serde_json::from_str::<Message>(&line) {
                                    match msg {
                                        Message::Ping => {
                                            // Update last ping time
                                            if let Some(info) = clients.read().await.get(&socket_addr) {
                                                *info.last_ping.write().await = Utc::now();
                                            }
                                            
                                            // Send pong response
                                            let pong = Message::Pong;
                                            if let Ok(json) = serde_json::to_string(&pong) {
                                                let mut writer_lock = writer.lock().await;
                                                let _ = writer_lock.write_all((json + "\n").as_bytes()).await;
                                                let _ = writer_lock.flush().await;
                                            }
                                        }
                                        Message::Chat { from_ip, from_port, message, timestamp, channel } => {
                                            // Broadcast chat message to all connected clients (including sender)
                                            println!("💬 Chat from {}:{} [{}]: {}", from_ip, from_port, channel, message);
                                            let chat_msg = Message::Chat {
                                                from_ip,
                                                from_port,
                                                message,
                                                timestamp,
                                                channel,
                                            };
                                            broadcast_message(&writers, &chat_msg, None).await;  // None = include sender
                                        }
                                        Message::DccRequest { from_ip, from_port, to_ip, to_port } => {
                                            println!("📨 DCC request received (ignored): {}:{} -> {}:{}", from_ip, from_port, to_ip, to_port);
                                            // DCC is not relayed by server.
                                        }
                                        Message::DccOpened { from_ip, from_port, to_ip, to_port } => {
                                            println!("🪟 DCC opened notification (ignored): {}:{} -> {}:{}", from_ip, from_port, to_ip, to_port);
                                        }
                                        Message::FileOffer { from_ip, from_port, to_ip, to_port, name, size } => {
                                            println!("📁 File offer (ignored) {}:{} -> {}:{} [{} - {} bytes]", from_ip, from_port, to_ip, to_port, name, size);
                                        }
                                        Message::FileAccept { from_ip, from_port, to_ip, to_port, name, action } => {
                                            println!("✅ File accept (ignored) {}:{} -> {}:{} [{} action={}]", from_ip, from_port, to_ip, to_port, name, action);
                                        }
                                        Message::FileChunk { from_ip, from_port, to_ip, to_port, name, offset, bytes_total, data_base64: _ } => {
                                            println!("🚚 File chunk (ignored) '{}' {}:{} -> {}:{} (offset {} / total {})", name, from_ip, from_port, to_ip, to_port, offset, bytes_total);
                                        }
                                        Message::FileCancel { from_ip, from_port, to_ip, to_port, name } => {
                                            println!("⛔ File cancel (ignored) '{}' {}:{} -> {}:{}", name, from_ip, from_port, to_ip, to_port);
                                        }
                                        _ => {
                                            // Handle other messages if needed
                                        }
                                    }
                                }
                                line.clear();
                            }
                            Ok(Err(e)) => {
                                println!("❌ Error reading from client {}: {}", socket_addr, e);
                                break;
                            }
                            Err(_) => {
                                // Timeout - check if client is still in map
                                if clients.read().await.contains_key(&socket_addr) {
                                    println!("⏱️  Read timeout for client {}:{}", client_ip, client_port);
                                    continue;
                                } else {
                                    // Client was removed by timeout checker
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        }
        Err(e) => {
            println!("❌ Error reading from client {}: {}", socket_addr, e);
        }
    }

    // Remove client from map
    {
        let mut clients_lock = clients.write().await;
        let mut writers_lock = writers.write().await;
        if let Some(info) = clients_lock.remove(&socket_addr) {
            println!("👋 Client disconnected: {}:{}", info.ip, info.port);
        }
        writers_lock.remove(&socket_addr);
    }

    // Broadcast updated client list
    broadcast_client_list(&clients, &writers).await;
}

async fn send_client_list(
    writer: &Arc<tokio::sync::Mutex<tokio::net::tcp::OwnedWriteHalf>>,
    clients: &ClientMap,
) -> Result<(), Box<dyn std::error::Error>> {
    let clients_lock = clients.read().await;
    let client_list: Vec<ClientInfo> = clients_lock.values().cloned().collect();

    let message = Message::ClientList {
        clients: client_list,
    };

    let json = serde_json::to_string(&message)? + "\n";
    let mut writer_lock = writer.lock().await;
    writer_lock.write_all(json.as_bytes()).await?;
    writer_lock.flush().await?;

    Ok(())
}

async fn broadcast_client_list(clients: &ClientMap, writers: &WriterMap) {
    let clients_lock = clients.read().await;
    let client_list: Vec<ClientInfo> = clients_lock.values().cloned().collect();

    let message = Message::ClientList { clients: client_list.clone() };

    let json = match serde_json::to_string(&message) {
        Ok(j) => j + "\n",
        Err(e) => {
            println!("❌ Error serializing client list: {}", e);
            return;
        }
    };

    println!(
        "📡 Broadcasting client list ({} clients)",
        client_list.len()
    );

    let writers_lock = writers.read().await;
    let mut failed_addrs = Vec::new();
    for (addr, writer) in writers_lock.iter() {
        let mut writer_lock = writer.lock().await;
        if let Err(e) = writer_lock.write_all(json.as_bytes()).await {
            println!("❌ Failed to send client list to {}: {}", addr, e);
            failed_addrs.push(*addr);
            continue;
        }
        if let Err(e) = writer_lock.flush().await {
            println!("❌ Failed to flush client list to {}: {}", addr, e);
            failed_addrs.push(*addr);
        }
    }

    if !failed_addrs.is_empty() {
        println!("⚠️  Failed to broadcast client list to {} clients", failed_addrs.len());
    }
}

async fn broadcast_message(writers: &WriterMap, message: &Message, exclude: Option<SocketAddr>) {
    let json = match serde_json::to_string(message) {
        Ok(j) => j + "\n",
        Err(e) => {
            println!("❌ Error serializing message: {}", e);
            return;
        }
    };

    let writers_lock = writers.read().await;
    let mut failed_addrs = Vec::new();

    for (addr, writer) in writers_lock.iter() {
        // Skip the sender if exclude is specified
        if let Some(exclude_addr) = exclude {
            if *addr == exclude_addr {
                continue;
            }
        }

        let mut writer_lock = writer.lock().await;
        if let Err(e) = writer_lock.write_all(json.as_bytes()).await {
            println!("❌ Failed to send to {}: {}", addr, e);
            failed_addrs.push(*addr);
        } else if let Err(e) = writer_lock.flush().await {
            println!("❌ Failed to flush to {}: {}", addr, e);
            failed_addrs.push(*addr);
        }
    }

    if !failed_addrs.is_empty() {
        println!("⚠️  Failed to broadcast to {} clients", failed_addrs.len());
    }
}

#[allow(dead_code)]
async fn find_addr_by_ip_port(clients: &ClientMap, ip: &str, port: u16) -> Option<SocketAddr> {
    let clients_lock = clients.read().await;
    for (addr, info) in clients_lock.iter() {
        if info.ip == ip && info.port == port {
            return Some(*addr);
        }
    }
    None
}

#[allow(dead_code)]
async fn send_to_addr(writers: &WriterMap, addr: SocketAddr, message: &Message) {
    let json = match serde_json::to_string(message) {
        Ok(j) => j + "\n",
        Err(e) => {
            println!("❌ Error serializing message: {}", e);
            return;
        }
    };
    let writers_lock = writers.read().await;
    if let Some(writer) = writers_lock.get(&addr) {
        let mut writer_lock = writer.lock().await;
        if let Err(e) = writer_lock.write_all(json.as_bytes()).await {
            println!("❌ Failed to send to {}: {}", addr, e);
            return;
        }
        if let Err(e) = writer_lock.flush().await {
            println!("❌ Failed to flush to {}: {}", addr, e);
        }
    } else {
        println!("⚠️  Writer not found for {}", addr);
    }
}
