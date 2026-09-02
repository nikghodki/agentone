import React from "react";
import { useAppStore } from "../store";
import { UseCaseBuilder } from "../components/UseCaseBuilder";

export function UseCasesPage() {
  const setView = useAppStore((s) => s.setView);

  return (
    <div className="flex flex-col h-screen bg-zinc-950">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-zinc-800">
        <button
          onClick={() => setView("task")}
          className="text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          ← Back
        </button>
        <h2 className="text-lg font-medium text-white">Get Started</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-6 max-w-5xl mx-auto w-full">
        <div className="mb-4">
          <p className="text-zinc-400">
            Choose a use case and generate a prompt to get started with your agent.
          </p>
        </div>

        {/* Light container for UseCaseBuilder on dark background */}
        <div className="bg-white rounded-2xl p-6">
          <UseCaseBuilder />
        </div>
      </div>
    </div>
  );
}
