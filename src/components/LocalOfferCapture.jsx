import { useState } from "react";
import { ChevronDown, ChevronUp, MapPinned, Plus, ShieldCheck } from "lucide-react";
import { base44 } from "@/api/base44Client";

const DEFAULT_FORM = {
  merchant: "",
  platform: "doordash",
  category: "food_pickup",
  payout: "",
  tip: "",
  miles: "",
  est_minutes: "",
  pickup_address: "",
  dropoff_address: "",
  expires_in_minutes: "90",
};

const PLATFORMS = [
  ["doordash", "DoorDash"],
  ["uber_eats", "Uber Eats"],
  ["instacart", "Instacart"],
  ["spark", "Spark"],
  ["shipt", "Shipt"],
  ["grubhub", "Grubhub"],
  ["amazon_flex", "Amazon Flex"],
  ["roadie", "Roadie"],
  ["other", "Other"],
];

const CATEGORIES = [
  ["food_pickup", "Food pickup"],
  ["grocery_shop_deliver", "Shop & deliver"],
  ["grocery_pickup", "Grocery pickup"],
  ["retail", "Retail"],
  ["package", "Package"],
  ["alcohol", "Alcohol"],
  ["pharmacy", "Pharmacy"],
];

function captureId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `offer-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function LocalOfferCapture({ onSaved }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function set(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const response = await base44.functions.invoke("ingest-local-offer", {
        ...form,
        payout: Number(form.payout),
        tip: form.tip === "" ? 0 : Number(form.tip),
        miles: Number(form.miles),
        est_minutes: Number(form.est_minutes),
        expires_in_minutes: Number(form.expires_in_minutes),
        source_type: "user_entered",
        capture_id: captureId(),
      });
      const offer = response.data?.offer;
      if (!offer?.id) throw new Error("Offer verification returned no saved record");
      setSuccess(`${offer.merchant} verified for ${offer.region || "Virginia"} and added to the live feed.`);
      setForm(DEFAULT_FORM);
      onSaved?.(offer);
    } catch (nextError) {
      setError(nextError?.response?.data?.error || nextError?.message || "Could not verify this Virginia offer");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-3xl border border-accent/20 bg-accent/[0.04] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-accent/30 bg-black text-accent">
          <MapPinned className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-white">Add Current Virginia Offer</div>
          <div className="text-[11px] text-white/45">Address-verify an offer you can currently see in your delivery app.</div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-white/40" /> : <ChevronDown className="h-4 w-4 text-white/40" />}
      </button>

      {open && (
        <form onSubmit={submit} className="space-y-3 border-t border-white/10 px-4 py-4">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Merchant">
              <input required value={form.merchant} onChange={(event) => set("merchant", event.target.value)} placeholder="Restaurant/store" className="input" />
            </Field>
            <Field label="Platform">
              <select value={form.platform} onChange={(event) => set("platform", event.target.value)} className="input">
                {PLATFORMS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Category">
            <select value={form.category} onChange={(event) => set("category", event.target.value)} className="input">
              {CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Payout">
              <input required inputMode="decimal" value={form.payout} onChange={(event) => set("payout", event.target.value)} placeholder="$0.00" className="input" />
            </Field>
            <Field label="Tip shown">
              <input inputMode="decimal" value={form.tip} onChange={(event) => set("tip", event.target.value)} placeholder="$0.00" className="input" />
            </Field>
            <Field label="Total miles">
              <input required inputMode="decimal" value={form.miles} onChange={(event) => set("miles", event.target.value)} placeholder="0.0" className="input" />
            </Field>
            <Field label="Estimated minutes">
              <input required inputMode="numeric" value={form.est_minutes} onChange={(event) => set("est_minutes", event.target.value)} placeholder="25" className="input" />
            </Field>
          </div>

          <Field label="Virginia pickup address">
            <input required value={form.pickup_address} onChange={(event) => set("pickup_address", event.target.value)} placeholder="Street, city, VA ZIP" className="input" />
          </Field>
          <Field label="Virginia drop-off address">
            <input required value={form.dropoff_address} onChange={(event) => set("dropoff_address", event.target.value)} placeholder="Street, city, VA ZIP" className="input" />
          </Field>

          <Field label="Offer expires">
            <select value={form.expires_in_minutes} onChange={(event) => set("expires_in_minutes", event.target.value)} className="input">
              <option value="30">30 minutes</option>
              <option value="60">1 hour</option>
              <option value="90">90 minutes</option>
              <option value="120">2 hours</option>
              <option value="240">4 hours</option>
            </select>
          </Field>

          <div className="flex items-start gap-2 rounded-2xl border border-white/10 bg-black/35 p-3 text-[10px] leading-relaxed text-white/45">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            LOKIN verifies both addresses are in Virginia. Platform availability and payout remain user-reported unless an authorized official API supplies them.
          </div>

          {error && <div className="text-xs text-red-300">{error}</div>}
          {success && <div className="text-xs text-primary">{success}</div>}

          <button
            type="submit"
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-black text-black disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {saving ? "VERIFYING VIRGINIA OFFER…" : "VERIFY & ADD TO LOKIN"}
          </button>
        </form>
      )}

      <style>{`
        .input {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid rgba(255,255,255,.1);
          background: rgba(255,255,255,.035);
          padding: .65rem .75rem;
          color: white;
          font-size: .78rem;
          outline: none;
        }
        .input:focus { border-color: rgba(170,255,0,.5); }
        .input option { background: #080a0c; color: white; }
      `}</style>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-white/40">{label}</span>
      {children}
    </label>
  );
}
