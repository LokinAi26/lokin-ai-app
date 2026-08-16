import { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";

const DEFAULTS = {
  mode: "adaptive",
  low_battery_threshold: 20,
  pause_nonessential_when_hidden: true,
  reduce_animation_in_saver: true,
  reduce_polling_in_saver: true,
  preserve_dashcam_priority: true,
  preserve_navigation_priority: true,
  preserve_voice_priority: true,
};

function deriveEffectiveMode(profile, battery) {
  const selected = profile?.mode || "adaptive";
  if (selected !== "adaptive") return selected;
  const level = Number.isFinite(battery?.level) ? battery.level * 100 : null;
  if (battery?.charging) return "performance";
  if (level !== null && level <= Number(profile?.low_battery_threshold || 20)) return "battery_saver";
  if (document.hidden) return "battery_saver";
  return "balanced";
}

export default function PerformanceEnergyManager() {
  const [profile, setProfile] = useState(DEFAULTS);
  const [battery, setBattery] = useState({ supported: false, level: null, charging: null });
  const userRef = useRef(null);
  const profileIdRef = useRef(null);
  const lastModeRef = useRef(null);
  const lastLoggedRef = useRef({ key: "", at: 0 });

  useEffect(() => {
    let alive = true;
    (async () => {
      const me = await base44.auth.me().catch(() => null);
      if (!alive) return;
      userRef.current = me;
      if (me?.id) {
        const rows = await base44.entities.BatteryPerformanceProfile.filter({ user_id: me.id }).catch(() => []);
        if (!alive) return;
        if (rows?.[0]) {
          profileIdRef.current = rows[0].id;
          setProfile({ ...DEFAULTS, ...rows[0] });
        }
      }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let bat;
    let alive = true;
    const sync = () => {
      if (!alive || !bat) return;
      setBattery({ supported: true, level: bat.level, charging: bat.charging });
    };
    if (navigator.getBattery) {
      navigator.getBattery().then((b) => {
        if (!alive) return;
        bat = b; sync();
        b.addEventListener("levelchange", sync);
        b.addEventListener("chargingchange", sync);
      }).catch(() => {});
    }
    return () => {
      alive = false;
      if (bat) {
        bat.removeEventListener("levelchange", sync);
        bat.removeEventListener("chargingchange", sync);
      }
    };
  }, []);

  useEffect(() => {
    const apply = async (reason = "state") => {
      const effectiveMode = deriveEffectiveMode(profile, battery);
      const saver = effectiveMode === "battery_saver";
      const performance = effectiveMode === "performance";
      document.documentElement.dataset.lokinPerformanceMode = effectiveMode;
      document.documentElement.classList.toggle("lokin-battery-saver", saver);
      document.documentElement.classList.toggle("lokin-performance", performance);
      const detail = {
        selectedMode: profile.mode || "adaptive",
        effectiveMode,
        batterySupported: battery.supported,
        batteryLevel: Number.isFinite(battery.level) ? Math.round(battery.level * 100) : null,
        charging: battery.charging,
        hidden: document.hidden,
        reduceAnimations: saver && profile.reduce_animation_in_saver !== false,
        reducePolling: saver && profile.reduce_polling_in_saver !== false,
        pauseNonessential: document.hidden && profile.pause_nonessential_when_hidden !== false,
        preserveDashcam: profile.preserve_dashcam_priority !== false,
        preserveNavigation: profile.preserve_navigation_priority !== false,
        preserveVoice: profile.preserve_voice_priority !== false,
      };
      window.LOKINPerformance = detail;
      window.dispatchEvent(new CustomEvent("lokin:performance-mode", { detail }));

      if (lastModeRef.current !== effectiveMode) {
        lastModeRef.current = effectiveMode;
        const me = userRef.current;
        const key = `${effectiveMode}:${detail.batteryLevel}:${detail.charging}`;
        const now = Date.now();
        if (me?.id && (lastLoggedRef.current.key !== key || now - lastLoggedRef.current.at > 15 * 60 * 1000)) {
          lastLoggedRef.current = { key, at: now };
          base44.entities.BatteryPerformanceEvent.create({
            user_id: me.id,
            event_type: "optimization_applied",
            mode: effectiveMode,
            battery_level: detail.batteryLevel,
            charging: Boolean(detail.charging),
            reason,
            occurred_at: new Date().toISOString(),
          }).catch(() => null);
        }
      }
    };

    apply("profile-or-battery");
    const onVisibility = () => apply(document.hidden ? "hidden" : "visible");
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [profile, battery]);

  useEffect(() => {
    const onProfile = async (e) => {
      const patch = e?.detail || {};
      const next = { ...profile, ...patch, updated_at_client: new Date().toISOString() };
      setProfile(next);
      const me = userRef.current;
      if (!me?.id) return;
      if (profileIdRef.current) {
        await base44.entities.BatteryPerformanceProfile.update(profileIdRef.current, patch).catch(() => null);
      } else {
        const created = await base44.entities.BatteryPerformanceProfile.create({ user_id: me.id, ...DEFAULTS, ...patch, updated_at_client: new Date().toISOString() }).catch(() => null);
        if (created?.id) profileIdRef.current = created.id;
      }
      base44.entities.DriverLearningSignalV2.create({ user_id: me.id, signal_type: "manual_override", context: "performance_energy", feature: `mode:${patch.mode || next.mode}`, metadata_json: JSON.stringify({ selected: patch.mode || next.mode }), occurred_at: new Date().toISOString() }).catch(() => null);
    };
    window.addEventListener("lokin:set-performance-profile", onProfile);
    return () => window.removeEventListener("lokin:set-performance-profile", onProfile);
  }, [profile]);

  return null;
}
