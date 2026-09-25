import { MapPin, Navigation, Flame } from "lucide-react";
import { LOKIN_CENTER, LOKIN_SKYLINE_BG } from "@/components/Brand";
import { LineChart, Line, ResponsiveContainer } from "recharts";

const EARN = [{ v: 30 }, { v: 45 }, { v: 25 }, { v: 60 }, { v: 50 }, { v: 75 }, { v: 87 }];
const R = 44;
const C = 2 * Math.PI * R;

function PhoneFrame({ children, label }) {
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-[226px] rounded-[2.2rem] border border-white/15 bg-[#050608] p-2 shadow-[0_0_34px_-8px_hsl(80_100%_50%/0.35)]">
        <div className="absolute top-2 left-1/2 -translate-x-1/2 h-5 w-24 rounded-full bg-black border border-white/10 z-10" />
        <div className="mt-1 h-[436px] rounded-[1.7rem] overflow-hidden bg-background border border-white/8">
          {children}
        </div>
      </div>
      {label && <div className="mt-2 text-[11px] tracking-wide text-white/50 font-medium">{label}</div>}
    </div>
  );
}

function LiveRouteScreen() {
  return (
    <div className="relative h-full bg-[#06100a] p-3 flex flex-col">
      <img
        src={LOKIN_SKYLINE_BG}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover opacity-45"
        draggable={false}
      />
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/45 to-black/70" />
      <div className="absolute inset-0 opacity-40" style={{ backgroundImage: "linear-gradient(hsl(81 84% 51% / 0.08) 1px, transparent 1px), linear-gradient(90deg, hsl(81 84% 51% / 0.08) 1px, transparent 1px)", backgroundSize: "26px 26px" }} />
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 230 436" preserveAspectRatio="none">
        <path d="M30 380 C 80 300, 60 220, 130 200 S 200 120, 180 60" fill="none" stroke="#ccff00" strokeWidth="3" strokeLinecap="round" className="lokin-route" />
      </svg>
      <div className="absolute top-[58px] right-[40px] h-2.5 w-2.5 rounded-full bg-fuchsia-400 ring-4 ring-fuchsia-400/30" />
      <div className="absolute top-[200px] left-[60px] h-2.5 w-2.5 rounded-full bg-cyan-400 ring-4 ring-cyan-400/30" />
      <div className="absolute top-[330px] left-[36px] h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-primary/30" />
      <div className="relative mt-7 flex items-center justify-between">
        <div className="text-[11px] font-bold text-primary tracking-wide">STOP 2 / 4</div>
        <MapPin className="h-4 w-4 text-primary" />
      </div>
      <div className="relative mt-auto rounded-2xl border border-primary/30 bg-black/70 p-3 backdrop-blur">
        <div className="text-[10px] text-white/50">Next Stop</div>
        <div className="text-sm font-semibold text-white">Sarah M.</div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-white/60"><span>6.2 mi</span><span>·</span><span>12 min</span></div>
        <div className="mt-2 flex items-center justify-between">
          <div><div className="text-[9px] text-white/40">Est. Earnings</div><div className="text-lg font-bold text-primary">$14.75</div></div>
          <div className="text-right"><div className="text-[9px] text-white/40">/hr</div><div className="text-sm font-bold text-white">$22.89</div></div>
        </div>
        <button className="mt-2 w-full rounded-xl bg-primary text-black text-xs font-bold py-2 flex items-center justify-center gap-1">
          <Navigation className="h-3 w-3" /> Start LOKIN Navigation
        </button>
      </div>
    </div>
  );
}

function DashboardScreen() {
  const pct = 64;
  return (
    <div className="relative h-full p-3 flex flex-col">
      <div className="flex items-center gap-2 mt-6">
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-emerald-500 flex items-center justify-center text-black font-bold text-xs">K</div>
        <div>
          <div className="text-[10px] text-white/45">Good afternoon,</div>
          <div className="text-sm font-semibold text-white flex items-center gap-1">Kendall <Flame className="h-3 w-3 text-orange-400" /></div>
        </div>
      </div>
      <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
        <div className="flex justify-between text-[10px] text-white/50"><span>Today's Goal</span><span className="text-primary font-bold">$200</span></div>
        <div className="mt-1.5 h-1.5 rounded-full bg-white/10"><div className="h-full rounded-full bg-primary" style={{ width: `${pct}%`, boxShadow: "0 0 8px hsl(81 84% 51% / 0.7)" }} /></div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        {[["Net/HR", "$28"], ["Active", "3"], ["Orders", "5"], ["Miles", "12"]].map(([k, v]) => (
          <div key={k} className="rounded-xl border border-white/8 bg-white/[0.02] py-1.5 text-center">
            <div className="text-sm font-bold text-primary">{v}</div>
            <div className="text-[9px] text-white/40">{k}</div>
          </div>
        ))}
      </div>
      <div className="mt-auto flex flex-col items-center">
        <div className="relative h-28 w-28">
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
            <circle cx="50" cy="50" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
            <circle cx="50" cy="50" r={R} fill="none" stroke="#ccff00" strokeWidth="5" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)} className="lokin-route" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <img src={LOKIN_CENTER} alt="" aria-hidden="true" className="h-11 w-11 object-contain lokin-pulse" draggable={false} />
          </div>
        </div>
        <button className="mt-3 rounded-full bg-primary text-black text-xs font-extrabold tracking-wider px-6 py-2 glow-primary">START WORK</button>
      </div>
    </div>
  );
}

function ActiveDeliveryScreen() {
  return (
    <div className="relative h-full p-3 flex flex-col">
      <img src={LOKIN_CENTER} alt="" aria-hidden="true" className="absolute right-4 top-5 h-10 w-10 rounded-full border border-primary/40 bg-black/50 p-1.5 object-contain shadow-[0_0_16px_rgba(204,255,0,0.35)]" draggable={false} />
      <div className="mt-6 text-[10px] text-primary tracking-wide font-bold">ACTIVE DELIVERY</div>
      <div className="mt-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-fuchsia-500/30 flex items-center justify-center text-white font-bold text-xs">S</div>
          <div>
            <div className="text-sm font-semibold text-white">Sarah M.</div>
            <div className="text-[11px] text-white/45">2.8 mi · 9 min ETA</div>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between rounded-xl bg-primary/10 border border-primary/30 px-3 py-2">
          <span className="text-[11px] text-white/60">Earnings</span>
          <span className="text-base font-bold text-primary">$14.75</span>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        {["5 MIN AWAY", "AT PICKUP", "ON MY WAY", "OUTSIDE"].map((b) => (
          <button key={b} className="rounded-xl border border-primary/30 bg-primary/10 text-[10px] font-bold text-primary py-2">{b}</button>
        ))}
      </div>
      <div className="mt-auto flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-3">
        <span className="text-xs text-white/70">Auto Updates</span>
        <div className="h-5 w-9 rounded-full bg-primary p-0.5 flex items-center justify-end"><div className="h-4 w-4 rounded-full bg-black" /></div>
      </div>
    </div>
  );
}

function EarningsScreen() {
  return (
    <div className="relative h-full p-3 flex flex-col">
      <img src={LOKIN_SKYLINE_BG} alt="" aria-hidden="true" className="pointer-events-none absolute bottom-0 left-0 h-28 w-full object-cover opacity-25" draggable={false} />
      <div className="mt-6 text-[10px] text-primary tracking-wide font-bold">EARNINGS</div>
      <div className="mt-1 text-3xl font-display font-extrabold text-primary text-glow">$87.40</div>
      <div className="text-[10px] text-white/45">Gross today · 5 trips · 12 mi</div>
      <div className="mt-2 h-20 -mx-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={EARN}>
            <Line type="monotone" dataKey="v" stroke="#ccff00" strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1 space-y-1">
        {[["Pay", "$52.00"], ["Tips", "$28.40"], ["Bonuses", "$5.00"], ["Adjustments", "$2.00"]].map(([k, v]) => (
          <div key={k} className="flex justify-between text-[11px]"><span className="text-white/45">{k}</span><span className="text-white font-semibold">{v}</span></div>
        ))}
      </div>
      <div className="mt-auto flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-2.5">
        <div className="relative h-12 w-12">
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
            <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="9" />
            <circle cx="50" cy="50" r="42" fill="none" stroke="#ccff00" strokeWidth="9" strokeLinecap="round" strokeDasharray={2 * Math.PI * 42} strokeDashoffset={2 * Math.PI * 42 * 0.08} />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-primary">92</div>
        </div>
        <div>
          <div className="text-xs font-semibold text-white">Lock In Score</div>
          <div className="text-[10px] text-white/45">92 out of 100 · Excellent</div>
        </div>
      </div>
    </div>
  );
}

export default function PhoneMockups() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 justify-items-center">
      <PhoneFrame label="Live Route"><LiveRouteScreen /></PhoneFrame>
      <PhoneFrame label="Dashboard"><DashboardScreen /></PhoneFrame>
      <PhoneFrame label="Active Delivery"><ActiveDeliveryScreen /></PhoneFrame>
      <PhoneFrame label="Earnings"><EarningsScreen /></PhoneFrame>
    </div>
  );
}