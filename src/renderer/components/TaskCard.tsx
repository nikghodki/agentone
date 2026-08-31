import type { TaskDefinition } from "@shared/types";

interface TaskCardProps {
  task: TaskDefinition;
  onClick: () => void;
}

export function TaskCard({ task, onClick }: TaskCardProps) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col gap-2 p-4 bg-zinc-900 rounded-xl border border-zinc-800 hover:border-blue-500/50 hover:bg-zinc-800/80 transition-all text-left group"
    >
      <div className="text-lg font-medium group-hover:text-blue-300 transition-colors">
        {task.title}
      </div>
      <div className="text-sm text-zinc-500">{task.subtitle}</div>
    </button>
  );
}
