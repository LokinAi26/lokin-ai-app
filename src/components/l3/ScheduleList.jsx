import { useState } from "react";
import { base44 } from "@/api/base44Client";

export default function ScheduleList({ schedules, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState("");

  async function seed() {
    setBusy(true);
    try {
      await base44.functions.invoke("lokin-l3-dispatch", { action: "seed_schedules" });
      onChanged?.();
    } finally {
      setBusy(false);
    }
  }

  async function toggle(schedule) {
    setBusy(true);
    try {
      await base44.functions.invoke("lokin-l3-dispatch", {
        action: "toggle_schedule",
        schedule_id: schedule.id,
        enabled: !schedule.enabled,
      });
      onChanged?.();
    } finally {
      setBusy(false);
    }
  }

  if (!schedules.length) {
    return (
      <div className="rounded-3xl border border-dashed border-lokin-neon/40 bg-black/50 p-5 text-center">
        <div className="text-sm font-bold text-white/75">No recurring schedules yet</div>
        <div className="mt-1 text-[11px] leading-relaxed text-white/40">
          Seed the three design starters — morning briefing, daily cost reconciliation, weekly worker evals. Each records its owner, trigger, scope, output, verification, and stop rule.
        </div>
        <button onClick={seed} disabled={busy} className="mt-3 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-black active:scale-95">SEED STARTER SCHEDULES</button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {schedules.map((s) => {
        const open = openId === s.id;
        return (
          <div key={s.id} className="lokin-card p-3">
            <div className="flex items-center justify-between gap-3">
              <button className="min-w-0 flex-1 text-left" onClick={() => setOpenId(open ? "" : s.id)}>
                <div className="text-sm font-bold text-white">{s.name}</div>
                <div className="mt-0.5 truncate text-[10px] text-white/40">{s.owner} · {s.trigger}</div>
              </button>
              <button
                onClick={() => toggle(s)}
                disabled={busy}
                className={`min-h-11 shrink-0 rounded-full border px-3 text-[10px] font-extrabold tracking-[0.1em] active:scale-95 ${s.enabled ? "border-primary/60 bg-primary/10 text-primary" : "border-white/12 bg-white/[0.03] text-white/50"}`}
              >
                {s.enabled ? "ENABLED" : "OFF"}
              </button>
            </div>
            {open && (
              <div className="mt-2 grid gap-1 border-t border-white/8 pt-2 text-[11px]">
                <div className="text-white/60"><span className="lokin-kicker mr-1">SCOPE</span>{s.scope}</div>
                <div className="text-white/60"><span className="lokin-kicker mr-1">OUTPUT</span>{s.output}</div>
                <div className="text-white/60"><span className="lokin-kicker mr-1">VERIFY</span>{s.verification}</div>
                <div className="text-white/60"><span className="lokin-kicker mr-1">STOP</span>{s.stop_rule}</div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}