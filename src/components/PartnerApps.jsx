import { ExternalLink } from "lucide-react";

// Partner delivery platforms this copilot pairs with.
// `scheme` is the native app deep link (opens the app if installed);
// `web` is the universal fallback (works on any phone, opens app via universal link if installed).
const PARTNERS = [
  {
    name: "DoorDash Dasher",
    scheme: "doordash://dash",
    web: "https://doordash.com/dash",
    color: "bg-red-500/10 text-red-500",
    letter: "D",
  },
  {
    name: "Uber Driver",
    scheme: "uberdash://",
    web: "https://drivers.uber.com",
    color: "bg-neutral-900/10 text-neutral-900 dark:text-white",
    letter: "U",
  },
  {
    name: "Amazon Flex",
    scheme: "amazonflex://",
    web: "https://flex.amazon.com",
    color: "bg-amber-500/10 text-amber-600",
    letter: "A",
  },
  {
    name: "Instacart Shopper",
    scheme: "instacartshopper://",
    web: "https://shoppers.instacart.com",
    color: "bg-emerald-500/10 text-emerald-600",
    letter: "I",
  },
  {
    name: "Grubhub Driver",
    scheme: "grubhubdriver://",
    web: "https://driver.grubhub.com",
    color: "bg-orange-500/10 text-orange-600",
    letter: "G",
  },
  {
    name: "Spark (Walmart)",
    scheme: "sparkdriver://",
    web: "https://sparkdriver.walmart.com",
    color: "bg-blue-500/10 text-blue-600",
    letter: "S",
  },
];

export default function PartnerApps() {
  function launch(p) {
    // Try the native app scheme first; fall back to the web portal after a short delay.
    let opened = false;
    try {
      const start = Date.now();
      window.location.href = p.scheme;
      const timer = setTimeout(() => {
        if (Date.now() - start < 1800) {
          window.open(p.web, "_blank", "noopener,noreferrer");
        }
      }, 700);
      // if the page gets hidden (app opened), cancel the fallback
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
        <div className="text-sm font-semibold">Pair with delivery apps</div>
        <div className="text-xs text-muted-foreground">
          One tap opens the partner app on your phone — keep this copilot running alongside.
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {PARTNERS.map((p) => (
          <button
            key={p.name}
            onClick={() => launch(p)}
            className="flex flex-col items-center gap-1.5 rounded-2xl border border-border bg-card p-3 active:scale-[0.97] transition-transform"
          >
            <div className={`flex h-11 w-11 items-center justify-center rounded-full text-lg font-bold ${p.color}`}>
              {p.letter}
            </div>
            <div className="text-[11px] font-medium text-center leading-tight">{p.name}</div>
            <ExternalLink className="h-3 w-3 text-muted-foreground" />
          </button>
        ))}
      </div>
    </div>
  );
}