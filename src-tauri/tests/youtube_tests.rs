use memosmith_lib::youtube::{embed_page, youtube_decodable, youtube_port};
use std::io::{Read, Write};
use std::net::TcpStream;

#[test]
fn wraps_valid_ids_only() {
    let page = embed_page("/embed/dQw4w9WgXcQ?start=42").unwrap();
    assert!(page.contains("youtube-nocookie.com/embed/dQw4w9WgXcQ?playsinline=1&start=42"));
    assert!(embed_page("/embed/dQw4w9WgXcQ").is_some());
    assert!(embed_page("/embed/bad\"id<x>").is_none());
    assert!(embed_page("/other/dQw4w9WgXcQ").is_none());
    assert!(!embed_page("/embed/dQw4w9WgXcQ?start=1\"x")
        .unwrap()
        .contains("start=1\""));
}

#[test]
fn serves_the_wrapper_over_loopback() {
    let port = youtube_port().unwrap();
    assert_eq!(port, youtube_port().unwrap());
    let mut stream = TcpStream::connect(("127.0.0.1", port)).unwrap();
    stream
        .write_all(b"GET /embed/dQw4w9WgXcQ HTTP/1.1\r\nHost: x\r\n\r\n")
        .unwrap();
    let mut response = String::new();
    stream.read_to_string(&mut response).unwrap();
    assert!(response.starts_with("HTTP/1.1 200 OK"));
    assert!(response.contains("dQw4w9WgXcQ"));
}

#[test]
fn decoder_check_answers_without_panicking() {
    let _ = youtube_decodable();
}
