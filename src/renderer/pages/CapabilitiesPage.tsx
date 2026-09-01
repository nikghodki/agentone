import React, { useState, useEffect } from "react";
import { useAppStore } from "../store";
import type { InstalledCapability } from "@shared/v2-types";

export function CapabilitiesPage() {
  const { setView, currentDeploymentId } = useAppStore();
  const [capabilities, setCapabilities] = useState<InstalledCapability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const loadCapabilities = async () => {
    if (!currentDeploymentId) {
      setError("No deployment selected");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const caps = await window.electronAPI.getCapabilities(currentDeploymentId);
      setCapabilities(caps);
    } catch (err) {
      setError("Failed to load capabilities");
      console.error("Failed to load capabilities:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadCapabilities();
  }, [currentDeploymentId]);

  const handleRemove = async (cap: InstalledCapability) => {
    if (!currentDeploymentId) return;

    // Simple confirm
    if (!confirm(`Remove ${cap.name}?`)) return;

    setNote(null);
    try {
      const result = await window.electronAPI.removeCapability(currentDeploymentId, {
        type: cap.type,
        name: cap.name,
      });

      if (!result.frameworkRemoved && result.note) {
        setNote(result.note);
      }

      // Refetch the list
      await loadCapabilities();
    } catch (err) {
      setError("Failed to remove capability");
      console.error("Failed to remove capability:", err);
    }
  };

  // Group capabilities by type
  const grouped = {
    skill: capabilities.filter((c) => c.type === "skill"),
    mcp: capabilities.filter((c) => c.type === "mcp"),
    plugin: capabilities.filter((c) => c.type === "plugin"),
  };

  return (
    <div className="flex flex-col h-screen">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-zinc-800">
        <button
          onClick={() => setView("settings")}
          className="text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          ← Back
        </button>
        <h2 className="text-lg font-medium">Manage Capabilities</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-6 max-w-3xl mx-auto w-full">
        {loading && (
          <div className="text-zinc-400 text-center py-8">Loading...</div>
        )}

        {error && (
          <div className="text-red-400 text-center py-8">{error}</div>
        )}

        {!loading && !error && capabilities.length === 0 && (
          <div className="text-zinc-400 text-center py-8">
            No capabilities installed yet.
          </div>
        )}

        {note && (
          <div className="mb-6 p-4 bg-yellow-900/20 border border-yellow-700/30 rounded-lg text-yellow-200 text-sm">
            {note}
          </div>
        )}

        {!loading && !error && capabilities.length > 0 && (
          <div className="space-y-8">
            {/* Skills */}
            {grouped.skill.length > 0 && (
              <section>
                <h3 className="text-sm font-medium text-zinc-400 mb-3">Skills</h3>
                <div className="space-y-2">
                  {grouped.skill.map((cap) => (
                    <div
                      key={`${cap.type}-${cap.name}`}
                      className="bg-zinc-900 rounded-lg p-4 border border-zinc-800 flex items-start justify-between"
                    >
                      <div className="flex-1">
                        <div className="text-zinc-200 font-medium">{cap.name}</div>
                        <div className="text-xs text-zinc-500 mt-1">{cap.source}</div>
                      </div>
                      <button
                        onClick={() => handleRemove(cap)}
                        className="ml-4 px-3 py-1 bg-red-600/80 hover:bg-red-600 text-white text-sm rounded transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* MCP Servers */}
            {grouped.mcp.length > 0 && (
              <section>
                <h3 className="text-sm font-medium text-zinc-400 mb-3">MCP Servers</h3>
                <div className="space-y-2">
                  {grouped.mcp.map((cap) => (
                    <div
                      key={`${cap.type}-${cap.name}`}
                      className="bg-zinc-900 rounded-lg p-4 border border-zinc-800 flex items-start justify-between"
                    >
                      <div className="flex-1">
                        <div className="text-zinc-200 font-medium">{cap.name}</div>
                        <div className="text-xs text-zinc-500 mt-1">{cap.source}</div>
                      </div>
                      <button
                        onClick={() => handleRemove(cap)}
                        className="ml-4 px-3 py-1 bg-red-600/80 hover:bg-red-600 text-white text-sm rounded transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Plugins */}
            {grouped.plugin.length > 0 && (
              <section>
                <h3 className="text-sm font-medium text-zinc-400 mb-3">Plugins</h3>
                <div className="space-y-2">
                  {grouped.plugin.map((cap) => (
                    <div
                      key={`${cap.type}-${cap.name}`}
                      className="bg-zinc-900 rounded-lg p-4 border border-zinc-800 flex items-start justify-between"
                    >
                      <div className="flex-1">
                        <div className="text-zinc-200 font-medium">{cap.name}</div>
                        <div className="text-xs text-zinc-500 mt-1">{cap.source}</div>
                      </div>
                      <button
                        onClick={() => handleRemove(cap)}
                        className="ml-4 px-3 py-1 bg-red-600/80 hover:bg-red-600 text-white text-sm rounded transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
