<p align="center">
  <img src="https://raw.githubusercontent.com/toggiho/TmarTerminal/main/docs/logo.png" width="160" alt="TmarTerminal logo" />
</p>

<h1 align="center">TmarTerminal</h1>

<p align="center">
  <b>A dark, fast, Windows-first SSH terminal</b><br/>
  Built with Tauri · React · xterm.js · Rust
</p>

<p align="center">
  <a href="https://github.com/toggiho/TmarTerminal/releases/latest">
    <img alt="Latest release" src="https://img.shields.io/github/v/release/toggiho/TmarTerminal?style=for-the-badge&color=8B5CF6&label=download">
  </a>
  <a href="https://github.com/toggiho/TmarTerminal/releases">
    <img alt="Downloads" src="https://img.shields.io/github/downloads/toggiho/TmarTerminal/total?style=for-the-badge&color=06B6D4">
  </a>
  <a href="./LICENSE">
    <img alt="License" src="https://img.shields.io/github/license/toggiho/TmarTerminal?style=for-the-badge&color=22C55E">
  </a>
</p>

<p align="center">
  <img alt="Tauri" src="https://img.shields.io/badge/Tauri-2.x-24C8DB?style=flat-square&logo=tauri&logoColor=white">
  <img alt="React" src="https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=0B1020">
  <img alt="Rust" src="https://img.shields.io/badge/Rust-SSH_backend-F46623?style=flat-square&logo=rust&logoColor=white">
  <img alt="Windows" src="https://img.shields.io/badge/Windows-10%2F11-0078D4?style=flat-square&logo=windows&logoColor=white">
</p>

<p align="center">
  <a href="#-русский">🇷🇺 Русский</a>
  <span> · </span>
  <a href="#-english">🇬🇧 English</a>
  <span> · </span>
  <a href="#-中文">🇨🇳 中文</a>
</p>

---

<p align="center">
  <img src="https://raw.githubusercontent.com/toggiho/TmarTerminal/main/docs/session.png" width="49%" alt="TmarTerminal SSH session" />
  &nbsp;
  <img src="https://raw.githubusercontent.com/toggiho/TmarTerminal/main/docs/welcome.png" width="49%" alt="TmarTerminal welcome screen" />
</p>

---

## 🇷🇺 Русский

**TmarTerminal** — современный SSH-терминал для Windows: тёмный интерфейс, вкладки, split-панели, локальный PowerShell, SFTP, проброс портов и настраиваемые темы. Быстрый Rust-бэкенд, нативное desktop-приложение на Tauri.

### ✨ Возможности

| | |
|---|---|
| 🔐 **SSH** | Подключение по паролю и private key |
| 💾 **Подключения** | Сохранённые профили + импорт из `~/.ssh/config` |
| 🗂️ **Вкладки и split** | Несколько сессий и панелей в одном окне |
| 🖥️ **Локальный PowerShell** | Локальные панели рядом с SSH-сессиями |
| 📁 **SFTP** | Двухпанельный файловый менеджер: upload/download, mkdir/delete/rename |
| 🔀 **Проброс портов** | Форвардинг `localhost:port` → удалённый хост, сканирование сервисов и форвард в один клик |
| 📡 **Ping** | Round-trip latency активного подключения в статус-баре |
| 📋 **Копирование** | Выделение в терминале + `Ctrl+Shift+C` копирует в буфер обмена |
| 🎨 **Темы** | Темы терминала, размер шрифта, настраиваемые хоткеи |

### 📦 Установка

Скачай последнюю сборку в разделе **[Releases](https://github.com/toggiho/TmarTerminal/releases/latest)**:

- `TmarTerminal_0.3.2_x64-setup.exe` — Windows installer (рекомендуется).
- `TmarTerminal_0.3.2_x64_en-US.msi` — MSI installer.

### 🛠️ Разработка

```powershell
npm install
npm run tauri dev
```

Если Rust не видит MSVC toolchain:

```powershell
.\dev.ps1
```

### 🏗️ Сборка

```powershell
npm run build
cd src-tauri; cargo check; cd ..
npm run tauri build
```

> Saved connections хранятся в пользовательской config-директории в `TmarTerminal/connections.json`. Этот файл не входит в репозиторий.

---

## 🇬🇧 English

**TmarTerminal** is a modern SSH terminal for Windows: dark desktop UI, tabs, split panes, local PowerShell, SFTP, port forwarding, and configurable themes. Fast Rust backend, native Tauri app.

### ✨ Features

| | |
|---|---|
| 🔐 **SSH** | Password or private key authentication |
| 💾 **Connections** | Saved profiles + `~/.ssh/config` import |
| 🗂️ **Tabs & splits** | Multiple sessions and panes in one window |
| 🖥️ **Local PowerShell** | Local panes next to your SSH sessions |
| 📁 **SFTP** | Dual-pane file manager: upload/download, mkdir/delete/rename |
| 🔀 **Port forwarding** | Forward `localhost:port` to a remote host, scan listening services, forward in one click |
| 📡 **Ping** | Active connection round-trip latency in the status bar |
| 📋 **Copy** | Select text in the terminal and press `Ctrl+Shift+C` to copy |
| 🎨 **Themes** | Terminal themes, font size, configurable hotkeys |

### 📦 Install

Download the latest build from **[Releases](https://github.com/toggiho/TmarTerminal/releases/latest)**:

- `TmarTerminal_0.3.2_x64-setup.exe` — Windows installer (recommended).
- `TmarTerminal_0.3.2_x64_en-US.msi` — MSI installer.

### 🛠️ Development

```powershell
npm install
npm run tauri dev
```

If Rust cannot find the MSVC toolchain:

```powershell
.\dev.ps1
```

### 🏗️ Build

```powershell
npm run build
cd src-tauri; cargo check; cd ..
npm run tauri build
```

Native updater releases require signing keys and GitHub release artifacts. See [`docs/UPDATER.md`](docs/UPDATER.md) before publishing a tagged release.

> Saved connections are stored in the user's config directory under `TmarTerminal/connections.json`. That file is not part of the repository.

---

## 🇨🇳 中文

**TmarTerminal** 是一个面向 Windows 的现代 SSH 终端：深色界面、标签页、分屏面板、本地 PowerShell、SFTP、端口转发和可配置主题。Rust 后端，基于 Tauri 的原生桌面应用。

### ✨ 功能

| | |
|---|---|
| 🔐 **SSH** | 支持密码和私钥登录 |
| 💾 **连接** | 保存连接 + 从 `~/.ssh/config` 导入 |
| 🗂️ **标签与分屏** | 单窗口内多会话、多面板 |
| 🖥️ **本地 PowerShell** | 在 SSH 会话旁打开本地面板 |
| 📁 **SFTP** | 双面板文件管理：上传/下载、创建目录、删除、重命名 |
| 🔀 **端口转发** | 将 `localhost:port` 转发到远程主机，扫描监听服务并一键转发 |
| 📡 **Ping** | 状态栏显示当前连接的往返延迟 |
| 📋 **复制** | 在终端中选择文本，按 `Ctrl+Shift+C` 复制到剪贴板 |
| 🎨 **主题** | 终端主题、字体大小、可配置快捷键 |

### 📦 安装

请在 **[Releases](https://github.com/toggiho/TmarTerminal/releases/latest)** 页面下载最新版本：

- `TmarTerminal_0.3.2_x64-setup.exe` — Windows 安装器（推荐）。
- `TmarTerminal_0.3.2_x64_en-US.msi` — MSI 安装器。

### 🛠️ 开发

```powershell
npm install
npm run tauri dev
```

如果 Rust 找不到 MSVC 工具链：

```powershell
.\dev.ps1
```

### 🏗️ 构建

```powershell
npm run build
cd src-tauri; cargo check; cd ..
npm run tauri build
```

> 保存的连接位于用户配置目录中的 `TmarTerminal/connections.json`。该文件不会提交到仓库。
