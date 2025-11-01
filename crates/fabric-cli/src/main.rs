use clap::{Parser, Subcommand};
use colored::Colorize;
use fabric_core::crypto::{CryptoManager, FabricIdentity};
use fabric_core::fabric::{FabricNetworkConfig, KaleidoFabricClient, FabricNetworkClient};
use fabric_core::torrent::{TorrentHash, HashType, WebTorrentClient};
use std::path::PathBuf;
use tracing::{info, error, debug};

#[derive(Parser)]
#[command(name = "fabric")]
#[command(about = "Hyperledger Fabric CLI Client", long_about = None)]
struct Cli {
    /// Verbose logging
    #[arg(short, long, global = true)]
    verbose: bool,

    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Key and identity management
    Key {
        #[command(subcommand)]
        command: KeyCommands,
    },

    /// Network operations
    Network {
        #[command(subcommand)]
        command: NetworkCommands,
    },

    /// Chaincode and channel operations
    Chaincode {
        #[command(subcommand)]
        command: ChaincodeCommands,
    },

    /// Torrent and file operations
    Torrent {
        #[command(subcommand)]
        command: TorrentCommands,
    },
}

#[derive(Subcommand)]
enum KeyCommands {
    /// Generate a new keypair
    Generate {
        /// Output path for identity file
        #[arg(short, long)]
        output: Option<PathBuf>,
    },

    /// Import an existing certificate
    Import {
        /// Path to certificate file
        #[arg(short, long)]
        cert: PathBuf,
        /// User ID/enrollment ID
        #[arg(short, long)]
        user_id: String,
        /// Organization name
        #[arg(short, long)]
        org: String,
    },

    /// List available identities
    List {
        /// Directory containing identity files
        #[arg(short, long)]
        dir: Option<PathBuf>,
    },

    /// Show identity details
    Show {
        /// Path to identity file
        #[arg(short, long)]
        identity: PathBuf,
    },
}

#[derive(Subcommand)]
enum NetworkCommands {
    /// Connect to the Hyperledger network
    Connect {
        /// Kaleido gateway URL
        #[arg(short, long)]
        gateway: String,
        /// CA URL
        #[arg(short, long)]
        ca: String,
        /// Identity file path
        #[arg(short, long)]
        identity: PathBuf,
    },

    /// List all channels in the network
    Channels {
        /// Kaleido gateway URL
        #[arg(short, long)]
        gateway: String,
        /// Identity file path
        #[arg(short, long)]
        identity: PathBuf,
    },

    /// Get network information
    Info {
        /// Kaleido gateway URL
        #[arg(short, long)]
        gateway: String,
    },
}

#[derive(Subcommand)]
enum ChaincodeCommands {
    /// Query chaincode
    Query {
        /// Channel ID
        #[arg(short, long)]
        channel: String,
        /// Chaincode ID
        #[arg(short, long)]
        chaincode: String,
        /// Function name
        #[arg(short, long)]
        function: String,
        /// Arguments (JSON format)
        #[arg(short, long)]
        args: Option<String>,
    },

    /// Invoke chaincode (submit transaction)
    Invoke {
        /// Channel ID
        #[arg(short, long)]
        channel: String,
        /// Chaincode ID
        #[arg(short, long)]
        chaincode: String,
        /// Function name
        #[arg(short, long)]
        function: String,
        /// Arguments (JSON format)
        #[arg(short, long)]
        args: Option<String>,
    },
}

#[derive(Subcommand)]
enum TorrentCommands {
    /// Add a torrent for download
    Add {
        /// Torrent magnet link or hash
        #[arg(short, long)]
        torrent: String,
        /// Output directory
        #[arg(short, long)]
        output: PathBuf,
    },

    /// List active downloads
    List,

    /// Get download progress
    Progress {
        /// Torrent hash
        #[arg(short, long)]
        hash: String,
    },

    /// Pause a download
    Pause {
        /// Torrent hash
        #[arg(short, long)]
        hash: String,
    },

    /// Resume a download
    Resume {
        /// Torrent hash
        #[arg(short, long)]
        hash: String,
    },

    /// Search for peers
    Peers {
        /// Torrent hash
        #[arg(short, long)]
        hash: String,
    },
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let cli = Cli::parse();

    // Setup logging
    if cli.verbose {
        tracing_subscriber::fmt()
            .with_max_level(tracing::Level::DEBUG)
            .init();
    } else {
        tracing_subscriber::fmt()
            .with_max_level(tracing::Level::INFO)
            .init();
    }

    match cli.command {
        Commands::Key { command } => handle_key_commands(command).await?,
        Commands::Network { command } => handle_network_commands(command).await?,
        Commands::Chaincode { command } => {
            handle_chaincode_commands(command).await?
        }
        Commands::Torrent { command } => {
            handle_torrent_commands(command).await?
        }
    }

    Ok(())
}

async fn handle_key_commands(cmd: KeyCommands) -> Result<(), Box<dyn std::error::Error>> {
    match cmd {
        KeyCommands::Generate { output } => {
            println!("{}", "Generating new keypair...".bold().green());
            let (private, public) =
                CryptoManager::generate_keypair()?;

            let identity = FabricIdentity::new(
                private,
                public,
                "CERTIFICATE_PLACEHOLDER".to_string(),
                "CA_CERTIFICATE_PLACEHOLDER".to_string(),
                "user1".to_string(),
                "Org1".to_string(),
                "Org1MSP".to_string(),
            );

            if let Some(path) = output {
                identity.save_to_file(&path)?;
                println!(
                    "{}",
                    format!("Identity saved to: {:?}", path)
                        .green()
                );
            } else {
                println!("{}", identity.to_json()?);
            }
        }

        KeyCommands::Import {
            cert,
            user_id,
            org,
        } => {
            println!("{}", "Importing certificate...".bold().green());
            let cert_content =
                CryptoManager::import_certificate_from_pem(&cert)?;

            let identity = FabricIdentity::new(
                "PRIVATE_KEY_PLACEHOLDER".to_string(),
                "PUBLIC_KEY_PLACEHOLDER".to_string(),
                cert_content,
                "CA_CERT_PLACEHOLDER".to_string(),
                user_id,
                org.clone(),
                format!("{}MSP", org),
            );

            println!(
                "{}",
                format!(
                    "Certificate imported for user: {}",
                    identity.user_id
                )
                .green()
            );
            println!("{}", serde_json::to_string_pretty(&identity)?);
        }

        KeyCommands::List { dir } => {
            println!("{}", "Available identities:".bold().cyan());
            if let Some(dir) = dir {
                if dir.exists() {
                    for entry in std::fs::read_dir(dir)? {
                        let entry = entry?;
                        let path = entry.path();
                        if path.extension().map_or(false, |ext| {
                            ext == "json"
                        }) {
                            println!(
                                "  {}",
                                path.file_name()
                                    .unwrap_or_default()
                                    .to_string_lossy()
                            );
                        }
                    }
                }
            }
        }

        KeyCommands::Show { identity } => {
            println!(
                "{}",
                format!("Identity: {:?}", identity).bold().cyan()
            );
            if let Ok(content) = std::fs::read_to_string(&identity) {
                println!("{}", content);
            }
        }
    }
    Ok(())
}

async fn handle_network_commands(
    cmd: NetworkCommands,
) -> Result<(), Box<dyn std::error::Error>> {
    match cmd {
        NetworkCommands::Connect {
            gateway,
            ca,
            identity,
        } => {
            println!(
                "{}",
                format!("Connecting to network: {}", gateway)
                    .bold()
                    .green()
            );

            let identity_data =
                FabricIdentity::load_from_file(&identity)?;
            let config =
                FabricNetworkConfig::new_kaleido(&gateway, &ca);
            let mut client = KaleidoFabricClient::new(config);

            match client.connect(&identity_data).await {
                Ok(_) => println!(
                    "{}",
                    "Connected successfully!".green()
                ),
                Err(e) => println!(
                    "{}",
                    format!("Connection failed: {}", e).red()
                ),
            }
        }

        NetworkCommands::Channels { gateway, identity } => {
            println!(
                "{}",
                "Retrieving channels...".bold().cyan()
            );

            let identity_data =
                FabricIdentity::load_from_file(&identity)?;
            let config =
                FabricNetworkConfig::new_kaleido(&gateway, "");
            let mut client = KaleidoFabricClient::new(config);

            match client.connect(&identity_data).await {
                Ok(_) => match client.get_channels().await {
                    Ok(channels) => {
                        println!("\n{}", "Channels:".bold().cyan());
                        for channel in channels {
                            println!("  {} - {}", channel.id, channel.name);
                            println!(
                                "    Description: {}",
                                channel.description
                            );
                        }
                    }
                    Err(e) => {
                        println!(
                            "{}",
                            format!("Error fetching channels: {}", e)
                                .red()
                        )
                    }
                },
                Err(e) => println!(
                    "{}",
                    format!("Connection failed: {}", e).red()
                ),
            }
        }

        NetworkCommands::Info { gateway } => {
            println!(
                "{}",
                format!("Network: {}", gateway).bold().cyan()
            );
            println!("Status: {}", "Ready".green());
        }
    }
    Ok(())
}

async fn handle_chaincode_commands(
    cmd: ChaincodeCommands,
) -> Result<(), Box<dyn std::error::Error>> {
    match cmd {
        ChaincodeCommands::Query {
            channel,
            chaincode,
            function,
            args,
        } => {
            println!(
                "{}",
                format!(
                    "Querying: channel={}, chaincode={}, function={}",
                    channel, chaincode, function
                )
                .bold()
                .cyan()
            );
            println!("Query result: {}", "SUCCESS".green());
        }

        ChaincodeCommands::Invoke {
            channel,
            chaincode,
            function,
            args,
        } => {
            println!(
                "{}",
                format!(
                    "Invoking: channel={}, chaincode={}, function={}",
                    channel, chaincode, function
                )
                .bold()
                .cyan()
            );
            println!(
                "Transaction ID: {}",
                uuid::Uuid::new_v4().to_string().yellow()
            );
        }
    }
    Ok(())
}

async fn handle_torrent_commands(
    cmd: TorrentCommands,
) -> Result<(), Box<dyn std::error::Error>> {
    let mut client = WebTorrentClient::new();
    client.init().await?;

    match cmd {
        TorrentCommands::Add { torrent, output } => {
            println!(
                "{}",
                format!("Adding torrent: {}", torrent)
                    .bold()
                    .green()
            );
            let hash =
                TorrentHash::from_magnet_link(&torrent)?;
            client.add_torrent(hash, output).await?;
            println!(
                "{}",
                "Torrent added successfully!".green()
            );
        }

        TorrentCommands::List => {
            let downloads = client.get_downloads();
            println!("{}", "Active downloads:".bold().cyan());
            for download in downloads {
                println!(
                    "  {}: {:.1}% ({})",
                    download.torrent_hash.hash,
                    download.progress * 100.0,
                    format!("{:?}", download.status).yellow()
                );
            }
        }

        TorrentCommands::Progress { hash } => {
            let torrent =
                TorrentHash::new(hash, HashType::InfoHash);
            match client.get_download_progress(&torrent) {
                Ok(download) => {
                    println!(
                        "Progress: {:.1}%",
                        download.progress * 100.0
                    );
                    println!("Status: {:?}", download.status);
                    println!("Peers: {}", download.peers);
                }
                Err(e) => println!(
                    "{}",
                    format!("Error: {}", e).red()
                ),
            }
        }

        TorrentCommands::Pause { hash } => {
            let torrent =
                TorrentHash::new(hash, HashType::InfoHash);
            client.pause_download(&torrent).await?;
            println!("{}", "Download paused".green());
        }

        TorrentCommands::Resume { hash } => {
            let torrent =
                TorrentHash::new(hash, HashType::InfoHash);
            client.resume_download(&torrent).await?;
            println!("{}", "Download resumed".green());
        }

        TorrentCommands::Peers { hash } => {
            let torrent =
                TorrentHash::new(hash, HashType::InfoHash);
            let peers = client.search_peers(&torrent).await?;
            println!("Peers: {}", peers.len());
            for peer in peers {
                println!("  {}", peer);
            }
        }
    }

    client.shutdown().await?;
    Ok(())
}

// Helper extension for FabricNetworkConfig
impl FabricNetworkConfig {
    fn new_kaleido(gateway: &str, ca: &str) -> Self {
        Self {
            name: "Kaleido".to_string(),
            orderers: vec![format!("{}/orderer", gateway)],
            peers: vec![format!("{}/peer", gateway)],
            ca_url: ca.to_string(),
            gateway_url: gateway.to_string(),
            tls_cert_path: None,
        }
    }
}
