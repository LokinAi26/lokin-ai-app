import { ExternalLink } from "lucide-react";

// Partner delivery platforms this copilot pairs with.
const PARTNERS = [
  { name: "DoorDash Dasher", scheme: "doordash://dash", web: "https://doordash.com/dash", color: "text-red-400", letter: "D" },
  { name: "Uber Driver", scheme: "uberdash://", web: "https://drivers.uber.com", color: "text-white", letter: "U" },
  { name: "Amazon Flex", scheme: "amazonflex://", web: "https://flex.amazon.com", color: "text-amber-400", letter: "A" },
  { name: "Instacart Shopper", scheme: "instacartshopper://", web: "https://shoppers.instacart.com", color: "text-emerald-400", letter: "I" },
  { name: "Grubhub Driver", scheme: "grubhubdriver://", web: "https://driver.grubhub.com", color: "text-orange-400", letter: "G" },
  { name: "Spark (Walmart)", scheme: "sparkdriver://", web: "https://sparkdriver.walmart.com", color: "text-blue-400", letter: "S" },
];

export default function PartnerApps() {
  function launch(p) {
    let opened = false;
    try {
      const start = Date.now();
      window.location.href = p.scheme;
      const timer = setTimeout(() => {
        if (Date.now() - start < 1800) {
          window.open(p.web, "_blank", "noopener,noreferrer");
        }
      }, 700);
      const onVis = () => {
        if (document.hidden) {
          clearTimeout(timer);
          opened = true;
        }
      };
      document.addEventListener("visibilitychange", onVis, { once: true });
    } catch {
      window.open(p.web, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <div className="text-sm font-semibold text-white/80">Pair with delivery apps</div>
        <div className="text-xs text-white/45">
          One tap opens the partner app on your phone — keep this copilot running alongside.
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