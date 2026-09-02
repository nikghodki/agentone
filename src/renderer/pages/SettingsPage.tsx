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
      try {
        const status = await window.electronAPI.getLicenseStatus();
        setLicenseStatus(status);

        const model = await window.electronAPI.getModelChoice();
        setModelName(model.displayName);

        const hw = await window.electronAPI.getHardwareInfo();
        setHardwareInfo(`${hw.totalRamGB}GB RAM · ${hw.gpuType === "apple-silicon" ? "Apple Silicon" : hw.gpuType === "nvidia" ? "NVIDIA GPU" : "CPU"} · ${hw.platform}`);
      } catch (err) {
        console.error("Failed to load settings data:", err);
      }
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
      } else {
        setActivationMsg("Invalid license key. Please try again.");
      }
    } catch {
      setActivationMsg("Invalid license key. Please try again.");
    }
    setActivating(false);
  }

  async function handleResetPersona() {
    try {
      const profile = await window.electronAPI.dbGetProfile();
      await window.electronAPI.dbSaveProfile({
        persona: "",
        priorities: [],
        licenseKey: profile?.licenseKey ?? null,
        licenseValidUntil: profile?.licenseValidUntil ?? null,
      });
      useAppStore.getState().selectPersona("");
      setView("onboarding-persona");
    } catch {
      setActivationMsg("Couldn't change persona. Please try again.");
    }
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-200">
        <button
          onClick={() => setView("dashboard")}
          className="text-slate-600 hover:text-slate-900 transition-colors"
        >
          ← Back
        </button>
        <h2 className="text-lg font-medium text-slate-900">Settings</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-6 max-w-lg mx-auto w-full">
        {/* License */}
        <section className="mb-8">
          <h3 className="text-sm font-medium text-slate-600 mb-3">Subscription</h3>
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-slate-700">Status:</span>
              <span className={`text-sm font-medium ${licenseStatus === "pro" ? "text-indigo-600" : "text-slate-500"}`}>
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
                  className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                <button
                  onClick={handleActivate}
                  disabled={activating}
                  className="px-4 py-2 bg-indigo-600 rounded-lg text-sm text-white hover:bg-indigo-700 disabled:opacity-40 transition-colors"
                >
                  Activate
                </button>
              </div>
            )}
            {activationMsg && (
              <p className={`text-xs mt-2 ${licenseStatus === "pro" ? "text-emerald-600" : "text-rose-600"}`}>
                {activationMsg}
              </p>
            )}
          </div>
        </section>

        {/* Model Info */}
        <section className="mb-8">
          <h3 className="text-sm font-medium text-slate-600 mb-3">AI Model</h3>
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm text-sm">
            <p className="text-slate-700">Model: <span className="text-slate-900">{modelName}</span></p>
            <p className="mt-1 text-slate-700">Hardware: <span className="text-slate-900">{hardwareInfo}</span></p>
            <p className="mt-2 text-xs text-slate-500">All AI processing happens on your device. Nothing is sent to the cloud.</p>
          </div>
        </section>

        {/* Persona */}
        <section className="mb-8">
          <h3 className="text-sm font-medium text-slate-600 mb-3">Persona</h3>
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
            <p className="text-sm mb-3 text-slate-700">
              Current: <span className="text-slate-900">{selectedPersonaId || "None"}</span>
            </p>
            <button
              onClick={handleResetPersona}
              className="px-4 py-2 bg-slate-100 rounded-lg text-sm text-slate-900 hover:bg-slate-200 transition-colors"
            >
              Change persona
            </button>
          </div>
        </section>

        {/* Capabilities */}
        <section className="mb-8">
          <h3 className="text-sm font-medium text-slate-600 mb-3">Capabilities</h3>
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
            <p className="text-sm mb-3 text-slate-600">
              Manage installed skills, MCP servers, and plugins for your current deployment.
            </p>
            <button
              onClick={() => setView("capabilities")}
              className="px-4 py-2 bg-slate-100 rounded-lg text-sm text-slate-900 hover:bg-slate-200 transition-colors"
            >
              Manage capabilities
            </button>
          </div>
        </section>

        {/* About */}
        <section>
          <h3 className="text-sm font-medium text-slate-600 mb-3">About</h3>
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm text-sm text-slate-600">
            <p>AgentOne v0.1.0</p>
            <p className="mt-1">Private AI that tells you what it can do.</p>
            <p className="mt-2 text-xs text-slate-500">All data stays on your device.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
