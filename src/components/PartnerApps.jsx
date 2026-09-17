import { ExternalLink } from "lucide-react";

// Honest driver-app launcher — the heart of LOKIN as a provider-neutral copilot.
// LOKIN has no direct API partnerships with DoorDash, Uber, or other platforms yet.
// These buttons do NOT claim pairing, syncing, or integration.
// They open the official driver apps (if installed) via universal links,
// falling back to verified App Store listings. LOKIN stays running alongside
// as your strategist — you drive the apps, LOKIN drives the decisions.
const PARTNERS = [
  {
    name: "DoorDash Dasher",
    letter: "D",
    color: "text-red-400",
    appStore: "https://apps.apple.com/app/id1451754591",
    universal: "https://dasher.doordash.com/",
    web: "https://drivers.doordash.com",
  },
  {
    name: "Uber Driver",
    letter: "U",
    color: "text-white",
    appStore: "https://apps.apple.com/app/id1131342792",
    universal: "https://drivers.uber.com/",
    web: "https://drivers.uber.com",
  },
  {
    name: "Amazon Flex",
    letter: "A",
    color: "text-amber-400",
    appStore: "https://apps.apple.com/app/id1454725763",
    universal: "https://flex.amazon.com/",
    web: "https://flex.amazon.com",
  },
  {
    name: "Instacart Shopper",
    letter: "I",
    color: "text-emerald-400",
    appStore: "https://apps.apple.com/app/id1454056744",
    universal: "https://shoppers.instacart.com/",
    web: "https://shoppers.instacart.com",
  },
  {
    name: "Grubhub Driver",
    letter: "G",
    color: "text-orange-400",
    appStore: "https://apps.apple.com/app/id1452071632",
    universal: "https://driver.grubhub.com/launch/",
    web: "https://driver.grubhub.com",
  },
  {
    name: "Spark Driver",
    letter: "S",
    color: "text-blue-400",
    appStore: "https://apps.apple.com/app/id1483998235",
    universal: "https://sparkdriver.walmart.com/",
    web: "https://sparkdriver.walmart.com",
  },
  {
    name: "Veho Driver",
    letter: "V",
    color: "text-teal-400",
    appStore: "https://apps.apple.com/app/id1457078986",
    universal: "https://app.veho.com/driver",
    web: "https://app.veho.com/driver",
  },
];

export default function PartnerApps() {
  function launch(p) {
    // Honest open: try universal link first (opens installed app on iOS),
    // fall back to App Store listing if the app isn't installed.
    // No fake "pairing" — just gets the driver where they need to go.
    try {
      const start = Date.now();
      // Use an invisible iframe attempt for universal link to avoid
      // hijacking LOKIN's own navigation on failure.
      const iframe = document.createElement("iframe");
      iframe.style.display = "none";
      iframe.src = p.universal;
      document.body.appendChild(iframe);
      setTimeout(() => {
        try { document.body.removeChild(iframe); } catch {}
        // If we're still here after 900ms, the app likely isn't installed —
        // send to the verified App Store page so it's a real, honest action.
        if (Date.now() - start < 2000 && !document.hidden) {
          window.open(p.appStore, "_blank", "noopener,noreferrer");
        }
      }, 900);
    } catch {
      window.open(p.appStore, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <div className="text-sm font-semibold text-white/80">Your driver apps</div>
        <div className="text-xs text-white/45 leading-relaxed">
          LOKIN works alongside your gig apps — no partnership needed. One tap tries to open
          the driver app if it's installed, otherwise opens its official App Store page.
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {PARTNERS.map((p) => (
          <button
            key={p.name}
            onClick={() => launch(p)}
            className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/10 lokin-panel p-3 active:scale-[0.97] transition-transform"
            aria-label={`Open ${p.name}`}
          >
            <div className={`flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-lg font-bold ${p.color}`}>
              {p.letter}
            </div>
            <div className="text-[11px] font-medium text-center leading-tight text-white/75">{p.name}</div>
            <ExternalLink className="h-3 w-3 text-white/35" />
          </button>
        ))}
      </div>
      <div className="text-[10px] text-white/30 text-center px-2">
        Provider-neutral. LOKIN never locks you to one platform.
      </div>
    </div>
  );
}
