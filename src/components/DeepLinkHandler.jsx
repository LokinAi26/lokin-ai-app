import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";

// Reads assistant-launched deep links and surfaces a brief acknowledgment
// so the driver knows a Siri / Google Assistant launch worked.
//
// Two entry paths:
//   1. Path-based deep link with ?via=siri|assistant (the native shell
//      loads <appUrl>/route?via=siri — the router already lands on /route,
//      this component just acknowledges the voice launch).
//   2. Custom scheme forwarded as ?scheme=lokin://route (a fallback for
//      shells that pass the lokin:// URL through as a query param).
export default function DeepLinkHandler() {
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const scheme = params.get("scheme");
    const via = params.get("via");

    // Native shell may forward lokin://route as ?scheme=lokin://route
    if (scheme && scheme.startsWith("lokin://")) {
      const target = scheme.replace("lokin://", "").split("?")[0] || "home";
      const map = { route: "/route", lokin: "/lokin", earnings: "/earnings", home: "/" };
      const path = map[target] || "/";
      if (path !== window.location.pathname) {
        navigate(`${path}?action=${target}&via=siri`);
        return;
      }
    }

    if (via === "siri") {
      toast({
        title: "Siri opened LOKIN",
        description: "Locked in. Use Siri hands-free, or say “Hey LOKIN” while the native app is open.",
        duration: 2600,
      });
    } else if (via === "assistant") {
      toast({
        title: "Assistant opened LOKIN",
        description: "Locked in. Use Siri hands-free, or say “Hey LOKIN” while the native app is open.",
        duration: 2600,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}