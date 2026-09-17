import { ExternalLink } from "lucide-react";

// Driver apps this copilot works alongside. No partnership or account linking — one tap opens the app.
// Root-cause fix (2026-09-17 road test): old custom schemes were wrong —
// "doordash://" is the CONSUMER app (opens Grocery, not Dasher); the other six
// schemes don't exist as registered iOS schemes, so taps silently did nothing.
// Verified: Grubhub universal link (AASA confirmed) + App Store URLs for rest.
const PARTNERS = [
  { name: "DoorDash Dasher", deep: "", store: "https://apps.apple.com/app/id1451754591", color: "text-red-400", letter: "D" },
  { name: "Uber Driver", deep: "", store: "https://apps.apple.com/app/id1131342792", color: "text-white", letter: "U" },
  { name: "Amazon Flex", deep: "", store: "https://apps.apple.com/app/id1454725763", color: "text-amber-400", letter: "A" },
  { name: "Instacart Shopper", deep: "", store: "https://apps.apple.com/app/id1454056744", color: "text-emerald-400", letter: "I" },
  { name: "Grubhub Driver", deep: "https://driver.grubhub.com/launch/", store: "https://apps.apple.com/app/id1452071632", color: "text-orange-400", letter: "G" },
  { name: "Spark (Walmart)", deep: "", store: "https://apps.apple.com/app/id1483998235", color: "text-blue-400", letter: "S" },
  { name: "Veho Driver", deep: "", store: "https://apps.apple.com/app/id1457078986", color: "text-teal-400", letter: "V" },
];

export default function PartnerApps() {
  function launch(p) {
    // Prefer the verified deep/universal link; fall back to the App Store URL
    // (opens the app directly when installed). _system lets the OS resolve
    // universal links outside the WebView.
    const target = p.deep || p.store;
    try {
      window.open(target, "_system") || window.open(target, "_blank", "noopener,noreferrer");
    } catch {
      window.location.href = target;
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <div className="text-sm font-semibold text-white/80">Your driver apps</div>
        <div className="text-xs text-white/45">
          LOKIN works alongside your gig apps. One tap opens the app — if it is not installed, you will land on its App Store page.
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {PARTNERS.map((p) => (
          <button
            key={p.name}
            onClick={() => launch(p)}
            className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/10 lokin-panel p-3 active:scale-[0.97] transition-transform"
          >
            <div className={`flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-lg font-bold ${p.color}`}>
              {p.letter}
            </div>
            <div className="text-[11px] font-medium text-center leading-tight text-white/75">{p.name}</div>
            <ExternalLink className="h-3 w-3 text-white/35" />
          </button>
        ))}
      </div>
    </div>
  );
}