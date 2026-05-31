export interface SavedConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  auth_type: "password" | "key";
  key_path?: string;
  password?: string;
}

export interface TerminalPane {
  id: string;
  sessionId: string;
  title: string;
  host?: string;
  status: "connecting" | "connected" | "disconnected" | "error";
  type: "ssh" | "local";
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
}

export interface AppSettings {
  terminalTheme: TerminalThemeName;
  fontSize: number;
  hotkeys: HotkeySettings;
}
