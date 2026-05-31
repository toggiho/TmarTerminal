import { motion, AnimatePresence } from "framer-motion";
import { invoke } from "@tauri-apps/api/core";
import { Server, Plus, Trash2, ChevronRight, Key, Lock, Settings, Download } from "lucide-react";
import { useStore } from "../store/useStore";
import { SavedConnection } from "../types";

interface SidebarProps {
  onNewConnection: () => void;
  onDirectConnect: (conn: SavedConnection) => void;
  onEdit: (conn: SavedConnection) => void;
}

function ConnectionItem({
  conn,
  onConnect,
  onEdit,
  onDelete,
}: {
  conn: SavedConnection;
  onConnect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      className="group relative flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-bg-elevated cursor-pointer transition-all"
      onClick={onConnect}
    >
      <div className="w-7 h-7 rounded-lg bg-accent-purple/15 flex items-center justify-center shrink-0">
        <Server size={12} className="text-accent-purple" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary truncate">{conn.name}</p>
        <p className="text-xs text-text-muted truncate">
          {conn.username}@{conn.host}:{conn.port}
        </p>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {conn.auth_type === "key" ? (
          <Key size={10} className="text-text-muted mr-0.5" />
        ) : (
          <Lock size={10} className="text-text-muted mr-0.5" />
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="p-0.5 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary transition-all"
          title="Edit connection"
        >
          <Settings size={11} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-0.5 rounded hover:bg-error/20 text-text-muted hover:text-error transition-all"
          title="Delete"
        >
          <Trash2 size={11} />
        </button>
        <ChevronRight size={12} className="text-text-muted" />
      </div>
    </motion.div>
  );
}

export function Sidebar({ onNewConnection, onDirectConnect, onEdit }: SidebarProps) {
  const { savedConnections, setSavedConnections, sidebarOpen } = useStore();

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this saved connection?")) return;
    await invoke("delete_connection", { id });
    const updated = await invoke<SavedConnection[]>("get_connections");
    setSavedConnections(updated);
  };

  const handleImportSshConfig = async () => {
    const updated = await invoke<SavedConnection[]>("import_ssh_config");
    setSavedConnections(updated);
  };

  return (
    <AnimatePresence initial={false}>
      {sidebarOpen && (
        <motion.aside
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 220, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          className="flex flex-col h-full bg-bg-surface border-r border-border overflow-hidden shrink-0"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Connections
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={handleImportSshConfig}
                className="flex items-center justify-center w-5 h-5 rounded text-text-muted hover:text-accent-cyan hover:bg-bg-hover transition-all"
                title="Import ~/.ssh/config"
              >
                <Download size={13} />
              </button>
              <button
                onClick={onNewConnection}
                className="flex items-center justify-center w-5 h-5 rounded text-text-muted hover:text-accent-cyan hover:bg-bg-hover transition-all"
                title="New connection (Ctrl+T)"
              >
                <Plus size={13} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            <AnimatePresence>
              {savedConnections.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center py-8 text-center"
                >
                  <div className="w-10 h-10 rounded-xl bg-bg-elevated flex items-center justify-center mb-3">
                    <Server size={16} className="text-text-muted" />
                  </div>
                  <p className="text-xs text-text-muted">No saved connections</p>
                  <button
                    onClick={onNewConnection}
                    className="mt-2 text-xs text-accent-purple hover:text-accent-purple-light transition-colors"
                  >
                    Add one
                  </button>
                </motion.div>
              ) : (
                savedConnections.map((conn) => (
                  <ConnectionItem
                    key={conn.id}
                    conn={conn}
                    onConnect={() => onDirectConnect(conn)}
                    onEdit={() => onEdit(conn)}
                    onDelete={() => handleDelete(conn.id)}
                  />
                ))
              )}
            </AnimatePresence>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
