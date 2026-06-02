import { AlertTriangle, CheckCircle2, Download, Loader2, RefreshCw, Rocket, X } from "lucide-react";
import { UpdaterState } from "../hooks/useUpdater";

interface UpdateModalProps {
  open: boolean;
  updater: UpdaterState & {
    checkForUpdate: () => Promise<void>;
    installUpdate: () => Promise<void>;
  };
  onClose: () => void;
}

function formatDate(value?: string) {
  if (!value) return "Unknown date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function getReleaseNotes(body?: string) {
  const text = body?.trim();
  return text || "No release notes were provided for this version.";
}

export function UpdateModal({ open, updater, onClose }: UpdateModalProps) {
  if (!open) return null;

  const busy = updater.status === "checking" || updater.status === "downloading" || updater.status === "installing";
  const available = !!updater.update;
  const progressLabel = updater.progress === null ? updater.message : `${updater.message ?? "Downloading update"} - ${updater.progress}%`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" data-hotkeys="ignore">
      <div className="absolute inset-0 bg-black/70" onClick={busy ? undefined : onClose} />
      <div className="relative flex max-h-[86vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-bg-surface shadow-panel">
        <div className="flex h-12 items-center justify-between border-b border-border px-4">
          <div className="flex min-w-0 items-center gap-2">
            <Rocket size={17} className="shrink-0 text-accent-cyan" />
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-text-primary">TmarTerminal update</h2>
              <p className="truncate text-[11px] text-text-muted">
                {available
                  ? `${updater.currentVersion || "Current"} -> ${updater.update?.version}`
                  : updater.message ?? "Checking for updates"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded p-1 text-text-muted transition-all hover:bg-bg-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
          >
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 overflow-y-auto p-4">
          {available ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border bg-bg-base p-3">
                  <p className="text-[11px] uppercase tracking-wider text-text-muted">New version</p>
                  <p className="mt-1 text-lg font-semibold text-text-primary">{updater.update?.version}</p>
                </div>
                <div className="rounded-lg border border-border bg-bg-base p-3">
                  <p className="text-[11px] uppercase tracking-wider text-text-muted">Published</p>
                  <p className="mt-1 text-sm text-text-primary">{formatDate(updater.update?.date)}</p>
                </div>
              </div>

              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-secondary">Changes</h3>
                <div className="max-h-[38vh] overflow-y-auto whitespace-pre-wrap rounded-lg border border-border bg-bg-base p-3 text-sm leading-6 text-text-secondary">
                  {getReleaseNotes(updater.update?.body)}
                </div>
              </section>
            </div>
          ) : updater.status === "error" ? (
            <div className="flex gap-3 rounded-lg border border-error/30 bg-error/10 p-3 text-sm text-text-secondary">
              <AlertTriangle size={18} className="shrink-0 text-error" />
              <div>
                <p className="font-medium text-text-primary">Could not check for updates</p>
                <p className="mt-1 text-xs text-text-muted">{updater.error}</p>
              </div>
            </div>
          ) : (
            <div className="flex gap-3 rounded-lg border border-border bg-bg-base p-3 text-sm text-text-secondary">
              <CheckCircle2 size={18} className="shrink-0 text-success" />
              <div>
                <p className="font-medium text-text-primary">TmarTerminal is up to date</p>
                <p className="mt-1 text-xs text-text-muted">Current version: {updater.currentVersion || "unknown"}</p>
              </div>
            </div>
          )}

          {busy && (
            <div className="mt-4 space-y-2 rounded-lg border border-accent-cyan/20 bg-accent-cyan/10 p-3">
              <div className="flex items-center gap-2 text-sm text-text-primary">
                <Loader2 size={15} className="animate-spin text-accent-cyan" />
                <span>{progressLabel}</span>
              </div>
              {updater.progress !== null && (
                <div className="h-1.5 overflow-hidden rounded-full bg-bg-base">
                  <div className="h-full bg-accent-cyan transition-all" style={{ width: `${updater.progress}%` }} />
                </div>
              )}
            </div>
          )}

          {updater.status === "error" && available && (
            <div className="mt-4 flex gap-3 rounded-lg border border-error/30 bg-error/10 p-3 text-sm text-text-secondary">
              <AlertTriangle size={18} className="shrink-0 text-error" />
              <div>
                <p className="font-medium text-text-primary">Update failed</p>
                <p className="mt-1 text-xs text-text-muted">{updater.error}</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded px-3 py-2 text-sm text-text-muted transition-all hover:bg-bg-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
          >
            Cancel
          </button>
          {available ? (
            <button
              onClick={() => updater.installUpdate().catch(console.error)}
              disabled={busy}
              className="flex items-center gap-2 rounded bg-accent-cyan px-3 py-2 text-sm font-medium text-bg-base transition-all hover:bg-accent-cyan-light disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Download size={15} />
              Update now
            </button>
          ) : (
            <button
              onClick={() => updater.checkForUpdate().catch(console.error)}
              disabled={busy}
              className="flex items-center gap-2 rounded border border-border px-3 py-2 text-sm text-text-primary transition-all hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw size={15} className={updater.status === "checking" ? "animate-spin" : ""} />
              Check again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
