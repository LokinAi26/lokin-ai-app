import { ExternalLink } from "lucide-react";

// Driver apps this copilot works alongside. No partnership or account linking — one tap opens the app.
// Root-cause fix (2026-09-17 road test): old custom schemes were wrong —
// "doordash://" is the CONSUMER app (opens Grocery, not Dasher); the other six
// schemes don't exist as registered iOS schemes, so taps silently did nothing.
// Verified: Grubhub universal link (AASA confirmed) + App Store URLs for rest.
// 2026-09-17: Shipt Shopper added (Kendall accepted as Shipt shopper); App Store id 976353472 verified via appadvice/similarweb.
// 2026-09-17 night: window.open("_system"/"_blank") is silently swallowed by the
// iOS wrapper's WKWebView (no popup delegate -> returns null, no throw), so taps
// still did nothing on the fresh build. launch() uses an anchor _blank click so
// iOS intercepts at the OS level: apps.apple.com -> App Store (OPEN button when the
// gig app is installed), universal links -> the installed gig app.
// 2026-09-18: NEVER window.location.href the top page as a fallback — it sailed
// LOKIN itself to the App Store link and broke the app on return. Fallback is a
// hidden iframe: same OS interception, LOKIN's page never navigates.
const PARTNERS = [
  { name: "DoorDash Dasher", deep: "", store: "https://apps.apple.com/app/id1451754591", color: "text-red-400", letter: "D" },
  { name: "Uber Driver", deep: "", store: "https://apps.apple.com/app/id1131342792", color: "text-white", letter: "U" },
  { name: "Amazon Flex", deep: "", store: "https://apps.apple.com/app/id1454725763", color: "text-amber-400", letter: "A" },
  { name: "Instacart Shopper", deep: "", store: "https://apps.apple.com/app/id1454056744", color: "text-emerald-400", letter: "I" },
  { name: "Grubhub Driver", deep: "https://driver.grubhub.com/launch/", store: "https://apps.apple.com/app/id1452071632", color: "text-orange-400", letter: "G" },
  { name: "Spark (Walmart)", deep: "", store: "https://apps.apple.com/app/id1483998235", color: "text-blue-400", letter: "W" },
  { name: "Veho Driver", deep: "", store: "https://apps.apple.com/app/id1457078986", color: "text-teal-400", letter: "V" },
  { name: "Shipt Shopper", deep: "", store: "https://apps.apple.com/app/id976353472", color: "text-green-400", letter: "S" },
];

export default function PartnerApps() {
  function launch(p) {
    const target = p.deep || p.store;
    let left = false;
    const markLeft = () => { left = true; };
    const onVis = () => { if (document.hidden) left = true; };
    window.addEventListener("pagehide", markLeft, { once: true });
    document.addEventListener("visibilitychange", onVis, { once: true });
    const cleanup = () => {
      window.removeEventListener("pagehide", markLeft);
      document.removeEventListener("visibilitychange", onVis);
    };
    // 1) Anchor click with _blank: lets the wrapper open the link externally
    //    (App Store app / installed gig app) without disturbing LOKIN.
    try {
      const a = document.createElement("a");
      a.href = target;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      /* fall through to the iframe fallback */
    }
    // 2) 2026-09-18: the old fallback ran window.location.href = target,
    //    which navigated LOKIN's OWN page to the App Store link — coming back
    //    from the gig app landed on a broken page ("no connection"). The
    //    fallback is now a hidden iframe: it triggers the same OS-level
    //    interception but can never navigate LOKIN's page, so returning from
    //    the gig app always lands back in LOKIN.
    setTimeout(() => {
      cleanup();
      if (left) return;
      try {
        const f = document.createElement("iframe");
        f.style.display = "none";
        f.setAttribute("aria-hidden", "true");
        document.body.appendChild(f);
        f.src = target;
        setTimeout(() => { try { f.remove(); } catch {} }, 2000);
      } catch {
        /* tap did nothing; LOKIN page untouched */
      }
    }, 700);
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