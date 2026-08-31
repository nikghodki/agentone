import { useState, useEffect } from "react";
import { useAppStore } from "../store";

export function SettingsPage() {
  const { setView, selectedPersonaId } = useAppStore();
  const [licenseKey, setLicenseKey] = useState("");
  const [licenseStatus, setLicenseStatus] = useState<"free" | "pro" | "expired">("free");
  const [modelName, setModelName] = useState("");
  const [hardwareInfo, setHardwareInfo] = useState("");
  const [activating, setActivating] = useState(false);
  const [activationMsg, setActivationMsg] = useState("");

  useEffect(() => {
    async function load() {
      const status = await window.electronAPI.getLicenseStatus();
      setLicenseStatus(status);

      const model = await window.electronAPI.getModelChoice();
      setModelName(model.displayName);

      const hw = await window.electronAPI.getHardwareInfo();
      setHardwareInfo(`${hw.totalRamGB}GB RAM · ${hw.gpuType === "apple-silicon" ? "Apple Silicon" : hw.gpuType === "nvidia" ? "NVIDIA GPU" : "CPU"} · ${hw.platform}`);
    }
    load();
  }, []);

  async function handleActivate() {
    if (!licenseKey.trim()) return;
    setActivating(true);
    setActivationMsg("");
    try {
      const success = await window.electronAPI.activateLicense(licenseKey.trim());
      if (success) {
        setLicenseStatus("pro");
        setActivationMsg("License activated! You now have unlimited generations.");
      }
    } catch {
      setActivationMsg("Invalid license key. Please try again.");
    }
    setActivating(false);
  }

  async function handleResetPersona() {
    await window.electronAPI.dbSaveProfile({
      persona: "",
      priorities: [],
      licenseKey: null,
      licenseValidUntil: null,
    });
    useAppStore.getState().selectPersona("");
    setView("onboarding-persona");
  }

  return (
    <div className="flex flex-col h-screen">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-zinc-800">
        <button
          onClick={() => setView("dashboard")}
          className="text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          ← Back
        </button>
        <h2 className="text-lg font-medium">Settings</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-6 max-w-lg mx-auto w-full">
        {/* License */}
        <section className="mb-8">
          <h3 className="text-sm font-medium text-zinc-400 mb-3">Subscription</h3>
          <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm">Status:</span>
              <span className={`text-sm font-medium ${licenseStatus === "pro" ? "text-blue-400" : "text-zinc-400"}`}>
                {licenseStatus === "pro" ? "Pro" : licenseStatus === "expired" ? "Expired" : "Free"}
              </span>
            </div>
            {licenseStatus !== "pro" && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={licenseKey}
                  onChange={(e) => setLicenseKey(e.target.value)}
                  placeholder="Enter license key"
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
                <button
                  onClick={handleActivate}
                  disabled={activating}
                  className="px-4 py-2 bg-blue-600 rounded-lg text-sm hover:bg-blue-500 disabled:opacity-40 transition-colors"
                >
                  Activate
                </button>
              </div>
            )}
            {activationMsg && (
              <p className={`text-xs mt-2 ${licenseStatus === "pro" ? "text-green-400" : "text-red-400"}`}>
                {activationMsg}
              </p>
            )}
          </div>
        </section>

        {/* Model Info */}
        <section className="mb-8">
          <h3 className="text-sm font-medium text-zinc-400 mb-3">AI Model</h3>
          <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 text-sm">
            <p>Model: <span className="text-zinc-200">{modelName}</span></p>
            <p className="mt-1">Hardware: <span className="text-zinc-200">{hardwareInfo}</span></p>
            <p className="mt-2 text-xs text-zinc-500">All AI processing happens on your device. Nothing is sent to the cloud.</p>
          </div>
        </section>

        {/* Persona */}
        <section className="mb-8">
          <h3 className="text-sm font-medium text-zinc-400 mb-3">Persona</h3>
          <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
            <p className="text-sm mb-3">
              Current: <span className="text-zinc-200">{selectedPersonaId || "None"}</span>
            </p>
            <button
              onClick={handleResetPersona}
              className="px-4 py-2 bg-zinc-800 rounded-lg text-sm hover:bg-zinc-700 transition-colors"
            >
              Change persona
            </button>
          </div>
        </section>

        {/* About */}
        <section>
          <h3 className="text-sm font-medium text-zinc-400 mb-3">About</h3>
          <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 text-sm text-zinc-400">
            <p>AgentOne v0.1.0</p>
            <p className="mt-1">Private AI that tells you what it can do.</p>
            <p className="mt-2 text-xs text-zinc-600">All data stays on your device.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
