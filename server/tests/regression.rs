//! Regression tests (planned) for the TCP server. These are marked #[ignore] until finalized.

use std::io::{BufRead, BufReader, Write};
use std::net::TcpStream;
use std::process::{Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};

#[derive(serde::Deserialize)]
#[serde(tag = "type")] 
enum Message {
    #[serde(rename = "client_list")]
    ClientList { clients: Vec<ClientInfo> },
    #[serde(rename = "chat")]
    Chat { from_ip: String, from_port: u16, message: String, timestamp: String, channel: String },
}

#[derive(serde::Deserialize)]
struct ClientInfo { ip: String, port: u16 }

fn spawn_server_and_get_port() -> (std::process::Child, u16) {
    // Run the server binary with custom port 0 to let OS assign a free port.
    let mut child = Command::new(if cfg!(windows) { "cmd" } else { "sh" })
        .arg(if cfg!(windows) { "/C" } else { "-c" })
        .arg("cargo run --quiet -p server -- 0")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("failed to spawn server");

    let stdout = child.stdout.take().expect("no stdout");
    let mut reader = BufReader::new(stdout);
    let start = Instant::now();
    let mut line = String::new();
    let mut port: Option<u16> = None;
    while start.elapsed() < Duration::from_secs(10) {
        line.clear();
        if reader.read_line(&mut line).unwrap_or(0) == 0 { continue; }
        if let Some(idx) = line.find("Address:") { 
            // Expect format: "   Address: 0.0.0.0:<port>"
            if let Some(colon) = line[idx..].rfind(':') {
                let pstr = line[idx+colon+1..].trim();
                if let Ok(p) = pstr.parse::<u16>() { port = Some(p); break; }
            }
        }
    }
    let port = port.expect("failed to parse bound port from server stdout");
    (child, port)
}

#[test]
#[ignore]
fn userlist_single_client() {
    let (mut server, port) = spawn_server_and_get_port();

    // Connect a TCP client
    let mut stream = TcpStream::connect(("127.0.0.1", port)).expect("connect A");
    stream.set_read_timeout(Some(Duration::from_secs(3))).unwrap();
    stream
        .write_all(br#"{"type":"register","client_ip":"127.0.0.1","client_port":50001}
"#)
        .unwrap();
    stream.flush().unwrap();

    // Read responses until we get a client_list
    let mut reader = BufReader::new(stream);
    let mut buf = String::new();
    let mut found = false;
    for _ in 0..10 {
        buf.clear();
        if reader.read_line(&mut buf).unwrap_or(0) == 0 { continue; }
        if let Ok(Message::ClientList { clients }) = serde_json::from_str::<Message>(&buf) {
            assert_eq!(clients.len(), 1);
            assert_eq!(clients[0].ip, "127.0.0.1");
            found = true;
            break;
        }
    }
    assert!(found, "did not receive client_list");

    // Terminate server
    let _ = server.kill();
}

#[test]
#[ignore]
fn chat_relay_two_clients() {
    let (mut server, port) = spawn_server_and_get_port();

    // Connect two clients A and B
    let mut a = TcpStream::connect(("127.0.0.1", port)).expect("connect A");
    let mut b = TcpStream::connect(("127.0.0.1", port)).expect("connect B");
    a.set_read_timeout(Some(Duration::from_secs(3))).unwrap();
    b.set_read_timeout(Some(Duration::from_secs(3))).unwrap();

    a.write_all(br#"{"type":"register","client_ip":"127.0.0.1","client_port":50001}
"#).unwrap();
    b.write_all(br#"{"type":"register","client_ip":"127.0.0.1","client_port":50002}
"#).unwrap();
    a.flush().unwrap(); b.flush().unwrap();

    // Drain initial lists
    let mut ra = BufReader::new(a.try_clone().unwrap());
    let mut rb = BufReader::new(b.try_clone().unwrap());
    let _ = ra.read_line(&mut String::new());
    let _ = rb.read_line(&mut String::new());

    // Send a chat from A
    let chat = format!(
        "{{\"type\":\"chat\",\"from_ip\":\"127.0.0.1\",\"from_port\":50001,\"message\":\"hello\",\"timestamp\":\"{}\",\"channel\":\"general\"}}\n",
        chrono::Utc::now().to_rfc3339());
    a.write_all(chat.as_bytes()).unwrap();
    a.flush().unwrap();

    // B should receive the chat
    let mut line = String::new();
    let mut got = false;
    for _ in 0..10 {
        line.clear();
        if rb.read_line(&mut line).unwrap_or(0) == 0 { continue; }
        if let Ok(Message::Chat { message, channel, .. }) = serde_json::from_str::<Message>(&line) {
            assert_eq!(message, "hello");
            assert_eq!(channel, "general");
            got = true; break;
        }
    }
    assert!(got, "B did not receive chat");

    let _ = server.kill();
}
