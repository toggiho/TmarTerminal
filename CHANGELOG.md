# Changelog

All notable changes to TmarTerminal are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.2] - 2026-06-02

### Added
- **Native updater.** TmarTerminal now checks GitHub Releases in the background,
  shows an update indicator in the title bar, displays release notes, and can
  install signed updates through the native Tauri updater.

### Changed
- **Release automation.** GitHub Actions now builds signed Windows release
  artifacts and publishes the updater `latest.json` file for future versions.

## [0.3.0] - 2026-06-01

### Added
- **Command Palette.** Added a global command palette for quickly opening
  actions, saved connections, recent sessions, and SSH snippets from one place.
- **Recent sessions and quick reconnect.** The sidebar and welcome screen now
  show recently used hosts, and the app can reconnect the latest session with a
  dedicated hotkey.
- **Per-pane activity indicators.** Tabs and panes now show unread terminal
  output and clearer connection state, making background sessions easier to
  monitor.
- **SSH snippets.** Saved connections can now store reusable commands and run
  them directly in an active SSH pane.
- **Port forward dashboard.** Active tunnels are now visible in a persistent
  side dashboard with refresh, copy, and stop controls.

### Changed
- **Release polish.** Version metadata has been bumped to `0.3.0` across the
  frontend and Tauri manifests, and the release notes/install references have
  been updated for the new build.

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
[0.3.0]: https://github.com/toggiho/TmarTerminal/releases/tag/v0.3.0
[0.3.2]: https://github.com/toggiho/TmarTerminal/releases/tag/v0.3.2
