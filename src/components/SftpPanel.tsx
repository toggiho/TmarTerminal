import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Download, File, FileSymlink, Folder, FolderPlus, RefreshCw, Trash2, Upload, X } from "lucide-react";

interface LocalEntry {
  name: string;
  path: string;
  is_dir: boolean;
  is_file: boolean;
  size: number;
  modified?: number;
}

interface RemoteEntry {
  name: string;
  path: string;
  is_dir: boolean;
  is_file: boolean;
  is_symlink: boolean;
  size: number;
  modified?: number;
}

interface SftpPanelProps {
  sessionId: string | null;
  onClose: () => void;
}

function parentPath(path: string, remote: boolean) {
  const normalized = path.replace(/\\/g, "/").replace(/\/+$/, "");
  if (remote) {
    if (!normalized || normalized === "/") return "/";
    const idx = normalized.lastIndexOf("/");
    return idx <= 0 ? "/" : normalized.slice(0, idx);
  }
  const idx = Math.max(normalized.lastIndexOf("/"), normalized.lastIndexOf("\\"));
  return idx <= 2 ? normalized.slice(0, 3).replace(/\//g, "\\") : normalized.slice(0, idx).replace(/\//g, "\\");
}

function joinPath(base: string, name: string, remote: boolean) {
  const sep = remote ? "/" : "\\";
  if (remote) return `${base.replace(/\/+$/, "") || "/"}${base === "/" ? "" : sep}${name}`;
  return `${base.replace(/[\\/]+$/, "")}${sep}${name}`;
}

function formatSize(entry: { is_dir: boolean; size: number }) {
  if (entry.is_dir) return "";
  if (entry.size < 1024) return `${entry.size} B`;
  if (entry.size < 1024 * 1024) return `${(entry.size / 1024).toFixed(1)} KB`;
  return `${(entry.size / 1024 / 1024).toFixed(1)} MB`;
}

export function SftpPanel({ sessionId, onClose }: SftpPanelProps) {
  const [localPath, setLocalPath] = useState("");
  const [remotePath, setRemotePath] = useState(".");
  const [localEntries, setLocalEntries] = useState<LocalEntry[]>([]);
  const [remoteEntries, setRemoteEntries] = useState<RemoteEntry[]>([]);
  const [selectedLocal, setSelectedLocal] = useState<LocalEntry | null>(null);
  const [selectedRemote, setSelectedRemote] = useState<RemoteEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const open = !!sessionId;

  const title = useMemo(() => (sessionId ? "SFTP file transfer" : ""), [sessionId]);

  const loadLocal = async (path = localPath) => {
    const roots = !path ? await invoke<string[]>("local_roots") : [];
    const nextPath = path || roots[0] || "C:\\";
    setLocalPath(nextPath);
    setLocalEntries(await invoke<LocalEntry[]>("local_list", { path: nextPath }));
  };

  const loadRemote = async (path = remotePath) => {
    if (!sessionId) return;
    setRemotePath(path);
    setRemoteEntries(await invoke<RemoteEntry[]>("sftp_list", { sessionId, path }));
  };

  const refresh = async () => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      await Promise.all([loadLocal(), loadRemote()]);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) refresh();
  }, [open, sessionId]);

  if (!open) return null;

  const upload = async () => {
    if (!sessionId || !selectedLocal || selectedLocal.is_dir) return;
    const remoteTarget = joinPath(remotePath, selectedLocal.name, true);
    setLoading(true);
    setError(null);
    try {
      await invoke("sftp_upload", { sessionId, localPath: selectedLocal.path, remotePath: remoteTarget });
      await loadRemote();
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const download = async () => {
    if (!sessionId || !selectedRemote || selectedRemote.is_dir) return;
    const localTarget = joinPath(localPath, selectedRemote.name, false);
    setLoading(true);
    setError(null);
    try {
      await invoke("sftp_download", { sessionId, remotePath: selectedRemote.path, localPath: localTarget });
      await loadLocal();
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const mkdir = async (side: "local" | "remote") => {
    const name = window.prompt("Folder name");
    if (!name) return;
    setLoading(true);
    setError(null);
    try {
      if (side === "local") {
        await invoke("local_mkdir", { path: joinPath(localPath, name, false) });
        await loadLocal();
      } else if (sessionId) {
        await invoke("sftp_mkdir", { sessionId, path: joinPath(remotePath, name, true) });
        await loadRemote();
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const deleteSelected = async (side: "local" | "remote") => {
    const entry = side === "local" ? selectedLocal : selectedRemote;
    if (!entry || !window.confirm(`Delete ${entry.name}?`)) return;
    setLoading(true);
    setError(null);
    try {
      if (side === "local") {
        await invoke("local_delete", { path: entry.path, recursive: entry.is_dir });
        setSelectedLocal(null);
        await loadLocal();
      } else if (sessionId) {
        await invoke("sftp_delete", { sessionId, path: entry.path, isDir: entry.is_dir });
        setSelectedRemote(null);
        await loadRemote();
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const renameRemote = async () => {
    if (!sessionId || !selectedRemote) return;
    const name = window.prompt("New name", selectedRemote.name);
    if (!name || name === selectedRemote.name) return;
    setLoading(true);
    setError(null);
    try {
      await invoke("sftp_rename", {
        sessionId,
        oldPath: selectedRemote.path,
        newPath: joinPath(remotePath, name, true),
      });
      await loadRemote();
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-10 z-50 flex flex-col bg-bg-surface border border-border rounded-xl shadow-panel overflow-hidden" data-hotkeys="ignore">
      <div className="flex items-center justify-between h-10 px-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Folder size={15} className="text-accent-cyan" />
          <span className="text-sm font-semibold text-text-primary">{title}</span>
          {loading && <RefreshCw size={12} className="text-accent-cyan animate-spin" />}
        </div>
        <button onClick={onClose} className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover">
          <X size={16} />
        </button>
      </div>

      {error && <div className="px-3 py-2 bg-error/10 border-b border-error/30 text-xs text-error">{error}</div>}

      <div className="grid grid-cols-[1fr_auto_1fr] flex-1 min-h-0">
        <FileSide
          title="Local"
          path={localPath}
          onPathChange={setLocalPath}
          onOpenPath={() => loadLocal(localPath)}
          onUp={() => loadLocal(parentPath(localPath, false))}
          onRefresh={() => loadLocal()}
          onMkdir={() => mkdir("local")}
          onDelete={() => deleteSelected("local")}
          entries={localEntries}
          selectedPath={selectedLocal?.path}
          onSelect={(entry) => setSelectedLocal(entry as LocalEntry)}
          onOpen={(entry) => entry.is_dir && loadLocal((entry as LocalEntry).path)}
        />

        <div className="flex flex-col items-center justify-center gap-2 px-2 border-x border-border bg-bg-base">
          <button
            onClick={upload}
            disabled={!selectedLocal || selectedLocal.is_dir || loading}
            className="p-2 rounded bg-bg-elevated text-text-muted hover:text-accent-cyan disabled:opacity-30"
            title="Upload selected local file"
          >
            <Upload size={16} />
          </button>
          <button
            onClick={download}
            disabled={!selectedRemote || selectedRemote.is_dir || loading}
            className="p-2 rounded bg-bg-elevated text-text-muted hover:text-accent-cyan disabled:opacity-30"
            title="Download selected remote file"
          >
            <Download size={16} />
          </button>
        </div>

        <FileSide
          title="Remote"
          path={remotePath}
          onPathChange={setRemotePath}
          onOpenPath={() => loadRemote(remotePath)}
          onUp={() => loadRemote(parentPath(remotePath, true))}
          onRefresh={() => loadRemote()}
          onMkdir={() => mkdir("remote")}
          onDelete={() => deleteSelected("remote")}
          onRename={renameRemote}
          entries={remoteEntries}
          selectedPath={selectedRemote?.path}
          onSelect={(entry) => setSelectedRemote(entry as RemoteEntry)}
          onOpen={(entry) => entry.is_dir && loadRemote((entry as RemoteEntry).path)}
        />
      </div>
    </div>
  );
}

interface FileSideProps {
  title: string;
  path: string;
  onPathChange: (path: string) => void;
  onOpenPath: () => void;
  onUp: () => void;
  onRefresh: () => void;
  onMkdir: () => void;
  onDelete: () => void;
  onRename?: () => void;
  entries: Array<LocalEntry | RemoteEntry>;
  selectedPath?: string;
  onSelect: (entry: LocalEntry | RemoteEntry) => void;
  onOpen: (entry: LocalEntry | RemoteEntry) => void;
}

function FileSide({
  title,
  path,
  onPathChange,
  onOpenPath,
  onUp,
  onRefresh,
  onMkdir,
  onDelete,
  onRename,
  entries,
  selectedPath,
  onSelect,
  onOpen,
}: FileSideProps) {
  return (
    <div className="flex flex-col min-w-0 min-h-0">
      <div className="flex items-center gap-1 p-2 border-b border-border">
        <span className="w-14 text-xs font-semibold uppercase tracking-wider text-text-secondary">{title}</span>
        <input
          value={path}
          onChange={(e) => onPathChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onOpenPath();
          }}
          className="flex-1 min-w-0 bg-bg-base border border-border rounded px-2 py-1 text-xs text-text-primary"
        />
        <button onClick={onUp} className="px-2 py-1 rounded bg-bg-base border border-border text-xs text-text-muted hover:text-text-primary">Up</button>
        <button onClick={onRefresh} className="p-1.5 rounded bg-bg-base border border-border text-text-muted hover:text-text-primary"><RefreshCw size={13} /></button>
        <button onClick={onMkdir} className="p-1.5 rounded bg-bg-base border border-border text-text-muted hover:text-text-primary"><FolderPlus size={13} /></button>
        {onRename && <button onClick={onRename} className="px-2 py-1 rounded bg-bg-base border border-border text-xs text-text-muted hover:text-text-primary">Rename</button>}
        <button onClick={onDelete} className="p-1.5 rounded bg-bg-base border border-border text-text-muted hover:text-error"><Trash2 size={13} /></button>
      </div>

      <div className="grid grid-cols-[1fr_80px] px-3 py-1 border-b border-border text-[11px] uppercase tracking-wider text-text-muted">
        <span>Name</span>
        <span className="text-right">Size</span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {entries.map((entry) => (
          <button
            key={entry.path}
            onClick={() => onSelect(entry)}
            onDoubleClick={() => onOpen(entry)}
            className={`grid grid-cols-[1fr_80px] w-full px-3 py-1.5 text-left text-xs hover:bg-bg-elevated ${
              selectedPath === entry.path ? "bg-accent-purple/20 text-text-primary" : "text-text-secondary"
            }`}
          >
            <span className="flex items-center gap-2 min-w-0">
              {entry.is_dir ? (
                <Folder size={14} className="shrink-0 text-accent-cyan" />
              ) : "is_symlink" in entry && entry.is_symlink ? (
                <FileSymlink size={14} className="shrink-0 text-warning" />
              ) : (
                <File size={14} className="shrink-0 text-text-muted" />
              )}
              <span className="truncate">{entry.name}</span>
            </span>
            <span className="text-right text-text-muted">{formatSize(entry)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
