import React, { useState, useEffect } from "react";
import { useAppStore } from "../store";
import { ChannelSetupForm } from "../components/ChannelSetupForm";
import { CHANNELS } from "@shared/channels";
import { Button } from "../components/ui/Button";

interface Channel {
  id: string;
  enabled: boolean;
  connected?: boolean;
}

export function ChannelsPage() {
  const { setView, currentDeploymentId, selectedFrameworkId } = useAppStore();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const loadChannels = async () => {
    if (!currentDeploymentId) {
      setError("No deployment selected");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const channelList = await window.electronAPI.listChannels(currentDeploymentId);
      setChannels(channelList);
    } catch (err) {
      setError("Failed to load channels");
      console.error("Failed to load channels:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadChannels();
  }, [currentDeploymentId]);

  const handleRemove = async (channel: Channel) => {
    if (!currentDeploymentId) return;

    // Get channel name from catalog
    const channelDef = CHANNELS.find((ch) => ch.id === channel.id);
    const channelName = channelDef?.name || channel.id;

    // Simple confirm
    if (!confirm(`Remove ${channelName}?`)) return;

    try {
      await window.electronAPI.removeChannel(currentDeploymentId, channel.id);
      // Refetch the list
      await loadChannels();
    } catch (err) {
      setError("Failed to remove channel");
      console.error("Failed to remove channel:", err);
    }
  };

  const handleChannelConnected = () => {
    setShowAddForm(false);
    loadChannels();
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-200">
        <button
          onClick={() => setView("task")}
          className="text-slate-600 hover:text-slate-900 transition-colors"
        >
          ← Back
        </button>
        <h2 className="text-lg font-medium text-slate-900">Manage Channels</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-6 max-w-3xl mx-auto w-full">
        {loading && (
          <div className="text-slate-500 text-center py-8">Loading...</div>
        )}

        {error && (
          <div className="text-rose-600 text-center py-8">{error}</div>
        )}

        {!loading && !error && channels.length === 0 && !showAddForm && (
          <div className="text-slate-500 text-center py-8">
            No channels connected yet.
          </div>
        )}

        {!loading && !error && channels.length > 0 && (
          <div className="space-y-4 mb-6">
            {channels.map((channel) => {
              const channelDef = CHANNELS.find((ch) => ch.id === channel.id);
              const channelName = channelDef?.name || channel.id;

              return (
                <div
                  key={channel.id}
                  className="bg-white rounded-lg p-4 border border-slate-200 flex items-start justify-between shadow-sm"
                >
                  <div className="flex-1">
                    <div className="text-slate-900 font-medium">{channelName}</div>
                    <div className="flex gap-2 mt-2">
                      {channel.enabled && (
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Enabled
                        </span>
                      )}
                      {channel.connected && (
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                          Connected
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemove(channel)}
                    className="ml-4 px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white text-sm rounded transition-colors"
                  >
                    Remove
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {!loading && !error && (
          <div className="mt-6">
            {!showAddForm ? (
              <Button
                variant="primary"
                onClick={() => setShowAddForm(true)}
              >
                Add channel
              </Button>
            ) : (
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-slate-900">Add a channel</h3>
                  <button
                    onClick={() => setShowAddForm(false)}
                    className="text-slate-600 hover:text-slate-900 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
                <ChannelSetupForm
                  deploymentId={currentDeploymentId!}
                  frameworkId={selectedFrameworkId}
                  onConnected={handleChannelConnected}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
