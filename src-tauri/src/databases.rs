use rusqlite::Connection;
use serde::{Deserialize, Serialize};

const FOLDER: &str = ".databases";

#[derive(Serialize, Deserialize)]
pub struct DatabaseRow {
    pub id: String,
    #[serde(rename = "tableId")]
    pub table_id: String,
    pub position: f64,
    /// Column id -> cell value, as JSON so columns can change without migrations.
    pub data: serde_json::Value,
}

#[derive(Serialize)]
pub struct DatabaseSummary {
    pub id: String,
    pub name: String,
    /// `[{ id, name, columns, views }]`, so callers can offer a table view without loading rows.
    pub tables: serde_json::Value,
}

#[derive(Serialize)]
pub struct DatabaseData {
    pub id: String,
    pub name: String,
    /// `[{ id, name, columns, views }]`; rows carry the table they belong to.
    pub tables: serde_json::Value,
    pub rows: Vec<DatabaseRow>,
}

/// Id of the table that pre-tables databases are folded into.
const LEGACY_TABLE: &str = "main";

/// Ids become file names, so they must not walk out of the `.databases` folder.
fn database_path(root: &str, id: &str) -> Result<std::path::PathBuf, String> {
    if id.is_empty()
        || !id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
    {
        return Err(format!("Invalid database id: {id}"));
    }

    Ok(std::path::PathBuf::from(root)
        .join(FOLDER)
        .join(format!("{id}.db")))
}

fn open(root: &str, id: &str) -> Result<Connection, String> {
    let path = database_path(root, id)?;

    if !path.exists() {
        return Err(format!("{} does not exist", path.display()));
    }

    let connection = Connection::open(path).map_err(|error| error.to_string())?;

    migrate(&connection)?;

    Ok(connection)
}

/// Databases written before tables existed hold one column set; it becomes the `main` table.
fn migrate(connection: &Connection) -> Result<(), String> {
    let has_table_id = connection
        .prepare("SELECT table_id FROM rows LIMIT 1")
        .is_ok();

    if !has_table_id {
        connection
            .execute(
                &format!("ALTER TABLE rows ADD COLUMN table_id TEXT NOT NULL DEFAULT '{LEGACY_TABLE}'"),
                [],
            )
            .map_err(|error| error.to_string())?;
    }

    if read_meta(connection, "tables").is_ok() {
        return Ok(());
    }

    let parse = |raw: String| serde_json::from_str(&raw).unwrap_or(serde_json::Value::Array(vec![]));
    let tables = serde_json::json!([{
        "id": LEGACY_TABLE,
        "name": read_meta(connection, "name").unwrap_or_else(|_| "Table".into()),
        "columns": parse(read_meta(connection, "columns").unwrap_or_default()),
        "views": parse(read_meta(connection, "views").unwrap_or_default()),
    }]);

    write_meta(connection, "tables", &tables.to_string())
}

fn read_meta(connection: &Connection, key: &str) -> Result<String, String> {
    connection
        .query_row("SELECT value FROM meta WHERE key = ?1", [key], |row| {
            row.get::<_, String>(0)
        })
        .map_err(|error| error.to_string())
}

fn write_meta(connection: &Connection, key: &str, value: &str) -> Result<(), String> {
    connection
        .execute(
            "INSERT INTO meta(key, value) VALUES(?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            [key, value],
        )
        .map(|_| ())
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn list_databases(root: String) -> Result<Vec<DatabaseSummary>, String> {
    let folder = std::path::PathBuf::from(&root).join(FOLDER);

    if !folder.is_dir() {
        return Ok(Vec::new());
    }

    let mut databases = Vec::new();

    for entry in std::fs::read_dir(&folder).map_err(|error| error.to_string())? {
        let path = entry.map_err(|error| error.to_string())?.path();

        if path.extension().unwrap_or_default() != "db" {
            continue;
        }

        let id = path.file_stem().unwrap_or_default().to_string_lossy().to_string();
        let (name, tables) = match open(&root, &id) {
            Ok(connection) => (
                read_meta(&connection, "name").unwrap_or_else(|_| id.clone()),
                read_meta(&connection, "tables")
                    .ok()
                    .and_then(|raw| serde_json::from_str(&raw).ok())
                    .unwrap_or_else(|| serde_json::json!([])),
            ),
            Err(_) => (id.clone(), serde_json::json!([])),
        };

        databases.push(DatabaseSummary { id, name, tables });
    }

    databases.sort_by_key(|database| database.name.to_lowercase());

    Ok(databases)
}

#[tauri::command]
pub fn create_database(
    root: String,
    id: String,
    name: String,
    tables: serde_json::Value,
) -> Result<(), String> {
    let path = database_path(&root, &id)?;

    if path.exists() {
        return Err(format!("{} already exists", path.display()));
    }

    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let connection = Connection::open(&path).map_err(|error| error.to_string())?;

    connection
        .execute_batch(
            "CREATE TABLE meta(key TEXT PRIMARY KEY, value TEXT NOT NULL);
             CREATE TABLE rows(id TEXT PRIMARY KEY, table_id TEXT NOT NULL, position REAL NOT NULL, data TEXT NOT NULL);",
        )
        .map_err(|error| error.to_string())?;

    write_meta(&connection, "name", &name)?;
    write_meta(&connection, "tables", &tables.to_string())
}

#[tauri::command]
pub fn load_database(root: String, id: String) -> Result<DatabaseData, String> {
    let connection = open(&root, &id)?;
    let parse = |raw: String| serde_json::from_str(&raw).unwrap_or(serde_json::Value::Array(vec![]));

    let mut statement = connection
        .prepare("SELECT id, table_id, position, data FROM rows ORDER BY position")
        .map_err(|error| error.to_string())?;

    let rows = statement
        .query_map([], |row| {
            Ok(DatabaseRow {
                id: row.get(0)?,
                table_id: row.get(1)?,
                position: row.get(2)?,
                data: serde_json::from_str(&row.get::<_, String>(3)?)
                    .unwrap_or(serde_json::Value::Object(Default::default())),
            })
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    Ok(DatabaseData {
        name: read_meta(&connection, "name")?,
        tables: parse(read_meta(&connection, "tables")?),
        rows,
        id,
    })
}

#[tauri::command]
pub fn save_database_meta(
    root: String,
    id: String,
    name: String,
    tables: serde_json::Value,
) -> Result<(), String> {
    let connection = open(&root, &id)?;

    write_meta(&connection, "name", &name)?;
    write_meta(&connection, "tables", &tables.to_string())
}

#[tauri::command]
pub fn save_database_row(root: String, id: String, row: DatabaseRow) -> Result<(), String> {
    let connection = open(&root, &id)?;

    connection
        .execute(
            "INSERT INTO rows(id, table_id, position, data) VALUES(?1, ?2, ?3, ?4)
             ON CONFLICT(id) DO UPDATE SET table_id = excluded.table_id, position = excluded.position, data = excluded.data",
            rusqlite::params![row.id, row.table_id, row.position, row.data.to_string()],
        )
        .map(|_| ())
        .map_err(|error| error.to_string())
}

/// Dropping a table takes its rows with it.
#[tauri::command]
pub fn delete_database_table(root: String, id: String, table_id: String) -> Result<(), String> {
    let connection = open(&root, &id)?;

    connection
        .execute("DELETE FROM rows WHERE table_id = ?1", [table_id])
        .map(|_| ())
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn delete_database_row(root: String, id: String, row_id: String) -> Result<(), String> {
    let connection = open(&root, &id)?;

    connection
        .execute("DELETE FROM rows WHERE id = ?1", [row_id])
        .map(|_| ())
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn delete_database(root: String, id: String) -> Result<(), String> {
    let path = database_path(&root, &id)?;

    std::fs::remove_file(path).map_err(|error| error.to_string())
}
