import { useEffect, useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { X, TerminalSquare, AlertCircle } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { Terminal } from "./Terminal";
import { useStore } from "../store/useStore";
import { v4 } from "../utils/uuid";

export function LocalPanel() {
  const { toggleLocalPanel } = useStore();
  const [sessionId] = useState(() => v4());
  const [error, setError] = useState<string | null>(null);
  const [width, setWidth] = useState(420);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      invoke("local_start", { sessionId })
        .catch((e) => setError(String(e)));
    }, 100);

    return () => {
      clearTimeout(t);
      invoke("local_close", { sessionId }).catch(() => {});
    };
  }, [sessionId]);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startWidth: width };

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const delta = dragRef.current.startX - ev.clientX;
      setWidth(Math.max(280, Math.min(900, dragRef.current.startWidth + delta)));
    };

    const onUp = () => {
      dragRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [width]);

  return (
    <motion.div
      initial={{ width: 0, opacity: 0 }}
      animate={{ width, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      className="flex flex-col h-full bg-bg-base border-l border-border overflow-hidden shrink-0 relative"
    >
      {/* Resize handle */}
      <div
        onMouseDown={handleDragStart}
        className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-accent-cyan/40 transition-colors z-10 group"
      >
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-full bg-border group-hover:bg-accent-cyan/60 transition-colors" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-bg-surface shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-accent-cyan/20 flex items-center justify-center">
            <TerminalSquare size={11} className="text-accent-cyan" />
          </div>
          <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
            PowerShell
          </span>
        </div>
        <button
          onClick={toggleLocalPanel}
          className="text-text-muted hover:text-text-primary hover:bg-bg-hover rounded p-1 transition-all"
        >
          <X size={13} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 relative">
        {error ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 p-4 text-center">
            <AlertCircle size={24} className="text-error" />
            <p className="text-sm text-text-secondary">Failed to start PowerShell</p>
            <p className="text-xs text-error font-mono bg-error/10 px-3 py-2 rounded">{error}</p>
          </div>
        ) : (
          <Terminal
            sessionId={sessionId}
            tabId=""
            paneId=""
            isActive={true}
            type="local"
          />
        )}
      </div>
    </motion.div>
  );
}
