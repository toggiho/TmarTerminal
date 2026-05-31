# TmarTerminal — Setup Guide

## Prerequisites

### 1. Install Rust (if not installed)
```powershell
winget install Rustlang.Rustup
```
Close and reopen PowerShell, then verify:
```powershell
rustc --version
```

### 2. Install Visual Studio Build Tools (required for Rust on Windows)
```powershell
winget install Microsoft.VisualStudio.2022.BuildTools
```
During install, select: **Desktop development with C++**

### 3. Install Node.js dependencies
```powershell
npm install
```

## Development

```powershell
npm run tauri dev
```

## Production build

```powershell
npm run tauri build
```
Output: `src-tauri/target/release/tmar-terminal.exe` (~5MB)
