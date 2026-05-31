use anyhow::{anyhow, Result};
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use std::collections::HashMap;
use std::io::Read;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};

pub enum PtyCmd {
    Data(Vec<u8>),
    Resize { cols: u16, rows: u16 },
    Close,
}

struct PtyHandle {
    tx: std::sync::mpsc::SyncSender<PtyCmd>,
}

pub struct PtyManager {
    sessions: Arc<Mutex<HashMap<String, PtyHandle>>>,
}

impl PtyManager {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn start(&self, app: AppHandle, session_id: String) -> Result<()> {
        let pty_system = native_pty_system();

        let pair = pty_system
            .openpty(PtySize {
                rows: 24,
                cols: 80,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| anyhow!("Failed to open PTY: {}", e))?;

        let mut cmd = CommandBuilder::new("powershell.exe");
        cmd.arg("-NoLogo");

        pair.slave
            .spawn_command(cmd)
            .map_err(|e| anyhow!("Failed to spawn PowerShell: {}", e))?;

        drop(pair.slave);

        let mut reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| anyhow!("Failed to clone reader: {}", e))?;

        let (tx, rx) = std::sync::mpsc::sync_channel::<PtyCmd>(64);

        {
            let mut sessions = self.sessions.lock().unwrap();
            sessions.insert(session_id.clone(), PtyHandle { tx });
        }

        // Reader thread: streams PTY output to frontend
        let app_r = app.clone();
        let sid_r = session_id.clone();
        std::thread::spawn(move || {
            let mut buf = [0u8; 4096];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) | Err(_) => break,
                    Ok(n) => {
                        let _ = app_r.emit(&format!("pty_data_{}", sid_r), buf[..n].to_vec());
                    }
                }
            }
            let _ = app_r.emit(&format!("pty_closed_{}", sid_r), ());
        });

        // Writer/resize thread — owns pair.master; use take_writer() for input
        let sessions_ref = self.sessions.clone();
        let sid_w = session_id.clone();
        std::thread::spawn(move || {
            let mut writer = match pair.master.take_writer() {
                Ok(w) => w,
                Err(_) => return,
            };
            loop {
                match rx.recv() {
                    Ok(PtyCmd::Data(data)) => {
                        use std::io::Write;
                        if writer.write_all(&data).is_err() {
                            break;
                        }
                    }
                    Ok(PtyCmd::Resize { cols, rows }) => {
                        let _ = pair.master.resize(PtySize {
                            rows,
                            cols,
                            pixel_width: 0,
                            pixel_height: 0,
                        });
                    }
                    Ok(PtyCmd::Close) | Err(_) => break,
                }
            }
            sessions_ref.lock().unwrap().remove(&sid_w);
        });

        Ok(())
    }

    pub fn send(&self, session_id: &str, data: Vec<u8>) -> Result<()> {
        let sessions = self.sessions.lock().unwrap();
        if let Some(h) = sessions.get(session_id) {
            h.tx.send(PtyCmd::Data(data))
                .map_err(|_| anyhow!("PTY session closed"))?;
        } else {
            return Err(anyhow!("PTY session not found"));
        }
        Ok(())
    }

    pub fn resize(&self, session_id: &str, cols: u16, rows: u16) {
        if let Ok(sessions) = self.sessions.lock() {
            if let Some(h) = sessions.get(session_id) {
                let _ = h.tx.send(PtyCmd::Resize { cols, rows });
            }
        }
    }

    pub fn close(&self, session_id: &str) {
        if let Ok(sessions) = self.sessions.lock() {
            if let Some(h) = sessions.get(session_id) {
                let _ = h.tx.send(PtyCmd::Close);
            }
        }
    }
}
