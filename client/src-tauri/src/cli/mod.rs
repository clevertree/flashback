// CLI command handlers - Shared logic that can be used by both GUI and CLI
// This module contains all the command processing functions extracted from main.rs

pub mod commands;
pub mod repl;

pub use commands::CliCommand;
