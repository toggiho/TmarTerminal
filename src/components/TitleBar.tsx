import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X, LayoutPanelLeft, TerminalSquare, Settings, Command, ArrowRightLeft, DownloadCloud } from "lucide-react";
import { useCallback } from "react";
import { TabBar } from "./TabBar";
import { useStore } from "../store/useStore";

interface TitleBarProps {
  onNewTab: () => void;
  onOpenSettings: () => void;
  onOpenPalette: () => void;
  onTogglePortDashboard: () => void;
  onOpenUpdate: () => void;
  portDashboardOpen: boolean;
  updateAvailable: boolean;
  updateVersion?: string;
}

export function TitleBar({
  onNewTab,
  onOpenSettings,
  onOpenPalette,
  onTogglePortDashboard,
  onOpenUpdate,
  portDashboardOpen,
  updateAvailable,
  updateVersion,
}: TitleBarProps) {
  const { toggleSidebar, toggleLocalPanel, localPanelOpen } = useStore();

  const handleDragMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    // Don't drag when clicking on interactive elements
    if (target.closest("button, a, input, select, [role='button']")) return;
    getCurrentWindow().startDragging();
  }, []);

  const win = getCurrentWindow();

  return (
    <div
      className="flex items-center h-10 bg-bg-surface border-b border-border select-none shrink-0"
      onMouseDown={handleDragMouseDown}
    >
      {/* Logo + sidebar toggle */}
      <div className="flex items-center gap-2 px-3 shrink-0">
        <div className="w-6 h-6 rounded-md bg-[#101827] border border-accent-cyan/40 flex items-center justify-center shadow-glow pointer-events-none">
          <span className="text-[13px] leading-none font-bold text-accent-cyan">T</span>
        </div>
        <button
          onClick={toggleSidebar}
          className="text-text-muted hover:text-text-primary hover:bg-bg-hover rounded p-1 transition-all"
          title="Toggle sidebar (Ctrl+B)"
        >
          <LayoutPanelLeft size={13} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex-1 flex items-center min-w-0 pr-2 h-full">
        <TabBar onNewTab={onNewTab} />
      </div>

      {/* PowerShell panel button */}
      <button
        onClick={onOpenPalette}
        title="Command palette (Ctrl+Shift+P)"
        className="flex items-center justify-center w-8 h-8 mr-1 rounded transition-all shrink-0 text-text-muted hover:text-text-primary hover:bg-bg-hover"
      >
        <Command size={14} />
      </button>

      <button
        onClick={onTogglePortDashboard}
        title="Port forwards dashboard"
        className={`flex items-center justify-center w-8 h-8 mr-1 rounded transition-all shrink-0 ${
          portDashboardOpen ? "bg-accent-purple/20 text-accent-purple" : "text-text-muted hover:text-accent-purple hover:bg-accent-purple/10"
        }`}
      >
        <ArrowRightLeft size={14} />
      </button>

      <button
        onClick={toggleLocalPanel}
        title="Local PowerShell (Ctrl+`)"
        className={`
          flex items-center justify-center w-8 h-8 mr-1 rounded transition-all shrink-0
          ${localPanelOpen
            ? "bg-accent-cyan/20 text-accent-cyan"
            : "text-text-muted hover:text-accent-cyan hover:bg-accent-cyan/10"}
        `}
      >
        <TerminalSquare size={14} />
      </button>

      <button
        onClick={onOpenSettings}
        title="Settings"
        className="flex items-center justify-center w-8 h-8 mr-1 rounded transition-all shrink-0 text-text-muted hover:text-text-primary hover:bg-bg-hover"
      >
        <Settings size={14} />
      </button>

      {updateAvailable && (
        <button
          onClick={onOpenUpdate}
          title={updateVersion ? `Update available: ${updateVersion}` : "Update available"}
          className="relative mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded text-accent-cyan transition-all hover:bg-accent-cyan/10 hover:text-accent-cyan-light"
        >
          <DownloadCloud size={15} />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-warning shadow-[0_0_10px_rgba(210,153,34,0.8)]" />
        </button>
      )}

      {/* Window controls */}
      <div className="flex items-center shrink-0">
        <button
          onClick={() => win.minimize()}
          className="flex items-center justify-center w-10 h-10 text-text-muted hover:text-text-primary hover:bg-bg-hover transition-all"
        >
          <Minus size={13} />
        </button>
        <button
          onClick={async () => {
            if (await win.isMaximized()) win.unmaximize();
            else win.maximize();
          }}
          className="flex items-center justify-center w-10 h-10 text-text-muted hover:text-text-primary hover:bg-bg-hover transition-all"
        >
          <Square size={12} />
        </button>
        <button
          onClick={() => win.close()}
          className="flex items-center justify-center w-10 h-10 text-text-muted hover:text-error hover:bg-error/10 transition-all"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
}
