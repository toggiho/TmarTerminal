import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { invoke } from "@tauri-apps/api/core";
import { ArrowRightLeft, FolderSync, SplitSquareHorizontal, SplitSquareVertical, X } from "lucide-react";
import { TitleBar } from "./components/TitleBar";
import { Sidebar } from "./components/Sidebar";
import { Terminal } from "./components/Terminal";
import { ConnectModal } from "./components/ConnectModal";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { LocalPanel } from "./components/LocalPanel";
import { PaneLauncher } from "./components/PaneLauncher";
import { SftpPanel } from "./components/SftpPanel";
import { PortForwardModal } from "./components/PortForwardModal";
import { SettingsModal } from "./components/SettingsModal";
import { useStore } from "./store/useStore";
import { ConnectFormData, PaneLayout, SavedConnection, Tab, TerminalPane } from "./types";
import { v4 } from "./utils/uuid";
import { isHotkey } from "./settings";

type SshAuth =
  | { type: "Password"; value: string }
  | { type: "PrivateKey"; value: { path: string; passphrase: string | null } };

interface SplitTarget {
  tabId: string;
  paneId: string;
  direction: "horizontal" | "vertical";
}

interface PaneRect {
  paneId: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

function isInputTarget(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el?.closest("input, textarea, select, [contenteditable='true'], [data-hotkeys='ignore']");
}

function getPane(tab: Tab, paneId: string) {
  return tab.panes.find((pane) => pane.id === paneId) ?? tab.panes[0];
}

function getPaneRects(layout: PaneLayout, bounds = { left: 0, top: 0, width: 100, height: 100 }): PaneRect[] {
  if (layout.type === "leaf") return [{ paneId: layout.paneId, ...bounds }];

  if (layout.direction === "horizontal") {
    return [
      ...getPaneRects(layout.first, { ...bounds, width: bounds.width / 2 }),
      ...getPaneRects(layout.second, { ...bounds, left: bounds.left + bounds.width / 2, width: bounds.width / 2 }),
    ];
  }

  return [
    ...getPaneRects(layout.first, { ...bounds, height: bounds.height / 2 }),
    ...getPaneRects(layout.second, { ...bounds, top: bounds.top + bounds.height / 2, height: bounds.height / 2 }),
  ];
}

export default function App() {
  const {
    tabs,
    activeTabId,
    savedConnections,
    setSavedConnections,
    removeTab,
    removePane,
    addTab,
    addPaneToTab,
    updatePane,
    setActiveTab,
    setActivePane,
    focusNextPane,
    toggleMaximizedPane,
    toggleLocalPanel,
    localPanelOpen,
    settings,
  } = useStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalPrefill, setModalPrefill] = useState<Partial<ConnectFormData> | undefined>();
  const [splitTarget, setSplitTarget] = useState<SplitTarget | null>(null);
  const [pingLabel, setPingLabel] = useState("-- ms");
  const [sftpSessionId, setSftpSessionId] = useState<string | null>(null);
  const [portForwardSessionId, setPortForwardSessionId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTabId),
    [activeTabId, tabs],
  );
  const activePane = activeTab ? getPane(activeTab, activeTab.activePaneId) : undefined;

  useEffect(() => {
    invoke<SavedConnection[]>("get_connections")
      .then(setSavedConnections)
      .catch(console.error);
  }, [setSavedConnections]);

  const openModal = useCallback((prefill?: Partial<ConnectFormData>) => {
    setModalPrefill(prefill);
    setModalOpen(true);
  }, []);

  const startSshSession = useCallback(async (
    conn: SavedConnection,
    auth: SshAuth,
    target?: SplitTarget,
  ) => {
    const sessionId = v4();
    const paneId = v4();
    const title = conn.name || `${conn.username}@${conn.host}`;
    const pane: TerminalPane = { id: paneId, sessionId, title, host: conn.host, status: "connecting", type: "ssh" };
    const tabId = target?.tabId ?? paneId;

    if (target) addPaneToTab(target.tabId, target.paneId, pane, target.direction);
    else addTab(pane);

    try {
      await invoke("ssh_connect", {
        sessionId,
        host: conn.host,
        port: conn.port,
        username: conn.username,
        auth,
      });
      updatePane(tabId, paneId, { status: "connected" });
    } catch (err) {
      updatePane(tabId, paneId, { status: "error", title: `Error: ${conn.host}` });
      console.error(err);
    }
  }, [addPaneToTab, addTab, updatePane]);

  const startLocalPane = useCallback(async (target?: SplitTarget) => {
    const sessionId = v4();
    const paneId = v4();
    const pane: TerminalPane = {
      id: paneId,
      sessionId,
      title: "PowerShell",
      status: "connecting",
      type: "local",
    };
    const tabId = target?.tabId ?? paneId;
    if (target) addPaneToTab(target.tabId, target.paneId, pane, target.direction);
    else addTab(pane);

    try {
      await invoke("local_start", { sessionId });
      updatePane(tabId, paneId, { status: "connected" });
    } catch (err) {
      updatePane(tabId, paneId, { status: "error", title: "PowerShell error" });
      console.error(err);
    }
  }, [addPaneToTab, addTab, updatePane]);

  const handleDirectConnect = useCallback(async (conn: SavedConnection, target?: SplitTarget) => {
    if (conn.auth_type === "key") {
      await startSshSession(conn, {
        type: "PrivateKey",
        value: { path: conn.key_path ?? "", passphrase: null },
      }, target);
      return;
    }

    if (conn.password) {
      await startSshSession(conn, { type: "Password", value: conn.password }, target);
    } else {
      openModal({
        name: conn.name,
        host: conn.host,
        port: conn.port,
        username: conn.username,
        authType: "password",
        targetTabId: target?.tabId,
        targetPaneId: target?.paneId,
        splitDirection: target?.direction,
      });
    }
  }, [openModal, startSshSession]);

  const handleEditConnection = useCallback((conn: SavedConnection) => {
    openModal({
      _editId: conn.id,
      name: conn.name,
      host: conn.host,
      port: conn.port,
      username: conn.username,
      authType: conn.auth_type,
      password: conn.password ?? "",
      savePassword: !!conn.password,
      keyPath: conn.key_path ?? "",
    });
  }, [openModal]);

  const openSplitLauncher = useCallback((direction: "horizontal" | "vertical") => {
    const tab = useStore.getState().tabs.find((item) => item.id === useStore.getState().activeTabId);
    if (!tab) {
      startLocalPane();
      return;
    }
    setSplitTarget({ tabId: tab.id, paneId: tab.activePaneId, direction });
  }, [startLocalPane]);

  const closeActivePane = useCallback(() => {
    const tab = useStore.getState().tabs.find((item) => item.id === useStore.getState().activeTabId);
    if (!tab) return;
    const pane = getPane(tab, tab.activePaneId);
    if (!pane) return;
    if (pane.type === "ssh") invoke("ssh_disconnect", { sessionId: pane.sessionId }).catch(console.error);
    else invoke("local_close", { sessionId: pane.sessionId }).catch(console.error);
    removePane(tab.id, pane.id);
  }, [removePane]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isInputTarget(e.target)) return;
      if (isHotkey(e, settings.hotkeys.newTab)) {
        e.preventDefault();
        openModal();
      }
      if (isHotkey(e, settings.hotkeys.toggleSidebar)) {
        e.preventDefault();
        useStore.getState().toggleSidebar();
      }
      if (isHotkey(e, settings.hotkeys.toggleLocalPanel)) {
        e.preventDefault();
        toggleLocalPanel();
      }
      if (isHotkey(e, settings.hotkeys.nextTab) || isHotkey(e, settings.hotkeys.previousTab)) {
        e.preventDefault();
        const { activeTabId, tabs } = useStore.getState();
        if (tabs.length < 2) return;
        const current = Math.max(0, tabs.findIndex((tab) => tab.id === activeTabId));
        const direction = isHotkey(e, settings.hotkeys.previousTab) ? -1 : 1;
        const next = (current + direction + tabs.length) % tabs.length;
        setActiveTab(tabs[next].id);
      }
      if (isHotkey(e, settings.hotkeys.splitRight)) {
        e.preventDefault();
        openSplitLauncher("horizontal");
      }
      if (isHotkey(e, settings.hotkeys.splitDown)) {
        e.preventDefault();
        openSplitLauncher("vertical");
      }
      if (isHotkey(e, settings.hotkeys.closePane)) {
        e.preventDefault();
        closeActivePane();
      }
      if (isHotkey(e, settings.hotkeys.maximizePane)) {
        e.preventDefault();
        toggleMaximizedPane();
      }
      if (isHotkey(e, settings.hotkeys.terminalSearch)) {
        e.preventDefault();
        window.dispatchEvent(new Event("terminal-search"));
      }
      if (isHotkey(e, settings.hotkeys.openSftp)) {
        e.preventDefault();
        const state = useStore.getState();
        const tab = state.tabs.find((item) => item.id === state.activeTabId);
        if (!tab) return;
        const pane = getPane(tab, tab.activePaneId);
        if (pane?.type === "ssh" && pane.status === "connected") setSftpSessionId(pane.sessionId);
      }
      if (isHotkey(e, settings.hotkeys.focusPreviousPane) || isHotkey(e, settings.hotkeys.focusNextPane)) {
        e.preventDefault();
        focusNextPane(isHotkey(e, settings.hotkeys.focusPreviousPane) ? -1 : 1);
      }
      if (isHotkey(e, settings.hotkeys.closeTab)) {
        e.preventDefault();
        const { activeTabId, tabs } = useStore.getState();
        const tab = tabs.find((item) => item.id === activeTabId);
        if (!tab) return;
        Promise.all(
          tab.panes.map((pane) =>
            invoke(pane.type === "ssh" ? "ssh_disconnect" : "local_close", { sessionId: pane.sessionId }).catch(console.error),
          ),
        ).finally(() => removeTab(tab.id));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    closeActivePane,
    focusNextPane,
    openModal,
    openSplitLauncher,
    removeTab,
    setActiveTab,
    settings.hotkeys,
    toggleLocalPanel,
    toggleMaximizedPane,
  ]);

  useEffect(() => {
    if (!activePane || activePane.type !== "ssh" || activePane.status !== "connected") {
      setPingLabel("-- ms");
      return;
    }

    let cancelled = false;
    const tick = async () => {
      try {
        const result = await invoke<{ latency_ms: number; ok: boolean; error?: string }>("ssh_ping", {
          sessionId: activePane.sessionId,
        });
        if (!cancelled) setPingLabel(result.ok ? `${Math.round(result.latency_ms)} ms` : result.error ?? "timeout");
      } catch {
        if (!cancelled) setPingLabel("offline");
      }
    };
    tick();
    const id = window.setInterval(tick, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [activePane?.sessionId, activePane?.status, activePane?.type]);

  const renderPane = (tab: Tab, pane: TerminalPane, rect: PaneRect) => {
    const active = tab.id === activeTabId && pane.id === tab.activePaneId;
    return (
      <div
        key={pane.id}
        className={`group absolute min-h-0 min-w-0 border ${active ? "border-accent-purple/50" : "border-transparent"}`}
        style={{
          left: `${rect.left}%`,
          top: `${rect.top}%`,
          width: `${rect.width}%`,
          height: `${rect.height}%`,
        }}
        onMouseDown={() => setActivePane(tab.id, pane.id)}
      >
        <div className="absolute right-2 top-2 z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
          <button
            onClick={() => openSplitLauncher("horizontal")}
            title="Split right (Ctrl+Shift+D)"
            className="p-1 rounded bg-bg-surface/90 text-text-muted hover:text-text-primary border border-border"
          >
            <SplitSquareHorizontal size={13} />
          </button>
          <button
            onClick={() => openSplitLauncher("vertical")}
            title="Split down (Ctrl+Shift+E)"
            className="p-1 rounded bg-bg-surface/90 text-text-muted hover:text-text-primary border border-border"
          >
            <SplitSquareVertical size={13} />
          </button>
          {pane.type === "ssh" && pane.status === "connected" && (
            <>
              <button
                onClick={() => setSftpSessionId(pane.sessionId)}
                title="Open SFTP (Ctrl+Shift+S)"
                className="p-1 rounded bg-bg-surface/90 text-text-muted hover:text-accent-cyan border border-border"
              >
                <FolderSync size={13} />
              </button>
              <button
                onClick={() => setPortForwardSessionId(pane.sessionId)}
                title="Port forwarding"
                className="p-1 rounded bg-bg-surface/90 text-text-muted hover:text-accent-purple border border-border"
              >
                <ArrowRightLeft size={13} />
              </button>
            </>
          )}
          <button
            onClick={closeActivePane}
            title="Close pane (Ctrl+Shift+W)"
            className="p-1 rounded bg-bg-surface/90 text-text-muted hover:text-error border border-border"
          >
            <X size={13} />
          </button>
        </div>
        <Terminal
          sessionId={pane.sessionId}
          tabId={tab.id}
          paneId={pane.id}
          isActive={active}
          type={pane.type}
        />
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-bg-base overflow-hidden font-sans">
      <TitleBar onNewTab={() => openModal()} onOpenSettings={() => setSettingsOpen(true)} />

      <div className="flex flex-1 min-h-0">
        <Sidebar
          onNewConnection={() => openModal()}
          onDirectConnect={handleDirectConnect}
          onEdit={handleEditConnection}
        />

        <main className="flex-1 min-w-0 relative bg-bg-base">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`absolute inset-0 ${tab.id === activeTabId ? "block" : "hidden"}`}
            >
              {(tab.maximizedPaneId
                ? getPaneRects({ type: "leaf", paneId: tab.maximizedPaneId })
                : getPaneRects(tab.layout)
              ).map((rect) => {
                const pane = tab.panes.find((item) => item.id === rect.paneId);
                return pane ? renderPane(tab, pane, rect) : null;
              })}
            </div>
          ))}
          {tabs.length === 0 && <WelcomeScreen onNewConnection={() => openModal()} />}
        </main>

        <AnimatePresence>
          {localPanelOpen && <LocalPanel key="local-panel" />}
        </AnimatePresence>
      </div>

      <div className="flex items-center h-6 px-4 bg-bg-surface border-t border-border shrink-0">
        <div className="flex items-center gap-4 text-[11px] text-text-muted">
          {!activePane ? (
            <span>TmarTerminal - Ready</span>
          ) : (
            <>
              <span className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${
                  activePane.status === "connected" ? "bg-success" :
                  activePane.status === "connecting" ? "bg-warning animate-pulse" :
                  activePane.status === "error" ? "bg-error" : "bg-text-muted"
                }`} />
                {activePane.status === "connected" ? `Connected - ${activePane.host ?? activePane.title}` :
                 activePane.status === "connecting" ? `Connecting to ${activePane.host ?? activePane.title}...` :
                 activePane.status === "error" ? `Connection failed - ${activePane.host ?? activePane.title}` : "Disconnected"}
              </span>
              <span className="opacity-30">|</span>
              <span>{activePane.title}</span>
            </>
          )}
        </div>
        <div className="ml-auto flex items-center gap-4 text-[11px] text-text-muted">
          <span>Ping: {pingLabel}</span>
          <span>{tabs.length} {tabs.length === 1 ? "tab" : "tabs"}</span>
        </div>
      </div>

      <PaneLauncher
        open={!!splitTarget}
        savedConnections={savedConnections}
        onClose={() => setSplitTarget(null)}
        onNewSsh={() => {
          if (!splitTarget) return;
          openModal({
            targetTabId: splitTarget.tabId,
            targetPaneId: splitTarget.paneId,
            splitDirection: splitTarget.direction,
          });
          setSplitTarget(null);
        }}
        onLocal={() => {
          if (!splitTarget) return;
          startLocalPane(splitTarget);
          setSplitTarget(null);
        }}
        onSavedConnection={(connection) => {
          if (!splitTarget) return;
          handleDirectConnect(connection, splitTarget);
          setSplitTarget(null);
        }}
      />

      <SftpPanel
        sessionId={sftpSessionId}
        onClose={() => setSftpSessionId(null)}
      />

      <PortForwardModal
        sessionId={portForwardSessionId}
        onClose={() => setPortForwardSessionId(null)}
      />

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <ConnectModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        prefill={modalPrefill}
      />
    </div>
  );
}
