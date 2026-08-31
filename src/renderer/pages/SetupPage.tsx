import { useEffect, useState } from "react";
import { useAppStore } from "../store";
import { ModelProgress } from "../components/ModelProgress";

export function SetupPage() {
  const { setView, setOllamaStatus, setModelDownloadProgress, modelDownloadProgress } = useAppStore();
  const [status, setStatus] = useState<"detecting" | "downloading" | "ready" | "error">("detecting");
  const [modelInfo, setModelInfo] = useState({ displayName: "", sizeGB: 0 });
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    async function setup() {
      try {
        const model = await window.electronAPI.getModelChoice();
        setModelInfo({ displayName: model.displayName, sizeGB: model.sizeGB });

        setStatus("downloading");
        setOllamaStatus("starting");

        const unsubscribe = window.electronAPI.onModelDownloadProgress((progress) => {
          setModelDownloadProgress(progress);
        });

        await window.electronAPI.ollamaStartAndPull();

        unsubscribe();
        setOllamaStatus("ready");
        setStatus("ready");

        const profile = await window.electronAPI.dbGetProfile();
        if (profile) {
          setView("dashboard");
        } else {
          setView("onboarding-persona");
        }
      } catch (err: any) {
        setStatus("error");
        setOllamaStatus("error");
        setErrorMsg(err.message || "Failed to set up AI");
      }
    }

    setup();
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-screen gap-6 p-8">
      <h1 className="text-4xl font-bold">AgentOne</h1>
      <p className="text-zinc-400">Your private AI assistant</p>

      {status === "detecting" && (
        <p className="text-zinc-300 animate-pulse">Detecting your hardware...</p>
      )}

      {status === "downloading" && (
        <ModelProgress
          progress={modelDownloadProgress}
          modelName={modelInfo.displayName}
          sizeGB={modelInfo.sizeGB}
        />
      )}

      {status === "ready" && (
        <p className="text-green-400">Ready! Setting up...</p>
      )}

      {status === "error" && (
        <div className="text-center">
          <p className="text-red-400 mb-2">Something went wrong</p>
          <p className="text-sm text-zinc-500">{errorMsg}</p>
          <button
            className="mt-4 px-4 py-2 bg-zinc-800 rounded hover:bg-zinc-700 text-sm"
            onClick={() => window.location.reload()}
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
