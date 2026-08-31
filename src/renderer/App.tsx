import { useAppStore } from "./store";
import { SetupPage } from "./pages/SetupPage";
import { OnboardingPage } from "./pages/OnboardingPage";

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
      return <Placeholder name="Dashboard" />;
    case "guided-task":
      return <Placeholder name="Guided Task Flow" />;
    case "chat":
      return <Placeholder name="Freeform Chat" />;
    case "settings":
      return <Placeholder name="Settings" />;
    default:
      return <Placeholder name="Unknown View" />;
  }
}
