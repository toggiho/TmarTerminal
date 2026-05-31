import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ArrowRightLeft, Plus, RefreshCw, Search, Trash2, X, Zap } from "lucide-react";

interface ForwardInfo {
  id: string;
  local_port: number;
  remote_host: string;
  remote_port: number;
}

interface RemoteService {
  port: number;
  process?: string | null;
}

interface Props {
  sessionId: string | null;
  onClose: () => void;
}

export function PortForwardModal({ sessionId, onClose }: Props) {
  const [forwards, setForwards] = useState<ForwardInfo[]>([]);
  const [services, setServices] = useState<RemoteService[]>([]);
  const [localPort, setLocalPort] = useState("8080");
  const [remoteHost, setRemoteHost] = useState("localhost");
  const [remotePort, setRemotePort] = useState("80");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);

  const refresh = async () => {
    if (!sessionId) return;
    try {
      const list = await invoke<ForwardInfo[]>("port_forward_list", { sessionId });
      setForwards(list);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (sessionId) {
      refresh();
    } else {
      setForwards([]);
      setServices([]);
      setScanned(false);
      setError("");
    }
  }, [sessionId]);

  const startForward = async (lp: number, rhost: string, rp: number) => {
    if (!sessionId) return;
    setLoading(true);
    setError("");
    try {
      await invoke("port_forward_start", {
        sessionId,
        localPort: lp,
        remoteHost: rhost,
        remotePort: rp,
      });
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    const lp = parseInt(localPort, 10);
    const rp = parseInt(remotePort, 10);
    if (!lp || lp < 1 || lp > 65535 || !rp || rp < 1 || rp > 65535 || !remoteHost.trim()) {
      setError("Fill in all fields with valid values");
      return;
    }
    startForward(lp, remoteHost.trim(), rp);
  };

  const handleStop = async (id: string) => {
    try {
      await invoke("port_forward_stop", { forwardId: id });
      await refresh();
    } catch (e) {
      console.error(e);
    }
  };

  const handleScan = async () => {
    if (!sessionId) return;
    setScanning(true);
    setError("");
    try {
      const list = await invoke<RemoteService[]>("scan_remote_ports", { sessionId });
      setServices(list);
      setScanned(true);
    } catch (e) {
      setError(String(e));
    } finally {
      setScanning(false);
    }
  };

  const isForwarded = (port: number) =>
    forwards.some((f) => f.remote_port === port && (f.remote_host === "localhost" || f.remote_host === "127.0.0.1"));

  if (!sessionId) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
      data-hotkeys="ignore"
    >
      <div
        className="bg-bg-surface border border-border rounded-xl shadow-2xl w-[540px] max-h-[82vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <div className="flex items-center gap-2">
            <ArrowRightLeft size={15} className="text-accent-purple" />
            <span className="text-sm font-semibold text-text-primary">Port Forwarding</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={refresh}
              className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover transition-all"
              title="Refresh"
            >
              <RefreshCw size={13} />
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover transition-all"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Add form */}
        <div className="px-5 py-4 border-b border-border">
          <p className="text-xs text-text-muted mb-3">
            Forward <span className="text-text-secondary">localhost:local_port</span> → <span className="text-text-secondary">remote_host:remote_port</span> via SSH
          </p>
          <div className="flex gap-2 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-text-muted">Local port</label>
              <input
                type="number"
                value={localPort}
                onChange={(e) => setLocalPort(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                className="w-24 px-2 py-1.5 text-sm bg-bg-elevated border border-border rounded text-text-primary focus:outline-none focus:border-accent-purple"
                placeholder="8080"
                min="1"
                max="65535"
              />
            </div>
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-xs text-text-muted">Remote host</label>
              <input
                type="text"
                value={remoteHost}
                onChange={(e) => setRemoteHost(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                className="w-full px-2 py-1.5 text-sm bg-bg-elevated border border-border rounded text-text-primary focus:outline-none focus:border-accent-purple"
                placeholder="localhost"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-text-muted">Remote port</label>
              <input
                type="number"
                value={remotePort}
                onChange={(e) => setRemotePort(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                className="w-20 px-2 py-1.5 text-sm bg-bg-elevated border border-border rounded text-text-primary focus:outline-none focus:border-accent-purple"
                placeholder="80"
                min="1"
                max="65535"
              />
            </div>
            <button
              onClick={handleAdd}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-accent-purple text-white text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              <Plus size={14} />
              Add
            </button>
          </div>
          {error && <p className="mt-2 text-xs text-error">{error}</p>}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {/* Active tunnels */}
          <div className="px-5 py-4 border-b border-border">
            <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
              Active tunnels
            </p>
            {forwards.length === 0 ? (
              <p className="text-xs text-text-muted">No active tunnels</p>
            ) : (
              <div className="space-y-2">
                {forwards.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-bg-elevated border border-border"
                  >
                    <div className="flex items-center gap-2 text-sm min-w-0">
                      <span className="w-2 h-2 rounded-full bg-success shrink-0" />
                      <span className="text-accent-cyan font-mono shrink-0">localhost:{f.local_port}</span>
                      <ArrowRightLeft size={11} className="text-text-muted shrink-0" />
                      <span className="text-text-primary font-mono truncate">
                        {f.remote_host}:{f.remote_port}
                      </span>
                    </div>
                    <button
                      onClick={() => handleStop(f.id)}
                      className="p-1 rounded text-text-muted hover:text-error hover:bg-error/10 transition-all shrink-0 ml-2"
                      title="Stop tunnel"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Discovered services */}
          <div className="px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                Listening services
              </p>
              <button
                onClick={handleScan}
                disabled={scanning}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-bg-elevated border border-border text-xs text-text-secondary hover:text-text-primary hover:border-accent-cyan disabled:opacity-50 transition-all"
              >
                {scanning ? <RefreshCw size={12} className="animate-spin" /> : <Search size={12} />}
                {scanning ? "Scanning..." : "Scan"}
              </button>
            </div>
            {!scanned ? (
              <p className="text-xs text-text-muted">
                Scan the remote host for listening TCP ports (uses <span className="font-mono">ss</span>/<span className="font-mono">netstat</span>).
              </p>
            ) : services.length === 0 ? (
              <p className="text-xs text-text-muted">No listening services found.</p>
            ) : (
              <div className="space-y-2">
                {services.map((s) => {
                  const forwarded = isForwarded(s.port);
                  return (
                    <div
                      key={s.port}
                      className="flex items-center justify-between px-3 py-2 rounded-lg bg-bg-elevated border border-border"
                    >
                      <div className="flex items-center gap-2 text-sm min-w-0">
                        <span className="text-accent-cyan font-mono shrink-0">:{s.port}</span>
                        {s.process && (
                          <span className="text-text-muted truncate">{s.process}</span>
                        )}
                      </div>
                      <button
                        onClick={() => startForward(s.port, "localhost", s.port)}
                        disabled={loading || forwarded}
                        className="flex items-center gap-1 px-2 py-1 rounded text-xs border transition-all shrink-0 ml-2 disabled:opacity-50 disabled:cursor-default border-border text-text-secondary hover:text-accent-purple hover:border-accent-purple"
                        title={forwarded ? "Already forwarded" : `Forward localhost:${s.port} → remote:${s.port}`}
                      >
                        <Zap size={12} />
                        {forwarded ? "Forwarded" : "Forward"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
