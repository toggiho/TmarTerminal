import { create } from "zustand";
import { AppSettings, PaneLayout, SavedConnection, Tab, TerminalPane } from "../types";
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from "../settings";

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
  localPanelOpen: boolean;
  settings: AppSettings;

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
  toggleLocalPanel: () => void;
  updateSettings: (updates: Partial<AppSettings>) => void;
  resetSettings: () => void;
}

export const useStore = create<Store>((set) => ({
  tabs: [],
  activeTabId: null,
  savedConnections: [],
  sidebarOpen: true,
  localPanelOpen: false,
  settings: loadSettings(),

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

  setActiveTab: (id) => set({ activeTabId: id }),

  setActivePane: (tabId, paneId) =>
    set((s) => ({
      activeTabId: tabId,
      tabs: s.tabs.map((tab) => (tab.id === tabId ? { ...tab, activePaneId: paneId } : tab)),
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
}));
