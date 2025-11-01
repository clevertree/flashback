use thiserror::Error;

pub type Result<T> = std::result::Result<T, FabricCoreError>;

#[derive(Debug, Error)]
pub enum FabricCoreError {
    #[error("Cryptography error: {0}")]
    CryptoError(String),

    #[error("Hyperledger Fabric error: {0}")]
    FabricError(String),

    #[error("Network error: {0}")]
    NetworkError(String),

    #[error("Torrent error: {0}")]
    TorrentError(String),

    #[error("Configuration error: {0}")]
    ConfigError(String),

    #[error("Connection error: {0}")]
    ConnectionError(String),

    #[error("Channel error: {0}")]
    ChannelError(String),

    #[error("Key management error: {0}")]
    KeyManagementError(String),

    #[error("Query error: {0}")]
    QueryError(String),

    #[error("Invocation error: {0}")]
    InvocationError(String),

    #[error("Serialization error: {0}")]
    SerializationError(#[from] serde_json::Error),

    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),

    #[error("Unknown error: {0}")]
    Unknown(String),
}
