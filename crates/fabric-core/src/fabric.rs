/// Hyperledger Fabric network interaction module
use crate::error::{Result, FabricCoreError};
use crate::crypto::FabricIdentity;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};

/// Configuration for connecting to a Hyperledger Fabric network
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FabricNetworkConfig {
    /// Network name
    pub name: String,
    /// Orderer URL(s)
    pub orderers: Vec<String>,
    /// Peer URLs
    pub peers: Vec<String>,
    /// Certificate Authority URL
    pub ca_url: String,
    /// Gateway endpoint (e.g., Kaleido)
    pub gateway_url: String,
    /// TLS certificate path for gateway
    pub tls_cert_path: Option<String>,
}

/// Represents a channel in the Hyperledger Fabric network
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FabricChannel {
    pub id: String,
    pub name: String,
    pub description: String,
    pub chaincode_id: String,
}

impl FabricChannel {
    pub fn new(
        id: String,
        name: String,
        description: String,
        chaincode_id: String,
    ) -> Self {
        Self {
            id,
            name,
            description,
            chaincode_id,
        }
    }
}

/// Chaincode query/invoke parameter
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChaincodeArg {
    pub key: String,
    pub value: serde_json::Value,
}

/// Transaction result from chaincode invocation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransactionResult {
    pub transaction_id: String,
    pub status: String,
    pub payload: serde_json::Value,
    pub timestamp: String,
}

/// Trait for Fabric network operations
#[async_trait]
pub trait FabricNetworkClient: Send + Sync {
    /// Connect to the network
    async fn connect(&mut self, identity: &FabricIdentity) -> Result<()>;

    /// Disconnect from the network
    async fn disconnect(&mut self) -> Result<()>;

    /// Get all available channels
    async fn get_channels(&self) -> Result<Vec<FabricChannel>>;

    /// Query chaincode
    async fn query_chaincode(
        &self,
        channel_id: &str,
        chaincode_id: &str,
        function: &str,
        _args: Vec<String>,
    ) -> Result<serde_json::Value>;

    /// Invoke chaincode (submit transaction)
    async fn invoke_chaincode(
        &self,
        channel_id: &str,
        chaincode_id: &str,
        function: &str,
        _args: Vec<String>,
    ) -> Result<TransactionResult>;

    /// Get transaction history
    async fn get_transaction_history(
        &self,
        channel_id: &str,
        chaincode_id: &str,
    ) -> Result<Vec<TransactionResult>>;
}

/// Default implementation for Kaleido-based Hyperledger Fabric network
pub struct KaleidoFabricClient {
    config: FabricNetworkConfig,
    connected: bool,
    identity: Option<FabricIdentity>,
    http_client: Option<reqwest::Client>,
}

impl KaleidoFabricClient {
    pub fn new(config: FabricNetworkConfig) -> Self {
        Self {
            config,
            connected: false,
            identity: None,
            http_client: None,
        }
    }

    /// Initialize a new Kaleido client with default config
    pub fn from_kaleido_endpoint(
        gateway_url: &str,
        ca_url: &str,
    ) -> Self {
        let config = FabricNetworkConfig {
            name: "Kaleido Network".to_string(),
            orderers: vec![format!("{}/orderer", gateway_url)],
            peers: vec![format!("{}/peer", gateway_url)],
            ca_url: ca_url.to_string(),
            gateway_url: gateway_url.to_string(),
            tls_cert_path: None,
        };

        Self::new(config)
    }

    /// Get the network configuration
    pub fn config(&self) -> &FabricNetworkConfig {
        &self.config
    }

    /// Check if connected
    pub fn is_connected(&self) -> bool {
        self.connected
    }
}

#[async_trait]
impl FabricNetworkClient for KaleidoFabricClient {
    async fn connect(&mut self, identity: &FabricIdentity) -> Result<()> {
        // Validate identity
        identity.validate()?;

        // Initialize HTTP client
        self.http_client = Some(reqwest::Client::new());
        self.identity = Some(identity.clone());
        self.connected = true;

        tracing::info!(
            "Connected to Hyperledger network: {}",
            self.config.name
        );
        Ok(())
    }

    async fn disconnect(&mut self) -> Result<()> {
        self.connected = false;
        self.identity = None;
        self.http_client = None;

        tracing::info!("Disconnected from Hyperledger network");
        Ok(())
    }

    async fn get_channels(&self) -> Result<Vec<FabricChannel>> {
        if !self.connected {
            return Err(FabricCoreError::ConnectionError(
                "Not connected to network".to_string(),
            ));
        }

        // Return predefined channels for the use case
        let channels = vec![
            FabricChannel::new(
                "movies".to_string(),
                "Movies".to_string(),
                "Movie database and torrent hashes".to_string(),
                "movie-chaincode".to_string(),
            ),
            FabricChannel::new(
                "tv-shows".to_string(),
                "TV Shows".to_string(),
                "TV show database and torrent hashes".to_string(),
                "tvshow-chaincode".to_string(),
            ),
            FabricChannel::new(
                "games".to_string(),
                "Games".to_string(),
                "Game database and torrent hashes".to_string(),
                "game-chaincode".to_string(),
            ),
            FabricChannel::new(
                "voting".to_string(),
                "Voting".to_string(),
                "Voting and consensus mechanism".to_string(),
                "voting-chaincode".to_string(),
            ),
        ];

        tracing::debug!("Retrieved {} channels", channels.len());
        Ok(channels)
    }

    async fn query_chaincode(
        &self,
        channel_id: &str,
        chaincode_id: &str,
        function: &str,
        args: Vec<String>,
    ) -> Result<serde_json::Value> {
        if !self.connected {
            return Err(FabricCoreError::ConnectionError(
                "Not connected to network".to_string(),
            ));
        }

        let http_client = self.http_client.as_ref().ok_or(FabricCoreError::ConnectionError(
            "HTTP client not initialized".to_string(),
        ))?;

        // Build Kaleido REST API URL for query
        let query_url = format!(
            "{}/channels/{}/chaincodes/{}/{}",
            self.config.gateway_url.trim_end_matches('/'),
            channel_id,
            chaincode_id,
            function
        );

        // Build query request body
        let request_body = serde_json::json!({
            "args": args,
            "sync": true,
        });

        tracing::debug!(
            "Querying chaincode: channel={}, id={}, function={}, url={}",
            channel_id,
            chaincode_id,
            function,
            query_url
        );

        // Make HTTP request to Kaleido
        let response = http_client
            .post(&query_url)
            .json(&request_body)
            .send()
            .await
            .map_err(|e| FabricCoreError::QueryError(e.to_string()))?;

        let status = response.status();
        if !status.is_success() {
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            return Err(FabricCoreError::QueryError(format!(
                "Query failed with status {}: {}",
                status, error_text
            )));
        }

        let result = response
            .json::<serde_json::Value>()
            .await
            .map_err(|e| FabricCoreError::QueryError(e.to_string()))?;

        tracing::debug!("Query successful: {:?}", result);
        Ok(result)
    }

    async fn invoke_chaincode(
        &self,
        channel_id: &str,
        chaincode_id: &str,
        function: &str,
        args: Vec<String>,
    ) -> Result<TransactionResult> {
        if !self.connected {
            return Err(FabricCoreError::ConnectionError(
                "Not connected to network".to_string(),
            ));
        }

        let http_client = self.http_client.as_ref().ok_or(FabricCoreError::ConnectionError(
            "HTTP client not initialized".to_string(),
        ))?;

        // Build Kaleido REST API URL for invocation
        let invoke_url = format!(
            "{}/channels/{}/chaincodes/{}/{}",
            self.config.gateway_url.trim_end_matches('/'),
            channel_id,
            chaincode_id,
            function
        );

        // Build invoke request body
        let request_body = serde_json::json!({
            "args": args,
            "sync": true,
            "private_data": {},
        });

        tracing::info!(
            "Invoking chaincode: channel={}, id={}, function={}, url={}",
            channel_id,
            chaincode_id,
            function,
            invoke_url
        );

        // Make HTTP request to Kaleido
        let response = http_client
            .post(&invoke_url)
            .json(&request_body)
            .send()
            .await
            .map_err(|e| FabricCoreError::InvocationError(e.to_string()))?;

        let status = response.status();
        if !status.is_success() {
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            return Err(FabricCoreError::InvocationError(format!(
                "Invocation failed with status {}: {}",
                status, error_text
            )));
        }

        let result = response
            .json::<serde_json::Value>()
            .await
            .map_err(|e| FabricCoreError::InvocationError(e.to_string()))?;

        // Extract transaction ID from response
        let transaction_id = result
            .get("transactionId")
            .or_else(|| result.get("txn_id"))
            .or_else(|| result.get("id"))
            .and_then(|v| v.as_str())
            .unwrap_or(&uuid::Uuid::new_v4().to_string())
            .to_string();

        let payload = result
            .get("result")
            .or_else(|| result.get("payload"))
            .cloned()
            .unwrap_or_else(|| result.clone());

        tracing::info!(
            "Invocation successful: txn_id={}, status={}",
            transaction_id,
            "SUCCESS"
        );

        Ok(TransactionResult {
            transaction_id,
            status: "SUCCESS".to_string(),
            payload,
            timestamp: chrono::Utc::now().to_rfc3339(),
        })
    }

    async fn get_transaction_history(
        &self,
        channel_id: &str,
        chaincode_id: &str,
    ) -> Result<Vec<TransactionResult>> {
        if !self.connected {
            return Err(FabricCoreError::ConnectionError(
                "Not connected to network".to_string(),
            ));
        }

        tracing::debug!(
            "Fetching transaction history: channel={}, chaincode={}",
            channel_id,
            chaincode_id
        );

        Ok(Vec::new())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_channel_creation() {
        let channel = FabricChannel::new(
            "ch1".to_string(),
            "Channel 1".to_string(),
            "Test channel".to_string(),
            "cc1".to_string(),
        );

        assert_eq!(channel.name, "Channel 1");
        assert_eq!(channel.id, "ch1");
    }

    #[test]
    fn test_kaleido_client_creation() {
        let client =
            KaleidoFabricClient::from_kaleido_endpoint(
                "https://api.kaleido.io",
                "https://ca.kaleido.io",
            );

        assert!(!client.is_connected());
    }
}
