import { motion } from "framer-motion";
import { History, Plus } from "lucide-react";
import { RecentConnection } from "../types";

interface WelcomeScreenProps {
  onNewConnection: () => void;
  recentConnections: RecentConnection[];
  onReconnect: (connection: RecentConnection) => void;
}

const shortcuts = [
  { keys: ["Ctrl", "T"], label: "New connection" },
  { keys: ["Ctrl", "W"], label: "Close tab" },
  { keys: ["Ctrl", "B"], label: "Toggle sidebar" },
  { keys: ["Ctrl", "Tab"], label: "Next tab" },
];

export function WelcomeScreen({ onNewConnection, recentConnections, onReconnect }: WelcomeScreenProps) {
  return (
    <div className="flex w-[440px] max-w-full flex-col items-center text-center gap-8 p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col items-center gap-4"
      >
        <div className="relative">
          <div className="w-20 h-20 rounded-2xl bg-[#101827] border border-accent-cyan/40 flex items-center justify-center shadow-glow">
            <span className="text-4xl font-bold text-accent-cyan">T</span>
          </div>
          <div className="absolute -inset-1 rounded-2xl bg-accent-gradient opacity-20 blur-lg" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">TmarTerminal</h1>
          <p className="text-text-muted text-sm mt-1">
            Fast &amp; modern SSH terminal for Windows
          </p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="flex flex-col items-center gap-3"
      >
        <button
          onClick={onNewConnection}
          className="flex items-center gap-2.5 px-6 py-3 rounded-xl bg-accent-gradient text-white font-medium text-sm shadow-glow hover:opacity-90 transition-opacity"
        >
          <Plus size={16} />
          New SSH Connection
        </button>
        <p className="text-xs text-text-muted">or select a saved connection from the sidebar</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="grid grid-cols-2 gap-2 max-w-xs w-full"
      >
        {shortcuts.map((s) => (
          <div
            key={s.label}
            className="flex items-center gap-2 p-2.5 bg-bg-surface border border-border rounded-lg"
          >
            <div className="flex items-center gap-1">
              {s.keys.map((k) => (
                <kbd
                  key={k}
                  className="px-1.5 py-0.5 bg-bg-elevated border border-border rounded text-[10px] font-mono text-text-secondary"
                >
                  {k}
                </kbd>
              ))}
            </div>
            <span className="text-xs text-text-muted">{s.label}</span>
          </div>
        ))}
      </motion.div>

      {recentConnections.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="w-full max-w-md"
        >
          <div className="mb-3 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wider text-text-secondary">
            <History size={12} />
            Recent sessions
          </div>
          <div className="space-y-2">
            {recentConnections.slice(0, 3).map((connection) => (
              <button
                key={connection.id}
                onClick={() => onReconnect(connection)}
                className="flex w-full items-center justify-between rounded-xl border border-border bg-bg-surface px-3 py-2.5 text-left transition-all hover:bg-bg-elevated"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm text-text-primary">{connection.name}</div>
                  <div className="truncate text-xs text-text-muted">{connection.username}@{connection.host}:{connection.port}</div>
                </div>
                <span className="text-xs text-accent-cyan">Reconnect</span>
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
