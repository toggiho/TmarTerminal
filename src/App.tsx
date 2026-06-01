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
import { CommandPalette, CommandPaletteAction } from "./components/CommandPalette";
import { PortForwardDashboard } from "./components/PortForwardDashboard";
import { useStore } from "./store/useStore";
import { ConnectFormData, PortForwardRecord, RecentConnection, SavedConnection, Tab, TerminalPane } from "./types";
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

interface ForwardInfo {
  id: string;
  local_port: number;
  remote_host: string;
  remote_port: number;
}

function isInputTarget(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el?.closest("input, textarea, select, [contenteditable='true'], [data-hotkeys='ignore']");
}

function getPane(tab: Tab, paneId: string) {
  return tab.panes.find((pane) => pane.id === paneId) ?? tab.panes[0];
}

function getPaneRects(layout: Tab["layout"], bounds = { left: 0, top: 0, width: 100, height: 100 }): PaneRect[] {
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

function toRecentConnection(connection: SavedConnection): Omit<RecentConnection, "lastConnectedAt"> {
  return {
    id: connection.id,
    name: connection.name || `${connection.username}@${connection.host}`,
    host: connection.host,
    port: connection.port,
    username: connection.username,
    auth_type: connection.auth_type,
    key_path: connection.key_path,
    password: connection.password,
    connectionId: connection.id,
  };
}

function normalizeConnection(connection: SavedConnection): SavedConnection {
  return {
    ...connection,
    snippets: (connection.snippets ?? []).map((snippet: any) => ({
      id: snippet.id,
      name: snippet.name,
      command: snippet.command,
      autoEnter: snippet.autoEnter ?? snippet.auto_enter ?? false,
    })),
  };
}

export default function App() {
  const {
    tabs,
    activeTabId,
    savedConnections,
    recentConnections,
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
    addRecentConnection,
    setPortForwards,
    portForwards,
  } = useStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalPrefill, setModalPrefill] = useState<Partial<ConnectFormData> | undefined>();
  const [splitTarget, setSplitTarget] = useState<SplitTarget | null>(null);
  const [pingLabel, setPingLabel] = useState("-- ms");
  const [sftpSessionId, setSftpSessionId] = useState<string | null>(null);
  const [portForwardSessionId, setPortForwardSessionId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [portDashboardOpen, setPortDashboardOpen] = useState(false);

  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTabId),
    [activeTabId, tabs],
  );
  const activePane = activeTab ? getPane(activeTab, activeTab.activePaneId) : undefined;

  const refreshPortForwards = useCallback(async () => {
    const sshPanes = tabs.flatMap((tab) => tab.panes.filter((pane) => pane.type === "ssh" && pane.status === "connected"));
    const records = await Promise.all(
      sshPanes.map(async (pane) => {
        try {
          const list = await invoke<ForwardInfo[]>("port_forward_list", { sessionId: pane.sessionId });
          return list.map<PortForwardRecord>((forward) => ({
            id: forward.id,
            sessionId: pane.sessionId,
            sessionLabel: pane.title,
            localPort: forward.local_port,
            remoteHost: forward.remote_host,
            remotePort: forward.remote_port,
          }));
        } catch {
          return [];
        }
      }),
    );
    setPortForwards(records.flat());
  }, [setPortForwards, tabs]);

  useEffect(() => {
    invoke<SavedConnection[]>("get_connections")
      .then((connections) => setSavedConnections(connections.map(normalizeConnection)))
      .catch(console.error);
  }, [setSavedConnections]);

  useEffect(() => {
    refreshPortForwards().catch(console.error);
  }, [refreshPortForwards]);

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
    const pane: TerminalPane = {
      id: paneId,
      sessionId,
      title,
      host: conn.host,
      status: "connecting",
      type: "ssh",
      connectionId: conn.id,
    };
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
      updatePane(tabId, paneId, { status: "connected", lastError: undefined });
      addRecentConnection(toRecentConnection(conn));
      refreshPortForwards().catch(console.error);
    } catch (err) {
      updatePane(tabId, paneId, {
        status: "error",
        title: conn.name || `${conn.username}@${conn.host}`,
        lastError: String(err),
      });
      console.error(err);
    }
  }, [addPaneToTab, addRecentConnection, addTab, refreshPortForwards, updatePane]);

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
      updatePane(tabId, paneId, { status: "error", title: "PowerShell error", lastError: String(err) });
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

  const handleReconnect = useCallback(async (conn: RecentConnection, target?: SplitTarget) => {
    const saved = conn.connectionId ? savedConnections.find((item) => item.id === conn.connectionId) : undefined;
    const merged: SavedConnection = saved ?? {
      id: conn.connectionId ?? conn.id,
      name: conn.name,
      host: conn.host,
      port: conn.port,
      username: conn.username,
      auth_type: conn.auth_type,
      key_path: conn.key_path,
      password: conn.password,
      snippets: [],
    };
    await handleDirectConnect(merged, target);
  }, [handleDirectConnect, savedConnections]);

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
      snippets: conn.snippets ?? [],
    });
  }, [openModal]);

  const activeConnection = useMemo(
    () => savedConnections.find((connection) => connection.id === activePane?.connectionId),
    [activePane?.connectionId, savedConnections],
  );

  const runSnippet = useCallback((command: string, autoEnter?: boolean) => {
    if (!activePane || activePane.type !== "ssh" || activePane.status !== "connected") return;
    const payload = `${command}${autoEnter ? "\r" : ""}`;
    invoke("ssh_send_data", { sessionId: activePane.sessionId, data: Array.from(new TextEncoder().encode(payload)) }).catch(console.error);
  }, [activePane]);

  const paletteActions = useMemo<CommandPaletteAction[]>(() => {
    const actions: CommandPaletteAction[] = [
      {
        id: "new-connection",
        label: "New SSH connection",
        group: "Actions",
        hotkey: settings.hotkeys.newTab,
        icon: "command",
        onSelect: () => openModal(),
      },
      {
        id: "new-local",
        label: "New local PowerShell pane",
        group: "Actions",
        icon: "terminal",
        onSelect: () => startLocalPane(),
      },
      {
        id: "settings",
        label: "Open settings",
        group: "Actions",
        icon: "command",
        onSelect: () => setSettingsOpen(true),
      },
      {
        id: "import-ssh-config",
        label: "Import ~/.ssh/config",
        group: "Actions",
        icon: "command",
        onSelect: async () => {
          const updated = await invoke<SavedConnection[]>("import_ssh_config");
          setSavedConnections(updated.map(normalizeConnection));
        },
      },
    ];

    recentConnections.forEach((connection) => {
      actions.push({
        id: `recent-${connection.id}`,
        label: `Reconnect ${connection.name}`,
        subtitle: `${connection.username}@${connection.host}:${connection.port}`,
        group: "Recent",
        icon: "history",
        onSelect: () => { handleReconnect(connection).catch(console.error); },
      });
    });

    savedConnections.forEach((connection) => {
      actions.push({
        id: `saved-${connection.id}`,
        label: connection.name,
        subtitle: `${connection.username}@${connection.host}:${connection.port}`,
        group: "Connections",
        icon: "server",
        keywords: [connection.host, connection.username],
        onSelect: () => { handleDirectConnect(connection).catch(console.error); },
      });
    });

    (activeConnection?.snippets ?? []).forEach((snippet) => {
      actions.push({
        id: `snippet-${snippet.id}`,
        label: `Run ${snippet.name}`,
        subtitle: snippet.command,
        group: "Snippets",
        icon: "terminal",
        onSelect: () => runSnippet(snippet.command, snippet.autoEnter),
      });
    });

    return actions;
  }, [activeConnection?.snippets, handleDirectConnect, handleReconnect, openModal, recentConnections, runSnippet, savedConnections, setSavedConnections, settings.hotkeys.newTab, startLocalPane]);

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
    refreshPortForwards().catch(console.error);
  }, [refreshPortForwards, removePane]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isInputTarget(e.target)) return;
      if (isHotkey(e, settings.hotkeys.newTab)) {
        e.preventDefault();
        openModal();
      }
      if (isHotkey(e, settings.hotkeys.commandPalette)) {
        e.preventDefault();
        setPaletteOpen(true);
      }
      if (isHotkey(e, settings.hotkeys.reconnectLast)) {
        e.preventDefault();
        if (recentConnections[0]) handleReconnect(recentConnections[0]).catch(console.error);
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
        const { activeTabId: currentId, tabs: currentTabs } = useStore.getState();
        if (currentTabs.length < 2) return;
        const current = Math.max(0, currentTabs.findIndex((tab) => tab.id === currentId));
        const direction = isHotkey(e, settings.hotkeys.previousTab) ? -1 : 1;
        const next = (current + direction + currentTabs.length) % currentTabs.length;
        setActiveTab(currentTabs[next].id);
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
        const { activeTabId: currentId, tabs: currentTabs } = useStore.getState();
        const tab = currentTabs.find((item) => item.id === currentId);
        if (!tab) return;
        Promise.all(
          tab.panes.map((pane) =>
            invoke(pane.type === "ssh" ? "ssh_disconnect" : "local_close", { sessionId: pane.sessionId }).catch(console.error),
          ),
        ).finally(() => {
          removeTab(tab.id);
          refreshPortForwards().catch(console.error);
        });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    closeActivePane,
    focusNextPane,
    handleReconnect,
    openModal,
    openSplitLauncher,
    recentConnections,
    refreshPortForwards,
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
        <div className="absolute inset-x-0 top-0 z-10 flex h-7 items-center gap-2 border-b border-border/70 bg-bg-surface px-2 text-[11px]">
          <span className={`h-1.5 w-1.5 rounded-full ${
            pane.status === "connected" ? "bg-success" :
            pane.status === "connecting" ? "bg-warning animate-pulse" :
            pane.status === "error" ? "bg-error" : "bg-text-muted"
          }`} />
          <span className="truncate text-text-primary">{pane.title}</span>
          {pane.host && <span className="truncate text-text-muted">{pane.host}</span>}
          {pane.hasUnreadOutput && !active && <span className="h-2 w-2 rounded-full bg-accent-cyan" title="New output" />}
          {pane.status === "error" && pane.lastError && (
            <span className="truncate text-error">{pane.lastError}</span>
          )}
          <div className="ml-auto flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            <button
              onClick={() => openSplitLauncher("horizontal")}
              title="Split right (Ctrl+Shift+D)"
              className="rounded border border-border bg-bg-surface/90 p-1 text-text-muted hover:text-text-primary"
            >
              <SplitSquareHorizontal size={13} />
            </button>
            <button
              onClick={() => openSplitLauncher("vertical")}
              title="Split down (Ctrl+Shift+E)"
              className="rounded border border-border bg-bg-surface/90 p-1 text-text-muted hover:text-text-primary"
            >
              <SplitSquareVertical size={13} />
            </button>
            {pane.type === "ssh" && pane.status === "connected" && (
              <>
                <button
                  onClick={() => setSftpSessionId(pane.sessionId)}
                  title="Open SFTP (Ctrl+Shift+S)"
                  className="rounded border border-border bg-bg-surface/90 p-1 text-text-muted hover:text-accent-cyan"
                >
                  <FolderSync size={13} />
                </button>
                <button
                  onClick={() => setPortForwardSessionId(pane.sessionId)}
                  title="Port forwarding"
                  className="rounded border border-border bg-bg-surface/90 p-1 text-text-muted hover:text-accent-purple"
                >
                  <ArrowRightLeft size={13} />
                </button>
              </>
            )}
            <button
              onClick={closeActivePane}
              title="Close pane (Ctrl+Shift+W)"
              className="rounded border border-border bg-bg-surface/90 p-1 text-text-muted hover:text-error"
            >
              <X size={13} />
            </button>
          </div>
        </div>
        <div className="h-full pt-7">
          <Terminal
            sessionId={pane.sessionId}
            tabId={tab.id}
            paneId={pane.id}
            isActive={active}
            type={pane.type}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-bg-base font-sans">
      <TitleBar
        onNewTab={() => openModal()}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenPalette={() => setPaletteOpen(true)}
        onTogglePortDashboard={() => setPortDashboardOpen((value) => !value)}
        portDashboardOpen={portDashboardOpen}
      />

      <div className="flex min-h-0 flex-1">
        <Sidebar
          onNewConnection={() => openModal()}
          onDirectConnect={handleDirectConnect}
          onEdit={handleEditConnection}
          onReconnect={handleReconnect}
        />

        {/* Content region: stable bounds between sidebar and window edge */}
        <div className="relative flex-1 min-w-0 bg-bg-base">
          {/* Background layer: fixed-size welcome, never reflows, just gets covered by panels */}
          {tabs.length === 0 && (
            <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center overflow-hidden">
              <div className="pointer-events-auto">
                <WelcomeScreen
                  onNewConnection={() => openModal()}
                  recentConnections={recentConnections}
                  onReconnect={handleReconnect}
                />
              </div>
            </div>
          )}

          {/* Foreground layer: terminal tabs + side panels */}
          <div className={`relative z-10 flex h-full w-full ${tabs.length === 0 ? "pointer-events-none" : ""}`}>
            <main className="relative flex-1 min-w-0">
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
            </main>

            <div className="pointer-events-auto flex h-full shrink-0">
              {portDashboardOpen && (
                <PortForwardDashboard forwards={portForwards} onRefresh={() => refreshPortForwards().catch(console.error)} />
              )}

              <AnimatePresence>
                {localPanelOpen && <LocalPanel key="local-panel" />}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      <div className="flex h-6 shrink-0 items-center border-t border-border bg-bg-surface px-4">
        <div className="flex items-center gap-4 text-[11px] text-text-muted">
          {!activePane ? (
            <span>TmarTerminal - Ready</span>
          ) : (
            <>
              <span className="flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${
                  activePane.status === "connected" ? "bg-success" :
                  activePane.status === "connecting" ? "bg-warning animate-pulse" :
                  activePane.status === "error" ? "bg-error" : "bg-text-muted"
                }`} />
                {activePane.status === "connected" ? `Connected - ${activePane.host ?? activePane.title}` :
                 activePane.status === "connecting" ? `Connecting to ${activePane.host ?? activePane.title}...` :
                 activePane.status === "error" ? activePane.lastError ?? `Connection failed - ${activePane.host ?? activePane.title}` : "Disconnected"}
              </span>
              <span className="opacity-30">|</span>
              <span>{activePane.title}</span>
            </>
          )}
        </div>
        <div className="ml-auto flex items-center gap-4 text-[11px] text-text-muted">
          <span>Ping: {pingLabel}</span>
          <span>{portForwards.length} tunnels</span>
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
        onChanged={() => refreshPortForwards().catch(console.error)}
        onClose={() => {
          setPortForwardSessionId(null);
          refreshPortForwards().catch(console.error);
        }}
      />

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <CommandPalette open={paletteOpen} actions={paletteActions} onClose={() => setPaletteOpen(false)} />

      <ConnectModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          invoke<SavedConnection[]>("get_connections").then((connections) => setSavedConnections(connections.map(normalizeConnection))).catch(console.error);
        }}
        prefill={modalPrefill}
      />
    </div>
  );
}
