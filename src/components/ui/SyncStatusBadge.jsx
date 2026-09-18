import { CheckCircle2, CloudUpload } from "lucide-react";
import { cn } from "@/lib/utils";

// Color-coded sync badge for offline-queued log rows: amber PENDING while a
// record is still waiting to upload, brand-green SYNCED once it's saved.
export default function SyncStatusBadge({ status, className = "" }) {
  const pending = status === "pending";
  const Icon = pending ? CloudUpload : CheckCircle2;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 font-heading text-[9px] font-bold uppercase tracking-[0.08em]",
        pending
          ? "border-[#FFD200]/60 bg-[#FFD200]/15 text-[#FFD200]"
          : "border-primary/40 bg-primary/10 text-primary",
        className
      )}
    >
      <Icon className="h-3 w-3" strokeWidth={2.4} />
      {pending ? "Pending" : "Synced"}
    </span>
  );
}