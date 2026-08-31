import { useAppStore } from "./store";
import { SetupPage } from "./pages/SetupPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { DashboardPage } from "./pages/DashboardPage";
import { GuidedTaskPage } from "./pages/GuidedTaskPage";
import { ChatPage } from "./pages/ChatPage";
import { SettingsPage } from "./pages/SettingsPage";

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
    default:
      return <Placeholder name="Unknown View" />;
  }
}
