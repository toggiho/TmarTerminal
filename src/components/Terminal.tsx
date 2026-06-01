import { useEffect, useRef, useCallback } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { SearchAddon } from "@xterm/addon-search";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { useStore } from "../store/useStore";
import { TERMINAL_THEMES } from "../settings";
import "@xterm/xterm/css/xterm.css";

interface TerminalProps {
  sessionId: string;
  tabId: string;
  paneId: string;
  isActive: boolean;
  type: "ssh" | "local";
}

export function Terminal({ sessionId, tabId, paneId, isActive, type }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const isActiveRef = useRef(isActive);
  const unlistenData = useRef<UnlistenFn | null>(null);
  const unlistenClose = useRef<UnlistenFn | null>(null);
  const { updatePane, settings, touchPaneActivity } = useStore();

  const dataEvent = type === "ssh" ? `ssh_data_${sessionId}` : `pty_data_${sessionId}`;
  const closeEvent = type === "ssh" ? `ssh_closed_${sessionId}` : `pty_closed_${sessionId}`;
  const sendCmd = type === "ssh" ? "ssh_send_data" : "local_send";
  const resizeCmd = type === "ssh" ? "ssh_resize" : "local_resize";

  const handleResize = useCallback(() => {
    if (!fitAddonRef.current || !xtermRef.current) return;
    try {
      fitAddonRef.current.fit();
      const { cols, rows } = xtermRef.current;
      invoke(resizeCmd, { sessionId, cols, rows }).catch(() => {});
    } catch {}
  }, [sessionId, resizeCmd]);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new XTerm({
      fontFamily: '"JetBrains Mono", "Cascadia Code", "Fira Code", monospace',
      fontSize: settings.fontSize,
      lineHeight: 1.4,
      theme: TERMINAL_THEMES[settings.terminalTheme],
      cursorBlink: true,
      cursorStyle: "block",
      scrollback: 10000,
      allowTransparency: true,
    });

    const fitAddon = new FitAddon();
    const searchAddon = new SearchAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(searchAddon);
    term.loadAddon(new WebLinksAddon());
    term.open(containerRef.current);
    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;
    searchAddonRef.current = searchAddon;

    term.onData((data) => {
      const encoded = Array.from(new TextEncoder().encode(data));
      invoke(sendCmd, { sessionId, data: encoded }).catch(() => {});
    });

    const setup = async () => {
      unlistenData.current = await listen<number[]>(dataEvent, (e) => {
        term.write(new Uint8Array(e.payload));
        touchPaneActivity(tabId, paneId);
      });
      unlistenClose.current = await listen(closeEvent, () => {
        term.writeln("\r\n\x1b[33mSession closed.\x1b[0m");
        if (tabId) updatePane(tabId, paneId, { status: "disconnected" });
      });
    };
    setup();

    const searchHandler = () => {
      if (!isActiveRef.current) return;
      const query = window.prompt("Search terminal");
      if (query) searchAddon.findNext(query);
    };
    window.addEventListener("terminal-search", searchHandler);

    const ro = new ResizeObserver(() => handleResize());
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      window.removeEventListener("terminal-search", searchHandler);
      unlistenData.current?.();
      unlistenClose.current?.();
      term.dispose();
    };
  }, [paneId, sessionId, tabId, touchPaneActivity, type, updatePane, sendCmd, dataEvent, closeEvent, handleResize, settings.fontSize, settings.terminalTheme]);

  useEffect(() => {
    if (!xtermRef.current) return;
    xtermRef.current.options.theme = TERMINAL_THEMES[settings.terminalTheme];
    xtermRef.current.options.fontSize = settings.fontSize;
    handleResize();
  }, [handleResize, settings.fontSize, settings.terminalTheme]);

  useEffect(() => {
    isActiveRef.current = isActive;
    if (isActive) {
      setTimeout(() => {
        handleResize();
        xtermRef.current?.focus();
      }, 50);
    }
  }, [isActive, handleResize]);

  return <div ref={containerRef} className="w-full h-full" style={{ padding: "4px 8px" }} />;
}
