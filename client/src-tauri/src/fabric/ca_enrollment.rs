/// Fabric CA Enrollment and Certificate Management
/// 
/// Handles enrollment with Fabric Certificate Authority,
/// certificate storage, and renewal logic.

use crate::fabric::errors::{FabricError, FabricResult};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use chrono::{DateTime, Duration, Utc};
use sha2::{Digest, Sha256};

/// CA Enrollment Request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnrollmentRequest {
    /// Username for enrollment
    pub username: String,
    
    /// Password for enrollment
    pub password: String,
    
    /// Organization name
    pub org_name: String,
    
    /// Organization domain
    pub org_domain: String,
    
    /// CA URL
    pub ca_url: String,
}

/// CA Enrollment Response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnrollmentResponse {
    /// Enrollment certificate (PEM format)
    pub certificate: String,
    
    /// Private key (PEM format)
    pub private_key: String,
    
    /// CA certificate chain (PEM format)
    pub ca_cert_chain: String,
    
    /// Enrollment ID
    pub enrollment_id: String,
}

/// Certificate Storage Information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredCertificate {
    /// Certificate path
    pub cert_path: PathBuf,
    
    /// Private key path
    pub key_path: PathBuf,
    
    /// CA cert path
    pub ca_cert_path: PathBuf,
    
    /// Certificate expiry timestamp
    pub expires_at: DateTime<Utc>,
    
    /// Enrollment ID
    pub enrollment_id: String,
    
    /// Username
    pub username: String,
    
    /// Organization
    pub organization: String,
}

/// Certificate Manager for Fabric CA interactions
pub struct CAEnrollmentManager {
    wallet_path: PathBuf,
}

impl CAEnrollmentManager {
    /// Create new CA enrollment manager
    pub fn new(wallet_path: impl AsRef<Path>) -> Self {
        Self {
            wallet_path: wallet_path.as_ref().to_path_buf(),
        }
    }

    /// Enroll user with Fabric CA
    /// 
    /// # Arguments
    /// - `request`: Enrollment request with CA details
    /// 
    /// # Returns
    /// Enrollment response with certificate and key
    pub async fn enroll(
        &self,
        request: EnrollmentRequest,
    ) -> FabricResult<EnrollmentResponse> {
        log::info!("Enrolling user {} with CA at {}", request.username, request.ca_url);

        // Create HTTP client
        let client = reqwest::Client::new();

        // Prepare enrollment request
        let enroll_url = format!("{}/api/v1/enroll", request.ca_url.trim_end_matches('/'));

        // Create enrollment payload
        let payload = serde_json::json!({
            "enrollmentID": request.username,
            "enrollmentSecret": request.password,
            "certificate_request": {}
        });

        // Send enrollment request
        let response = client
            .post(&enroll_url)
            .basic_auth(&request.username, Some(&request.password))
            .json(&payload)
            .send()
            .await
            .map_err(|e| {
                FabricError::CertificateError(format!("CA enrollment request failed: {}", e))
            })?;

        if !response.status().is_success() {
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            return Err(FabricError::CertificateError(format!(
                "CA enrollment failed: {}",
                error_text
            )));
        }

        // Parse enrollment response
        let enroll_response: serde_json::Value = response.json().await.map_err(|e| {
            FabricError::CertificateError(format!("Failed to parse CA response: {}", e))
        })?;

        // Extract certificate and key
        let certificate = enroll_response["result"]["Cert"]
            .as_str()
            .ok_or_else(|| {
                FabricError::CertificateError("No certificate in CA response".to_string())
            })?
            .to_string();

        let private_key = enroll_response["result"]["SK"]
            .as_str()
            .ok_or_else(|| {
                FabricError::CertificateError("No private key in CA response".to_string())
            })?
            .to_string();

        let ca_cert_chain = enroll_response["result"]["CAName"]
            .as_str()
            .unwrap_or("")
            .to_string();

        log::info!(
            "Successfully enrolled user {} with certificate",
            request.username
        );

        Ok(EnrollmentResponse {
            certificate,
            private_key,
            ca_cert_chain,
            enrollment_id: request.username,
        })
    }

    /// Store enrolled certificate and key securely
    /// 
    /// # Arguments
    /// - `username`: Username
    /// - `org_name`: Organization name
    /// - `enrollment_response`: Response from CA
    /// - `expires_at`: Certificate expiry time
    /// 
    /// # Returns
    /// Path to stored certificate
    pub fn store_certificate(
        &self,
        username: &str,
        org_name: &str,
        enrollment_response: EnrollmentResponse,
        expires_at: DateTime<Utc>,
    ) -> FabricResult<StoredCertificate> {
        // Create wallet directory if not exists
        fs::create_dir_all(&self.wallet_path).map_err(|e| {
            FabricError::CertificateError(format!("Failed to create wallet directory: {}", e))
        })?;

        // Create user-specific directory
        let user_path = self
            .wallet_path
            .join(org_name)
            .join("users")
            .join(format!("{}@{}", username, org_name));
        fs::create_dir_all(&user_path).map_err(|e| {
            FabricError::CertificateError(format!("Failed to create user directory: {}", e))
        })?;

        // Store certificate
        let cert_path = user_path.join("certificate.pem");
        fs::write(&cert_path, &enrollment_response.certificate).map_err(|e| {
            FabricError::CertificateError(format!("Failed to write certificate: {}", e))
        })?;

        // Store private key with restricted permissions
        let key_path = user_path.join("private_key.pem");
        fs::write(&key_path, &enrollment_response.private_key).map_err(|e| {
            FabricError::CertificateError(format!("Failed to write private key: {}", e))
        })?;

        // Set restrictive permissions on private key (Unix only)
        #[cfg(unix)]
        {
            use std::fs::Permissions;
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&key_path, Permissions::from_mode(0o600)).map_err(|e| {
                FabricError::CertificateError(format!("Failed to set key permissions: {}", e))
            })?;
        }

        // Store CA certificate chain
        let ca_cert_path = user_path.join("ca_cert.pem");
        fs::write(&ca_cert_path, &enrollment_response.ca_cert_chain).map_err(|e| {
            FabricError::CertificateError(format!("Failed to write CA cert: {}", e))
        })?;

        log::info!(
            "Certificate stored for user {} at {:?}",
            username,
            cert_path
        );

        Ok(StoredCertificate {
            cert_path,
            key_path,
            ca_cert_path,
            expires_at,
            enrollment_id: enrollment_response.enrollment_id,
            username: username.to_string(),
            organization: org_name.to_string(),
        })
    }

    /// Load certificate from storage
    /// 
    /// # Arguments
    /// - `username`: Username
    /// - `org_name`: Organization name
    /// 
    /// # Returns
    /// Stored certificate info and contents
    pub fn load_certificate(
        &self,
        username: &str,
        org_name: &str,
    ) -> FabricResult<(StoredCertificate, String, String)> {
        let user_path = self
            .wallet_path
            .join(org_name)
            .join("users")
            .join(format!("{}@{}", username, org_name));

        let cert_path = user_path.join("certificate.pem");
        let key_path = user_path.join("private_key.pem");
        let ca_cert_path = user_path.join("ca_cert.pem");

        if !cert_path.exists() {
            return Err(FabricError::CertificateError(
                format!("Certificate not found for user {}", username),
            ));
        }

        let certificate = fs::read_to_string(&cert_path).map_err(|e| {
            FabricError::CertificateError(format!("Failed to read certificate: {}", e))
        })?;

        let private_key = fs::read_to_string(&key_path).map_err(|e| {
            FabricError::CertificateError(format!("Failed to read private key: {}", e))
        })?;

        log::info!("Certificate loaded for user {} from {:?}", username, cert_path);

        Ok((
            StoredCertificate {
                cert_path,
                key_path,
                ca_cert_path,
                expires_at: Utc::now() + Duration::days(365),
                enrollment_id: username.to_string(),
                username: username.to_string(),
                organization: org_name.to_string(),
            },
            certificate,
            private_key,
        ))
    }

    /// Check if certificate needs renewal
    /// Renewal is needed if expiring within 30 days
    pub fn needs_renewal(stored_cert: &StoredCertificate) -> bool {
        let renewal_threshold = Utc::now() + Duration::days(30);
        stored_cert.expires_at <= renewal_threshold
    }

    /// Re-enroll user to get new certificate
    pub async fn renew_certificate(
        &self,
        username: &str,
        org_name: &str,
        request: EnrollmentRequest,
    ) -> FabricResult<StoredCertificate> {
        log::info!("Renewing certificate for user {}", username);

        // Perform re-enrollment
        let enrollment_response = self.enroll(request).await?;

        // Store new certificate with future expiry
        let expires_at = Utc::now() + Duration::days(365);
        self.store_certificate(username, org_name, enrollment_response, expires_at)
    }

    /// Delete certificate from storage
    pub fn delete_certificate(&self, username: &str, org_name: &str) -> FabricResult<()> {
        let user_path = self
            .wallet_path
            .join(org_name)
            .join("users")
            .join(format!("{}@{}", username, org_name));

        if user_path.exists() {
            fs::remove_dir_all(&user_path).map_err(|e| {
                FabricError::CertificateError(format!("Failed to delete certificate: {}", e))
            })?;
            log::info!("Certificate deleted for user {}", username);
        }

        Ok(())
    }

    /// List all stored certificates
    pub fn list_certificates(&self) -> FabricResult<Vec<StoredCertificate>> {
        let mut certificates = Vec::new();

        if !self.wallet_path.exists() {
            return Ok(certificates);
        }

        // Iterate through wallet directory
        for org_entry in fs::read_dir(&self.wallet_path)
            .map_err(|e| FabricError::CertificateError(format!("Failed to read wallet: {}", e)))?
        {
            let org_entry = org_entry.map_err(|e| {
                FabricError::CertificateError(format!("Failed to read org entry: {}", e))
            })?;

            let org_name = org_entry
                .file_name()
                .into_string()
                .unwrap_or_default();
            let users_path = org_entry.path().join("users");

            if users_path.exists() {
                for user_entry in fs::read_dir(&users_path)
                    .map_err(|e| {
                        FabricError::CertificateError(format!("Failed to read users: {}", e))
                    })?
                {
                    let user_entry = user_entry.map_err(|e| {
                        FabricError::CertificateError(format!("Failed to read user entry: {}", e))
                    })?;

                    let cert_path = user_entry.path().join("certificate.pem");
                    let key_path = user_entry.path().join("private_key.pem");
                    let ca_cert_path = user_entry.path().join("ca_cert.pem");

                    if cert_path.exists() {
                        let username = user_entry.file_name().into_string().unwrap_or_default();
                        certificates.push(StoredCertificate {
                            cert_path,
                            key_path,
                            ca_cert_path,
                            expires_at: Utc::now() + Duration::days(365),
                            enrollment_id: username.clone(),
                            username,
                            organization: org_name.clone(),
                        });
                    }
                }
            }
        }

        Ok(certificates)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_enrollment_request_creation() {
        let req = EnrollmentRequest {
            username: "admin".to_string(),
            password: "adminpw".to_string(),
            org_name: "org1".to_string(),
            org_domain: "org1.flashback.local".to_string(),
            ca_url: "http://localhost:7054".to_string(),
        };

        assert_eq!(req.username, "admin");
        assert_eq!(req.ca_url, "http://localhost:7054");
    }

    #[test]
    fn test_needs_renewal_returns_true_when_close_to_expiry() {
        let cert = StoredCertificate {
            cert_path: PathBuf::from("/tmp/cert.pem"),
            key_path: PathBuf::from("/tmp/key.pem"),
            ca_cert_path: PathBuf::from("/tmp/ca.pem"),
            expires_at: Utc::now() + Duration::days(15), // Within 30-day threshold
            enrollment_id: "user".to_string(),
            username: "user".to_string(),
            organization: "org".to_string(),
        };

        assert!(CAEnrollmentManager::needs_renewal(&cert));
    }

    #[test]
    fn test_needs_renewal_returns_false_when_far_from_expiry() {
        let cert = StoredCertificate {
            cert_path: PathBuf::from("/tmp/cert.pem"),
            key_path: PathBuf::from("/tmp/key.pem"),
            ca_cert_path: PathBuf::from("/tmp/ca.pem"),
            expires_at: Utc::now() + Duration::days(90), // Well beyond 30-day threshold
            enrollment_id: "user".to_string(),
            username: "user".to_string(),
            organization: "org".to_string(),
        };

        assert!(!CAEnrollmentManager::needs_renewal(&cert));
    }
}
