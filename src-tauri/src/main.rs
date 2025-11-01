// Tauri main backend entrypoint
#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use fabric_core::crypto::{CryptoManager, FabricIdentity};
use fabric_core::fabric::{FabricNetworkClient, KaleidoFabricClient, FabricNetworkConfig};
use fabric_core::torrent::{TorrentHash, WebTorrentClient, HashType};
use serde_json::json;
use std::sync::Mutex;
use tauri::State;

// Global state management
pub struct AppState {
    identity: Mutex<Option<FabricIdentity>>,
    fabric_client: Mutex<Option<KaleidoFabricClient>>,
    torrent_client: Mutex<Option<WebTorrentClient>>,
}

// Tauri Commands for Key Management
#[tauri::command]
async fn generate_keypair() -> Result<serde_json::Value, String> {
    CryptoManager::generate_keypair()
        .map(|(private, public)| {
            json!({
                "private_key": private,
                "public_key": public
            })
        })
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn load_identity(
    path: String,
) -> Result<serde_json::Value, String> {
    FabricIdentity::load_from_file(std::path::Path::new(&path))
        .map(|identity| serde_json::to_value(&identity).unwrap())
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn save_identity(
    path: String,
    identity: serde_json::Value,
) -> Result<(), String> {
    let fabric_id: FabricIdentity =
        serde_json::from_value(identity)
            .map_err(|e| e.to_string())?;
    fabric_id
        .save_to_file(std::path::Path::new(&path))
        .map_err(|e| e.to_string())
}

// Tauri Commands for Network Operations
#[tauri::command]
async fn connect_network(
    gateway: String,
    ca_url: String,
    identity_json: serde_json::Value,
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let identity: FabricIdentity =
        serde_json::from_value(identity_json)
            .map_err(|e| e.to_string())?;

    let config = FabricNetworkConfig {
        name: "Kaleido".to_string(),
        orderers: vec![format!("{}/orderer", gateway)],
        peers: vec![format!("{}/peer", gateway)],
        ca_url,
        gateway_url: gateway.clone(),
        tls_cert_path: None,
    };

    let mut client = KaleidoFabricClient::new(config);
    client
        .connect(&identity)
        .await
        .map_err(|e| e.to_string())?;

    *state.fabric_client.lock().unwrap() = Some(client);
    *state.identity.lock().unwrap() = Some(identity);

    Ok(json!({
        "status": "connected",
        "gateway": gateway
    }))
}

#[tauri::command]
async fn get_channels(
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let fabric_client = state.fabric_client.lock().unwrap();
    if let Some(client) = fabric_client.as_ref() {
        match client.get_channels().await {
            Ok(channels) => {
                let channels_json: Vec<_> = channels
                    .iter()
                    .map(|ch| {
                        json!({
                            "id": ch.id,
                            "name": ch.name,
                            "description": ch.description,
                            "chaincode_id": ch.chaincode_id
                        })
                    })
                    .collect();
                Ok(json!({ "channels": channels_json }))
            }
            Err(e) => Err(e.to_string()),
        }
    } else {
        Err("Not connected to network".to_string())
    }
}

// Tauri Commands for Chaincode Operations
#[tauri::command]
async fn query_chaincode(
    channel_id: String,
    chaincode_id: String,
    function: String,
    args: Vec<String>,
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let fabric_client = state.fabric_client.lock().unwrap();
    if let Some(client) = fabric_client.as_ref() {
        client
            .query_chaincode(&channel_id, &chaincode_id, &function, args)
            .await
            .map_err(|e| e.to_string())
    } else {
        Err("Not connected to network".to_string())
    }
}

#[tauri::command]
async fn invoke_chaincode(
    channel_id: String,
    chaincode_id: String,
    function: String,
    args: Vec<String>,
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let fabric_client = state.fabric_client.lock().unwrap();
    if let Some(client) = fabric_client.as_ref() {
        match client
            .invoke_chaincode(
                &channel_id,
                &chaincode_id,
                &function,
                args,
            )
            .await
        {
            Ok(result) => Ok(json!({
                "transaction_id": result.transaction_id,
                "status": result.status,
                "payload": result.payload,
                "timestamp": result.timestamp
            })),
            Err(e) => Err(e.to_string()),
        }
    } else {
        Err("Not connected to network".to_string())
    }
}

// Tauri Commands for Torrent Operations
#[tauri::command]
async fn add_torrent(
    magnet_link: String,
    output_path: String,
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let torrent_hash = TorrentHash::from_magnet_link(&magnet_link)
        .map_err(|e| e.to_string())?;

    let mut torrent_client = state.torrent_client.lock().unwrap();
    let client = if let Some(ref mut c) = *torrent_client {
        c
    } else {
        *torrent_client = Some(WebTorrentClient::new());
        if let Some(ref mut c) = *torrent_client {
            c.init().await.map_err(|e| e.to_string())?;
            c
        } else {
            return Err("Failed to initialize torrent client".to_string());
        }
    };

    client
        .add_torrent(
            torrent_hash.clone(),
            std::path::PathBuf::from(&output_path),
        )
        .await
        .map_err(|e| e.to_string())?;

    Ok(json!({
        "hash": torrent_hash.hash,
        "status": "added",
        "output_path": output_path
    }))
}

#[tauri::command]
async fn get_torrent_progress(
    hash: String,
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let torrent_client = state.torrent_client.lock().unwrap();
    if let Some(client) = torrent_client.as_ref() {
        let torrent =
            TorrentHash::new(hash, HashType::InfoHash);
        match client.get_download_progress(&torrent) {
            Ok(download) => {
                Ok(json!({
                    "hash": download.torrent_hash.hash,
                    "progress": download.progress,
                    "status": format!("{:?}", download.status),
                    "peers": download.peers,
                    "download_speed": download.download_speed
                }))
            }
            Err(e) => Err(e.to_string()),
        }
    } else {
        Err("Torrent client not initialized".to_string())
    }
}

fn main() {
    let app_state = AppState {
        identity: Mutex::new(None),
        fabric_client: Mutex::new(None),
        torrent_client: Mutex::new(None),
    };

    tauri::Builder::default()
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            generate_keypair,
            load_identity,
            save_identity,
            connect_network,
            get_channels,
            query_chaincode,
            invoke_chaincode,
            add_torrent,
            get_torrent_progress
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
