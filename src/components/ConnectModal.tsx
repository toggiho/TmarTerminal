import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Server, User, Lock, Key, ChevronDown, Loader, Wifi, Edit3 } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { v4 as uuidv4 } from "../utils/uuid";
import { useStore } from "../store/useStore";
import { ConnectFormData } from "../types";

interface ConnectModalProps {
  open: boolean;
  onClose: () => void;
  prefill?: Partial<ConnectFormData>;
}

const defaultForm: ConnectFormData = {
  name: "",
  host: "",
  port: 22,
  username: "",
  authType: "password",
  password: "",
  savePassword: false,
  keyPath: "",
  keyPassphrase: "",
  saveConnection: false,
};

function InputField({
  label,
  icon: Icon,
  type = "text",
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  icon: React.ElementType;
  type?: string;
  value: string | number;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">
        {label}
      </label>
      <div className="relative">
        <Icon
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
        />
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          className="
            w-full bg-bg-base border border-border rounded-lg
            pl-9 pr-3 py-2.5 text-sm text-text-primary
            placeholder:text-text-muted
            focus:outline-none focus:border-accent-purple/60 focus:ring-1 focus:ring-accent-purple/30
            transition-all
          "
        />
      </div>
    </div>
  );
}

function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer group">
      <div
        onClick={onChange}
        className={`
          w-4 h-4 rounded border transition-all flex items-center justify-center
          ${checked
            ? "bg-accent-purple border-accent-purple"
            : "border-border group-hover:border-accent-purple/50"}
        `}
      >
        {checked && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <span className="text-sm text-text-secondary group-hover:text-text-primary transition-colors">
        {label}
      </span>
    </label>
  );
}

export function ConnectModal({ open, onClose, prefill }: ConnectModalProps) {
  const [form, setForm] = useState<ConnectFormData>({ ...defaultForm, ...prefill });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addTab, addPaneToTab, updatePane, setSavedConnections, savedConnections } = useStore();

  // Reset form whenever modal opens with new prefill
  useEffect(() => {
    if (open) {
      setForm({ ...defaultForm, ...prefill });
      setError(null);
    }
  }, [open, prefill]);

  const isEditMode = !!form._editId;

  const set = (key: keyof ConnectFormData) => (val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (isEditMode) {
      // Edit mode: just save the connection, no new tab
      try {
        const conn = {
          id: form._editId!,
          name: form.name || `${form.username}@${form.host}`,
          host: form.host,
          port: Number(form.port),
          username: form.username,
          auth_type: form.authType,
          key_path: form.authType === "key" ? form.keyPath : undefined,
          password: form.authType === "password" && form.savePassword ? form.password : undefined,
        };
        await invoke("save_connection", { connection: conn });
        const updated = await invoke<typeof savedConnections>("get_connections");
        setSavedConnections(updated);
        onClose();
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
      return;
    }

    // New connection mode
    const sessionId = uuidv4();
    const tabId = form.targetTabId ?? uuidv4();
    const paneId = uuidv4();
    const title = form.name || `${form.username}@${form.host}`;

    const pane = { id: paneId, sessionId, title, host: form.host, status: "connecting" as const, type: "ssh" as const };
    if (form.targetTabId && form.targetPaneId && form.splitDirection) {
      addPaneToTab(form.targetTabId, form.targetPaneId, pane, form.splitDirection);
    } else {
      addTab(pane);
    }

    const auth =
      form.authType === "password"
        ? { type: "Password", value: form.password }
        : { type: "PrivateKey", value: { path: form.keyPath, passphrase: form.keyPassphrase || null } };

    try {
      await invoke("ssh_connect", {
        sessionId,
        host: form.host,
        port: Number(form.port),
        username: form.username,
        auth,
      });
      updatePane(tabId, paneId, { status: "connected" });

      if (form.saveConnection) {
        const existing = savedConnections.find(
          (c) => c.host === form.host && c.port === Number(form.port) && c.username === form.username
        );
        const conn = {
          id: existing?.id ?? uuidv4(),
          name: form.name || title,
          host: form.host,
          port: Number(form.port),
          username: form.username,
          auth_type: form.authType,
          key_path: form.authType === "key" ? form.keyPath : undefined,
          password: form.authType === "password" && form.savePassword ? form.password : undefined,
        };
        await invoke("save_connection", { connection: conn });
        const updated = await invoke<typeof savedConnections>("get_connections");
        setSavedConnections(updated);
      }
      onClose();
    } catch (err) {
      updatePane(tabId, paneId, { status: "error", title: `Error: ${form.host}` });
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="relative w-full max-w-md bg-bg-surface border border-border rounded-2xl shadow-panel overflow-hidden"
          >
            <div className="absolute inset-x-0 top-0 h-px bg-accent-gradient" />

            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-accent-gradient flex items-center justify-center shadow-glow">
                    {isEditMode ? <Edit3 size={16} className="text-white" /> : <Wifi size={16} className="text-white" />}
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-text-primary">
                      {isEditMode ? "Edit Connection" : "New Connection"}
                    </h2>
                    <p className="text-xs text-text-muted">SSH Terminal</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-lg p-1.5 transition-all"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <InputField
                  label="Host"
                  icon={Server}
                  value={form.host}
                  onChange={set("host")}
                  placeholder="192.168.1.1 or example.com"
                  required
                />

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <InputField
                      label="Username"
                      icon={User}
                      value={form.username}
                      onChange={set("username")}
                      placeholder="root"
                      required
                    />
                  </div>
                  <InputField
                    label="Port"
                    icon={ChevronDown}
                    type="number"
                    value={form.port}
                    onChange={set("port")}
                    placeholder="22"
                  />
                </div>

                {/* Auth type toggle */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Authentication
                  </label>
                  <div className="grid grid-cols-2 gap-2 p-1 bg-bg-base rounded-lg">
                    {(["password", "key"] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, authType: type }))}
                        className={`
                          py-2 rounded-md text-sm font-medium transition-all
                          ${form.authType === type
                            ? "bg-accent-purple text-white shadow-glow"
                            : "text-text-muted hover:text-text-primary"}
                        `}
                      >
                        {type === "password" ? (
                          <span className="flex items-center justify-center gap-1.5">
                            <Lock size={12} /> Password
                          </span>
                        ) : (
                          <span className="flex items-center justify-center gap-1.5">
                            <Key size={12} /> Private Key
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {form.authType === "password" ? (
                  <>
                    <InputField
                      label="Password"
                      icon={Lock}
                      type="password"
                      value={form.password}
                      onChange={set("password")}
                      placeholder="Password"
                      required={!isEditMode}
                    />
                    <Checkbox
                      checked={form.savePassword}
                      onChange={() => setForm((f) => ({ ...f, savePassword: !f.savePassword }))}
                      label="Save password for one-click connect"
                    />
                  </>
                ) : (
                  <>
                    <InputField
                      label="Private Key Path"
                      icon={Key}
                      value={form.keyPath}
                      onChange={set("keyPath")}
                      placeholder="C:\\Users\\you\\.ssh\\id_rsa"
                      required
                    />
                    <InputField
                      label="Passphrase (optional)"
                      icon={Lock}
                      type="password"
                      value={form.keyPassphrase}
                      onChange={set("keyPassphrase")}
                      placeholder="Leave empty if none"
                    />
                  </>
                )}

                <InputField
                  label="Label (optional)"
                  icon={Server}
                  value={form.name}
                  onChange={set("name")}
                  placeholder="My Server"
                />

                {!isEditMode && (
                  <Checkbox
                    checked={form.saveConnection}
                    onChange={() => setForm((f) => ({ ...f, saveConnection: !f.saveConnection }))}
                    label="Save to connections"
                  />
                )}

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 bg-error/10 border border-error/30 rounded-lg text-sm text-error"
                  >
                    {error}
                  </motion.div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="
                    w-full py-2.5 rounded-xl font-medium text-sm text-white
                    bg-accent-gradient hover:opacity-90
                    disabled:opacity-50 disabled:cursor-not-allowed
                    shadow-glow transition-all
                    flex items-center justify-center gap-2
                  "
                >
                  {loading ? (
                    <>
                      <Loader size={14} className="animate-spin" />
                      {isEditMode ? "Saving..." : "Connecting..."}
                    </>
                  ) : (
                    isEditMode ? "Save" : "Connect"
                  )}
                </button>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
