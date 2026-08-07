use memosmith_lib::utils::percent_decode;

#[test]
fn decodes_percent_escapes() {
    assert_eq!(percent_decode("a%20b.png"), "a b.png");
    assert_eq!(percent_decode("caf%C3%A9.png"), "café.png");
    assert_eq!(percent_decode("100%"), "100%");
}
