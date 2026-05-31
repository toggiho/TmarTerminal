# Changelog

All notable changes to TmarTerminal are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-05-31

### Added
- **SSH local port forwarding.** A new port forwarding button sits next to the
  SFTP button on connected SSH panes. Forward `localhost:<local_port>` to a
  `<remote_host>:<remote_port>` over the active SSH session (local `-L` style
  forwarding via `channel_open_direct_tcpip`).
- **Remote service discovery.** Scan the remote host for listening TCP ports
  (`ss -tlnpH` with a `netstat` fallback) and forward any discovered service
  with a single click. Process names are shown where available.
- **Active tunnel management.** Active tunnels are listed in the port forwarding
  dialog and can be stopped individually. Tunnels are automatically cancelled
  when their SSH session disconnects.

### Fixed
- Port forwarding listeners now bind both `127.0.0.1` and `::1`, so connecting
  to `localhost` works regardless of how the OS resolves it. Previously the
  IPv4-only listener left tunnels unreachable on Windows, where `localhost`
  commonly resolves to IPv6 `::1`.

## [0.1.0]

### Added
- Initial TmarTerminal release: Tauri-based SSH terminal client with multi-pane
  terminals, saved connections, `~/.ssh/config` import, SFTP file transfer, and
  a local PowerShell panel.

[0.2.0]: https://github.com/toggiho/TmarTerminal/releases/tag/v0.2.0
[0.1.0]: https://github.com/toggiho/TmarTerminal/releases/tag/v0.1.0
