// CLI Command enum and parsing logic
// Shared by both GUI (for command processing) and CLI (for REPL)

use crate::{AppState, RuntimeConfig};
use std::collections::HashMap;

/// Represents all possible CLI commands
#[derive(Debug, Clone)]
pub enum CliCommand {
    Help,
    Exit,
    GenKey {
        email: String,
        password: Option<String>,
        bits: Option<u32>,
        alg: String,
        reuse_key: bool,
    },
    GenCert {
        email: String,
    },
    SetCertPath {
        path: String,
    },
    PrintCert,
    StartListener,
    ApiRegister {
        base_url: String,
    },
    ApiReady {
        base_url: String,
        socket: Option<String>,
    },
    ApiLookup {
        base_url: String,
        email: String,
        minutes: Option<u32>,
    },
    ConnectPeer {
        socket: String,
    },
    SendClient {
        socket: String,
        message: String,
    },
    AllowAuto,
    Allow,
    Deny,
    Help2,
    LibClone {
        repo_name: String,
        git_url: String,
    },
}

impl CliCommand {
    /// Parse a command from raw user input
    pub fn parse(input: &str) -> Option<CliCommand> {
        let mut parts = input.split_whitespace();
        let cmd = parts.next()?;

        match cmd {
            "help" | "--help" | "-h" => Some(CliCommand::Help),
            "quit" | "exit" => Some(CliCommand::Exit),
            "gen-key" => {
                let email = parts.next()?.to_string();
                let mut password: Option<String> = None;
                let mut bits: Option<u32> = None;
                let mut alg = "ecdsa".to_string();
                let mut reuse_key = false;

                for tok in parts {
                    if let Some(v) = tok.strip_prefix("--password=") {
                        password = Some(v.to_string());
                    } else if let Some(v) = tok.strip_prefix("--bits=") {
                        bits = v.parse::<u32>().ok();
                    } else if let Some(v) = tok.strip_prefix("--alg=") {
                        alg = v.to_lowercase();
                    } else if tok == "--reuse-key" {
                        reuse_key = true;
                    }
                }

                Some(CliCommand::GenKey {
                    email,
                    password,
                    bits,
                    alg,
                    reuse_key,
                })
            }
            "gen-cert" => {
                let email = parts.next()?.to_string();
                Some(CliCommand::GenCert { email })
            }
            "set-cert-path" => {
                let path = parts.next()?.to_string();
                Some(CliCommand::SetCertPath { path })
            }
            "print-cert" => Some(CliCommand::PrintCert),
            "start-listener" => Some(CliCommand::StartListener),
            "api-register" => {
                let base_url = parts.next()?.to_string();
                Some(CliCommand::ApiRegister { base_url })
            }
            "api-ready" => {
                let base_url = parts.next()?.to_string();
                let socket = parts.next().map(|s| s.to_string());
                Some(CliCommand::ApiReady { base_url, socket })
            }
            "api-lookup" => {
                let base_url = parts.next()?.to_string();
                let email = parts.next()?.to_string();
                let minutes = parts.next().and_then(|m| m.parse::<u32>().ok());
                Some(CliCommand::ApiLookup {
                    base_url,
                    email,
                    minutes,
                })
            }
            "connect-peer" => {
                let socket = parts.next()?.to_string();
                Some(CliCommand::ConnectPeer { socket })
            }
            "send-client" => {
                let socket = parts.next()?.to_string();
                let message = parts.collect::<Vec<_>>().join(" ");
                if message.is_empty() {
                    return None;
                }
                Some(CliCommand::SendClient { socket, message })
            }
            "allow" => {
                if let Some(next) = parts.next() {
                    if next == "auto" {
                        Some(CliCommand::AllowAuto)
                    } else {
                        None
                    }
                } else {
                    Some(CliCommand::Allow)
                }
            }
            "deny" => Some(CliCommand::Deny),
            "lib" => {
                let subcommand = parts.next()?;
                match subcommand {
                    "clone" => {
                        let repo_name = parts.next()?.to_string();
                        let git_url = parts.next()?.to_string();
                        Some(CliCommand::LibClone { repo_name, git_url })
                    }
                    _ => None,
                }
            }
            _ => None,
        }
    }

    /// Get a description of this command for help text
    pub fn description(&self) -> &'static str {
        match self {
            CliCommand::Help => "Show help message",
            CliCommand::Exit => "Exit the CLI",
            CliCommand::GenKey { .. } => "Generate a new key and certificate",
            CliCommand::GenCert { .. } => "Generate a self-signed certificate (deprecated, use gen-key)",
            CliCommand::SetCertPath { .. } => "Set the certificate path",
            CliCommand::PrintCert => "Print the current certificate",
            CliCommand::StartListener => "Start a peer listener",
            CliCommand::ApiRegister { .. } => "Register certificate with server",
            CliCommand::ApiReady { .. } => "Announce ready socket to server",
            CliCommand::ApiLookup { .. } => "Lookup clients on server",
            CliCommand::ConnectPeer { .. } => "Connect to a peer",
            CliCommand::SendClient { .. } => "Send a message to a peer",
            CliCommand::AllowAuto => "Enable auto-allow mode",
            CliCommand::Allow => "Allow a pending request",
            CliCommand::Deny => "Deny a pending request",
            CliCommand::Help2 => "Show help message",
            CliCommand::LibClone { .. } => "Clone a git repository to the local repository directory",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_help() {
        let cmd = CliCommand::parse("help");
        assert!(matches!(cmd, Some(CliCommand::Help)));
    }

    #[test]
    fn test_parse_gen_key() {
        let cmd = CliCommand::parse("gen-key test@example.com --alg=rsa");
        assert!(matches!(
            cmd,
            Some(CliCommand::GenKey {
                email,
                alg,
                ..
            }) if email == "test@example.com" && alg == "rsa"
        ));
    }

    #[test]
    fn test_parse_send_client() {
        let cmd = CliCommand::parse("send-client 192.168.1.1:5000 hello world");
        assert!(matches!(
            cmd,
            Some(CliCommand::SendClient {
                socket,
                message,
            }) if socket == "192.168.1.1:5000" && message == "hello world"
        ));
    }
}
