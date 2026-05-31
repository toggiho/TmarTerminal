import { AppSettings, TerminalThemeName } from "./types";

export const TERMINAL_THEMES = {
  "github-dark": {
    background: "#0D1117",
    foreground: "#E6EDF3",
    cursor: "#7C3AED",
    cursorAccent: "#0D1117",
    selectionBackground: "rgba(124, 58, 237, 0.3)",
    black: "#0D1117",
    red: "#FF7B72",
    green: "#3FB950",
    yellow: "#D29922",
    blue: "#58A6FF",
    magenta: "#BC8CFF",
    cyan: "#39C5CF",
    white: "#B1BAC4",
    brightBlack: "#6E7681",
    brightRed: "#FFA198",
    brightGreen: "#56D364",
    brightYellow: "#E3B341",
    brightBlue: "#79C0FF",
    brightMagenta: "#D2A8FF",
    brightCyan: "#56D4DD",
    brightWhite: "#F0F6FC",
  },
  dracula: {
    background: "#282A36",
    foreground: "#F8F8F2",
    cursor: "#BD93F9",
    cursorAccent: "#282A36",
    selectionBackground: "rgba(189, 147, 249, 0.35)",
    black: "#21222C",
    red: "#FF5555",
    green: "#50FA7B",
    yellow: "#F1FA8C",
    blue: "#BD93F9",
    magenta: "#FF79C6",
    cyan: "#8BE9FD",
    white: "#F8F8F2",
    brightBlack: "#6272A4",
    brightRed: "#FF6E6E",
    brightGreen: "#69FF94",
    brightYellow: "#FFFFA5",
    brightBlue: "#D6ACFF",
    brightMagenta: "#FF92DF",
    brightCyan: "#A4FFFF",
    brightWhite: "#FFFFFF",
  },
  nord: {
    background: "#2E3440",
    foreground: "#D8DEE9",
    cursor: "#88C0D0",
    cursorAccent: "#2E3440",
    selectionBackground: "rgba(136, 192, 208, 0.32)",
    black: "#3B4252",
    red: "#BF616A",
    green: "#A3BE8C",
    yellow: "#EBCB8B",
    blue: "#81A1C1",
    magenta: "#B48EAD",
    cyan: "#88C0D0",
    white: "#E5E9F0",
    brightBlack: "#4C566A",
    brightRed: "#BF616A",
    brightGreen: "#A3BE8C",
    brightYellow: "#EBCB8B",
    brightBlue: "#81A1C1",
    brightMagenta: "#B48EAD",
    brightCyan: "#8FBCBB",
    brightWhite: "#ECEFF4",
  },
  "solarized-dark": {
    background: "#002B36",
    foreground: "#839496",
    cursor: "#2AA198",
    cursorAccent: "#002B36",
    selectionBackground: "rgba(42, 161, 152, 0.3)",
    black: "#073642",
    red: "#DC322F",
    green: "#859900",
    yellow: "#B58900",
    blue: "#268BD2",
    magenta: "#D33682",
    cyan: "#2AA198",
    white: "#EEE8D5",
    brightBlack: "#586E75",
    brightRed: "#CB4B16",
    brightGreen: "#586E75",
    brightYellow: "#657B83",
    brightBlue: "#839496",
    brightMagenta: "#6C71C4",
    brightCyan: "#93A1A1",
    brightWhite: "#FDF6E3",
  },
} as const;

export const THEME_LABELS: Record<TerminalThemeName, string> = {
  "github-dark": "GitHub Dark",
  dracula: "Dracula",
  nord: "Nord",
  "solarized-dark": "Solarized Dark",
};

export const DEFAULT_SETTINGS: AppSettings = {
  terminalTheme: "github-dark",
  fontSize: 14,
  hotkeys: {
    newTab: "Ctrl+T",
    closeTab: "Ctrl+W",
    toggleSidebar: "Ctrl+B",
    toggleLocalPanel: "Ctrl+`",
    nextTab: "Ctrl+Tab",
    previousTab: "Ctrl+Shift+Tab",
    splitRight: "Ctrl+Shift+D",
    splitDown: "Ctrl+Shift+E",
    closePane: "Ctrl+Shift+W",
    maximizePane: "Ctrl+Shift+Enter",
    terminalSearch: "Ctrl+Shift+F",
    openSftp: "Ctrl+Shift+S",
    focusPreviousPane: "Alt+ArrowLeft",
    focusNextPane: "Alt+ArrowRight",
  },
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem("tmar-terminal-settings");
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      hotkeys: { ...DEFAULT_SETTINGS.hotkeys, ...parsed.hotkeys },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: AppSettings) {
  localStorage.setItem("tmar-terminal-settings", JSON.stringify(settings));
}

export function isHotkey(event: KeyboardEvent, hotkey: string) {
  const parts = hotkey.toLowerCase().split("+").map((part) => part.trim());
  const key = parts[parts.length - 1];
  const eventKey = event.key.toLowerCase();
  const normalizedEventKey =
    eventKey === " " ? "space" :
    eventKey === "escape" ? "esc" :
    eventKey;

  return (
    event.ctrlKey === parts.includes("ctrl") &&
    event.shiftKey === parts.includes("shift") &&
    event.altKey === parts.includes("alt") &&
    event.metaKey === parts.includes("meta") &&
    normalizedEventKey === key
  );
}
