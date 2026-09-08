import { Mic, MapPin, ScanLine, ChevronRight, Car } from "lucide-react";

function VoiceChat() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
      <div className="text-xs font-semibold text-white mb-2 flex items-center gap-1.5"><Mic className="h-3.5 w-3.5 text-primary" /> Lock In Voice</div>
      <div className="space-y-1.5">
        <div className="ml-auto max-w-[82%] rounded-2xl rounded-tr-sm bg-primary/15 border border-primary/30 px-2.5 py-1.5 text-[11px] text-white">Hey LOKIN, how am I doing?</div>
        <div className="max-w-[88%] rounded-2xl rounded-tl-sm bg-white/[0.04] border border-white/10 px-2.5 py-1.5 text-[11px] text-white/80">
          You're $64 from your $200 goal at $22/hr. Take 2 more Norfolk runs to hit it by 7pm.
        </div>
      </div>
      <div className="mt-2 flex items-center justify-center gap-0.5 h-6">
        {[3, 7, 5, 9, 4, 8, 6, 10, 5, 3].map((h, i) => (
          <div key={i} className="w-1 rounded-full bg-primary/70" style={{ height: `${h * 3}px` }} />
        ))}
      </div>
    </div>
  );
}

function DrivingPreview() {
  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-[#0a0f14] to-black p-3 relative overflow-hidden">
      <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "radial-gradient(circle at 50% 100%, hsl(188 95% 50% / 0.2), transparent 60%)" }} />
      <div className="relative flex items-center gap-2 mb-2"><Car className="h-4 w-4 text-primary" /><span className="text-xs font-semibold text-white">Driving Mode</span></div>
      <div className="relative grid grid-cols-3 gap-2 text-center">
        <div><div className="text-sm font-bold text-primary">2.8 mi</div><div className="text-[9px] text-white/40">ETA</div></div>
        <div><div className="text-sm font-bold text-white">9 min</div><div className="text-[9px] text-white/40">Time</div></div>
        <div><div className="text-sm font-bold text-primary">$24.60</div><div className="text-[9px] text-white/40">/hr</div></div>
      </div>
      <div className="relative mt-2 flex items-center gap-1.5 rounded-xl border border-primary/30 bg-black/50 px-2.5 py-1.5">
        <Mic className="h-3 w-3 text-primary" /><span className="text-[10px] text-white/50">Hey LOKIN…</span>
      </div>
    </div>
  );
}

function ShoppingLocator() {
  const steps = [ScanLine, MapPin, Mic];
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
      <div className="text-xs font-semibold text-white mb-2 flex items-center gap-1.5"><ScanLine className="h-3.5 w-3.5 text-primary" /> Shopping AI · Item Locator</div>
      <div className="flex items-center gap-1.5">
        {steps.map((Icon, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-primary/30 bg-primary/10"><Icon className="h-3.5 w-3.5 text-primary" /></div>
            {i < steps.length - 1 && <ChevronRight className="h-3 w-3 text-white/30" />}
          </div>
        ))}
      </div>
      <div className="mt-2 text-[11px] text-white/70">Peanut Butter</div>
      <div className="text-[10px] text-primary font-semibold">Aisle 7 · Shelf 3</div>
      <div className="mt-1.5 h-1.5 rounded-full bg-white/10"><div className="h-full rounded-full bg-primary" style={{ width: "40%", boxShadow: "0 0 6px hsl(81 84% 51% / 0.7)" }} /></div>
      <div className="text-[9px] text-white/40 mt-0.5">You're 40% closer</div>
    </div>
  );
}

export default function CapabilitiesColumn() {
  return (
    <div className="space-y-3">
      <VoiceChat />
      <DrivingPreview />
      <ShoppingLocator />
    </div>
  );
}