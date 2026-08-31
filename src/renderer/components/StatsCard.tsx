interface StatsCardProps {
  tasksToday: number;
  remaining: number | "unlimited";
}

export function StatsCard({ tasksToday, remaining }: StatsCardProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-zinc-900/50 rounded-lg border border-zinc-800/50 text-sm">
      <span className="text-zinc-400">
        Today: <span className="text-zinc-200 font-medium">{tasksToday} tasks</span>
      </span>
      <span className="text-zinc-500">
        {remaining === "unlimited" ? (
          <span className="text-blue-400">Unlimited (Pro)</span>
        ) : (
          <>{remaining} generations left today</>
        )}
      </span>
    </div>
  );
}
