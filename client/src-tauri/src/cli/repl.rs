// CLI REPL (Read-Eval-Print Loop)
// Handles interactive CLI mode with command input and processing

use super::commands::CliCommand;
use std::io::{self, Write};

/// Print the CLI help message
pub fn print_help() {
    println!("\nFlashback Client CLI\n");
    println!("Commands:");
    println!("  --cli                 Start in interactive CLI mode");
    println!("  --help, -h           Show this help");
    println!("\nInteractive CLI commands:");
    println!("  help                 Show this help");
    println!("  connect-server <server:port>");
    println!("                       Connect to the server (client IP is auto-detected; binds on a random local port)");
    println!("  connect-peer <peer:port>");
    println!("                       Connect to a peer client (DCC)");
    println!("  send-channel <channel> <message>");
    println!("                       Send a message to a server channel");
    println!("  users");
    println!("                       Request the current user list from the server");
    println!("  send-client <peer:port> <text>");
    println!("                       Send a direct message to a peer client (DCC chat)");
    println!("  allow                Approve the pending incoming chat/transfer request");
    println!("  allow auto           Auto-approve all incoming chats/transfers for this session");
    println!("  deny                 Reject the pending incoming chat/transfer request");
    println!("  gen-key <email> [--password=***] [--bits=N] [--alg=ecdsa|ed25519|rsa] [--reuse-key]");
    println!("                       Generate or reuse a key: writes private.key, certificate.pem next to Config.certificate_path");
    println!("  gen-cert <email>      (alias) Generate a self-signed cert and private key; writes private.key, certificate.pem next to Config.certificate_path");
    println!("  set-cert-path <path> Set Config.privateKeyPath (file path). If a directory is provided, 'certificate.pem' will be appended");
    println!("  print-cert           Print the generated certificate PEM between markers");
    println!("  start-listener       Start the peer listener on an ephemeral port (no server connection)");
    println!("  api-register [baseUrl]   Register certificate with server");
    println!("  api-ready [baseUrl] [ip:port]  Announce ready socket; if ip:port omitted, uses local listener; prints 'READY OK <ip:port>'");
    println!("  api-lookup [baseUrl] <email> [minutes]  Lookup recent sockets; prints 'LOOKUP SOCKET <ip:port>' or 'LOOKUP NONE'");
    println!("  quit | exit          Exit the CLI");
    println!();
}

/// Run the interactive REPL loop
/// This function reads commands from stdin and processes them
pub fn run_repl<F>(mut command_handler: F) -> Result<(), Box<dyn std::error::Error>>
where
    F: FnMut(&CliCommand) -> Result<bool, Box<dyn std::error::Error>>,
{
    println!("Running in CLI mode! Type 'help' to see available commands.");
    print_help();

    let mut line = String::new();
    loop {
        print!("> ");
        let _ = io::stdout().flush();
        line.clear();

        match io::stdin().read_line(&mut line) {
            Ok(0) => {
                // EOF reached (e.g., stdin closed). Stay alive and keep waiting.
                std::thread::sleep(std::time::Duration::from_millis(200));
                continue;
            }
            Ok(_) => {}
            Err(e) => {
                eprintln!("Input error: {}. Type 'exit' to quit (continuing).", e);
                std::thread::sleep(std::time::Duration::from_millis(200));
                continue;
            }
        }

        let input = line.trim();
        if input.is_empty() {
            continue;
        }

        // Parse the command
        match CliCommand::parse(input) {
            Some(CliCommand::Exit) => {
                println!("Bye!");
                break;
            }
            Some(CliCommand::Help) => {
                print_help();
            }
            Some(cmd) => {
                // Pass to the command handler
                match command_handler(&cmd) {
                    Ok(true) => {
                        // Handler requested exit
                        break;
                    }
                    Ok(false) => {
                        // Handler processed successfully, continue
                    }
                    Err(e) => {
                        eprintln!("Error processing command: {}", e);
                    }
                }
            }
            None => {
                println!("Unknown command: '{}'. Type 'help' for available commands.", input);
            }
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_print_help_no_panic() {
        // Just ensure it doesn't panic
        print_help();
    }
}
