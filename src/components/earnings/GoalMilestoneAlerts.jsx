import { useEffect, useRef } from "react";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";

// Goal-milestone alerts: watches today's logged earnings in real time and
// notifies the driver when they cross 80% and 100% of their daily goal.
// Returns nothing — purely a notification listener.

const MILESTONES = [
  {
    level: "80",
    fraction: 0.8,
    title: "80% of your daily goal",
    describe: (earned, goal) => `$${earned.toFixed(2)} earned · $${(goal - earned).toFixed(2)} to go. Keep it rolling.`,
  },
  {
    level: "100",
    fraction: 1,
    title: "Daily goal reached",
    describe: (earned) => `$${earned.toFixed(2)} earned today. Everything from here is bonus.`,
  },
];

function dayKey(d) {
  return d.toISOString().slice(0, 10);
}

export default function GoalMilestoneAlerts() {
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const goalRef = useRef(null);
  const earnedRef = useRef(null);

  useEffect(() => {
    let alive = true;

    async function computeEarned() {
      const today = dayKey(new Date());
      const records = await base44.entities.Earning.filter({ date: today });
      return records.reduce((sum, r) => sum + (r.amount || 0), 0);
    }

    function evaluate(earned) {
      const goal = goalRef.current;
      if (!goal || goal <= 0) return;
      const previous = earnedRef.current;
      earnedRef.current = earned;
      // First computation is the baseline: never alert for thresholds already
      // passed before the app started watching.
      if (previous == null) return;
      MILESTONES.forEach((m) => {
        const target = goal * m.fraction;
        if (earned >= target && previous < target) {
          toastRef.current({
            title: m.title,
            description: m.describe(earned, goal),
            duration: 9000,
          });
        }
      });
    }

    async function refresh() {
      try {
        const earned = await computeEarned();
        if (alive) evaluate(earned);
      } catch {
        // Earnings lookups are best-effort; the next event retries.
      }
    }

    (async () => {
      try {
        const prefs = await base44.entities.DriverPreference.filter({});
        goalRef.current = prefs[0]?.daily_goal || 150;
      } catch {
        goalRef.current = 150;
      }
      await refresh();
    })();

    const unsubscribe = base44.entities.Earning.subscribe(() => refresh());
    return () => {
      alive = false;
      unsubscribe?.();
    };
  }, []);

  return null;
}