import { create } from "zustand";
import { AppSettings, PaneLayout, PortForwardRecord, RecentConnection, SavedConnection, Tab, TerminalPane } from "../types";
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from "../settings";

const SIDEBAR_WIDTH_KEY = "tmar-terminal-sidebar-width";
const RECENT_CONNECTIONS_KEY = "tmar-terminal-recents";
const DEFAULT_SIDEBAR_WIDTH = 220;
const MIN_SIDEBAR_WIDTH = 180;
const MAX_SIDEBAR_WIDTH = 420;
const MAX_RECENTS = 8;

function loadSidebarWidth() {
  try {
    const raw = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    const value = raw ? Number(raw) : DEFAULT_SIDEBAR_WIDTH;
    if (!Number.isFinite(value)) return DEFAULT_SIDEBAR_WIDTH;
    return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, value));
  } catch {
    return DEFAULT_SIDEBAR_WIDTH;
  }
}

function saveSidebarWidth(width: number) {
  localStorage.setItem(SIDEBAR_WIDTH_KEY, String(width));
}

function loadRecentConnections() {
  try {
    const raw = localStorage.getItem(RECENT_CONNECTIONS_KEY);
    if (!raw) return [] as RecentConnection[];
    const parsed = JSON.parse(raw) as RecentConnection[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENTS) : [];
  } catch {
    return [] as RecentConnection[];
  }
}

function saveRecentConnections(recents: RecentConnection[]) {
  localStorage.setItem(RECENT_CONNECTIONS_KEY, JSON.stringify(recents.slice(0, MAX_RECENTS)));
}

function collectPaneIds(layout: PaneLayout): string[] {
  if (layout.type === "leaf") return [layout.paneId];
  return [...collectPaneIds(layout.first), ...collectPaneIds(layout.second)];
}

function splitLayout(
  layout: PaneLayout,
  targetPaneId: string,
  newPaneId: string,
  direction: "horizontal" | "vertical",
): PaneLayout {
  if (layout.type === "leaf") {
    if (layout.paneId !== targetPaneId) return layout;
    return {
      type: "split",
      direction,
      first: { type: "leaf", paneId: targetPaneId },
      second: { type: "leaf", paneId: newPaneId },
    };
  }

  return {
    ...layout,
    first: splitLayout(layout.first, targetPaneId, newPaneId, direction),
    second: splitLayout(layout.second, targetPaneId, newPaneId, direction),
  };
}

function removeFromLayout(layout: PaneLayout, paneId: string): PaneLayout | null {
  if (layout.type === "leaf") {
    return layout.paneId === paneId ? null : layout;
  }

  const first = removeFromLayout(layout.first, paneId);
  const second = removeFromLayout(layout.second, paneId);
  if (!first) return second;
  if (!second) return first;
  return { ...layout, first, second };
}

interface Store {
  tabs: Tab[];
  activeTabId: string | null;
  savedConnections: SavedConnection[];
  sidebarOpen: boolean;
  sidebarWidth: number;
  localPanelOpen: boolean;
  settings: AppSettings;
  recentConnections: RecentConnection[];
  portForwards: PortForwardRecord[];

  addTab: (pane: TerminalPane) => string;
  addPaneToTab: (
    tabId: string,
    targetPaneId: string,
    pane: TerminalPane,
    direction: "horizontal" | "vertical",
  ) => void;
  updatePane: (tabId: string, paneId: string, updates: Partial<TerminalPane>) => void;
  removePane: (tabId: string, paneId: string) => void;
  removeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  setActivePane: (tabId: string, paneId: string) => void;
  focusNextPane: (direction: 1 | -1) => void;
  toggleMaximizedPane: () => void;
  setSavedConnections: (connections: SavedConnection[]) => void;
  toggleSidebar: () => void;
  setSidebarWidth: (width: number) => void;
  toggleLocalPanel: () => void;
  updateSettings: (updates: Partial<AppSettings>) => void;
  resetSettings: () => void;
  addRecentConnection: (connection: Omit<RecentConnection, "lastConnectedAt">) => void;
  setPaneUnread: (tabId: string, paneId: string, unread: boolean) => void;
  touchPaneActivity: (tabId: string, paneId: string) => void;
  setPortForwards: (forwards: PortForwardRecord[]) => void;
}

export const useStore = create<Store>((set) => ({
  tabs: [],
  activeTabId: null,
  savedConnections: [],
  sidebarOpen: true,
  sidebarWidth: loadSidebarWidth(),
  localPanelOpen: false,
  settings: loadSettings(),
  recentConnections: loadRecentConnections(),
  portForwards: [],

  addTab: (pane) => {
    const tabId = pane.id;
    set((s) => ({
      tabs: [
        ...s.tabs,
        {
          id: tabId,
          title: pane.title,
          panes: [pane],
          activePaneId: pane.id,
          layout: { type: "leaf", paneId: pane.id },
        },
      ],
      activeTabId: tabId,
    }));
    return tabId;
  },

  addPaneToTab: (tabId, targetPaneId, pane, direction) =>
    set((s) => ({
      tabs: s.tabs.map((tab) =>
        tab.id === tabId
          ? {
              ...tab,
              panes: [...tab.panes, pane],
              activePaneId: pane.id,
              maximizedPaneId: undefined,
              layout: splitLayout(tab.layout, targetPaneId, pane.id, direction),
            }
          : tab,
      ),
      activeTabId: tabId,
    })),

  updatePane: (tabId, paneId, updates) =>
    set((s) => ({
      tabs: s.tabs.map((tab) => {
        if (tab.id !== tabId) return tab;
        const panes = tab.panes.map((pane) => (pane.id === paneId ? { ...pane, ...updates } : pane));
        const activePane = panes.find((pane) => pane.id === tab.activePaneId);
        return { ...tab, panes, title: activePane?.title ?? tab.title };
      }),
    })),

  removePane: (tabId, paneId) =>
    set((s) => {
      const tab = s.tabs.find((item) => item.id === tabId);
      if (!tab) return {};
      if (tab.panes.length <= 1) {
        const newTabs = s.tabs.filter((item) => item.id !== tabId);
        const idx = s.tabs.findIndex((item) => item.id === tabId);
        return {
          tabs: newTabs,
          activeTabId: s.activeTabId === tabId ? newTabs[Math.max(0, idx - 1)]?.id ?? null : s.activeTabId,
        };
      }

      const panes = tab.panes.filter((pane) => pane.id !== paneId);
      const layout = removeFromLayout(tab.layout, paneId) ?? { type: "leaf", paneId: panes[0].id };
      const activePaneId = tab.activePaneId === paneId ? panes[0].id : tab.activePaneId;
      return {
        tabs: s.tabs.map((item) =>
          item.id === tabId
            ? {
                ...item,
                panes,
                layout,
                activePaneId,
                maximizedPaneId: item.maximizedPaneId === paneId ? undefined : item.maximizedPaneId,
                title: panes.find((pane) => pane.id === activePaneId)?.title ?? item.title,
              }
            : item,
        ),
      };
    }),

  removeTab: (id) =>
    set((s) => {
      const newTabs = s.tabs.filter((t) => t.id !== id);
      let newActive = s.activeTabId;
      if (s.activeTabId === id) {
        const idx = s.tabs.findIndex((t) => t.id === id);
        newActive = newTabs[Math.max(0, idx - 1)]?.id ?? null;
      }
      return { tabs: newTabs, activeTabId: newActive };
    }),

  setActiveTab: (id) =>
    set((s) => ({
      activeTabId: id,
      tabs: s.tabs.map((tab) => (
        tab.id === id
          ? {
              ...tab,
              panes: tab.panes.map((pane) => (
                pane.id === tab.activePaneId ? { ...pane, hasUnreadOutput: false } : pane
              )),
            }
          : tab
      )),
    })),

  setActivePane: (tabId, paneId) =>
    set((s) => ({
      activeTabId: tabId,
      tabs: s.tabs.map((tab) => (
        tab.id === tabId
          ? {
              ...tab,
              activePaneId: paneId,
              panes: tab.panes.map((pane) => (pane.id === paneId ? { ...pane, hasUnreadOutput: false } : pane)),
            }
          : tab
      )),
    })),

  focusNextPane: (direction) =>
    set((s) => {
      const tab = s.tabs.find((item) => item.id === s.activeTabId);
      if (!tab || tab.panes.length < 2) return {};
      const ids = collectPaneIds(tab.layout).filter((id) => tab.panes.some((pane) => pane.id === id));
      const index = Math.max(0, ids.indexOf(tab.activePaneId));
      const activePaneId = ids[(index + direction + ids.length) % ids.length];
      return {
        tabs: s.tabs.map((item) => (item.id === tab.id ? { ...item, activePaneId } : item)),
      };
    }),

  toggleMaximizedPane: () =>
    set((s) => ({
      tabs: s.tabs.map((tab) =>
        tab.id === s.activeTabId
          ? { ...tab, maximizedPaneId: tab.maximizedPaneId ? undefined : tab.activePaneId }
          : tab,
      ),
    })),

  setSavedConnections: (connections) => set({ savedConnections: connections }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarWidth: (width) =>
    set(() => {
      const next = Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, Math.round(width)));
      saveSidebarWidth(next);
      return { sidebarWidth: next };
    }),
  toggleLocalPanel: () => set((s) => ({ localPanelOpen: !s.localPanelOpen })),
  updateSettings: (updates) =>
    set((s) => {
      const next = {
        ...s.settings,
        ...updates,
        hotkeys: { ...s.settings.hotkeys, ...updates.hotkeys },
      };
      saveSettings(next);
      return { settings: next };
    }),
  resetSettings: () =>
    set(() => {
      const next = DEFAULT_SETTINGS;
      saveSettings(next);
      return { settings: next };
    }),
  addRecentConnection: (connection) =>
    set((s) => {
      const next = [
        { ...connection, lastConnectedAt: Date.now() },
        ...s.recentConnections.filter((item) => (
          item.connectionId ? item.connectionId !== connection.connectionId : `${item.username}@${item.host}:${item.port}` !== `${connection.username}@${connection.host}:${connection.port}`
        )),
      ].slice(0, MAX_RECENTS);
      saveRecentConnections(next);
      return { recentConnections: next };
    }),
  setPaneUnread: (tabId, paneId, unread) =>
    set((s) => ({
      tabs: s.tabs.map((tab) => (
        tab.id === tabId
          ? { ...tab, panes: tab.panes.map((pane) => (pane.id === paneId ? { ...pane, hasUnreadOutput: unread } : pane)) }
          : tab
      )),
    })),
  touchPaneActivity: (tabId, paneId) =>
    set((s) => ({
      tabs: s.tabs.map((tab) => (
        tab.id === tabId
          ? {
              ...tab,
              panes: tab.panes.map((pane) => (
                pane.id === paneId
                  ? { ...pane, lastActivityAt: Date.now(), hasUnreadOutput: tab.activePaneId === paneId && s.activeTabId === tabId ? false : true }
                  : pane
              )),
            }
          : tab
      )),
    })),
  setPortForwards: (portForwards) => set({ portForwards }),
}));
