import { invoke } from "@tauri-apps/api/core";
import { ArrowRightLeft, Copy, RefreshCw, StopCircle } from "lucide-react";
import { PortForwardRecord } from "../types";

interface PortForwardDashboardProps {
  forwards: PortForwardRecord[];
  onRefresh: () => void;
}

export function PortForwardDashboard({ forwards, onRefresh }: PortForwardDashboardProps) {
  const stopForward = async (id: string) => {
    await invoke("port_forward_stop", { forwardId: id }).catch(console.error);
    onRefresh();
  };

  const copyEndpoint = async (forward: PortForwardRecord) => {
    try {
      await navigator.clipboard.writeText(`http://localhost:${forward.localPort}`);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="w-[320px] shrink-0 border-l border-border bg-bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <ArrowRightLeft size={14} className="text-accent-purple" />
          <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Tunnels</span>
        </div>
        <button
          onClick={onRefresh}
          className="rounded p-1 text-text-muted transition-all hover:bg-bg-hover hover:text-text-primary"
          title="Refresh tunnels"
        >
          <RefreshCw size={13} />
        </button>
      </div>
      <div className="max-h-full overflow-y-auto p-3">
        {forwards.length === 0 ? (
          <div className="rounded-xl border border-border bg-bg-base px-3 py-5 text-center text-xs text-text-muted">
            No active port forwards
          </div>
        ) : (
          <div className="space-y-2">
            {forwards.map((forward) => (
              <div key={forward.id} className="rounded-xl border border-border bg-bg-base p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-text-secondary">{forward.sessionLabel}</span>
                  <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] text-success">ACTIVE</span>
                </div>
                <div className="text-sm font-mono text-accent-cyan">localhost:{forward.localPort}</div>
                <div className="mt-1 text-xs text-text-muted">{forward.remoteHost}:{forward.remotePort}</div>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => copyEndpoint(forward)}
                    className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs text-text-secondary transition-all hover:border-accent-cyan hover:text-text-primary"
                  >
                    <Copy size={11} />
                    Copy
                  </button>
                  <button
                    onClick={() => stopForward(forward.id)}
                    className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs text-text-secondary transition-all hover:border-error hover:text-error"
                  >
                    <StopCircle size={11} />
                    Stop
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
