import { Monitor, Plus, Server, X } from "lucide-react";
import { SavedConnection } from "../types";

interface PaneLauncherProps {
  open: boolean;
  savedConnections: SavedConnection[];
  onClose: () => void;
  onNewSsh: () => void;
  onLocal: () => void;
  onSavedConnection: (connection: SavedConnection) => void;
}

export function PaneLauncher({
  open,
  savedConnections,
  onClose,
  onNewSsh,
  onLocal,
  onSavedConnection,
}: PaneLauncherProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-bg-surface border border-border rounded-xl shadow-panel overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Open split pane</h2>
            <p className="text-xs text-text-muted">Choose a terminal source for the new pane</p>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary hover:bg-bg-hover rounded p-1 transition-all"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-3 grid grid-cols-2 gap-2">
          <button
            onClick={onNewSsh}
            className="flex items-center gap-3 p-3 rounded-lg border border-border bg-bg-base hover:bg-bg-elevated text-left transition-all"
          >
            <Plus size={16} className="text-accent-cyan" />
            <div>
              <p className="text-sm text-text-primary font-medium">New SSH</p>
              <p className="text-xs text-text-muted">Open connection form</p>
            </div>
          </button>
          <button
            onClick={onLocal}
            className="flex items-center gap-3 p-3 rounded-lg border border-border bg-bg-base hover:bg-bg-elevated text-left transition-all"
          >
            <Monitor size={16} className="text-accent-cyan" />
            <div>
              <p className="text-sm text-text-primary font-medium">PowerShell</p>
              <p className="text-xs text-text-muted">Local terminal</p>
            </div>
          </button>
        </div>

        <div className="px-4 pb-2 text-xs font-semibold text-text-secondary uppercase tracking-wider">
          Saved SSH
        </div>
        <div className="max-h-72 overflow-y-auto p-2 pt-0">
          {savedConnections.length === 0 ? (
            <div className="p-6 text-center text-xs text-text-muted">No saved connections</div>
          ) : (
            savedConnections.map((connection) => (
              <button
                key={connection.id}
                onClick={() => onSavedConnection(connection)}
                className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-bg-elevated text-left transition-all"
              >
                <div className="w-7 h-7 rounded-lg bg-accent-purple/15 flex items-center justify-center shrink-0">
                  <Server size={12} className="text-accent-purple" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-text-primary truncate">{connection.name}</p>
                  <p className="text-xs text-text-muted truncate">
                    {connection.username}@{connection.host}:{connection.port}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
