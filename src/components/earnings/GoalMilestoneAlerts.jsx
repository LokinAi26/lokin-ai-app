import { useEffect, useRef } from "react";
import { useToast } from "@/components/ui/use-toast";
import { useDriverPrefs } from "@/context/DriverPrefsContext";
import { useEarnings } from "@/context/EarningsContext";

// Goal-milestone alerts: watches today's logged earnings in real time and
// notifies the driver when they cross 80% and 100% of their daily goal.
// Reads the shared prefs and earnings state (single app-level fetch each) —
// no per-component GETs or subscriptions.
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
  const { prefs } = useDriverPrefs();
  const { earnings } = useEarnings();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const goalRef = useRef(null);
  const earnedRef = useRef(null);

  useEffect(() => {
    goalRef.current = prefs?.daily_goal || 150;
  }, [prefs?.daily_goal]);

  useEffect(() => {
    const goal = goalRef.current;
    if (!goal || goal <= 0) return;
    const today = dayKey(new Date());
    const earned = earnings
      .filter((r) => r.date === today)
      .reduce((sum, r) => sum + (r.amount || 0), 0);
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
  }, [earnings]);

  return null;
}