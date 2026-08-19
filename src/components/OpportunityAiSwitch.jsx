import { useNavigate, useLocation } from "react-router-dom";
import { Radar } from "lucide-react";
import { LokinGlyph } from "@/components/Brand";

// One-handed, thumb-reachable toggle between the Opportunity Hub and the
// LOKIN AI assistant. Only renders on those two screens so it never clutters
// the rest of the app.
export default function OpportunityAiSwitch() {
  const loc = useLocation();
  const navigate = useNavigate();
  const onOpps = loc.pathname === "/opportunities";
  const onAi = loc.pathname === "/lokin";
  if (!onOpps && !onAi) return null;

  const goingToAi = onOpps;

  return (
    <button
      onClick={() => navigate(goingToAi ? "/lokin" : "/opportunities")}
      aria-label={goingToAi ? "Switch to LOKIN AI assistant" : "Switch to Opportunity Hub"}
      className="fixed right-4 z-40 flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 h-12 pl-3 pr-4 glow-primary active:scale-95 transition-transform select-none"
      style={{ bottom: "calc(6rem + env(safe-area-inset-bottom))" }}
    >
      {goingToAi ? (
        <>
          <LokinGlyph size={18} />
          <span className="text-xs font-bold text-primary">AI Assistant</span>
        </>
      ) : (
        <>
          <Radar className="h-5 w-5 text-primary" />
          <span className="text-xs font-bold text-primary">Opportunities</span>
        </>
      )}
    </button>
  );
}