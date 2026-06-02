mod pty;
mod ssh;
mod sshconfig;

use pty::PtyManager;
use serde::{Deserialize, Serialize};
use ssh::{
    AuthMethod, ConnectionParams, PingResult, PortForwardInfo, RemoteService, SftpEntry, SshManager,
};
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{AppHandle, State};
use tokio::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SavedConnection {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_type: String,
    pub key_path: Option<String>,
    #[serde(default)]
    pub password: Option<String>,
    #[serde(default)]
    pub snippets: Vec<ConnectionSnippet>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionSnippet {
    pub id: String,
    pub name: String,
    pub command: String,
    #[serde(default)]
    pub auto_enter: bool,
}

pub struct AppState {
    pub ssh: Arc<SshManager>,
    pub pty: Arc<PtyManager>,
    pub saved_connections: Mutex<Vec<SavedConnection>>,
}

#[derive(Debug, Clone, Serialize)]
pub struct LocalEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub is_file: bool,
    pub size: u64,
    pub modified: Option<u64>,
}

fn connections_path() -> Result<std::path::PathBuf, String> {
    let dir = dirs::config_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("TmarTerminal");
    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create config directory: {e}"))?;
    Ok(dir.join("connections.json"))
}

fn load_connections() -> Vec<SavedConnection> {
    let Ok(path) = connections_path() else {
        return Vec::new();
    };
    fs::read_to_string(path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn save_connections_to_disk(connections: &[SavedConnection]) -> Result<(), String> {
    let path = connections_path()?;
    let json = serde_json::to_string_pretty(connections)
        .map_err(|e| format!("Failed to serialize saved connections: {e}"))?;
    fs::write(path, json).map_err(|e| format!("Failed to write saved connections: {e}"))
}

fn validate_connection(connection: &SavedConnection) -> Result<(), String> {
    if connection.host.trim().is_empty() {
        return Err("Host is required".to_string());
    }
    if connection.username.trim().is_empty() {
        return Err("Username is required".to_string());
    }
    if connection.port == 0 {
        return Err("Port must be between 1 and 65535".to_string());
    }
    if connection.auth_type != "password" && connection.auth_type != "key" {
        return Err("Unsupported authentication type".to_string());
    }
    if connection.auth_type == "key"
        && connection
            .key_path
            .as_deref()
            .unwrap_or("")
            .trim()
            .is_empty()
    {
        return Err("Private key path is required".to_string());
    }
    Ok(())
}

// ── SSH commands ──────────────────────────────────────────────────────────────

#[tauri::command]
async fn ssh_connect(
    app: AppHandle,
    state: State<'_, AppState>,
    session_id: String,
    host: String,
    port: u16,
    username: String,
    auth: AuthMethod,
) -> Result<(), String> {
    let params = ConnectionParams {
        host,
        port,
        username,
        auth,
    };
    state
        .ssh
        .connect(app, session_id, params)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn ssh_send_data(
    state: State<'_, AppState>,
    session_id: String,
    data: Vec<u8>,
) -> Result<(), String> {
    state
        .ssh
        .send_data(&session_id, data)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn ssh_resize(
    state: State<'_, AppState>,
    session_id: String,
    cols: u32,
    rows: u32,
) -> Result<(), String> {
    state
        .ssh
        .resize(&session_id, cols, rows)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn ssh_disconnect(state: State<'_, AppState>, session_id: String) -> Result<(), String> {
    state.ssh.disconnect(&session_id).await;
    Ok(())
}

#[tauri::command]
async fn ssh_ping(state: State<'_, AppState>, session_id: String) -> Result<PingResult, String> {
    state.ssh.ping(&session_id).await.map_err(|e| e.to_string())
}

// ── Local PTY commands ────────────────────────────────────────────────────────

#[tauri::command]
fn local_start(
    app: AppHandle,
    state: State<'_, AppState>,
    session_id: String,
) -> Result<(), String> {
    state.pty.start(app, session_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn local_send(state: State<'_, AppState>, session_id: String, data: Vec<u8>) -> Result<(), String> {
    state.pty.send(&session_id, data).map_err(|e| e.to_string())
}

#[tauri::command]
fn local_resize(
    state: State<'_, AppState>,
    session_id: String,
    cols: u32,
    rows: u32,
) -> Result<(), String> {
    state.pty.resize(&session_id, cols as u16, rows as u16);
    Ok(())
}

#[tauri::command]
fn local_close(state: State<'_, AppState>, session_id: String) -> Result<(), String> {
    state.pty.close(&session_id);
    Ok(())
}

// File browser commands

#[tauri::command]
fn local_roots() -> Result<Vec<String>, String> {
    let mut roots = Vec::new();
    for letter in b'A'..=b'Z' {
        let root = format!("{}:\\", letter as char);
        if PathBuf::from(&root).exists() {
            roots.push(root);
        }
    }
    if roots.is_empty() {
        roots.push(
            std::env::current_dir()
                .map_err(|e| e.to_string())?
                .display()
                .to_string(),
        );
    }
    Ok(roots)
}

#[tauri::command]
fn local_list(path: String) -> Result<Vec<LocalEntry>, String> {
    let mut entries = Vec::new();
    for entry in fs::read_dir(path).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let metadata = entry.metadata().map_err(|e| e.to_string())?;
        entries.push(LocalEntry {
            name: entry.file_name().to_string_lossy().into_owned(),
            path: entry.path().display().to_string(),
            is_dir: metadata.is_dir(),
            is_file: metadata.is_file(),
            size: metadata.len(),
            modified: metadata
                .modified()
                .ok()
                .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|duration| duration.as_secs()),
        });
    }
    entries.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    Ok(entries)
}

#[tauri::command]
fn local_mkdir(path: String) -> Result<(), String> {
    fs::create_dir_all(path).map_err(|e| e.to_string())
}

#[tauri::command]
fn local_delete(path: String, recursive: bool) -> Result<(), String> {
    let metadata = fs::metadata(&path).map_err(|e| e.to_string())?;
    if metadata.is_dir() {
        if recursive {
            fs::remove_dir_all(path).map_err(|e| e.to_string())
        } else {
            fs::remove_dir(path).map_err(|e| e.to_string())
        }
    } else {
        fs::remove_file(path).map_err(|e| e.to_string())
    }
}

#[tauri::command]
async fn sftp_list(
    state: State<'_, AppState>,
    session_id: String,
    path: String,
) -> Result<Vec<SftpEntry>, String> {
    state
        .ssh
        .sftp_list(&session_id, path)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn sftp_mkdir(
    state: State<'_, AppState>,
    session_id: String,
    path: String,
) -> Result<(), String> {
    state
        .ssh
        .sftp_mkdir(&session_id, path)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn sftp_delete(
    state: State<'_, AppState>,
    session_id: String,
    path: String,
    is_dir: bool,
) -> Result<(), String> {
    state
        .ssh
        .sftp_delete(&session_id, path, is_dir)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn sftp_rename(
    state: State<'_, AppState>,
    session_id: String,
    old_path: String,
    new_path: String,
) -> Result<(), String> {
    state
        .ssh
        .sftp_rename(&session_id, old_path, new_path)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn sftp_upload(
    state: State<'_, AppState>,
    session_id: String,
    local_path: String,
    remote_path: String,
) -> Result<(), String> {
    state
        .ssh
        .sftp_upload(&session_id, local_path, remote_path)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn sftp_download(
    state: State<'_, AppState>,
    session_id: String,
    remote_path: String,
    local_path: String,
) -> Result<(), String> {
    state
        .ssh
        .sftp_download(&session_id, remote_path, local_path)
        .await
        .map_err(|e| e.to_string())
}

// ── Port forwarding ───────────────────────────────────────────────────────────

#[tauri::command]
async fn port_forward_start(
    state: State<'_, AppState>,
    session_id: String,
    local_port: u16,
    remote_host: String,
    remote_port: u16,
) -> Result<String, String> {
    state
        .ssh
        .port_forward_start(&session_id, local_port, remote_host, remote_port)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn port_forward_stop(
    state: State<'_, AppState>,
    forward_id: String,
) -> Result<(), String> {
    state.ssh.port_forward_stop(&forward_id).await;
    Ok(())
}

#[tauri::command]
async fn port_forward_list(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<Vec<PortForwardInfo>, String> {
    Ok(state.ssh.port_forward_list(&session_id).await)
}

#[tauri::command]
async fn scan_remote_ports(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<Vec<RemoteService>, String> {
    state
        .ssh
        .scan_remote_ports(&session_id)
        .await
        .map_err(|e| e.to_string())
}

// ── Saved connections ─────────────────────────────────────────────────────────

#[tauri::command]
async fn get_connections(state: State<'_, AppState>) -> Result<Vec<SavedConnection>, String> {
    Ok(state.saved_connections.lock().await.clone())
}

#[tauri::command]
async fn save_connection(
    state: State<'_, AppState>,
    connection: SavedConnection,
) -> Result<(), String> {
    validate_connection(&connection)?;
    let mut conns = state.saved_connections.lock().await;
    // Update by id, or deduplicate by host+port+username
    let dup = conns.iter().position(|c| {
        c.id == connection.id
            || (c.host == connection.host
                && c.port == connection.port
                && c.username == connection.username)
    });
    if let Some(pos) = dup {
        conns[pos] = connection;
    } else {
        conns.push(connection);
    }
    save_connections_to_disk(&conns)
}

#[tauri::command]
async fn delete_connection(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let mut conns = state.saved_connections.lock().await;
    conns.retain(|c| c.id != id);
    save_connections_to_disk(&conns)
}

// ── SSH config import ─────────────────────────────────────────────────────────

#[tauri::command]
async fn import_ssh_config(state: State<'_, AppState>) -> Result<Vec<SavedConnection>, String> {
    let entries = sshconfig::parse_ssh_config();
    let mut conns = state.saved_connections.lock().await;

    for entry in entries {
        // Skip if already saved (match by host+port+username)
        let exists = conns
            .iter()
            .any(|c| c.host == entry.hostname && c.port == entry.port && c.username == entry.user);
        if exists {
            continue;
        }
        conns.push(SavedConnection {
            id: uuid::Uuid::new_v4().to_string(),
            name: entry.name,
            host: entry.hostname,
            port: entry.port,
            username: entry.user,
            auth_type: if entry.identity_file.is_some() {
                "key".to_string()
            } else {
                "password".to_string()
            },
            key_path: entry.identity_file,
            password: None,
            snippets: Vec::new(),
        });
    }

    save_connections_to_disk(&conns)?;
    Ok(conns.clone())
}

// ── App entry point ───────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let saved = load_connections();

    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(AppState {
            ssh: Arc::new(SshManager::new()),
            pty: Arc::new(PtyManager::new()),
            saved_connections: Mutex::new(saved),
        })
        .invoke_handler(tauri::generate_handler![
            ssh_connect,
            ssh_send_data,
            ssh_resize,
            ssh_disconnect,
            ssh_ping,
            local_start,
            local_send,
            local_resize,
            local_close,
            local_roots,
            local_list,
            local_mkdir,
            local_delete,
            sftp_list,
            sftp_mkdir,
            sftp_delete,
            sftp_rename,
            sftp_upload,
            sftp_download,
            get_connections,
            save_connection,
            delete_connection,
            import_ssh_config,
            port_forward_start,
            port_forward_stop,
            port_forward_list,
            scan_remote_ports,
        ])
        .run(tauri::generate_context!())
        .expect("error while running TmarTerminal");
}
