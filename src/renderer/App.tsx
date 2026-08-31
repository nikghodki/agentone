import { useAppStore } from "./store";

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
      return <Placeholder name="Setup (Hardware + Model Download)" />;
    case "onboarding-persona":
      return <Placeholder name="Onboarding — Pick Your Persona" />;
    case "onboarding-priorities":
      return <Placeholder name="Onboarding — Pick Priorities" />;
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
