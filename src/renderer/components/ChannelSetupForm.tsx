import React, { useState } from "react";
import { CHANNELS, ChannelDef, ChannelField } from "@shared/channels";
import { RadioCardGroup, RadioCard } from "./ui/RadioCardGroup";
import { Input } from "./ui/Input";
import { Callout } from "./ui/Callout";
import { ProgressBar } from "./ui/ProgressBar";
import { Button } from "./ui/Button";

export interface ChannelSetupFormProps {
  deploymentId: string;
  frameworkId: string;
  onConnected?: (id: string) => void;
}

type ConnectState = "idle" | "connecting" | "success" | "error";

export function ChannelSetupForm({
  deploymentId,
  frameworkId,
  onConnected,
}: ChannelSetupFormProps) {
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [connectState, setConnectState] = useState<ConnectState>("idle");
  const [connectDetail, setConnectDetail] = useState<string>("");
  const [progressLabel, setProgressLabel] = useState<string>("");

  // Filter channels by framework
  const availableChannels = CHANNELS.filter((ch) =>
    ch.frameworks.includes(frameworkId)
  );

  const selectedChannel = availableChannels.find((ch) => ch.id === selectedChannelId);

  const handleChannelSelect = (channelId: string) => {
    setSelectedChannelId(channelId);
    setFieldValues({});
    setConnectState("idle");
    setConnectDetail("");
  };

  const handleFieldChange = (key: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleConnect = async () => {
    if (!selectedChannel) return;

    setConnectState("connecting");
    setConnectDetail("");

    // Separate config (non-secret) and secrets (secret fields)
    const config: Record<string, string> = {};
    const secrets: Record<string, string> = {};

    selectedChannel.fields.forEach((field) => {
      const value = fieldValues[field.key] || "";
      if (field.secret) {
        secrets[field.key] = value;
      } else {
        config[field.key] = value;
      }
    });

    try {
      // Staged progress
      setProgressLabel("Saving...");
      await new Promise((resolve) => setTimeout(resolve, 100));

      setProgressLabel("Restarting gateway...");
      await new Promise((resolve) => setTimeout(resolve, 100));

      setProgressLabel("Verifying...");
      const result = await window.electronAPI.configureChannel(deploymentId, {
        id: selectedChannel.id,
        config,
        secrets,
      });

      if (result.connected) {
        setConnectState("success");
        setConnectDetail("Connected successfully!");
        onConnected?.(selectedChannel.id);
      } else {
        setConnectState("error");
        setConnectDetail(result.detail || "Connection failed");
      }
    } catch (err) {
      setConnectState("error");
      setConnectDetail(err instanceof Error ? err.message : "Unknown error occurred");
    }
  };

  // No channels available for this framework
  if (availableChannels.length === 0) {
    return (
      <Callout tone="info">
        No channels available for this framework yet.
      </Callout>
    );
  }

  // Convert channels to RadioCard format
  const radioOptions: RadioCard[] = availableChannels.map((ch) => ({
    value: ch.id,
    title: ch.name,
    description: ch.instructions,
  }));

  return (
    <div className="space-y-6">
      {/* Channel picker */}
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-3">
          Select a channel
        </h3>
        <RadioCardGroup
          options={radioOptions}
          value={selectedChannelId}
          onChange={handleChannelSelect}
        />
      </div>

      {/* Channel fields + instructions */}
      {selectedChannel && (
        <div className="space-y-4">
          {/* Instructions callout */}
          <Callout tone="info">
            {selectedChannel.instructions}
          </Callout>

          {/* Field inputs */}
          {selectedChannel.fields.map((field) => (
            <Input
              key={field.key}
              label={field.label}
              type={field.secret ? "password" : "text"}
              placeholder={field.placeholder}
              helper={field.help}
              value={fieldValues[field.key] || ""}
              onChange={(e) => handleFieldChange(field.key, e.target.value)}
            />
          ))}

          {/* Connect button and progress */}
          {connectState === "connecting" && (
            <ProgressBar
              value={0}
              indeterminate
              label={progressLabel}
            />
          )}

          {connectState === "idle" && (
            <Button
              variant="primary"
              onClick={handleConnect}
              disabled={
                selectedChannel.fields.some((f) => !fieldValues[f.key])
              }
            >
              Connect
            </Button>
          )}

          {/* Success callout */}
          {connectState === "success" && (
            <Callout tone="success">
              {connectDetail}
            </Callout>
          )}

          {/* Error callout */}
          {connectState === "error" && (
            <Callout tone="warning">
              {connectDetail}
            </Callout>
          )}
        </div>
      )}
    </div>
  );
}
