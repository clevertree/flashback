use tauri_build::Attributes;

fn main() {
    let attrs = Attributes::new();
    tauri_build::try_build(attrs).expect("failed to run tauri-build");
}
