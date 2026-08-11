import { useEffect, useState } from "react";
import {
  ClipboardList, MapPin, Clock, Camera, Send, Check, Star,
  Utensils, ShoppingBag, FileText, Package, Sparkles, DollarSign,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

const TYPE_META = {
  mystery_shop: { label: "Mystery Shop", icon: ShoppingBag, color: "text-primary" },
  food_review: { label: "Food Review", icon: Utensils, color: "text-accent" },
  survey: { label: "Survey", icon: FileText, color: "text-primary" },
  product_test: { label: "Product Test", icon: Package, color: "text-accent" },
};

export default function GigTasks() {
  const { toast } = useToast();
  const [tab, setTab] = useState("available");
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [proofTask, setProofTask] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [photoUrl, setPhotoUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [rating, setRating] = useState(5);
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    base44.auth.me().then((u) => setUser(u)).catch(() => {});
    loadTasks();
  }, []);

  async function loadTasks() {
    setLoading(true);
    try {
      const all = await base44.entities.GigTask.list("-created_date", 50);
      setTasks(all);
    } catch (e) {
      toast({ title: "Failed to load gigs", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function claim(task) {
    try {
      const u = user || (await base44.auth.me());
      const updated = await base44.entities.GigTask.update(task.id, {
        status: "claimed",
        assigned_to_id: u.id,
        claimed_at: new Date().toISOString(),
      });
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
      toast({ title: "Task claimed!", description: "Find it in My Gigs to submit proof." });
      setTab("mine");
    } catch (e) {
      toast({ title: "Claim failed", description: e.message, variant: "destructive" });
    }
  }

  function openProof(task) {
    setProofTask(task);
    setPhoto(null);
    setPhotoUrl("");
    setNotes("");
    setRating(5);
  }

  function handlePhoto(e) {
    const f = e.target.files?.[0];
    if (f) {
      setPhoto(f);
      setPhotoUrl(URL.createObjectURL(f));
    }
  }

  async function submitProof() {
    if (!proofTask) return;
    if (!photo) {
      toast({ title: "Photo required", description: "Upload a proof photo to submit.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await base44.integrations.Core.UploadFile({ file: photo });
      const url = res.file_url;
      const noteText =
        proofTask.type === "food_review"
          ? `${notes}${rating ? ` | Rating: ${rating}/5` : ""}`
          : notes;
      const updated = await base44.entities.GigTask.update(proofTask.id, {
        status: "completed",
        proof_photo_url: url,
        proof_notes: noteText,
        submitted_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      });
      await base44.entities.Earning.create({
        date: new Date().toISOString().slice(0, 10),
        amount: proofTask.payout,
        trips: 1,
        miles: 0,
        platform: "lokin_gigs",
      });
      setTasks((prev) => prev.map((t) => (t.id === proofTask.id ? updated : t)));
      setProofTask(null);
      toast({ title: "Proof submitted!", description: `$${proofTask.payout} added to your earnings.` });
    } catch (e) {
      toast({ title: "Submit failed", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  const myTasks = tasks.filter((t) => t.assigned_to_id === user?.id);
  const availableTasks = tasks.filter((t) => t.status === "available");
  const filtered =
    tab === "available"
      ? filter === "all"
        ? availableTasks
        : availableTasks.filter((t) => t.type === filter)
      : myTasks;
  const earned = myTasks
    .filter((t) => t.status === "completed")
    .reduce((s, t) => s + (t.payout || 0), 0);
  const inProgress = myTasks.filter((t) => t.status === "claimed").length;

  return (
    <div className="p-4 space-y-4 pb-8">
      <div className="flex items-center gap-2">
        <ClipboardList className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold font-heading metal-text">Gig Opportunities</h1>
      </div>
      <p className="text-sm text-white/45 -mt-2">
        Get paid for mystery shopping, food reviews &amp; more — no car required.
      </p>

      <div className="rounded-3xl border border-primary/25 lokin-panel radial-fade p-4">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-white/45">Earned from Gigs</div>
            <div className="text-3xl font-bold font-display text-primary text-glow leading-none mt-1">
              ${earned.toFixed(2)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wider text-white/45">In Progress</div>
            <div className="text-2xl font-bold font-display text-white leading-none mt-1">{inProgress}</div>
          </div>
        </div>
      </div>

      <div className="flex rounded-2xl border border-white/10 bg-white/[0.03] p-1">
        <button
          onClick={() => setTab("available")}
          className={`flex-1 rounded-xl py-2 text-sm font-semibold transition-colors ${
            tab === "available" ? "bg-primary text-primary-foreground glow-primary" : "text-white/55"
          }`}
        >
          Available ({availableTasks.length})
        </button>
        <button
          onClick={() => setTab("mine")}
          className={`flex-1 rounded-xl py-2 text-sm font-semibold transition-colors ${
            tab === "mine" ? "bg-primary text-primary-foreground glow-primary" : "text-white/55"
          }`}
        >
          My Gigs ({myTasks.length})
        </button>
      </div>

      {tab === "available" && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {[
            { v: "all", l: "All" },
            ...Object.entries(TYPE_META).map(([v, m]) => ({ v, l: m.label })),
          ].map((f) => (
            <button
              key={f.v}
              onClick={() => setFilter(f.v)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
                filter === f.v
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-white/10 bg-white/[0.03] text-white/50"
              }`}
            >
              {f.l}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-white/40 text-sm">Loading gigs…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-white/40 text-sm">
          {tab === "available"
            ? "No gigs available right now. Check back soon!"
            : "You haven't claimed any gigs yet."}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((task) => {
            const meta = TYPE_META[task.type] || TYPE_META.mystery_shop;
            const Icon = meta.icon;
            return (
              <div key={task.id} className="rounded-3xl border border-white/10 lokin-panel p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                    <Icon className={`h-5 w-5 ${meta.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold text-sm text-white truncate">{task.title}</div>
                      <div className="text-sm font-bold text-primary shrink-0">${task.payout}</div>
                    </div>
                    <div className="text-xs text-white/45 mt-0.5">
                      {task.brand} · {meta.label}
                    </div>
                    {task.description && (
                      <p className="text-xs text-white/60 mt-1.5 line-clamp-2">{task.description}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-white/55">
                      {task.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-primary" />
                          {task.location}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-primary" />
                        {task.est_minutes || 30}m
                      </span>
                    </div>
                    {task.proof_required && (
                      <div className="mt-1.5 text-[11px] text-accent/70">Proof: {task.proof_required}</div>
                    )}
                  </div>
                </div>
                {tab === "available" ? (
                  <button
                    onClick={() => claim(task)}
                    className="mt-3 w-full rounded-2xl bg-primary text-primary-foreground py-2.5 text-sm font-bold glow-primary active:scale-[0.98] transition-transform"
                  >
                    Claim &amp; Earn ${task.payout}
                  </button>
                ) : task.status === "claimed" ? (
                  <button
                    onClick={() => openProof(task)}
                    className="mt-3 w-full rounded-2xl border border-primary/40 bg-primary/10 text-primary py-2.5 text-sm font-bold active:scale-[0.98] transition-transform"
                  >
                    Submit Proof
                  </button>
                ) : task.status === "completed" ? (
                  <div className="mt-3 flex items-center justify-center gap-1.5 rounded-2xl border border-primary/30 bg-primary/5 py-2.5 text-sm font-semibold text-primary">
                    <Check className="h-4 w-4" /> Completed · +${task.payout}
                  </div>
                ) : (
                  <div className="mt-3 text-center rounded-2xl border border-white/10 bg-white/[0.03] py-2.5 text-sm text-white/50 capitalize">
                    {task.status}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {proofTask && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => setProofTask(null)}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            className="relative w-full rounded-t-3xl border-t border-primary/30 lokin-panel p-5 pb-8 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto w-10 h-1 rounded-full bg-white/20 mb-4" />
            <div className="flex items-center gap-2 mb-1">
              <Camera className="h-4 w-4 text-primary" />
              <h2 className="text-lg font-bold font-heading text-white">Submit Proof</h2>
            </div>
            <p className="text-xs text-white/45 mb-4">
              {proofTask.title} · ${proofTask.payout}
            </p>

            {proofTask.proof_required && (
              <div className="rounded-xl border border-accent/30 bg-accent/5 p-3 mb-4 text-xs text-accent/80">
                Required: {proofTask.proof_required}
              </div>
            )}

            <label className="block cursor-pointer">
              <div className="text-xs font-semibold text-white/60 mb-1.5">Proof Photo</div>
              {photoUrl ? (
                <div className="relative rounded-2xl overflow-hidden border border-primary/30">
                  <img src={photoUrl} alt="proof" className="w-full h-40 object-cover" />
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1 text-[10px] text-white">
                    Tap to retake
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border-2 border-dashed border-white/15 bg-white/[0.02] p-6 text-center">
                  <Camera className="h-8 w-8 mx-auto text-white/30 mb-2" />
                  <div className="text-xs text-white/40">Tap to upload proof photo</div>
                </div>
              )}
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto} />
            </label>

            {proofTask.type === "food_review" && (
              <div className="mt-4">
                <div className="text-xs font-semibold text-white/60 mb-1.5">Your Rating</div>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button key={s} onClick={() => setRating(s)}>
                      <Star
                        className={`h-7 w-7 ${
                          s <= rating ? "fill-primary text-primary" : "text-white/25"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4">
              <div className="text-xs font-semibold text-white/60 mb-1.5">Notes</div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Share your experience..."
                rows={3}
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-white/30 resize-none"
              />
            </div>

            <button
              onClick={submitProof}
              disabled={submitting}
              className="mt-5 w-full rounded-2xl bg-primary text-primary-foreground py-3 text-sm font-bold glow-primary active:scale-[0.98] transition-transform disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {submitting ? (
                "Submitting…"
              ) : (
                <>
                  <Send className="h-4 w-4" /> Submit &amp; Earn ${proofTask.payout}
                </>
              )}
            </button>
            <button
              onClick={() => setProofTask(null)}
              className="mt-2 w-full rounded-2xl border border-white/10 py-2.5 text-sm text-white/50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}