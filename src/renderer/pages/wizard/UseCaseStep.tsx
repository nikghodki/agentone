import React from "react";
import { useAppStore } from "../../store";
import { UseCaseBuilder } from "../../components/UseCaseBuilder";
import { Button } from "../../components/ui/Button";

export function UseCaseStep() {
  const setView = useAppStore((s) => s.setView);

  const handleFinish = () => {
    setView("task");
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900 mb-2">
          Get Started with a Use Case
        </h2>
        <p className="text-slate-600">
          Choose a use case and generate a prompt to get started with your agent.
        </p>
      </div>

      <UseCaseBuilder />

      {/* Action buttons */}
      <div className="flex gap-3 justify-end border-t border-slate-200 pt-4">
        <Button variant="primary" onClick={handleFinish}>
          Finish
        </Button>
      </div>
    </div>
  );
}
