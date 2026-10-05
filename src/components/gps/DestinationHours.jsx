// Operating-hours line for the GPS ETA card: looked up live from OpenStreetMap
// for the store/restaurant being navigated to. Renders nothing when OSM has no
// hours for this destination — never invented.
import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { describeHours } from "@/lib/openingHours";

export default function DestinationHours({ name, latitude, longitude }) {
  const [hours, setHours] = useState(null);
  const key = `${name}|${latitude}|${longitude}`;
  useEffect(() => {
    let alive = true;
    const lat = Number(latitude);
    const lon = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !String(name || "").trim()) {
      setHours(null);
      return undefined;
    }
    setHours(null);
    // Deadline: a hung hours lookup must never stall the ETA card UI — after
    // 25s this render simply shows no hours line.
    const deadline = window.setTimeout(() => { alive = false; }, 25000);
    base44.functions
      .invoke("navigation-engine", { action: "dest_hours", coordinate: { longitude: lon, latitude: lat }, name })
      .then((res) => {
        if (alive) setHours(res.data?.opening_hours || null);
      })
      .catch(() => {
        if (alive) setHours(null);
      })
      .finally(() => window.clearTimeout(deadline));
    return () => {
      alive = false;
    };
  }, [key]);

  if (!hours) return null;
  const { text, raw } = describeHours(hours);
  if (!text) return null;
  return (
    <div className="mt-1 flex items-center gap-1.5 text-[10px] font-semibold">
      <Clock className="h-3 w-3 shrink-0 text-primary" />
      <span className={raw ? "text-white/55" : "text-primary/90"}>{text}</span>
      <span className="text-white/30">· OSM</span>
    </div>
  );
}