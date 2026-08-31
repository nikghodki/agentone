import { useEffect, useState } from "react";
import { useAppStore } from "../store";
import { getPersonaById } from "../lib/persona-loader";
import { TaskCard } from "../components/TaskCard";
import { StatsCard } from "../components/StatsCard";

export function DashboardPage() {
  const {
    selectedPersonaId,
    openGuidedTask,
    setView,
    remainingGenerations,
    setRemainingGenerations,
    setConversations,
    conversations,
  } = useAppStore();

  const [dailyCount, setDailyCount] = useState(0);
  const persona = selectedPersonaId ? getPersonaById(selectedPersonaId) : null;

  useEffect(() => {
    async function load() {
      const remaining = await window.electronAPI.getRemainingGenerations();
      setRemainingGenerations(remaining);

      const count = await window.electronAPI.dbGetDailyGenerationCount();
      setDailyCount(count);

      const convs = await window.electronAPI.dbGetConversations(5);
      setConversations(convs);
    }
    load();
  }, []);

  const greeting = getGreeting();

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <h1 className="text-lg font-bold">AgentOne</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setView("chat")}
            className="px-3 py-1.5 text-sm bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors"
          >
            Chat
          </button>
          <button
            onClick={() => setView("settings")}
            className="px-3 py-1.5 text-sm bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors"
          >
            Settings
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <p className="text-xl font-medium mb-6">
          {greeting} Here's what I can help with:
        </p>

        {/* Task Grid */}
        {persona && (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
            {persona.tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onClick={() => openGuidedTask(persona.id, task.id)}
              />
            ))}
          </div>
        )}

        {/* Recently Used */}
        {conversations.length > 0 && (
          <div className="mb-8">
            <h3 className="text-sm font-medium text-zinc-400 mb-3">Recently Used</h3>
            <div className="flex flex-col gap-1">
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => {
                    useAppStore.getState().setCurrentConversationId(conv.id);
                    setView("chat");
                  }}
                  className="text-left px-3 py-2 text-sm text-zinc-300 bg-zinc-900/50 rounded hover:bg-zinc-800 transition-colors"
                >
                  {conv.title || conv.taskId || "Freeform chat"} —{" "}
                  <span className="text-zinc-500">
                    {new Date(conv.createdAt).toLocaleDateString()}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Discover More */}
        {persona && persona.discovery_queue.length > 0 && (
          <div className="mb-8">
            <h3 className="text-sm font-medium text-zinc-400 mb-3">
              Did you know I can also help with...
            </h3>
            <div className="flex flex-wrap gap-2">
              {persona.discovery_queue.map((taskId) => (
                <span
                  key={taskId}
                  className="px-3 py-1.5 bg-zinc-900 rounded-full text-sm text-zinc-400 border border-zinc-800"
                >
                  {taskId.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Stats */}
        <StatsCard tasksToday={dailyCount} remaining={remainingGenerations} />
      </div>
    </div>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning!";
  if (hour < 17) return "Good afternoon!";
  return "Good evening!";
}
