use memosmith_lib::notes::list_templates;

#[test]
fn templates_inherit_from_parents_and_nearest_wins() {
    let root = std::env::temp_dir().join("memosmith-templates-test");
    let _ = std::fs::remove_dir_all(&root);
    std::fs::create_dir_all(root.join(".templates")).unwrap();
    std::fs::create_dir_all(root.join("work/.templates")).unwrap();
    std::fs::create_dir_all(root.join("other/.templates")).unwrap();
    std::fs::write(root.join(".templates/daily.md"), "root daily").unwrap();
    std::fs::write(root.join(".templates/weekly.md"), "root weekly").unwrap();
    std::fs::write(root.join("work/.templates/daily.md"), "work daily").unwrap();
    std::fs::write(root.join("other/.templates/meet.md"), "other").unwrap();

    let found = list_templates(root.to_string_lossy().into(), "work".into()).unwrap();
    let pairs: Vec<_> = found.iter().map(|t| (t.name.as_str(), t.text.as_str())).collect();
    assert_eq!(pairs, [("daily.md", "work daily"), ("weekly.md", "root weekly")]);

    let top = list_templates(root.to_string_lossy().into(), "".into()).unwrap();
    assert_eq!(top.len(), 2);
    std::fs::remove_dir_all(&root).unwrap();
}
