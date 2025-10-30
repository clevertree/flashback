// Flashback CLI - Standalone binary that uses the shared client library
// This is a separate entry point from the Tauri GUI (src/main.rs)
// It provides a lightweight CLI interface without Tauri overhead

use client::{AppState, cli::repl};
use std::io;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = std::env::args().collect();

    // Check for help flag
    if args.iter().any(|a| a == "--help" || a == "-h") {
        repl::print_help();
        return Ok(());
    }

    // Initialize shared application state
    let app_state = AppState::new();

    // Run the REPL loop with a command handler
    // The handler will process commands using the shared state
    repl::run_repl(|cmd| {
        // TODO: Implement command handlers using app_state
        // For now, just print the command
        println!("Command: {:?}", cmd);
        Ok(false)
    })?;

    Ok(())
}
