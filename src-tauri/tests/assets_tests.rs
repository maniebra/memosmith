use memosmith_lib::assets::unique_path;

#[test]
fn unique_path_avoids_collisions_and_escapes() {
    let dir = std::env::temp_dir().join("memosmith-unique-test");
    std::fs::create_dir_all(&dir).unwrap();
    let first = unique_path(&dir, "../shot.png");
    assert_eq!(first, dir.join("shot.png"));
    std::fs::write(&first, "x").unwrap();
    assert_eq!(unique_path(&dir, "shot.png"), dir.join("shot-1.png"));
    std::fs::remove_dir_all(&dir).unwrap();
}
