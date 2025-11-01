pub mod crypto;
pub mod fabric;
pub mod torrent;
pub mod error;

pub use error::{Result, FabricCoreError};

/// Library version
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn it_works() {
        assert_eq!(2 + 2, 4);
    }
}
