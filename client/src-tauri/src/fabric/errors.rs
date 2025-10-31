/// Error types for Fabric operations

use std::fmt;

/// Result type for Fabric operations
pub type FabricResult<T> = Result<T, FabricError>;

/// Errors that can occur during Fabric operations
#[derive(Debug, Clone)]
pub enum FabricError {
    /// Connection error to Fabric peer or orderer
    ConnectionError(String),
    
    /// Chaincode invocation failed
    ChaincodeError(String),
    
    /// Certificate parsing or validation error
    CertificateError(String),
    
    /// Channel not found or not subscribed
    ChannelNotFound(String),
    
    /// Entry not found on blockchain
    EntryNotFound(String),
    
    /// Permission denied (e.g., not entry owner)
    PermissionDenied(String),
    
    /// Transaction failed or was rejected
    TransactionFailed(String),
    
    /// Endorsement policy not satisfied
    EndorsementFailed(String),
    
    /// Validation error (input validation)
    ValidationError(String),
    
    /// Serialization/deserialization error
    SerializationError(String),
    
    /// Timeout waiting for response
    Timeout(String),
    
    /// Other error
    Other(String),
}

impl fmt::Display for FabricError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            FabricError::ConnectionError(msg) => write!(f, "Connection error: {}", msg),
            FabricError::ChaincodeError(msg) => write!(f, "Chaincode error: {}", msg),
            FabricError::CertificateError(msg) => write!(f, "Certificate error: {}", msg),
            FabricError::ChannelNotFound(msg) => write!(f, "Channel not found: {}", msg),
            FabricError::EntryNotFound(msg) => write!(f, "Entry not found: {}", msg),
            FabricError::PermissionDenied(msg) => write!(f, "Permission denied: {}", msg),
            FabricError::TransactionFailed(msg) => write!(f, "Transaction failed: {}", msg),
            FabricError::EndorsementFailed(msg) => write!(f, "Endorsement failed: {}", msg),
            FabricError::ValidationError(msg) => write!(f, "Validation error: {}", msg),
            FabricError::SerializationError(msg) => write!(f, "Serialization error: {}", msg),
            FabricError::Timeout(msg) => write!(f, "Timeout: {}", msg),
            FabricError::Other(msg) => write!(f, "Error: {}", msg),
        }
    }
}

impl std::error::Error for FabricError {}

impl From<FabricError> for String {
    fn from(err: FabricError) -> Self {
        err.to_string()
    }
}
