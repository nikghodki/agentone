import React, { useState } from "react";
import { CHANNELS } from "@shared/channels";
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

type ConnectState = "idle" | "connecting" | "verifying" | "success" | "error";

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

    // For QR channels, config and secrets are empty
    let config: Record<string, string> = {};
    let secrets: Record<string, string> = {};

    if (selectedChannel.kind === "credential") {
      // Separate config (non-secret) and secrets (secret fields)
      selectedChannel.fields.forEach((field) => {
        const value = fieldValues[field.key] || "";
        // Only include non-empty values or required fields
        if (value) {
          if (field.secret) {
            secrets[field.key] = value;
          } else {
            config[field.key] = value;
          }
        }
      });
    }
    // For QR channels, config and secrets remain empty

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

  const getQrPairingCommand = (frameworkId: string): string => {
    switch (frameworkId) {
      case "openclaw":
        return "openclaw channels login --channel whatsapp";
      case "hermes":
        return "hermes whatsapp";
      case "zeptoclaw":
        return "zeptoclaw channel setup whatsapp_web";
      default:
        return "run your framework's WhatsApp pairing command";
    }
  };

  const handleQrDone = () => {
    if (!selectedChannel) return;
    onConnected?.(selectedChannel.id);
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

          {/* Credential channel: show field inputs */}
          {selectedChannel.kind === "credential" && (
            <>
              {selectedChannel.fields.map((field) => (
                <Input
                  key={field.key}
                  label={field.optional ? `${field.label} (optional)` : field.label}
                  type={field.secret ? "password" : "text"}
                  placeholder={field.placeholder}
                  helper={field.help}
                  value={fieldValues[field.key] || ""}
                  onChange={(e) => handleFieldChange(field.key, e.target.value)}
                />
              ))}
            </>
          )}

          {/* QR channel: show guided pairing instructions only */}
          {selectedChannel.kind === "qr" && (
            <>
              <Callout tone="info">
                Pairing happens in the framework itself by running a terminal command that displays a QR code. Scan it with your phone to complete pairing.
              </Callout>
              <div className="rounded-lg bg-slate-50 p-4 border border-slate-200">
                <h4 className="text-sm font-medium text-slate-900 mb-2">Pairing command</h4>
                <code className="text-sm text-indigo-700 font-mono">
                  {getQrPairingCommand(frameworkId)}
                </code>
              </div>
            </>
          )}

          {/* Connect button and progress */}
          {connectState === "connecting" && (
            <ProgressBar
              value={0}
              indeterminate
              label={progressLabel}
            />
          )}

          {/* Credential channel: Connect button */}
          {selectedChannel.kind === "credential" && connectState === "idle" && (
            <Button
              variant="primary"
              onClick={handleConnect}
              disabled={
                // Only require non-optional fields to be filled
                selectedChannel.fields
                  .filter((f) => !f.optional)
                  .some((f) => !fieldValues[f.key])
              }
            >
              Connect
            </Button>
          )}

          {/* QR channel: Done button */}
          {selectedChannel.kind === "qr" && (
            <Button
              variant="primary"
              onClick={handleQrDone}
            >
              Done
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
