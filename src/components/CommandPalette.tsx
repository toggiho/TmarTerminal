import { useEffect, useMemo, useState } from "react";
import { Command, CornerDownLeft, History, Search, Server, TerminalSquare } from "lucide-react";

export interface CommandPaletteAction {
  id: string;
  label: string;
  subtitle?: string;
  group: string;
  keywords?: string[];
  hotkey?: string;
  icon?: "command" | "server" | "history" | "terminal";
  onSelect: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  actions: CommandPaletteAction[];
  onClose: () => void;
}

function getIcon(icon?: CommandPaletteAction["icon"]) {
  if (icon === "server") return <Server size={14} className="text-accent-cyan" />;
  if (icon === "history") return <History size={14} className="text-warning" />;
  if (icon === "terminal") return <TerminalSquare size={14} className="text-success" />;
  return <Command size={14} className="text-accent-purple" />;
}

export function CommandPalette({ open, actions, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSelected(0);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actions;
    return actions.filter((action) => {
      const haystack = [
        action.label,
        action.subtitle,
        action.group,
        ...(action.keywords ?? []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [actions, query]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelected((value) => (filtered.length ? (value + 1) % filtered.length : 0));
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelected((value) => (filtered.length ? (value - 1 + filtered.length) % filtered.length : 0));
      }
      if (event.key === "Enter") {
        event.preventDefault();
        const current = filtered[selected];
        if (!current) return;
        current.onSelect();
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [filtered, onClose, open, selected]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4" data-hotkeys="ignore">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-bg-surface shadow-2xl">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search size={16} className="text-text-muted" />
          <input
            autoFocus
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelected(0);
            }}
            placeholder="Search commands, connections, recents..."
            className="w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted"
          />
        </div>
        <div className="max-h-[420px] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="px-3 py-10 text-center text-sm text-text-muted">No matches</div>
          ) : (
            filtered.map((action, index) => (
              <button
                key={action.id}
                onClick={() => {
                  action.onSelect();
                  onClose();
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all ${
                  index === selected ? "bg-bg-elevated" : "hover:bg-bg-elevated/70"
                }`}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-bg-base border border-border">
                  {getIcon(action.icon)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-text-primary">{action.label}</div>
                  <div className="truncate text-xs text-text-muted">
                    {action.group}{action.subtitle ? ` • ${action.subtitle}` : ""}
                  </div>
                </div>
                {action.hotkey && (
                  <span className="rounded-md border border-border bg-bg-base px-2 py-1 text-[10px] font-mono text-text-secondary">
                    {action.hotkey}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
        <div className="flex items-center justify-between border-t border-border px-4 py-2 text-[11px] text-text-muted">
          <span>Palette</span>
          <span className="flex items-center gap-1"><CornerDownLeft size={11} /> Run</span>
        </div>
      </div>
    </div>
  );
}
