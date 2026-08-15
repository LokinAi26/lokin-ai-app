import { useEffect, useState } from "react";
import { ShieldCheck, ShieldX } from "lucide-react";
import { dispatchLokinCommand } from "@/lib/lokinCommandBus";
import { validateExternalCommand } from "@/lib/lokinCommandPolicy";
import { parseLokinUniversalLink } from "@/lib/lokinUniversalLink";
import { recordSecurityEvent, securityDecision } from "@/lib/lokinSecurityEngine";

export default function CommandIngress() {
  const [status, setStatus] = useState("validating");
  const [reason, setReason] = useState("");

  useEffect(() => {
    const parsed = parseLokinUniversalLink(window.location.href, window.location.hostname);
    if (!parsed.ok) { recordSecurityEvent({ accepted: false, reason: parsed.reason, source: "universal-link" }); setStatus("rejected"); setReason(parsed.reason); return; }
    const policy = validateExternalCommand(parsed.command, parsed.payload);
    if (!policy.ok) { recordSecurityEvent({ accepted: false, reason: policy.reason || "policy_rejected", source: parsed.source, command: parsed.command }); setStatus("rejected"); setReason(policy.reason || "policy_rejected"); return; }
    const adaptive = securityDecision({ command: parsed.command, confirmation: policy.policy.confirmation });
    if (!adaptive.allow) { recordSecurityEvent({ accepted: false, reason: adaptive.reason, source: parsed.source, command: parsed.command }); setStatus("rejected"); setReason(adaptive.reason); return; }
    recordSecurityEvent({ accepted: true, source: parsed.source, command: parsed.command });

    // Remove command data from the visible URL immediately to reduce accidental
    // replay, screenshots, analytics leakage, and copy/paste propagation.
    window.history.replaceState({}, "", "/");

    if (policy.policy.confirmation === "explicit" || adaptive.requireConfirmation) {
      window.dispatchEvent(new CustomEvent("lokin:external-confirmation", {
        detail: { command: parsed.command, payload: policy.payload, source: parsed.source, nonce: parsed.nonce },
      }));
      setStatus("confirmation");
      return;
    }

    dispatchLokinCommand(parsed.command, policy.payload, parsed.source);
    setStatus("accepted");
  }, []);

  const rejected = status === "rejected";
  return (
    <main className="min-h-screen bg-black text-white grid place-items-center p-6">
      <section className="w-full max-w-sm rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-center">
        {rejected ? <ShieldX className="mx-auto h-10 w-10 text-red-400" /> : <ShieldCheck className="mx-auto h-10 w-10 text-primary" />}
        <div className="mt-4 text-[10px] tracking-[0.22em] text-white/40">LOKIN SECURE COMMAND GATEWAY</div>
        <h1 className="mt-2 text-lg font-bold">{rejected ? "Link rejected" : status === "confirmation" ? "Confirmation required" : status === "accepted" ? "Command accepted" : "Validating…"}</h1>
        <p className="mt-2 text-xs text-white/45">{rejected ? `This link did not pass LOKIN validation (${reason}).` : "LOKIN validates the command before handing it to the Co-Pilot."}</p>
      </section>
    </main>
  );
}
