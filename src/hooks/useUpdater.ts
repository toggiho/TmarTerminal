import { useCallback, useEffect, useRef, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";

export type UpdateStatus =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "installing"
  | "installed"
  | "error";

export interface UpdaterState {
  status: UpdateStatus;
  currentVersion: string;
  update: Update | null;
  progress: number | null;
  message: string | null;
  error: string | null;
}

const initialState: UpdaterState = {
  status: "idle",
  currentVersion: "",
  update: null,
  progress: null,
  message: null,
  error: null,
};

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function useUpdater() {
  const [state, setState] = useState<UpdaterState>(initialState);
  const checkedRef = useRef(false);

  const checkForUpdate = useCallback(async () => {
    setState((value) => ({ ...value, status: "checking", error: null, message: null }));

    try {
      const [currentVersion, update] = await Promise.all([getVersion(), check()]);
      setState((value) => ({
        ...value,
        currentVersion,
        update,
        status: update ? "available" : "idle",
        message: update ? null : "No updates available",
      }));
    } catch (error) {
      setState((value) => ({
        ...value,
        status: "error",
        error: toErrorMessage(error),
        message: "Update check failed",
      }));
    }
  }, []);

  const installUpdate = useCallback(async () => {
    if (!state.update) return;

    let downloaded = 0;
    let contentLength = 0;
    setState((value) => ({
      ...value,
      status: "downloading",
      progress: 0,
      error: null,
      message: "Downloading update",
    }));

    try {
      await state.update.downloadAndInstall((event) => {
        if (event.event === "Started") {
          contentLength = event.data.contentLength ?? 0;
          downloaded = 0;
          setState((value) => ({
            ...value,
            status: "downloading",
            progress: contentLength > 0 ? 0 : null,
            message: "Downloading update",
          }));
        }

        if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          setState((value) => ({
            ...value,
            status: "downloading",
            progress: contentLength > 0 ? Math.min(100, Math.round((downloaded / contentLength) * 100)) : null,
            message: "Downloading update",
          }));
        }

        if (event.event === "Finished") {
          setState((value) => ({
            ...value,
            status: "installing",
            progress: 100,
            message: "Installing update",
          }));
        }
      });

      setState((value) => ({
        ...value,
        status: "installed",
        progress: 100,
        message: "Restarting TmarTerminal",
      }));
      await relaunch();
    } catch (error) {
      setState((value) => ({
        ...value,
        status: "error",
        error: toErrorMessage(error),
        message: "Update failed",
      }));
    }
  }, [state.update]);

  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;
    checkForUpdate().catch(console.error);
  }, [checkForUpdate]);

  return {
    ...state,
    checkForUpdate,
    installUpdate,
  };
}
