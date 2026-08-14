import { Car, ScanLine, MessageSquare, Flame, Gauge, MapPin, ChevronRight } from "lucide-react";

const AUTO_STATES = ["Order Confirmed", "On My Way", "Arriving Soon", "Delivered"];
const SUB_METRICS = ["Earnings Efficiency", "Route Efficiency", "Offer Quality", "Goal Progress", "Time Utilization"];

function Panel({ title, icon: Icon, children }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-white"><Icon className="h-3.5 w-3.5 text-primary" /> {title}</div>
      {children}
    </div>
  );
}

export default function DashboardPanels() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      <Panel title="Driving Mode" icon={Car}>
        <div className="flex justify-between text-[11px]"><span className="text-white/50">ETA</span><span className="text-primary font-bold">2.8 mi</span></div>
        <div className="flex justify-between text-[11px] mt-1"><span className="text-white/50">Projected</span><span className="text-primary font-bold">$24.60/hr</span></div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[10px] text-white/40 flex items-center gap-1"><MessageSquare className="h-3 w-3" /> Hey LOKIN…</span>
          <div className="h-4 w-7 rounded-full bg-primary p-0.5 flex items-center justify-end"><div className="h-3 w-3 rounded-full bg-black" /></div>
        </div>
      </Panel>

      <Panel title="Shopping AI" icon={ScanLine}>
        <div className="flex items-center gap-1.5">
          {[ScanLine, MapPin, MessageSquare].map((Icon, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-primary/30 bg-primary/10"><Icon className="h-3.5 w-3.5 text-primary" /></div>
              {i < 2 && <ChevronRight className="h-3 w-3 text-white/30" />}
            </div>
          ))}
        </div>
        <div className="mt-2 text-[11px] text-white/70">Peanut Butter · <span className="text-primary">Aisle 7 · Shelf 3</span></div>
        <div className="mt-1.5 h-1.5 rounded-full bg-white/10"><div className="h-full rounded-full bg-primary" style={{ width: "40%" }} /></div>
      </Panel>

      <Panel title="Voice & Auto Messages" icon={MessageSquare}>
        <div className="space-y-1">
          {AUTO_STATES.map((s) => (
            <div key={s} className="flex items-center justify-between text-[11px]"><span className="text-white/60">{s}</span><span className="text-primary text-[9px] font-bold tracking-wide">ON</span></div>
          ))}
        </div>
        <div className="mt-2 flex justify-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-primary/40 bg-primary/10 glow-primary"><MessageSquare className="h-4 w-4 text-primary" /></div>
        </div>
      </Panel>

      <Panel title="Goals & Streaks" icon={Flame}>
        <div className="text-sm font-bold text-white">3 Day Streak 🔥</div>
        <div className="mt-1.5 h-1.5 rounded-full bg-white/10"><div className="h-full rounded-full bg-primary" style={{ width: "64%", boxShadow: "0 0 6px hsl(80 100% 50% / 0.7)" }} /></div>
        <div className="mt-1 text-[10px] text-white/40">64% of $200 daily goal</div>
        <div className="mt-1.5 inline-block rounded-full bg-orange-500/20 border border-orange-400/40 px-2 py-0.5 text-[9px] font-bold text-orange-300">You're on fire!</div>
      </Panel>

      <Panel title="Lock In Score" icon={Gauge}>
        <div className="flex items-center gap-3">
          <div className="relative h-14 w-14 shrink-0">
            <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
              <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="9" />
              <circle cx="50" cy="50" r="42" fill="none" stroke="#ccff00" strokeWidth="9" strokeLinecap="round" strokeDasharray={2 * Math.PI * 42} strokeDashoffset={2 * Math.PI * 42 * 0.08} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-sm font-bold text-primary leading-none">92</span>
              <span className="text-[7px] text-white/40">/100</span>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-0.5">
            {SUB_METRICS.map((m) => (
              <div key={m} className="flex items-center gap-1.5 text-[10px]"><span className="h-1 w-1 rounded-full bg-primary" /><span className="text-white/55">{m}</span></div>
            ))}
          </div>
        </div>
      </Panel>
    </div>
  );
}