import { useAppStore } from "./store";
import { SetupPage } from "./pages/SetupPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { DashboardPage } from "./pages/DashboardPage";
import { GuidedTaskPage } from "./pages/GuidedTaskPage";
import { ChatPage } from "./pages/ChatPage";
import { SettingsPage } from "./pages/SettingsPage";
import { FrameworkSelectPage } from "./pages/FrameworkSelectPage";
import { ModelBackendPage } from "./pages/ModelBackendPage";
import { TaskPage } from "./pages/TaskPage";
import { CapabilitiesPage } from "./pages/CapabilitiesPage";
import { ChannelsPage } from "./pages/ChannelsPage";
import { Wizard } from "./pages/wizard/Wizard";

function Placeholder({ name }: { name: string }) {
  return (
    <div className="flex items-center justify-center h-screen">
      <p className="text-zinc-400 text-lg">{name} — Coming next</p>
    </div>
  );
}

export function App() {
  const view = useAppStore((s) => s.view);

  switch (view) {
    case "setup":
      return <SetupPage />;
    case "onboarding-persona":
    case "onboarding-priorities":
      return <OnboardingPage />;
    case "dashboard":
      return <DashboardPage />;
    case "guided-task":
      return <GuidedTaskPage />;
    case "chat":
      return <ChatPage />;
    case "settings":
      return <SettingsPage />;
    case "wizard":
      return <Wizard />;
    case "v2-framework-select":
      return <FrameworkSelectPage />;
    case "v2-model-backend":
      return <ModelBackendPage />;
    case "task":
      return <TaskPage />;
    case "capabilities":
      return <CapabilitiesPage />;
    case "channels":
      return <ChannelsPage />;
    default:
      return <Placeholder name="Unknown View" />;
  }
}
