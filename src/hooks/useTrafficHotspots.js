// Loads the driver's logged TrafficDelay records and clusters them into map
// hotspots for the GPS-map overlay. Refreshes every 2 minutes, matching the
// existing TrafficDelayHotspotAlert cadence.
import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { clusterTrafficDelays } from "@/lib/trafficHotspots";

const RELOAD_MS = 120000;

export default function useTrafficHotspots() {
  const [hotspots, setHotspots] = useState([]);
  useEffect(() => {
    let on = true;
    const load = () => {
      base44.entities.TrafficDelay.filter({}, "-created_date", 200)
        .then((rows) => {
          if (on) setHotspots(clusterTrafficDelays(rows || []));
        })
        .catch(() => {
          if (on) setHotspots([]);
        });
    };
    load();
    const timer = window.setInterval(load, RELOAD_MS);
    return () => {
      on = false;
      window.clearInterval(timer);
    };
  }, []);
  return hotspots;
}