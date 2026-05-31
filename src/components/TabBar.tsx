import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Terminal, Wifi, WifiOff, Loader } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useStore } from "../store/useStore";
import { TerminalPane } from "../types";

interface TabBarProps {
  onNewTab: () => void;
}

function StatusIcon({ status }: { status: TerminalPane["status"] }) {
  if (status === "connected") return <Wifi size={10} className="text-success" />;
  if (status === "connecting") return <Loader size={10} className="text-accent-cyan animate-spin" />;
  if (status === "error") return <WifiOff size={10} className="text-error" />;
  return <WifiOff size={10} className="text-text-muted" />;
}

export function TabBar({ onNewTab }: TabBarProps) {
  const { tabs, activeTabId, setActiveTab, removeTab } = useStore();

  const handleClose = async (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    const tab = tabs.find((item) => item.id === tabId);
    await Promise.all(
      (tab?.panes ?? [])
        .filter((pane) => pane.type === "ssh" && pane.status === "connected")
        .map((pane) => invoke("ssh_disconnect", { sessionId: pane.sessionId }).catch(() => {})),
    );
    removeTab(tabId);
  };

  return (
    <div className="flex items-center gap-1 flex-1 overflow-x-auto scrollbar-none min-w-0">
      <AnimatePresence initial={false}>
        {tabs.map((tab) => {
          const activePane = tab.panes.find((pane) => pane.id === tab.activePaneId) ?? tab.panes[0];
          return (
            <motion.button
              key={tab.id}
              initial={{ opacity: 0, scale: 0.9, x: -10 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.9, x: 10 }}
              transition={{ duration: 0.15 }}
              onClick={() => setActiveTab(tab.id)}
              className={`
                group relative flex items-center gap-2 px-3 py-1.5 rounded-lg
                text-sm font-medium whitespace-nowrap min-w-[120px] max-w-[220px]
                transition-all duration-150 border
                ${
                  activeTabId === tab.id
                    ? "bg-bg-elevated text-text-primary border-accent-purple/40 shadow-glow"
                    : "bg-transparent text-text-secondary border-transparent hover:bg-bg-elevated/50 hover:text-text-primary"
                }
              `}
            >
              <Terminal size={12} className="shrink-0" />
              <span className="truncate flex-1 text-left">
                {activePane?.title ?? tab.title}
                {tab.panes.length > 1 ? ` (${tab.panes.length})` : ""}
              </span>
              {activePane && <StatusIcon status={activePane.status} />}
              <button
                onClick={(e) => handleClose(e, tab.id)}
                className="opacity-0 group-hover:opacity-100 hover:bg-white/10 rounded p-0.5 transition-all"
              >
                <X size={10} />
              </button>
            </motion.button>
          );
        })}
      </AnimatePresence>

      <button
        onClick={onNewTab}
        className="flex items-center justify-center w-7 h-7 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-all shrink-0"
        title="New connection (Ctrl+T)"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
