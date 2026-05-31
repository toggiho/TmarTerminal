import { RotateCcw, Settings, X } from "lucide-react";
import { THEME_LABELS } from "../settings";
import { HotkeySettings, TerminalThemeName } from "../types";
import { useStore } from "../store/useStore";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

const HOTKEY_LABELS: Array<[keyof HotkeySettings, string]> = [
  ["newTab", "New SSH tab"],
  ["closeTab", "Close tab"],
  ["toggleSidebar", "Toggle sidebar"],
  ["toggleLocalPanel", "Toggle local panel"],
  ["nextTab", "Next tab"],
  ["previousTab", "Previous tab"],
  ["splitRight", "Split right"],
  ["splitDown", "Split down"],
  ["closePane", "Close pane"],
  ["maximizePane", "Maximize pane"],
  ["terminalSearch", "Terminal search"],
  ["openSftp", "Open SFTP"],
  ["focusPreviousPane", "Focus previous pane"],
  ["focusNextPane", "Focus next pane"],
];

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { settings, updateSettings, resetSettings } = useStore();
  if (!open) return null;

  const setHotkey = (key: keyof HotkeySettings, value: string) => {
    updateSettings({ hotkeys: { ...settings.hotkeys, [key]: value } });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" data-hotkeys="ignore">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-3xl max-h-[86vh] bg-bg-surface border border-border rounded-xl shadow-panel overflow-hidden">
        <div className="flex items-center justify-between h-11 px-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Settings size={16} className="text-accent-cyan" />
            <h2 className="text-sm font-semibold text-text-primary">Settings</h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={resetSettings}
              className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-text-muted hover:text-text-primary hover:bg-bg-hover"
            >
              <RotateCcw size={13} />
              Reset
            </button>
            <button onClick={onClose} className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-[260px_1fr] min-h-0">
          <section className="p-4 border-r border-border">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-3">
              Terminal
            </h3>
            <label className="block space-y-1.5 mb-4">
              <span className="text-xs text-text-muted">Theme</span>
              <select
                value={settings.terminalTheme}
                onChange={(e) => updateSettings({ terminalTheme: e.target.value as TerminalThemeName })}
                className="w-full bg-bg-base border border-border rounded px-2 py-2 text-sm text-text-primary"
              >
                {Object.entries(THEME_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs text-text-muted">Font size</span>
              <input
                type="number"
                min={10}
                max={24}
                value={settings.fontSize}
                onChange={(e) => updateSettings({ fontSize: Number(e.target.value) })}
                className="w-full bg-bg-base border border-border rounded px-2 py-2 text-sm text-text-primary"
              />
            </label>
          </section>

          <section className="p-4 overflow-y-auto max-h-[calc(86vh-44px)]">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-3">
              Hotkeys
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {HOTKEY_LABELS.map(([key, label]) => (
                <label key={key} className="space-y-1.5">
                  <span className="text-xs text-text-muted">{label}</span>
                  <input
                    value={settings.hotkeys[key]}
                    onChange={(e) => setHotkey(key, e.target.value)}
                    className="w-full bg-bg-base border border-border rounded px-2 py-2 text-sm text-text-primary font-mono"
                  />
                </label>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
