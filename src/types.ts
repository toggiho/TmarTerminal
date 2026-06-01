export interface SavedConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  auth_type: "password" | "key";
  key_path?: string;
  password?: string;
  snippets?: ConnectionSnippet[];
}

export interface ConnectionSnippet {
  id: string;
  name: string;
  command: string;
  autoEnter?: boolean;
}

export interface TerminalPane {
  id: string;
  sessionId: string;
  title: string;
  host?: string;
  status: "connecting" | "connected" | "disconnected" | "error";
  type: "ssh" | "local";
  connectionId?: string;
  hasUnreadOutput?: boolean;
  lastActivityAt?: number;
  lastError?: string;
}

export type PaneLayout =
  | { type: "leaf"; paneId: string }
  | { type: "split"; direction: "horizontal" | "vertical"; first: PaneLayout; second: PaneLayout };

export interface Tab {
  id: string;
  title: string;
  panes: TerminalPane[];
  activePaneId: string;
  layout: PaneLayout;
  maximizedPaneId?: string;
}

export interface ConnectFormData {
  name: string;
  host: string;
  port: number;
  username: string;
  authType: "password" | "key";
  password: string;
  savePassword: boolean;
  keyPath: string;
  keyPassphrase: string;
  saveConnection: boolean;
  _editId?: string;
  targetTabId?: string;
  targetPaneId?: string;
  splitDirection?: "horizontal" | "vertical";
  snippets?: ConnectionSnippet[];
}

export type TerminalThemeName = "github-dark" | "dracula" | "nord" | "solarized-dark";

export interface HotkeySettings {
  newTab: string;
  closeTab: string;
  toggleSidebar: string;
  toggleLocalPanel: string;
  nextTab: string;
  previousTab: string;
  splitRight: string;
  splitDown: string;
  closePane: string;
  maximizePane: string;
  terminalSearch: string;
  openSftp: string;
  focusPreviousPane: string;
  focusNextPane: string;
  commandPalette: string;
  reconnectLast: string;
}

export interface AppSettings {
  terminalTheme: TerminalThemeName;
  fontSize: number;
  hotkeys: HotkeySettings;
}

export interface RecentConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  auth_type: "password" | "key";
  key_path?: string;
  password?: string;
  connectionId?: string;
  lastConnectedAt: number;
}

export interface PortForwardRecord {
  id: string;
  sessionId: string;
  sessionLabel: string;
  localPort: number;
  remoteHost: string;
  remotePort: number;
}
