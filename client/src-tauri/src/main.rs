#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use tauri::{Manager, State};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpStream;
use tokio::sync::mpsc;
use tokio::time::{interval, Duration};

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ClientInfo {
    ip: String,
    port: u16,
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
}

struct AppState {
    clients: Arc<Mutex<Vec<ClientInfo>>>,
    tx: Arc<Mutex<Option<mpsc::Sender<Message>>>>,
    current_channel: Arc<Mutex<String>>,
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
    tokio::spawn(async move {
        let mut line = String::new();
        loop {
            line.clear();
            match reader.read_line(&mut line).await {
                Ok(0) => {
                    println!("Server disconnected");
                    let _ = app_handle_clone.emit_all("server-disconnected", ());
                    break;
                }
                Ok(_) => {
                    if let Ok(msg) = serde_json::from_str::<Message>(&line) {
                        match msg {
                            Message::ClientList { clients } => {
                                println!("Received client list: {} clients", clients.len());
                                {
                                    let mut state_clients = state_clients.lock().unwrap();
                                    *state_clients = clients.clone();
                                }
                                let _ = app_handle_clone.emit_all("client-list-updated", clients);
                            }
                            Message::Pong => {
                                println!("💓 Received pong from server");
                            }
                            Message::Chat { from_ip, from_port, message, timestamp, channel } => {
                                println!("💬 Chat from {}:{} [{}]: {}", from_ip, from_port, channel, message);
                                let chat_data = serde_json::json!({
                                    "from_ip": from_ip,
                                    "from_port": from_port,
                                    "message": message,
                                    "timestamp": timestamp,
                                    "channel": channel,
                                });
                                let _ = app_handle_clone.emit_all("chat-message", chat_data);
                            }
                            _ => {
                                // Handle other message types if needed
                            }
                        }
                    }
                }
                Err(e) => {
                    println!("Error reading from server: {}", e);
                    let _ = app_handle_clone.emit_all("server-error", e.to_string());
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
        
        sender.send(chat_msg).await
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
    };

    tauri::Builder::default()
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![connect_to_server, get_clients, send_chat_message])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
