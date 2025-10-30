// Shared command handlers for both CLI and UI
// These functions contain the business logic for commands that can be invoked
// from either the CLI REPL or the Tauri GUI interface.
//
// This module provides a single source of truth for command implementations,
// ensuring CLI and UI code paths are consistent.

use crate::AppState;
use std::path::PathBuf;

// ============================================================================
// Certificate & Key Generation Handlers
// ============================================================================

#[derive(Debug, Clone)]
pub struct GenKeyArgs {
    pub email: String,
    pub password: Option<String>,
    pub bits: Option<u32>,
    pub alg: String,
    pub reuse_key: bool,
}

#[derive(Debug, Clone)]
pub struct KeyCheckResult {
    pub status: String,
    pub private_key_path: String,
    pub cert_pem_path: String,
}

/// Generate a new key/certificate or reuse existing key
///
/// # Arguments
/// * `args` - Arguments including email, algorithm, bits, and reuse flag
/// * `state` - Application state for config management
///
/// # Returns
/// Result with key/cert paths or error message
pub async fn handle_gen_key(
    args: GenKeyArgs,
    state: &AppState,
) -> Result<KeyCheckResult, String> {
    let cfg = state.config.lock().map_err(|e| e.to_string())?.clone();
    
    let cert_path_cur = PathBuf::from(cfg.certificate_path.clone());
    let out_dir = cert_path_cur
        .parent()
        .map(|p| p.to_path_buf())
        .unwrap_or_else(|| PathBuf::from("."));
    
    let _ = std::fs::create_dir_all(&out_dir);
    let cert_path = out_dir.join("certificate.pem");
    let priv_path = out_dir.join("private.key");

    // Reuse mode: use existing private key
    if args.reuse_key {
        if let Ok(priv_pem) = std::fs::read_to_string(&priv_path) {
            let mut pem_opt: Option<String> = None;
            
            // Try to use existing certificate
            if let Ok(existing_cert) = std::fs::read_to_string(&cert_path) {
                pem_opt = Some(existing_cert);
            } else {
                // Generate new certificate using existing key
                let mut params = rcgen::CertificateParams::default();
                params
                    .subject_alt_names
                    .push(rcgen::SanType::Rfc822Name(args.email.clone()));
                params.distinguished_name.push(
                    rcgen::DnType::CommonName,
                    format!("Flashback Test {}", args.email),
                );

                // Select algorithm
                match args.alg.as_str() {
                    "ed25519" => {
                        params.alg = &rcgen::PKCS_ED25519;
                    }
                    "rsa" => {
                        params.alg = &rcgen::PKCS_RSA_SHA256;
                    }
                    _ => {
                        params.alg = &rcgen::PKCS_ECDSA_P256_SHA256;
                    }
                }

                // Attach existing key
                if let Ok(kp) = rcgen::KeyPair::from_pem(&priv_pem) {
                    params.key_pair = Some(kp);
                    match rcgen::Certificate::from_params(params) {
                        Ok(cert) => {
                            if let Ok(pem) = cert.serialize_pem() {
                                let _ = std::fs::write(&cert_path, &pem);
                                pem_opt = Some(pem);
                            }
                        }
                        Err(e) => {
                            return Err(format!("Error generating certificate from existing key: {}", e));
                        }
                    }
                } else {
                    return Err("Invalid existing private.key; cannot reuse.".to_string());
                }
            }

            if pem_opt.is_some() {
                // Update config
                let mut new_cfg = cfg.clone();
                new_cfg.certificate_path = cert_path.to_string_lossy().to_string();
                new_cfg.email = args.email.clone();
                
                {
                    let mut guard = state.config.lock().map_err(|e| e.to_string())?;
                    *guard = new_cfg.clone();
                }
                
                crate::save_config_to_disk(&new_cfg);
                
                return Ok(KeyCheckResult {
                    status: "success".to_string(),
                    private_key_path: priv_path.to_string_lossy().to_string(),
                    cert_pem_path: cert_path.to_string_lossy().to_string(),
                });
            }
        } else {
            return Err("No existing private.key found for reuse.".to_string());
        }
    }

    // Generate new key/certificate
    let mut params = rcgen::CertificateParams::default();
    params
        .subject_alt_names
        .push(rcgen::SanType::Rfc822Name(args.email.clone()));
    params.distinguished_name.push(
        rcgen::DnType::CommonName,
        format!("Flashback Test {}", args.email),
    );

    // Select algorithm
    match args.alg.as_str() {
        "ed25519" => {
            params.alg = &rcgen::PKCS_ED25519;
        }
        "rsa" => {
            params.alg = &rcgen::PKCS_RSA_SHA256;
            // For RSA with custom bits, we'd need to generate a custom key pair
            // For now, use default which is 2048-bit RSA
        }
        _ => {
            params.alg = &rcgen::PKCS_ECDSA_P256_SHA256;
        }
    }

    // Generate certificate
    match rcgen::Certificate::from_params(params) {
        Ok(cert) => {
            let priv_pem = cert.serialize_private_key_pem();
            let cert_pem = cert.serialize_pem().map_err(|e| format!("Failed to serialize cert: {}", e))?;

            let _ = std::fs::write(&priv_path, &priv_pem);
            let _ = std::fs::write(&cert_path, &cert_pem);

            // Update config
            let mut new_cfg = cfg.clone();
            new_cfg.certificate_path = cert_path.to_string_lossy().to_string();
            new_cfg.email = args.email.clone();
            
            {
                let mut guard = state.config.lock().map_err(|e| e.to_string())?;
                *guard = new_cfg.clone();
            }
            
            crate::save_config_to_disk(&new_cfg);

            Ok(KeyCheckResult {
                status: "success".to_string(),
                private_key_path: priv_path.to_string_lossy().to_string(),
                cert_pem_path: cert_path.to_string_lossy().to_string(),
            })
        }
        Err(e) => Err(format!("Failed to generate certificate: {}", e)),
    }
}

// ============================================================================
// Configuration Handlers
// ============================================================================

/// Set the certificate path in config
pub async fn handle_set_cert_path(
    path: String,
    state: &AppState,
) -> Result<String, String> {
    let mut cfg = state.config.lock().map_err(|e| e.to_string())?;
    
    let path_obj = PathBuf::from(&path);
    let final_path = if path_obj.is_dir() {
        path_obj.join("certificate.pem")
    } else {
        path_obj
    };
    
    cfg.certificate_path = final_path.to_string_lossy().to_string();
    
    drop(cfg); // Release lock
    
    let cfg = state.config.lock().map_err(|e| e.to_string())?;
    crate::save_config_to_disk(&cfg);
    
    Ok(cfg.certificate_path.clone())
}

/// Print the current certificate
pub async fn handle_print_cert(state: &AppState) -> Result<String, String> {
    let cfg = state.config.lock().map_err(|e| e.to_string())?;
    
    match std::fs::read_to_string(&cfg.certificate_path) {
        Ok(pem) => Ok(pem),
        Err(e) => Err(format!("Failed to read certificate: {}", e)),
    }
}

// ============================================================================
// Server API Handlers
// ============================================================================

/// Register certificate with server
/// Returns the response status and data
pub async fn handle_api_register(
    base_url: Option<String>,
    state: &AppState,
) -> Result<String, String> {
    let url = base_url.unwrap_or_else(|| "http://127.0.0.1:8080".to_string());
    let endpoint = format!("{}/api/register", url);
    
    let cfg = state.config.lock().map_err(|e| e.to_string())?;
    let cert_pem = std::fs::read_to_string(&cfg.certificate_path)
        .map_err(|e| format!("Failed to read certificate: {}", e))?;

    // Note: This is a placeholder. In actual implementation, this would be called
    // from the Tauri command context where HTTP is available.
    // For now, we return the endpoint and cert for the caller to use.
    Ok(format!("Would register cert with endpoint: {} (cert length: {})", endpoint, cert_pem.len()))
}

/// Announce ready socket to server
pub async fn handle_api_ready(
    base_url: Option<String>,
    local_ip: Option<String>,
    remote_ip: Option<String>,
    broadcast_port: Option<u16>,
    state: &AppState,
) -> Result<String, String> {
    let url = base_url.unwrap_or_else(|| "http://127.0.0.1:8080".to_string());
    let endpoint = format!("{}/api/broadcast/ready", url);
    
    let cfg = state.config.lock().map_err(|e| e.to_string())?;

    // Note: This is a placeholder. Returns formatted ready announcement.
    Ok(format!(
        "READY OK {}:{}",
        remote_ip.unwrap_or_else(|| "127.0.0.1".to_string()),
        broadcast_port.unwrap_or(5000)
    ))
}

/// Lookup peers by email on server
pub async fn handle_api_lookup(
    base_url: Option<String>,
    email: String,
    minutes: Option<u32>,
    _state: &AppState,
) -> Result<String, String> {
    let url = base_url.unwrap_or_else(|| "http://127.0.0.1:8080".to_string());
    let minutes_param = minutes.unwrap_or(10);
    let endpoint = format!("{}/api/broadcast/lookup?email={}&minutes={}", url, email, minutes_param);
    
    // Note: This is a placeholder. In actual implementation, this would perform the HTTP request.
    Ok(format!("Would lookup peers from endpoint: {}", endpoint))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_gen_key_args_creation() {
        let args = GenKeyArgs {
            email: "test@example.com".to_string(),
            password: None,
            bits: Some(2048),
            alg: "ecdsa".to_string(),
            reuse_key: false,
        };
        assert_eq!(args.email, "test@example.com");
        assert_eq!(args.alg, "ecdsa");
    }

    #[test]
    fn test_key_check_result() {
        let result = KeyCheckResult {
            status: "success".to_string(),
            private_key_path: "/path/to/key".to_string(),
            cert_pem_path: "/path/to/cert".to_string(),
        };
        assert_eq!(result.status, "success");
        assert!(result.private_key_path.contains("key"));
    }
}

// ============================================================================
// Integration Examples - How to use handlers from CLI and Tauri
// ============================================================================
//
// # CLI Integration Example (in main.rs run_cli):
//
//   "gen-key" => {
//       let args = GenKeyArgs {
//           email: email.to_string(),
//           password: _password,
//           bits: _bits,
//           alg: alg,
//           reuse_key: reuse,
//       };
//       match async_runtime::block_on(handle_gen_key(args, &state)) {
//           Ok(result) => {
//               println!("Generated key: {}", result.private_key_path);
//               println!("Certificate: {}", result.cert_pem_path);
//           }
//           Err(e) => println!("Error: {}", e),
//       }
//   }
//
// # Tauri Integration Example (in main.rs Tauri command):
//
//   #[tauri::command]
//   async fn ui_generate_user_keys_and_cert(
//       args: GenerateArgs,
//       state: State<'_, AppState>,
//   ) -> Result<KeyCheckResult, String> {
//       let handler_args = GenKeyArgs {
//           email: args.email,
//           password: args.password,
//           bits: args.bits,
//           alg: args.alg.unwrap_or_else(|| "ecdsa".to_string()),
//           reuse_key: args.reuse_key,
//       };
//       handle_gen_key(handler_args, &state).await
//   }
//
