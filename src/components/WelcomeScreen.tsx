import { motion } from "framer-motion";
import { Plus } from "lucide-react";

interface WelcomeScreenProps {
  onNewConnection: () => void;
}

const shortcuts = [
  { keys: ["Ctrl", "T"], label: "New connection" },
  { keys: ["Ctrl", "W"], label: "Close tab" },
  { keys: ["Ctrl", "B"], label: "Toggle sidebar" },
  { keys: ["Ctrl", "Tab"], label: "Next tab" },
];

export function WelcomeScreen({ onNewConnection }: WelcomeScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center gap-8 p-8">
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
    </div>
  );
}
