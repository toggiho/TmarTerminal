use serde::Serialize;
use std::fs;

#[derive(Debug, Clone, Serialize)]
pub struct SshConfigEntry {
    pub name: String,
    pub hostname: String,
    pub port: u16,
    pub user: String,
    pub identity_file: Option<String>,
}

pub fn parse_ssh_config() -> Vec<SshConfigEntry> {
    let config_path = dirs::home_dir().map(|h| h.join(".ssh").join("config"));

    let content = match config_path.and_then(|p| fs::read_to_string(p).ok()) {
        Some(c) => c,
        None => return vec![],
    };

    let mut entries: Vec<SshConfigEntry> = Vec::new();
    let mut current: Option<PartialEntry> = None;

    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }

        let (key, value) = match line.split_once(char::is_whitespace) {
            Some((k, v)) => (k.to_lowercase(), v.trim().to_string()),
            None => continue,
        };

        match key.as_str() {
            "host" => {
                if let Some(p) = current.take() {
                    if let Some(e) = p.build() {
                        entries.push(e);
                    }
                }
                // Skip wildcards and multi-host patterns
                if !value.contains('*') && !value.contains('?') && !value.contains(' ') {
                    current = Some(PartialEntry {
                        name: value,
                        hostname: None,
                        port: None,
                        user: None,
                        identity_file: None,
                    });
                }
            }
            "hostname" => {
                if let Some(ref mut p) = current {
                    p.hostname = Some(value);
                }
            }
            "port" => {
                if let Some(ref mut p) = current {
                    p.port = value.parse().ok();
                }
            }
            "user" => {
                if let Some(ref mut p) = current {
                    p.user = Some(value);
                }
            }
            "identityfile" => {
                if let Some(ref mut p) = current {
                    let home = dirs::home_dir()
                        .map(|h| h.to_string_lossy().into_owned())
                        .unwrap_or_default();
                    p.identity_file = Some(value.replace('~', &home));
                }
            }
            _ => {}
        }
    }

    if let Some(p) = current {
        if let Some(e) = p.build() {
            entries.push(e);
        }
    }

    entries
}

struct PartialEntry {
    name: String,
    hostname: Option<String>,
    port: Option<u16>,
    user: Option<String>,
    identity_file: Option<String>,
}

impl PartialEntry {
    fn build(self) -> Option<SshConfigEntry> {
        let hostname = self.hostname.unwrap_or_else(|| self.name.clone());
        Some(SshConfigEntry {
            name: self.name,
            hostname,
            port: self.port.unwrap_or(22),
            user: self.user.unwrap_or_else(|| "root".to_string()),
            identity_file: self.identity_file,
        })
    }
}
