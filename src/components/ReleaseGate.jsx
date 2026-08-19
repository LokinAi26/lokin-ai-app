import { ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

export default function ReleaseGate({ title = "Coming after launch", body = "This regulated capability is preserved in LOKIN but is not enabled in the App Store 1.0 launch candidate." }) {
  return (
    <div className="min-h-[65dvh] p-6 flex items-center justify-center">
      <div className="w-full rounded-3xl border border-primary/20 lokin-panel p-6 text-center">
        <div className="mx-auto h-14 w-14 rounded-full border border-primary/30 bg-primary/10 flex items-center justify-center mb-4">
          <ShieldCheck className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-xl font-bold font-heading metal-text">{title}</h1>
        <p className="mt-2 text-sm text-white/55 leading-relaxed">{body}</p>
        <Link to="/more" className="mt-5 inline-flex rounded-2xl bg-primary text-primary-foreground px-5 py-2.5 text-sm font-bold">Back to LOKIN</Link>
      </div>
    </div>
  );
}
