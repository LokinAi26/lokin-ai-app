import { useState } from "react";
import { Link } from "react-router-dom";
import { LifeBuoy, Send, CheckCircle2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function SupportInfo() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await base44.functions.invoke("public-support-request", { email, message });
      setSent(true);
      setMessage("");
    } catch (err) {
      setError(err?.message || "Support request could not be submitted.");
    } finally { setBusy(false); }
  }

  return (
    <main className="min-h-screen bg-background text-foreground px-5 py-10">
      <div className="mx-auto max-w-xl space-y-5">
        <div className="flex items-center gap-3"><LifeBuoy className="h-7 w-7 text-primary" /><div><h1 className="text-2xl font-bold">LOKIN AI Support</h1><p className="text-sm text-muted-foreground">Public support contact</p></div></div>
        <p className="text-sm text-white/65">For app access, account, billing, privacy, safety, or technical questions, send a message below. Signed-in users can also use Adaptive AI Support inside LOKIN and request human follow-up when needed.</p>
        {sent ? (
          <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4 flex gap-3"><CheckCircle2 className="h-5 w-5 text-primary shrink-0"/><div><div className="font-semibold">Request received</div><div className="text-sm text-white/55">Your message has been added to the LOKIN support queue.</div></div></div>
        ) : (
          <form onSubmit={submit} className="space-y-3 rounded-3xl border border-white/10 lokin-panel p-4">
            <input type="email" required value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="Your email" className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm outline-none" />
            <textarea required rows={6} value={message} onChange={(e)=>setMessage(e.target.value)} placeholder="How can we help?" className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm outline-none resize-y" />
            {error && <div className="text-sm text-destructive">{error}</div>}
            <button disabled={busy} className="w-full rounded-xl bg-primary text-primary-foreground py-3 font-bold flex items-center justify-center gap-2 disabled:opacity-50"><Send className="h-4 w-4" />{busy ? "Sending…" : "Send support request"}</button>
          </form>
        )}
        <div className="flex flex-wrap gap-4 text-sm"><Link className="text-primary hover:underline" to="/privacy">Privacy Policy</Link><Link className="text-primary hover:underline" to="/terms">Terms of Use</Link><Link className="text-primary hover:underline" to="/login">Sign in</Link></div>
      </div>
    </main>
  );
}
