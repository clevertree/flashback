/// Hyperledger Fabric Client
/// 
/// Provides a high-level interface to interact with Fabric network
/// for querying and invoking chaincode.

use crate::fabric::errors::{FabricError, FabricResult};
use crate::fabric::certificate::{CertificateInfo, CertificateManager};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Configuration for Fabric client
#[derive(Debug, Clone)]
pub struct FabricConfig {
    /// Organization name (e.g., "bootstrap-org")
    pub org_name: String,
    
    /// MSP ID (e.g., "bootstrap-orgMSP")
    pub msp_id: String,
    
    /// Path to wallet directory
    pub wallet_path: String,
    
    /// Path to certificate file
    pub cert_path: String,
    
    /// Path to private key file
    pub key_path: String,
    
    /// Peer addresses (e.g., ["peer0.org:7051", "peer1.org:7051"])
    pub peer_addresses: Vec<String>,
    
    /// Orderer address (e.g., "orderer.org:7050")
    pub orderer_address: String,
    
    /// Connection timeout in seconds
    pub timeout_seconds: u64,
}

impl Default for FabricConfig {
    fn default() -> Self {
        Self {
            org_name: "bootstrap-org".to_string(),
            msp_id: "bootstrap-orgMSP".to_string(),
            wallet_path: "./.fabric-wallet".to_string(),
            cert_path: "./certificate.pem".to_string(),
            key_path: "./private.key".to_string(),
            peer_addresses: vec![
                "localhost:7051".to_string(),
                "localhost:7052".to_string(),
                "localhost:7053".to_string(),
            ],
            orderer_address: "localhost:7050".to_string(),
            timeout_seconds: 30,
        }
    }
}

/// Entry from Fabric ledger (parsed response)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FabricEntry {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub creator: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
    pub tags: Option<Vec<String>>,
    pub torrent_hash: Option<String>,
}

/// Comment from Fabric ledger (parsed response)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FabricComment {
    pub id: String,
    pub entry_id: String,
    pub content: String,
    pub rating: Option<u32>,
    pub commented_by: String,
    pub created_at: String,
    pub updated_at: Option<String>,
    pub status: String,
    pub edit_count: Option<usize>,
}

/// Fabric client for network operations
pub struct FabricClient {
    config: FabricConfig,
    certificate: Arc<RwLock<Option<CertificateInfo>>>,
    connected_channels: Arc<RwLock<HashMap<String, bool>>>,
}

impl FabricClient {
    /// Create new Fabric client with given configuration
    pub fn new(config: FabricConfig) -> Self {
        Self {
            config,
            certificate: Arc::new(RwLock::new(None)),
            connected_channels: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Connect to Fabric network and load certificate
    pub async fn connect(&self) -> FabricResult<()> {
        log::info!("Connecting to Fabric network: {}", self.config.org_name);

        // Load and parse certificate
        let cert_info = CertificateManager::get_email_from_file(&self.config.cert_path)
            .map(|email| CertificateInfo {
                email,
                common_name: None,
                organization: Some(self.config.org_name.clone()),
                pem: String::new(),
                fingerprint: String::new(),
            })?;

        log::info!("Loaded certificate for: {}", cert_info.email);

        let mut cert_lock = self.certificate.write().await;
        *cert_lock = Some(cert_info);

        log::info!("Connected to Fabric network");
        Ok(())
    }

    /// Get the caller's email from certificate
    pub async fn get_caller_email(&self) -> FabricResult<String> {
        let cert_lock = self.certificate.read().await;
        cert_lock
            .as_ref()
            .map(|c| c.email.clone())
            .ok_or_else(|| FabricError::CertificateError("Not connected - no certificate loaded".to_string()))
    }

    /// Join a channel (subscribe)
    pub async fn join_channel(&self, channel: &str) -> FabricResult<()> {
        log::info!("Joining channel: {}", channel);

        // In production, would call fabric-admin to join channel
        // For now, just track locally
        let mut channels = self.connected_channels.write().await;
        channels.insert(channel.to_string(), true);

        log::info!("Joined channel: {}", channel);
        Ok(())
    }

    /// Leave a channel (unsubscribe)
    pub async fn leave_channel(&self, channel: &str) -> FabricResult<()> {
        log::info!("Leaving channel: {}", channel);

        let mut channels = self.connected_channels.write().await;
        channels.remove(channel);

        log::info!("Left channel: {}", channel);
        Ok(())
    }

    /// Query entries from a channel
    pub async fn query_entries(
        &self,
        channel: &str,
        query: Option<&str>,
        tags: Option<&[String]>,
    ) -> FabricResult<Vec<FabricEntry>> {
        self.verify_channel_access(channel).await?;

        log::info!(
            "Querying entries on channel: {} (query: {:?}, tags: {:?})",
            channel,
            query,
            tags
        );

        // TODO: Replace with real Fabric SDK call
        // Will call chaincode: repo-manager.js queryEntries() function
        // Format: queryEntries(channel, query, tags, limit, offset)

        // For now, return empty (placeholder)
        log::debug!("QueryEntries would call Fabric SDK here");
        Ok(vec![])
    }

    /// Get single entry by ID
    pub async fn get_entry(&self, channel: &str, entry_id: &str) -> FabricResult<FabricEntry> {
        self.verify_channel_access(channel).await?;

        log::info!("Getting entry {} from channel: {}", entry_id, channel);

        // TODO: Replace with real Fabric SDK call
        // Will call chaincode: repo-manager.js getEntry(entryId)

        Err(FabricError::EntryNotFound(format!(
            "Entry {} not found (SDK not yet integrated)",
            entry_id
        )))
    }

    /// Query comments for an entry
    pub async fn query_comments(
        &self,
        channel: &str,
        entry_id: &str,
    ) -> FabricResult<Vec<FabricComment>> {
        self.verify_channel_access(channel).await?;

        log::info!(
            "Querying comments for entry {} on channel: {}",
            entry_id,
            channel
        );

        // TODO: Replace with real Fabric SDK call
        // Will call chaincode: repo-manager.js queryComments(entryId)

        log::debug!("QueryComments would call Fabric SDK here");
        Ok(vec![])
    }

    /// Invoke chaincode to add entry
    pub async fn add_entry(
        &self,
        channel: &str,
        title: &str,
        description: Option<&str>,
        tags: Option<&[String]>,
    ) -> FabricResult<String> {
        self.verify_channel_access(channel).await?;
        let caller_email = self.get_caller_email().await?;

        log::info!(
            "Adding entry to channel: {} (title: {}, creator: {})",
            channel,
            title,
            caller_email
        );

        // TODO: Replace with real Fabric SDK call
        // Will invoke chaincode: repo-manager.js addEntry(title, description, tags, creator)
        // Creator extracted from certificate email

        let entry_id = format!("entry:{}", uuid::Uuid::new_v4());
        log::debug!("Created entry ID: {}", entry_id);
        Ok(entry_id)
    }

    /// Invoke chaincode to add comment
    pub async fn add_comment(
        &self,
        channel: &str,
        entry_id: &str,
        content: &str,
        rating: Option<u32>,
    ) -> FabricResult<String> {
        self.verify_channel_access(channel).await?;
        let caller_email = self.get_caller_email().await?;

        log::info!(
            "Adding comment to entry {} on channel: {} (creator: {})",
            entry_id,
            channel,
            caller_email
        );

        // TODO: Replace with real Fabric SDK call
        // Will invoke chaincode: repo-manager.js addComment(entryId, content, rating, commentedBy)
        // commentedBy extracted from certificate email

        let comment_id = format!("comment:{}", uuid::Uuid::new_v4());
        log::debug!("Created comment ID: {}", comment_id);
        Ok(comment_id)
    }

    /// Update entry (must be owner or admin)
    pub async fn update_entry(
        &self,
        channel: &str,
        entry_id: &str,
        title: Option<&str>,
        description: Option<&str>,
        tags: Option<&[String]>,
    ) -> FabricResult<()> {
        self.verify_channel_access(channel).await?;
        let caller_email = self.get_caller_email().await?;

        log::info!(
            "Updating entry {} on channel: {} (caller: {})",
            entry_id,
            channel,
            caller_email
        );

        // TODO: Replace with real Fabric SDK call
        // Will invoke chaincode: repo-manager.js updateEntry(entryId, title, description, tags)
        // Chaincode verifies caller is owner or has admin capability

        log::debug!("Entry would be updated via Fabric SDK");
        Ok(())
    }

    /// Delete entry (mark as deleted, not erased)
    pub async fn delete_entry(
        &self,
        channel: &str,
        entry_id: &str,
        reason: Option<&str>,
    ) -> FabricResult<()> {
        self.verify_channel_access(channel).await?;
        let caller_email = self.get_caller_email().await?;

        log::info!(
            "Deleting entry {} on channel: {} (reason: {:?})",
            entry_id,
            channel,
            reason
        );

        // TODO: Replace with real Fabric SDK call
        // Will invoke chaincode: repo-manager.js deleteEntry(entryId, deletedBy, reason)
        // Mark entry as deleted (preserves immutability)

        log::debug!("Entry would be marked deleted via Fabric SDK");
        Ok(())
    }

    /// Update comment (must be owner or admin)
    pub async fn update_comment(
        &self,
        channel: &str,
        entry_id: &str,
        comment_id: &str,
        content: Option<&str>,
        rating: Option<u32>,
    ) -> FabricResult<()> {
        self.verify_channel_access(channel).await?;
        let caller_email = self.get_caller_email().await?;

        log::info!(
            "Updating comment {} on entry {} (caller: {})",
            comment_id,
            entry_id,
            caller_email
        );

        // TODO: Replace with real Fabric SDK call
        // Will invoke chaincode: repo-manager.js updateComment(commentId, content, rating, updatedBy)
        // Chaincode verifies caller is owner and increments editCount

        log::debug!("Comment would be updated via Fabric SDK");
        Ok(())
    }

    /// Delete comment (mark as deleted)
    pub async fn delete_comment(
        &self,
        channel: &str,
        entry_id: &str,
        comment_id: &str,
        reason: Option<&str>,
    ) -> FabricResult<()> {
        self.verify_channel_access(channel).await?;
        let caller_email = self.get_caller_email().await?;

        log::info!(
            "Deleting comment {} on entry {} (caller: {})",
            comment_id,
            entry_id,
            caller_email
        );

        // TODO: Replace with real Fabric SDK call
        // Will invoke chaincode: repo-manager.js deleteComment(commentId, deletedBy, reason)

        log::debug!("Comment would be marked deleted via Fabric SDK");
        Ok(())
    }

    // Helper functions

    async fn verify_channel_access(&self, channel: &str) -> FabricResult<()> {
        let channels = self.connected_channels.read().await;
        if !channels.contains_key(channel) {
            return Err(FabricError::ChannelNotFound(format!(
                "Not subscribed to channel: {}",
                channel
            )));
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_fabric_client_creation() {
        let config = FabricConfig::default();
        let client = FabricClient::new(config);
        assert!(client.connected_channels.read().await.is_empty());
    }

    #[tokio::test]
    async fn test_channel_join_leave() {
        let config = FabricConfig::default();
        let client = FabricClient::new(config);

        // Join channel
        let result = client.join_channel("movies").await;
        assert!(result.is_ok());

        // Verify joined
        let channels = client.connected_channels.read().await;
        assert!(channels.contains_key("movies"));
    }
}
