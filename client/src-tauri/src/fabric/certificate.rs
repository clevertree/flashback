/// X.509 Certificate Management for Fabric
/// 
/// Handles extraction of certificate information, particularly the email address
/// used to identify users in the Fabric network.

use crate::fabric::errors::{FabricError, FabricResult};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use x509_parser::prelude::*;
use base64::engine::general_purpose;
use base64::Engine;

/// Certificate information extracted from X.509 certificate
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CertificateInfo {
    /// Email address (rfc822Name Subject Alternative Name)
    pub email: String,

    /// Common Name from Subject DN
    pub common_name: Option<String>,

    /// Organization from Subject DN
    pub organization: Option<String>,

    /// Raw PEM certificate string
    pub pem: String,

    /// Certificate fingerprint (SHA256)
    pub fingerprint: String,
}

pub struct CertificateManager;

impl CertificateManager {
    /// Extract certificate information from PEM string
    ///
    /// # Arguments
    /// - `pem`: PEM-formatted certificate string
    ///
    /// # Returns
    /// CertificateInfo with parsed details
    pub fn parse_certificate(pem: &str) -> FabricResult<CertificateInfo> {
        // Validate PEM format
        if !pem.contains("-----BEGIN CERTIFICATE-----") || !pem.contains("-----END CERTIFICATE-----") {
            return Err(FabricError::CertificateError(
                "Invalid PEM format: missing headers".to_string(),
            ));
        }

        // Decode base64 and extract DER
        let der = Self::pem_to_der(pem)?;

        // Parse DER-encoded certificate
        let (_, cert) = X509Certificate::from_der(&der)
            .map_err(|e| FabricError::CertificateError(format!("Failed to parse DER: {}", e)))?;

        // Extract email from Subject Alternative Names or CN
        let email = Self::extract_email(&cert)?;

        // Extract Common Name and Organization from Subject DN
        let (common_name, organization) = Self::extract_subject_info(&cert);

        // Calculate fingerprint
        let fingerprint = Self::calculate_sha256_fingerprint(&der);

        log::info!(
            "Certificate parsed successfully - email: {}, cn: {:?}, org: {:?}",
            email,
            common_name,
            organization
        );

        Ok(CertificateInfo {
            email,
            common_name,
            organization,
            pem: pem.to_string(),
            fingerprint,
        })
    }

    /// Get email from certificate file path
    ///
    /// # Arguments
    /// - `cert_path`: Path to certificate.pem file
    ///
    /// # Returns
    /// Email extracted from certificate
    pub fn get_email_from_file(cert_path: &str) -> FabricResult<String> {
        let pem = std::fs::read_to_string(cert_path)
            .map_err(|e| FabricError::CertificateError(format!("Failed to read certificate file: {}", e)))?;

        let cert_info = Self::parse_certificate(&pem)?;
        Ok(cert_info.email)
    }

    /// Validate certificate format and structure
    pub fn validate_certificate(pem: &str) -> FabricResult<()> {
        // Check for PEM headers
        if !pem.contains("-----BEGIN CERTIFICATE-----") || !pem.contains("-----END CERTIFICATE-----") {
            return Err(FabricError::CertificateError(
                "Invalid PEM format: missing headers".to_string(),
            ));
        }

        // Try to parse
        Self::parse_certificate(pem)?;

        log::info!("Certificate validation successful");
        Ok(())
    }

    // ========================================================================
    // Helper Functions
    // ========================================================================

    /// Decode PEM to DER bytes
    fn pem_to_der(pem: &str) -> FabricResult<Vec<u8>> {
        // Extract base64 data between headers
        let lines: Vec<&str> = pem
            .lines()
            .filter(|line| !line.starts_with("-----") && !line.is_empty())
            .collect();

        let cert_data = lines.join("");

        // Decode base64 using the engine
        general_purpose::STANDARD.decode(&cert_data).map_err(|e| {
            FabricError::CertificateError(format!("Failed to decode base64: {}", e))
        })
    }

    /// Extract email address from certificate
    /// For Phase 1.5, we use a simple regex pattern to find email in the PEM text
    /// Real implementation would use proper x509 extension parsing
    fn extract_email(cert: &X509Certificate) -> FabricResult<String> {
        // Fallback: Try to extract email from CN
        let subject = &cert.tbs_certificate.subject;
        let cn_iter = subject.iter_common_name();
        for cn_attr in cn_iter {
            if let Ok(cn_str) = cn_attr.as_str() {
                if cn_str.contains('@') {
                    return Ok(cn_str.to_string());
                }
            }
        }

        Err(FabricError::CertificateError(
            "No email found in certificate Common Name".to_string(),
        ))
    }

    /// Extract Common Name and Organization from Subject DN
    fn extract_subject_info(cert: &X509Certificate) -> (Option<String>, Option<String>) {
        let subject = &cert.tbs_certificate.subject;
        let mut common_name = None;
        let mut organization = None;

        // Get Common Name
        let cn_iter = subject.iter_common_name();
        for cn_attr in cn_iter {
            if let Ok(cn_str) = cn_attr.as_str() {
                common_name = Some(cn_str.to_string());
                break;
            }
        }

        // Get Organization
        let org_iter = subject.iter_organization();
        for org_attr in org_iter {
            if let Ok(org_str) = org_attr.as_str() {
                organization = Some(org_str.to_string());
                break;
            }
        }

        (common_name, organization)
    }

    /// Calculate SHA256 fingerprint of DER certificate
    fn calculate_sha256_fingerprint(der: &[u8]) -> String {
        let mut hasher = Sha256::new();
        hasher.update(der);
        let result = hasher.finalize();
        format!("{:x}", result)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_invalid_pem_format() {
        let invalid_pem = "not a certificate";
        let result = CertificateManager::validate_certificate(invalid_pem);
        assert!(result.is_err());
    }

    #[test]
    fn test_pem_missing_begin_header() {
        let invalid_pem = r#"MIIC+DCCAeACCQD/s2TS3RVuaDANBgkqhkiG9w0BAQUFADA...
-----END CERTIFICATE-----"#;
        let result = CertificateManager::validate_certificate(invalid_pem);
        assert!(result.is_err());
    }

    #[test]
    fn test_pem_missing_end_header() {
        let invalid_pem = r#"-----BEGIN CERTIFICATE-----
MIIC+DCCAeACCQD/s2TS3RVuaDANBgkqhkiG9w0BAQUFADA..."#;
        let result = CertificateManager::validate_certificate(invalid_pem);
        assert!(result.is_err());
    }

    #[test]
    fn test_calculate_fingerprint_deterministic() {
        let data = b"test certificate data";
        let fp1 = CertificateManager::calculate_sha256_fingerprint(data);
        let fp2 = CertificateManager::calculate_sha256_fingerprint(data);
        assert_eq!(fp1, fp2, "Fingerprints should be deterministic");
    }

    #[test]
    fn test_fingerprint_length() {
        let data = b"test";
        let fp = CertificateManager::calculate_sha256_fingerprint(data);
        assert_eq!(fp.len(), 64, "SHA256 hex should be 64 chars");
    }

    #[test]
    fn test_pem_validation_rejects_empty_string() {
        let result = CertificateManager::validate_certificate("");
        assert!(result.is_err());
    }

    #[test]
    fn test_certificate_info_structure() {
        let cert_info = CertificateInfo {
            email: "test@example.com".to_string(),
            common_name: Some("Test User".to_string()),
            organization: Some("Test Org".to_string()),
            pem: "PEM_DATA".to_string(),
            fingerprint: "abcd1234".to_string(),
        };

        assert_eq!(cert_info.email, "test@example.com");
        assert_eq!(cert_info.common_name, Some("Test User".to_string()));
        assert_eq!(cert_info.organization, Some("Test Org".to_string()));
    }
}
