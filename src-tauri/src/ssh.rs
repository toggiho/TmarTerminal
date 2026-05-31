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

pub struct SshManager {
    sessions: Arc<Mutex<HashMap<String, SessionHandle>>>,
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
