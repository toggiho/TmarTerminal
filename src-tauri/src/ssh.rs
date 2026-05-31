use anyhow::{anyhow, Result};
use async_trait::async_trait;
use russh::{client, ChannelMsg};
use russh_keys::key;
use russh_sftp::client::SftpSession;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Instant;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::sync::Mutex;
use tokio::net::TcpListener;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionParams {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth: AuthMethod,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "value")]
pub enum AuthMethod {
    Password(String),
    PrivateKey {
        path: String,
        passphrase: Option<String>,
    },
}

pub enum SessionCmd {
    Data(Vec<u8>),
    Resize { cols: u32, rows: u32 },
    Close,
}

struct SessionHandle {
    tx: tokio::sync::mpsc::UnboundedSender<SessionCmd>,
    handle: Arc<client::Handle<SshHandler>>,
}

#[derive(Debug, Clone, Serialize)]
pub struct PingResult {
    pub ok: bool,
    pub latency_ms: f64,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SftpEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub is_file: bool,
    pub is_symlink: bool,
    pub size: u64,
    pub modified: Option<u32>,
}

struct PortForwardEntry {
    session_id: String,
    local_port: u16,
    remote_host: String,
    remote_port: u16,
    cancel: Arc<tokio::sync::Notify>,
}

#[derive(Debug, Clone, Serialize)]
pub struct PortForwardInfo {
    pub id: String,
    pub local_port: u16,
    pub remote_host: String,
    pub remote_port: u16,
}

#[derive(Debug, Clone, Serialize)]
pub struct RemoteService {
    pub port: u16,
    pub process: Option<String>,
}

fn extract_port(line: &str) -> Option<u16> {
    for tok in line.split_whitespace() {
        if let Some(idx) = tok.rfind(':') {
            let port_str = &tok[idx + 1..];
            if !port_str.is_empty() && port_str.bytes().all(|b| b.is_ascii_digit()) {
                if let Ok(port) = port_str.parse::<u16>() {
                    return Some(port);
                }
            }
        }
    }
    None
}

fn extract_process(line: &str) -> Option<String> {
    // ss format: users:(("nginx",pid=123,fd=6),...)
    if let Some(pos) = line.find("((\"") {
        let rest = &line[pos + 3..];
        if let Some(end) = rest.find('"') {
            return Some(rest[..end].to_string());
        }
    }
    // netstat format: trailing token like "123/nginx"
    if let Some(tok) = line.split_whitespace().last() {
        if let Some(slash) = tok.find('/') {
            let name = &tok[slash + 1..];
            if !name.is_empty() && name != "-" {
                return Some(name.to_string());
            }
        }
    }
    None
}

fn parse_listening_ports(output: &str) -> Vec<RemoteService> {
    let mut seen = std::collections::HashSet::new();
    let mut services = Vec::new();
    for line in output.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let lower = line.to_lowercase();
        if lower.starts_with("state")
            || lower.starts_with("proto")
            || lower.starts_with("active")
            || lower.starts_with("netid")
        {
            continue;
        }
        // ss -l output omits the State column header data sometimes; keep entries
        // that look like listeners. netstat -l lines all contain LISTEN.
        if lower.contains("listen") || lower.starts_with("tcp") {
            if let Some(port) = extract_port(line) {
                if seen.insert(port) {
                    services.push(RemoteService {
                        port,
                        process: extract_process(line),
                    });
                }
            }
        }
    }
    services.sort_by_key(|s| s.port);
    services
}

pub struct SshManager {
    sessions: Arc<Mutex<HashMap<String, SessionHandle>>>,
    port_forwards: Arc<Mutex<HashMap<String, PortForwardEntry>>>,
}

#[allow(dead_code)]
struct SshHandler {
    app: AppHandle,
    session_id: String,
}

#[async_trait]
impl client::Handler for SshHandler {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        _server_public_key: &key::PublicKey,
    ) -> std::result::Result<bool, Self::Error> {
        Ok(true)
    }
}

impl SshManager {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
            port_forwards: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn connect(
        &self,
        app: AppHandle,
        session_id: String,
        params: ConnectionParams,
    ) -> Result<()> {
        let config = Arc::new(client::Config {
            inactivity_timeout: Some(std::time::Duration::from_secs(60)),
            keepalive_interval: Some(std::time::Duration::from_secs(30)),
            ..Default::default()
        });

        let handler = SshHandler {
            app: app.clone(),
            session_id: session_id.clone(),
        };

        let addr = format!("{}:{}", params.host, params.port);
        let mut session = client::connect(config, addr.as_str(), handler)
            .await
            .map_err(|e| anyhow!("Connection failed: {}", e))?;

        match &params.auth {
            AuthMethod::Password(password) => {
                let ok = session
                    .authenticate_password(&params.username, password)
                    .await
                    .map_err(|e| anyhow!("Auth error: {}", e))?;
                if !ok {
                    return Err(anyhow!("Wrong username or password"));
                }
            }
            AuthMethod::PrivateKey { path, passphrase } => {
                let key = russh_keys::load_secret_key(path, passphrase.as_deref())
                    .map_err(|e| anyhow!("Failed to load key: {}", e))?;
                let ok = session
                    .authenticate_publickey(&params.username, Arc::new(key))
                    .await
                    .map_err(|e| anyhow!("Auth error: {}", e))?;
                if !ok {
                    return Err(anyhow!("Public key authentication failed"));
                }
            }
        }

        let mut channel = session
            .channel_open_session()
            .await
            .map_err(|e| anyhow!("Failed to open channel: {}", e))?;

        channel
            .request_pty(false, "xterm-256color", 220, 50, 0, 0, &[])
            .await
            .map_err(|e| anyhow!("PTY request failed: {}", e))?;

        channel
            .request_shell(false)
            .await
            .map_err(|e| anyhow!("Shell request failed: {}", e))?;

        let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<SessionCmd>();
        let session_handle = Arc::new(session);

        {
            let mut sessions = self.sessions.lock().await;
            sessions.insert(
                session_id.clone(),
                SessionHandle {
                    tx,
                    handle: session_handle,
                },
            );
        }

        let sessions_ref = self.sessions.clone();
        let port_forwards_ref = self.port_forwards.clone();
        let sid = session_id.clone();

        tokio::spawn(async move {
            loop {
                tokio::select! {
                    msg = channel.wait() => {
                        match msg {
                            Some(ChannelMsg::Data { ref data }) => {
                                let _ = app.emit(&format!("ssh_data_{}", sid), data.to_vec());
                            }
                            Some(ChannelMsg::ExitStatus { exit_status: _ }) => {
                                break;
                            }
                            None => break,
                            _ => {}
                        }
                    }
                    cmd = rx.recv() => {
                        match cmd {
                            Some(SessionCmd::Data(data)) => {
                                let _ = channel.data(data.as_slice()).await;
                            }
                            Some(SessionCmd::Resize { cols, rows }) => {
                                let _ = channel.window_change(cols, rows, 0, 0).await;
                            }
                            Some(SessionCmd::Close) | None => {
                                let _ = channel.close().await;
                                break;
                            }
                        }
                    }
                }
            }

            let mut sessions = sessions_ref.lock().await;
            sessions.remove(&sid);
            let _ = app.emit(&format!("ssh_closed_{}", sid), ());

            // Cancel all port forwards for this session
            let mut forwards = port_forwards_ref.lock().await;
            let to_cancel: Vec<String> = forwards
                .iter()
                .filter(|(_, v)| v.session_id == sid)
                .map(|(k, _)| k.clone())
                .collect();
            for id in to_cancel {
                if let Some(entry) = forwards.remove(&id) {
                    entry.cancel.notify_waiters();
                }
            }
        });

        Ok(())
    }

    pub async fn send_data(&self, session_id: &str, data: Vec<u8>) -> Result<()> {
        let sessions = self.sessions.lock().await;
        if let Some(handle) = sessions.get(session_id) {
            handle
                .tx
                .send(SessionCmd::Data(data))
                .map_err(|_| anyhow!("Session not found or closed"))?;
        } else {
            return Err(anyhow!("Session not found or closed"));
        }
        Ok(())
    }

    pub async fn resize(&self, session_id: &str, cols: u32, rows: u32) -> Result<()> {
        let sessions = self.sessions.lock().await;
        if let Some(handle) = sessions.get(session_id) {
            handle
                .tx
                .send(SessionCmd::Resize { cols, rows })
                .map_err(|_| anyhow!("Session not found or closed"))?;
        } else {
            return Err(anyhow!("Session not found or closed"));
        }
        Ok(())
    }

    pub async fn disconnect(&self, session_id: &str) {
        let sessions = self.sessions.lock().await;
        if let Some(handle) = sessions.get(session_id) {
            let _ = handle.tx.send(SessionCmd::Close);
        }
    }

    async fn session_handle(&self, session_id: &str) -> Result<Arc<client::Handle<SshHandler>>> {
        let sessions = self.sessions.lock().await;
        sessions
            .get(session_id)
            .map(|session| session.handle.clone())
            .ok_or_else(|| anyhow!("Session not found or closed"))
    }

    pub async fn ping(&self, session_id: &str) -> Result<PingResult> {
        let handle = self.session_handle(session_id).await?;
        let started = Instant::now();
        let mut channel = handle.channel_open_session().await?;
        channel.exec(true, "true").await?;

        let result = tokio::time::timeout(std::time::Duration::from_secs(5), async {
            loop {
                match channel.wait().await {
                    Some(ChannelMsg::ExitStatus { .. }) | Some(ChannelMsg::Eof) | None => break,
                    _ => {}
                }
            }
        })
        .await;

        let _ = channel.close().await;

        match result {
            Ok(_) => Ok(PingResult {
                ok: true,
                latency_ms: started.elapsed().as_secs_f64() * 1000.0,
                error: None,
            }),
            Err(_) => Ok(PingResult {
                ok: false,
                latency_ms: 0.0,
                error: Some("timeout".to_string()),
            }),
        }
    }

    async fn open_sftp(&self, session_id: &str) -> Result<SftpSession> {
        let handle = self.session_handle(session_id).await?;
        let channel = handle.channel_open_session().await?;
        channel.request_subsystem(true, "sftp").await?;
        SftpSession::new(channel.into_stream())
            .await
            .map_err(|e| anyhow!("SFTP failed: {e}"))
    }

    pub async fn sftp_list(&self, session_id: &str, path: String) -> Result<Vec<SftpEntry>> {
        let sftp = self.open_sftp(session_id).await?;
        let entries = sftp
            .read_dir(path)
            .await?
            .map(|entry| {
                let metadata = entry.metadata();
                SftpEntry {
                    name: entry.file_name(),
                    path: entry.path(),
                    is_dir: metadata.is_dir(),
                    is_file: metadata.is_regular(),
                    is_symlink: metadata.is_symlink(),
                    size: metadata.len(),
                    modified: metadata.mtime,
                }
            })
            .collect();
        let _ = sftp.close().await;
        Ok(entries)
    }

    pub async fn sftp_mkdir(&self, session_id: &str, path: String) -> Result<()> {
        let sftp = self.open_sftp(session_id).await?;
        sftp.create_dir(path).await?;
        let _ = sftp.close().await;
        Ok(())
    }

    pub async fn sftp_delete(&self, session_id: &str, path: String, is_dir: bool) -> Result<()> {
        let sftp = self.open_sftp(session_id).await?;
        if is_dir {
            sftp.remove_dir(path).await?;
        } else {
            sftp.remove_file(path).await?;
        }
        let _ = sftp.close().await;
        Ok(())
    }

    pub async fn sftp_rename(
        &self,
        session_id: &str,
        old_path: String,
        new_path: String,
    ) -> Result<()> {
        let sftp = self.open_sftp(session_id).await?;
        sftp.rename(old_path, new_path).await?;
        let _ = sftp.close().await;
        Ok(())
    }

    pub async fn sftp_upload(
        &self,
        session_id: &str,
        local_path: String,
        remote_path: String,
    ) -> Result<()> {
        let sftp = self.open_sftp(session_id).await?;
        let data = tokio::fs::read(local_path).await?;
        let mut file = sftp.create(remote_path).await?;
        file.write_all(&data).await?;
        file.shutdown().await?;
        let _ = sftp.close().await;
        Ok(())
    }

    pub async fn port_forward_start(
        &self,
        session_id: &str,
        local_port: u16,
        remote_host: String,
        remote_port: u16,
    ) -> Result<String> {
        let handle = self.session_handle(session_id).await?;

        // Bind both IPv4 and IPv6 loopback so that connecting to "localhost"
        // works regardless of how the OS resolves it (Windows often prefers ::1).
        let v4 = TcpListener::bind(("127.0.0.1", local_port))
            .await
            .map_err(|e| anyhow!("Cannot bind 127.0.0.1:{local_port}: {e}"))?;
        let v6 = TcpListener::bind(("::1", local_port)).await.ok();

        let cancel = Arc::new(tokio::sync::Notify::new());
        let forward_id = uuid::Uuid::new_v4().to_string();

        {
            let mut forwards = self.port_forwards.lock().await;
            forwards.insert(
                forward_id.clone(),
                PortForwardEntry {
                    session_id: session_id.to_string(),
                    local_port,
                    remote_host: remote_host.clone(),
                    remote_port,
                    cancel: cancel.clone(),
                },
            );
        }

        let forwards_ref = self.port_forwards.clone();
        let fwd_id = forward_id.clone();

        tokio::spawn(async move {
            loop {
                tokio::select! {
                    _ = cancel.notified() => break,
                    result = v4.accept() => {
                        if !Self::handle_forward_conn(result, &handle, &remote_host, remote_port) {
                            break;
                        }
                    }
                    result = async {
                        match &v6 {
                            Some(listener) => listener.accept().await,
                            None => std::future::pending().await,
                        }
                    } => {
                        if !Self::handle_forward_conn(result, &handle, &remote_host, remote_port) {
                            break;
                        }
                    }
                }
            }
            let mut forwards = forwards_ref.lock().await;
            forwards.remove(&fwd_id);
        });

        Ok(forward_id)
    }

    // Spawns a proxy task for one accepted local connection.
    // Returns false if the listener errored and the loop should stop.
    fn handle_forward_conn(
        result: std::io::Result<(tokio::net::TcpStream, std::net::SocketAddr)>,
        handle: &Arc<client::Handle<SshHandler>>,
        remote_host: &str,
        remote_port: u16,
    ) -> bool {
        let (tcp_stream, _) = match result {
            Ok(pair) => pair,
            Err(_) => return false,
        };
        let ssh_handle = handle.clone();
        let rhost = remote_host.to_string();
        tokio::spawn(async move {
            match ssh_handle
                .channel_open_direct_tcpip(&rhost, remote_port as u32, "127.0.0.1", 0)
                .await
            {
                Ok(channel) => {
                    let mut ch_stream = channel.into_stream();
                    let mut tcp = tcp_stream;
                    let _ = tokio::io::copy_bidirectional(&mut tcp, &mut ch_stream).await;
                }
                Err(e) => {
                    eprintln!("direct-tcpip failed: {e}");
                }
            }
        });
        true
    }

    async fn run_command(&self, session_id: &str, command: &str) -> Result<String> {
        let handle = self.session_handle(session_id).await?;
        let mut channel = handle.channel_open_session().await?;
        channel.exec(true, command).await?;

        let mut output = Vec::new();
        let collected = tokio::time::timeout(std::time::Duration::from_secs(10), async {
            loop {
                match channel.wait().await {
                    Some(ChannelMsg::Data { ref data }) => output.extend_from_slice(data),
                    Some(ChannelMsg::ExtendedData { ref data, .. }) => {
                        output.extend_from_slice(data)
                    }
                    Some(ChannelMsg::Eof) | None => break,
                    _ => {}
                }
            }
        })
        .await;
        let _ = channel.close().await;
        collected.map_err(|_| anyhow!("command timed out"))?;
        Ok(String::from_utf8_lossy(&output).into_owned())
    }

    pub async fn scan_remote_ports(&self, session_id: &str) -> Result<Vec<RemoteService>> {
        let cmd = "ss -tlnpH 2>/dev/null || ss -tlnH 2>/dev/null || netstat -tlnp 2>/dev/null || netstat -tln 2>/dev/null";
        let output = self.run_command(session_id, cmd).await?;
        Ok(parse_listening_ports(&output))
    }

    pub async fn port_forward_stop(&self, forward_id: &str) {
        let mut forwards = self.port_forwards.lock().await;
        if let Some(entry) = forwards.remove(forward_id) {
            entry.cancel.notify_waiters();
        }
    }

    pub async fn port_forward_list(&self, session_id: &str) -> Vec<PortForwardInfo> {
        let forwards = self.port_forwards.lock().await;
        forwards
            .iter()
            .filter(|(_, v)| v.session_id == session_id)
            .map(|(id, v)| PortForwardInfo {
                id: id.clone(),
                local_port: v.local_port,
                remote_host: v.remote_host.clone(),
                remote_port: v.remote_port,
            })
            .collect()
    }

    pub async fn sftp_download(
        &self,
        session_id: &str,
        remote_path: String,
        local_path: String,
    ) -> Result<()> {
        let sftp = self.open_sftp(session_id).await?;
        let mut remote = sftp.open(remote_path).await?;
        let mut data = Vec::new();
        remote.read_to_end(&mut data).await?;
        tokio::fs::write(local_path, data).await?;
        let _ = remote.shutdown().await;
        let _ = sftp.close().await;
        Ok(())
    }
}
