import { Radar } from "lucide-react";
import AiGps4D from "@/components/AiGps4D";

export default function AiGps() {
  return (
    <div className="p-4 space-y-4 pb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radar className="h-5 w-5 text-accent" />
          <h1 className="text-xl font-bold font-heading metal-text">4D AI GPS</h1>
        </div>
        <span className="text-[11px] tracking-[0.22em] text-accent/80 font-display">PRECISION · TIME · RE-ROUTE</span>
      </div>
      <p className="text-sm text-white/45 -mt-2">3D space + time. Scrub the day, capture precise drop-off pins, and re-route live to sharpen every drop.</p>
      <AiGps4D />
    </div>
  );
}