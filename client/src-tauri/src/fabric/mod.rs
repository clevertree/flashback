/// Hyperledger Fabric SDK Integration
/// 
/// This module provides a bridge between Tauri commands and the Hyperledger Fabric network.
/// It handles:
/// - Connection management to Fabric peers and orderers
/// - Certificate extraction from X.509 certificates
/// - Chaincode query and invoke operations
/// - Event listening and block processing
/// 
/// Architecture:
/// Tauri Commands (fabric.rs)
///   ↓ (call)
/// Fabric Client (fabric/client.rs)
///   ↓ (uses)
/// Fabric SDK / gRPC
///   ↓ (connects to)
/// Hyperledger Fabric Network

pub mod client;
pub mod certificate;
pub mod errors;

pub use client::{FabricClient, FabricConfig};
pub use certificate::CertificateManager;
pub use errors::{FabricError, FabricResult};
