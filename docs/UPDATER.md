# Native updates

TmarTerminal uses the Tauri updater plugin and GitHub Releases.

The updater public key is already configured in `src-tauri/tauri.conf.json`.
The private signing key was generated outside the repository:

- Private key: `C:\Users\markeev\.tauri\tmar-terminal-updater.key`
- Password: `C:\Users\markeev\.tauri\tmar-terminal-updater-password.txt`

Before publishing the first updater-enabled release:

1. Add the private key content to the repository secret `TAURI_SIGNING_PRIVATE_KEY`.
2. Add the private key password to `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.
3. Publish releases by pushing SemVer tags such as `v0.3.2`.

The release workflow builds the Windows installer, creates signed updater artifacts,
uploads `latest.json`, and prefers the NSIS setup executable for updater installs.
