# TmarTerminal

TmarTerminal is a Windows-focused SSH terminal built with Tauri, React, xterm.js, and Rust.

## Development

```powershell
npm install
npm run tauri dev
```

If Rust cannot find the MSVC toolchain, use the included launcher:

```powershell
.\dev.ps1
```

## Checks

```powershell
npm run build
cd src-tauri
cargo check
```

## Notes

- Saved connections are stored under the user's config directory in `TmarTerminal/connections.json`.
- Password saving currently stores the password in that JSON file. Prefer private key auth until credential-manager storage is added.
- The sidebar import button reads entries from `~/.ssh/config`.
