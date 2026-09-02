import React, { useState, useEffect, useRef } from "react";
import { useAppStore } from "../store";

export function TaskPage() {
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [showSwitchConfirm, setShowSwitchConfirm] = useState(false);
  const currentDeploymentId = useAppStore((s) => s.currentDeploymentId);
  const taskStreamText = useAppStore((s) => s.taskStreamText);
  const taskStatus = useAppStore((s) => s.taskStatus);
  const appendTaskStreamText = useAppStore((s) => s.appendTaskStreamText);
  const clearTaskStreamText = useAppStore((s) => s.clearTaskStreamText);
  const setTaskStatus = useAppStore((s) => s.setTaskStatus);
  const clearTaskStatus = useAppStore((s) => s.clearTaskStatus);
  const resetWizard = useAppStore((s) => s.resetWizard);
  const setView = useAppStore((s) => s.setView);
  const setCurrentDeploymentId = useAppStore((s) => s.setCurrentDeploymentId);

  const unsubTokenRef = useRef<(() => void) | null>(null);
  const unsubStatusRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Clean up any existing subscriptions first
    if (unsubTokenRef.current) {
      unsubTokenRef.current();
    }
    if (unsubStatusRef.current) {
      unsubStatusRef.current();
    }

    // Subscribe to task tokens
    const unsubToken = window.electronAPI.onTaskToken((token: string) => {
      appendTaskStreamText(token);
    });
    unsubTokenRef.current = unsubToken;

    // Subscribe to task status
    const unsubStatus = window.electronAPI.onTaskStatus((status: string) => {
      setTaskStatus(status);
    });
    unsubStatusRef.current = unsubStatus;

    // Cleanup on unmount
    return () => {
      if (unsubTokenRef.current) {
        unsubTokenRef.current();
        unsubTokenRef.current = null;
      }
      if (unsubStatusRef.current) {
        unsubStatusRef.current();
        unsubStatusRef.current = null;
      }
    };
  }, [appendTaskStreamText, setTaskStatus]);

  const handleSendTask = async () => {
    if (!input.trim() || !currentDeploymentId || isStreaming) return;

    clearTaskStreamText();
    clearTaskStatus();
    setIsStreaming(true);

    try {
      await window.electronAPI.sendTask(currentDeploymentId, input);
    } catch (err) {
      console.error("sendTask failed:", err);
    } finally {
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendTask();
    }
  };

  const handleSwitchFramework = async () => {
    if (!currentDeploymentId) return;

    try {
      await window.electronAPI.removeDeployment(currentDeploymentId);
      setCurrentDeploymentId(null);
      resetWizard();
      setView("wizard");
      setShowSwitchConfirm(false);
    } catch (err) {
      console.error("Failed to remove deployment:", err);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-zinc-950">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-zinc-800">
        <h1 className="text-xl font-semibold text-white">Task Runner</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSwitchConfirm(true)}
            disabled={!currentDeploymentId}
            className="px-4 py-2 text-sm bg-transparent hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Switch framework
          </button>
          <button
            onClick={() => useAppStore.getState().setView("dashboard")}
            className="px-4 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>

      {/* Switch Framework Confirmation Modal */}
      {showSwitchConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-zinc-900 rounded-lg p-6 max-w-md border border-zinc-800">
            <h2 className="text-lg font-semibold text-white mb-3">Switch framework?</h2>
            <p className="text-zinc-400 mb-6">
              This will tear down the current deployment and restart the setup wizard.
              Any unsaved work will be lost.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowSwitchConfirm(false)}
                className="px-4 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSwitchFramework}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                Switch framework
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Banner */}
      {taskStatus && (
        <div className="px-4 py-3 bg-blue-900/30 border-b border-blue-800/50">
          <p className="text-sm text-blue-200">Setting up {taskStatus}...</p>
        </div>
      )}

      {/* Output Area */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto">
          {taskStreamText ? (
            <pre className="text-zinc-300 whitespace-pre-wrap font-mono text-sm">
              {taskStreamText}
            </pre>
          ) : (
            <p className="text-zinc-500 text-center mt-8">
              Enter a task below to get started
            </p>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t border-zinc-800 p-4">
        <div className="max-w-4xl mx-auto flex gap-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter your task..."
            disabled={isStreaming || !currentDeploymentId}
            className="flex-1 px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed resize-none"
            rows={3}
          />
          <button
            onClick={handleSendTask}
            disabled={isStreaming || !input.trim() || !currentDeploymentId}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
          >
            {isStreaming ? "Running..." : "Send"}
          </button>
        </div>
        {!currentDeploymentId && (
          <p className="text-center text-zinc-500 text-sm mt-2">
            No deployment active. Please complete onboarding first.
          </p>
        )}
      </div>
    </div>
  );
}
