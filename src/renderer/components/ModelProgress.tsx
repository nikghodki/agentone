interface ModelProgressProps {
  progress: number;
  modelName: string;
  sizeGB: number;
}

export function ModelProgress({ progress, modelName, sizeGB }: ModelProgressProps) {
  return (
    <div className="w-full max-w-md mx-auto">
      <p className="text-sm text-zinc-400 mb-2">
        Downloading your AI... ({sizeGB} GB)
      </p>
      <div className="w-full bg-zinc-800 rounded-full h-3">
        <div
          className="bg-blue-500 h-3 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-xs text-zinc-500 mt-2 text-center">{progress}%</p>
    </div>
  );
}
