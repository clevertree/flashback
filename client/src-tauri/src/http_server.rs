use axum::{
    extract::{Path, State},
    http::{header, StatusCode},
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::fs;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileInfo {
    pub name: String,
    #[serde(rename = "type")]
    pub file_type: String,
    pub size: Option<u64>,
    pub modified: Option<String>,
}

#[derive(Clone)]
pub struct HttpServerState {
    pub root_directory: Arc<PathBuf>,
}

pub async fn start_http_server(
    root_directory: String,
    _port: u16,
) -> Result<u16, Box<dyn std::error::Error>> {
    if root_directory.is_empty() {
        return Err("Root directory not configured".into());
    }

    let root_path = PathBuf::from(&root_directory);

    // Verify the directory exists or create it
    if !root_path.exists() {
        fs::create_dir_all(&root_path)
            .await
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    // Create index.md if it doesn't exist
    let index_path = root_path.join("index.md");
    if !index_path.exists() {
        let default_content = "# Welcome to File Sharing\n\nThis is the root directory for file sharing.";
        fs::write(&index_path, default_content)
            .await
            .map_err(|e| format!("Failed to create index.md: {}", e))?;
    }

    let state = HttpServerState {
        root_directory: Arc::new(root_path),
    };

    let app = Router::new()
        .route("/api/files", get(list_files_root))
        .route("/api/files/*path", get(list_files_path))
        .route("/content/*path", get(get_file_content))
        .route("/download/*path", get(download_file))
        .with_state(state);

    // Bind to any available port on localhost (0 means OS chooses)
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .map_err(|e| format!("Failed to bind HTTP listener: {}", e))?;

    let actual_port = listener.local_addr().unwrap().port();
    println!("HTTP file server listening on 127.0.0.1:{}", actual_port);

    tokio::spawn(async move {
        if let Err(e) = axum::serve(listener, app).await {
            println!("HTTP server error: {}", e);
        }
    });

    Ok(actual_port)
}

async fn list_files_root(
    State(state): State<HttpServerState>,
) -> impl IntoResponse {
    list_files_internal(&state, "").await
}

async fn list_files_path(
    Path(path): Path<String>,
    State(state): State<HttpServerState>,
) -> impl IntoResponse {
    list_files_internal(&state, &path).await
}

async fn list_files_internal(
    state: &HttpServerState,
    path: &str,
) -> impl IntoResponse {
    let dir_path = if path.is_empty() {
        state.root_directory.as_ref().clone()
    } else {
        state.root_directory.join(path)
    };

    // Security check: ensure the resolved path is within the root directory
    if !is_within_root(&dir_path, &state.root_directory) {
        return (StatusCode::FORBIDDEN, Json(Vec::<FileInfo>::new())).into_response();
    }

    match fs::read_dir(&dir_path).await {
        Ok(mut entries) => {
            let mut files = Vec::new();
            while let Ok(Some(entry)) = entries.next_entry().await {
                if let Ok(metadata) = entry.metadata().await {
                    let file_name = entry.file_name();
                    let name = file_name.to_string_lossy().to_string();
                    let file_type = if metadata.is_dir() { "directory" } else { "file" };
                    let size = if metadata.is_file() {
                        Some(metadata.len())
                    } else {
                        None
                    };
                    let modified = metadata
                        .modified()
                        .ok()
                        .and_then(|t| {
                            let duration = t
                                .duration_since(std::time::UNIX_EPOCH)
                                .ok()?;
                            Some(duration.as_secs().to_string())
                        });

                    files.push(FileInfo {
                        name,
                        file_type: file_type.to_string(),
                        size,
                        modified,
                    });
                }
            }
            (StatusCode::OK, Json(files)).into_response()
        }
        Err(_) => (StatusCode::NOT_FOUND, Json(Vec::<FileInfo>::new())).into_response(),
    }
}

async fn get_file_content(
    Path(path): Path<String>,
    State(state): State<HttpServerState>,
) -> impl IntoResponse {
    let file_path = state.root_directory.join(&path);

    // Security check: ensure the resolved path is within the root directory
    if !is_within_root(&file_path, &state.root_directory) {
        return (StatusCode::FORBIDDEN, "Access denied").into_response();
    }

    match fs::read_to_string(&file_path).await {
        Ok(content) => (StatusCode::OK, content).into_response(),
        Err(_) => (StatusCode::NOT_FOUND, "File not found").into_response(),
    }
}

async fn download_file(
    Path(path): Path<String>,
    State(state): State<HttpServerState>,
) -> impl IntoResponse {
    let file_path = state.root_directory.join(&path);

    // Security check: ensure the resolved path is within the root directory
    if !is_within_root(&file_path, &state.root_directory) {
        return (StatusCode::FORBIDDEN, "Access denied").into_response();
    }

    match fs::read(&file_path).await {
        Ok(content) => {
            let filename = file_path.file_name().unwrap_or_default().to_string_lossy();
            (
                [
                    (header::CONTENT_TYPE, "application/octet-stream".to_string()),
                    (
                        header::CONTENT_DISPOSITION,
                        format!("attachment; filename=\"{}\"", filename),
                    ),
                ],
                content,
            )
                .into_response()
        }
        Err(_) => (StatusCode::NOT_FOUND, Vec::<u8>::new()).into_response(),
    }
}

/// Ensure a path is within the root directory (prevent directory traversal)
fn is_within_root(path: &PathBuf, root: &PathBuf) -> bool {
    match (path.canonicalize(), root.canonicalize()) {
        (Ok(p), Ok(r)) => p.starts_with(&r),
        _ => false,
    }
}
